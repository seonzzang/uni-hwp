import type { CommandServices } from '@/command/types';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import { PrintProgressOverlay } from '@/ui/print-progress-overlay';

const DEFAULT_SVG_BATCH_SIZE = 50;
const DEFAULT_DOM_INSERT_BATCH_SIZE = 50;

type LegacyPrintParams = {
  startPage?: number;
  endPage?: number;
  samplePageLimit?: number;
};

export async function runLegacyPrintPreview(
  services: CommandServices,
  params?: LegacyPrintParams,
): Promise<void> {
  const wasm = services.wasm;
  const pageCount = wasm.pageCount;
  const startPage = Math.max(1, Math.min(pageCount, Math.floor(params?.startPage ?? 1)));
  const endPage = Math.max(startPage, Math.min(pageCount, Math.floor(params?.endPage ?? pageCount)));
  const targetPageIndexes = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage - 1 + index,
  );
  const samplePageLimit = typeof params?.samplePageLimit === 'number'
    ? Math.max(1, Math.min(targetPageIndexes.length, Math.floor(params.samplePageLimit)))
    : undefined;
  const renderPageIndexes = samplePageLimit === undefined
    ? targetPageIndexes
    : targetPageIndexes.slice(0, samplePageLimit);
  const traceId = `print-svg:${Date.now()}`;

  if (pageCount === 0) return;

  const statusEl = document.getElementById('sb-message');
  const origStatus = statusEl?.innerHTML || '';
  const printOverlay = new PrintProgressOverlay();
  const abortSignal = printOverlay.show('인쇄 준비 중');

  try {
    console.time(`[${traceId}] svg.generate`);
    console.log('[Print Baseline] start', {
      totalPageCount: pageCount,
      selectedStartPage: startPage,
      selectedEndPage: endPage,
      renderPageCount: renderPageIndexes.length,
      sampled: samplePageLimit !== undefined,
      batchSize: DEFAULT_SVG_BATCH_SIZE,
    });
    const svgPages = await generateSvgPagesInBatches({
      wasm,
      pageIndexes: renderPageIndexes,
      batchSize: DEFAULT_SVG_BATCH_SIZE,
      abortSignal,
      onProgress: (processedPages, totalPages, batchIndex, batchStart, batchEnd) => {
        if (statusEl) {
          statusEl.textContent = `인쇄 준비 중... (${processedPages}/${totalPages})`;
        }
        printOverlay.updateProgress(
          processedPages,
          totalPages,
          `정확한 인쇄 미리보기를 위해 SVG 페이지를 생성하고 있습니다... (배치 ${batchIndex}, ${batchStart}-${batchEnd}페이지)`,
        );
      },
    });
    console.timeEnd(`[${traceId}] svg.generate`);

    const pageInfo = wasm.getPageInfo(renderPageIndexes[0] ?? 0);
    const widthMm = Math.round(pageInfo.width * 25.4 / 96);
    const heightMm = Math.round(pageInfo.height * 25.4 / 96);

    await printSvgPages(wasm.fileName, widthMm, heightMm, svgPages, traceId);

    if (statusEl) statusEl.innerHTML = origStatus;
    printOverlay.hide();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[file:print:legacy]', msg);
    if (statusEl) statusEl.textContent = `인쇄 실패: ${msg}`;
    printOverlay.hide();
    throw err;
  }
}

async function printSvgPages(
  fileName: string,
  widthMm: number,
  heightMm: number,
  svgPages: string[],
  traceId = `print-svg:${Date.now()}`,
): Promise<void> {
  const printRoot = document.createElement('div');
  const printStyle = document.createElement('style');
  const cleanupDelayMs = 1200;

  const cleanup = () => {
    document.body.removeAttribute('data-printing');
    printRoot.remove();
    printStyle.remove();
    window.removeEventListener('afterprint', handleAfterPrint);
  };

  let resolvePrint!: () => void;
  let rejectPrint!: (error: Error) => void;
  const completion = new Promise<void>((resolve, reject) => {
    resolvePrint = resolve;
    rejectPrint = reject;
  });

  const handleAfterPrint = () => {
    cleanup();
    resolvePrint();
  };

  printRoot.id = 'tauri-print-root';
  printRoot.setAttribute('aria-hidden', 'true');

  const printShell = document.createElement('div');
  printShell.className = 'tauri-print-shell';

  console.time(`[${traceId}] dom.insert`);
  for (let start = 0; start < svgPages.length; start += DEFAULT_DOM_INSERT_BATCH_SIZE) {
    const end = Math.min(start + DEFAULT_DOM_INSERT_BATCH_SIZE, svgPages.length);
    const fragment = document.createDocumentFragment();

    for (let index = start; index < end; index += 1) {
      const page = document.createElement('div');
      page.className = 'tauri-print-page';
      page.innerHTML = svgPages[index];
      fragment.appendChild(page);
    }

    printShell.appendChild(fragment);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  printRoot.appendChild(printShell);
  console.timeEnd(`[${traceId}] dom.insert`);

  printStyle.textContent = `
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
body[data-printing="true"] > :not(#tauri-print-root):not(script):not(style) {
  display: none !important;
}
#tauri-print-root {
  display: none;
}
body[data-printing="true"] {
  margin: 0 !important;
  padding: 0 !important;
  background: #fff !important;
}
.tauri-print-shell {
  background: #fff;
}
.tauri-print-page {
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
}
.tauri-print-page:last-child {
  break-after: auto;
  page-break-after: auto;
}
.tauri-print-page svg {
  display: block;
  width: 100%;
  height: 100%;
}
@media print {
  body[data-printing="true"] #tauri-print-root {
    display: block;
  }
}
`;

  try {
    console.time(`[${traceId}] dom.attach`);
    document.head.appendChild(printStyle);
    document.body.appendChild(printRoot);
    document.body.setAttribute('data-printing', 'true');
    window.addEventListener('afterprint', handleAfterPrint, { once: true });
    console.timeEnd(`[${traceId}] dom.attach`);

    setTimeout(() => {
      void (async () => {
        try {
          console.time(`[${traceId}] layout.waitBeforePrint`);
          await waitForPrintLayout();
          console.timeEnd(`[${traceId}] layout.waitBeforePrint`);
          console.time(`[${traceId}] window.print`);
          window.focus();
          await Promise.resolve(window.print());
          console.timeEnd(`[${traceId}] window.print`);
          setTimeout(() => {
            if (document.body.contains(printRoot)) {
              cleanup();
              resolvePrint();
            }
          }, cleanupDelayMs);
        } catch (error) {
          cleanup();
          rejectPrint(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    }, 100);
  } catch (error) {
    cleanup();
    rejectPrint(error instanceof Error ? error : new Error(String(error)));
  }

  return completion;
}

async function waitForPrintLayout(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function generateSvgPagesInBatches(params: {
  wasm: UniHwpEngine;
  pageIndexes: number[];
  batchSize: number;
  abortSignal: AbortSignal;
  onProgress?: (
    processedPages: number,
    totalPages: number,
    batchIndex: number,
    batchStartPage: number,
    batchEndPage: number,
  ) => void;
}): Promise<string[]> {
  const {
    wasm,
    pageIndexes,
    batchSize,
    abortSignal,
    onProgress,
  } = params;

  const svgPages: string[] = [];
  let processedPages = 0;
  let batchIndex = 0;
  const totalPages = pageIndexes.length;

  for (let start = 0; start < pageIndexes.length; start += batchSize) {
    if (abortSignal.aborted) {
      throw new Error('인쇄 준비가 취소되었습니다.');
    }

    batchIndex += 1;
    const end = Math.min(start + batchSize, pageIndexes.length);
    for (let offset = start; offset < end; offset += 1) {
      if (abortSignal.aborted) {
        throw new Error('인쇄 준비가 취소되었습니다.');
      }

      svgPages.push(wasm.renderPageSvg(pageIndexes[offset]));
      processedPages += 1;
    }

    const batchStartPage = pageIndexes[start] + 1;
    const batchEndPage = pageIndexes[end - 1] + 1;
    onProgress?.(processedPages, totalPages, batchIndex, batchStartPage, batchEndPage);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return svgPages;
}
