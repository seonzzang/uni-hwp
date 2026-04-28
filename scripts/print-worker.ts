import { createInterface } from 'node:readline';
import { access, appendFile, readFile, unlink, writeFile } from 'node:fs/promises';
import { stdin, stdout, stderr } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  PrintJobProgress,
  PrintJobRequest,
  PrintJobResult,
  PrintWorkerMessage,
} from '../rhwp-studio/src/print/worker-types.ts';

function writeMessage(message: PrintWorkerMessage): void {
  stdout.write(`${JSON.stringify(message)}\n`);
}

function writeProgress(progress: PrintJobProgress): void {
  writeMessage({
    type: 'progress',
    progress,
  });
}

function writeResult(result: PrintJobResult): void {
  writeMessage({
    type: 'result',
    result,
  });
}

async function appendAnalysisLog(request: PrintJobRequest, message: string, details: Record<string, unknown> = {}): Promise<void> {
  const logPath = resolve(request.tempDir, 'print-worker-analysis.log');
  const payload = {
    at: new Date().toISOString(),
    elapsedMs: Date.now() - analysisStartedAt,
    jobId: request.jobId,
    message,
    ...details,
  };

  await appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf8').catch(() => undefined);
}

let analysisStartedAt = Date.now();

class PrintJobCancelledError extends Error {
  constructor() {
    super('PDF 생성이 취소되었습니다.');
    this.name = 'PrintJobCancelledError';
  }
}

function getCancelRequestPath(request: PrintJobRequest): string {
  return resolve(request.tempDir, 'print-worker-cancel.request');
}

async function throwIfCancelled(request: PrintJobRequest): Promise<void> {
  try {
    await access(getCancelRequestPath(request), fsConstants.F_OK);
    await appendAnalysisLog(request, 'pdf job cancel requested');
    throw new PrintJobCancelledError();
  } catch (error) {
    if (error instanceof PrintJobCancelledError) {
      throw error;
    }
  }
}

function getWorkspaceRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '..');
}

async function loadPuppeteerCore(): Promise<typeof import('puppeteer-core')> {
  const modulePath = resolve(
    getWorkspaceRoot(),
    'rhwp-studio',
    'node_modules',
    'puppeteer-core',
    'lib',
    'esm',
    'puppeteer',
    'puppeteer-core.js',
  );

  return import(pathToFileURL(modulePath).href);
}

async function loadPdfLib(): Promise<typeof import('pdf-lib')> {
  const modulePath = resolve(
    getWorkspaceRoot(),
    'rhwp-studio',
    'node_modules',
    'pdf-lib',
    'cjs',
    'index.js',
  );

  return import(pathToFileURL(modulePath).href);
}

async function getBrowserExecutableCandidates(): Promise<string[]> {
  const configuredPath = process.env.UNI_HWP_PUPPETEER_EXECUTABLE_PATH
    ?? process.env.BBDG_PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    configuredPath,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter((value): value is string => Boolean(value));

  const resolved: string[] = [];

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      resolved.push(candidate);
    } catch {
      // 다음 후보 검사
    }
  }

  return resolved;
}

async function handleJob(request: PrintJobRequest): Promise<void> {
  const startedAt = Date.now();

  writeProgress({
    jobId: request.jobId,
    phase: 'spawned',
    completedPages: 0,
    totalPages: request.pageCount,
    batchIndex: 0,
    message: `Print worker spawned for ${request.sourceFileName}`,
  });

  writeProgress({
    jobId: request.jobId,
    phase: 'loading',
    completedPages: 0,
    totalPages: request.pageCount,
    batchIndex: 0,
    message: `Echo worker received ${request.svgPagePaths.length} svg paths`,
  });

  if (request.debugDelayMs && request.debugDelayMs > 0) {
    await sleep(request.debugDelayMs);
  }

  const completedPages = Math.min(request.batchSize, request.pageCount);
  writeProgress({
    jobId: request.jobId,
    phase: 'rendering-batch',
    completedPages,
    totalPages: request.pageCount,
    batchIndex: 1,
    message: `Echo batch processed ${completedPages} pages`,
  });

  writeResult({
    jobId: request.jobId,
    ok: true,
    outputPdfPath: request.outputPdfPath,
    durationMs: Date.now() - startedAt,
  });
}

function buildPdfHtmlDocument(
  request: PrintJobRequest,
  svgMarkupPages: string[],
): string {
  const pageWidth = request.pageSize.widthPx;
  const pageHeight = request.pageSize.heightPx;
  const pageSections = svgMarkupPages
    .map((svgMarkup) => `<section class="page">${svgMarkup}</section>`)
    .join('\n');

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      @page {
        size: ${pageWidth}px ${pageHeight}px;
        margin: 0;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: white;
      }
      body {
        width: ${pageWidth}px;
      }
      .page {
        width: ${pageWidth}px;
        height: ${pageHeight}px;
        break-after: page;
        page-break-after: always;
        overflow: hidden;
      }
      .page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .page > svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    ${pageSections}
  </body>
</html>`;
}

function getWorkerChunkSize(totalPages: number): number {
  if (totalPages >= 500) return 100;
  if (totalPages >= 200) return 100;
  return totalPages;
}

async function launchBrowserForJob(): Promise<{
  browser: import('puppeteer-core').Browser;
  executablePath: string;
}> {
  const executableCandidates = await getBrowserExecutableCandidates();
  if (executableCandidates.length === 0) {
    throw new Error('사용 가능한 Chromium/Edge/Chrome 실행 파일을 찾지 못했습니다.');
  }

  const puppeteer = await loadPuppeteerCore();
  let lastError: unknown = null;

  for (const executablePath of executableCandidates) {
    try {
      const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
        ],
      });

      return { browser, executablePath };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('사용 가능한 브라우저 실행 파일을 찾았지만 모두 launch에 실패했습니다.');
}

async function handlePdfJob(request: PrintJobRequest): Promise<void> {
  analysisStartedAt = Date.now();
  const startedAt = Date.now();
  const totalPages = request.svgPagePaths.length;
  const batchSize = Math.max(1, request.batchSize);
  const svgMarkupPages: string[] = [];
  const workerChunkSize = Math.max(1, getWorkerChunkSize(totalPages));
  const chunkPdfPaths: string[] = [];
  await appendAnalysisLog(request, 'pdf job started', {
    totalPages,
    batchSize,
    workerChunkSize,
    outputPdfPath: request.outputPdfPath,
  });
  await throwIfCancelled(request);

  writeProgress({
    jobId: request.jobId,
    phase: 'spawned',
    completedPages: 0,
    totalPages,
    batchIndex: 0,
    message: `PDF worker spawned for ${request.sourceFileName}`,
  });

  await appendAnalysisLog(request, 'launching browser');
  await throwIfCancelled(request);
  const browserStartedAt = Date.now();
  const { browser, executablePath } = await launchBrowserForJob();
  await appendAnalysisLog(request, 'browser launched', {
    executablePath,
    browserLaunchMs: Date.now() - browserStartedAt,
  });
  try {
    writeProgress({
      jobId: request.jobId,
      phase: 'loading',
      completedPages: 0,
      totalPages,
      batchIndex: 0,
      message: `Browser ready: ${executablePath}`,
    });

    const svgReadStartedAt = Date.now();
    for (let start = 0; start < totalPages; start += batchSize) {
      await throwIfCancelled(request);
      const batchPaths = request.svgPagePaths.slice(start, start + batchSize);
      const batchSvgMarkup = await Promise.all(
        batchPaths.map((path) => readFile(path, 'utf8')),
      );
      svgMarkupPages.push(...batchSvgMarkup);

      const completedPages = Math.min(start + batchPaths.length, totalPages);
      writeProgress({
        jobId: request.jobId,
        phase: 'rendering-batch',
        completedPages,
        totalPages,
        batchIndex: Math.floor(start / batchSize) + 1,
        message: `Loaded ${completedPages}/${totalPages} SVG pages`,
      });
      await appendAnalysisLog(request, 'svg batch loaded', {
        completedPages,
        totalPages,
        batchIndex: Math.floor(start / batchSize) + 1,
        batchReadMs: Date.now() - svgReadStartedAt,
        loadedSvgChars: svgMarkupPages.reduce((total, svg) => total + svg.length, 0),
      });

      if (request.debugDelayMs && request.debugDelayMs > 0) {
        await sleep(request.debugDelayMs);
      }
    }
    await throwIfCancelled(request);
    await appendAnalysisLog(request, 'all svg pages loaded', {
      readAllSvgMs: Date.now() - svgReadStartedAt,
      svgCount: svgMarkupPages.length,
      totalSvgChars: svgMarkupPages.reduce((total, svg) => total + svg.length, 0),
    });

    const pageStartedAt = Date.now();
    await throwIfCancelled(request);
    const page = await browser.newPage();
    await appendAnalysisLog(request, 'browser page created', {
      newPageMs: Date.now() - pageStartedAt,
    });
    await page.setViewport({
      width: request.pageSize.widthPx,
      height: request.pageSize.heightPx,
      deviceScaleFactor: 1,
    });

    const totalChunkCount = Math.ceil(totalPages / workerChunkSize);
    for (let chunkStart = 0; chunkStart < totalPages; chunkStart += workerChunkSize) {
      await throwIfCancelled(request);
      const chunkIndex = Math.floor(chunkStart / workerChunkSize);
      const chunkPages = svgMarkupPages.slice(chunkStart, chunkStart + workerChunkSize);
      const chunkStartPage = chunkStart + 1;
      const chunkEndPage = chunkStart + chunkPages.length;
      const chunkPdfPath = resolve(
        request.tempDir,
        `chunk-${String(chunkIndex + 1).padStart(4, '0')}.pdf`,
      );

      await appendAnalysisLog(request, 'building html document chunk', {
        chunkIndex: chunkIndex + 1,
        totalChunkCount,
        chunkStartPage,
        chunkEndPage,
        chunkPageCount: chunkPages.length,
      });
      const htmlStartedAt = Date.now();
      const htmlDocument = buildPdfHtmlDocument(request, chunkPages);
      await appendAnalysisLog(request, 'html document chunk built', {
        chunkIndex: chunkIndex + 1,
        totalChunkCount,
        chunkStartPage,
        chunkEndPage,
        htmlBuildMs: Date.now() - htmlStartedAt,
        htmlChars: htmlDocument.length,
        approxHtmlBytes: htmlDocument.length * 2,
      });

      await appendAnalysisLog(request, 'page.setContent chunk started', {
        chunkIndex: chunkIndex + 1,
        totalChunkCount,
        chunkStartPage,
        chunkEndPage,
      });
      const setContentStartedAt = Date.now();
      await throwIfCancelled(request);
      await page.setContent(htmlDocument, {
        waitUntil: 'load',
        timeout: 300_000,
      });
      await appendAnalysisLog(request, 'page.setContent chunk finished', {
        chunkIndex: chunkIndex + 1,
        totalChunkCount,
        chunkStartPage,
        chunkEndPage,
        setContentMs: Date.now() - setContentStartedAt,
      });

      writeProgress({
        jobId: request.jobId,
        phase: 'writing-pdf',
        completedPages: chunkEndPage,
        totalPages,
        batchIndex: chunkIndex + 1,
        message: `PDF 청크 생성 중... (${chunkStartPage}-${chunkEndPage}페이지)`,
      });

      await appendAnalysisLog(request, 'page.pdf chunk started', {
        chunkIndex: chunkIndex + 1,
        totalChunkCount,
        chunkStartPage,
        chunkEndPage,
        chunkPdfPath,
      });
      const pdfStartedAt = Date.now();
      await throwIfCancelled(request);
      await page.pdf({
        path: chunkPdfPath,
        width: `${request.pageSize.widthPx}px`,
        height: `${request.pageSize.heightPx}px`,
        margin: {
          top: '0px',
          right: '0px',
          bottom: '0px',
          left: '0px',
        },
        printBackground: true,
        preferCSSPageSize: true,
      });
      chunkPdfPaths.push(chunkPdfPath);
      await appendAnalysisLog(request, 'page.pdf chunk finished', {
        chunkIndex: chunkIndex + 1,
        totalChunkCount,
        chunkStartPage,
        chunkEndPage,
        pdfWriteMs: Date.now() - pdfStartedAt,
        chunkPdfPath,
      });
    }

    await throwIfCancelled(request);
    await page.close();
    await appendAnalysisLog(request, 'browser page closed after chunk rendering', {
      totalChunkCount,
      durationMs: Date.now() - startedAt,
    });

    writeProgress({
      jobId: request.jobId,
      phase: 'writing-pdf',
      completedPages: totalPages,
      totalPages,
      batchIndex: totalChunkCount,
      message: `PDF 병합 중... (${chunkPdfPaths.length}개 청크)`,
    });

    const mergeStartedAt = Date.now();
    await appendAnalysisLog(request, 'pdf merge started', {
      chunkCount: chunkPdfPaths.length,
    });
    const { PDFDocument } = await loadPdfLib();
    const mergedDocument = await PDFDocument.create();
    for (const [chunkIndex, chunkPdfPath] of chunkPdfPaths.entries()) {
      await throwIfCancelled(request);
      const mergeChunkStartedAt = Date.now();
      await appendAnalysisLog(request, 'pdf merge chunk started', {
        chunkIndex: chunkIndex + 1,
        chunkCount: chunkPdfPaths.length,
        chunkPdfPath,
      });
      const chunkBytes = await readFile(chunkPdfPath);
      await throwIfCancelled(request);
      await appendAnalysisLog(request, 'pdf merge chunk read', {
        chunkIndex: chunkIndex + 1,
        readMs: Date.now() - mergeChunkStartedAt,
        chunkBytes: chunkBytes.length,
      });
      const loadStartedAt = Date.now();
      const chunkDocument = await PDFDocument.load(chunkBytes);
      await throwIfCancelled(request);
      await appendAnalysisLog(request, 'pdf merge chunk loaded', {
        chunkIndex: chunkIndex + 1,
        loadMs: Date.now() - loadStartedAt,
        pageCount: chunkDocument.getPageCount(),
      });
      const copyStartedAt = Date.now();
      const copiedPages = await mergedDocument.copyPages(chunkDocument, chunkDocument.getPageIndices());
      await throwIfCancelled(request);
      await appendAnalysisLog(request, 'pdf merge chunk copied', {
        chunkIndex: chunkIndex + 1,
        copyMs: Date.now() - copyStartedAt,
        copiedPageCount: copiedPages.length,
      });
      for (const copiedPage of copiedPages) {
        mergedDocument.addPage(copiedPage);
      }
      await appendAnalysisLog(request, 'pdf merge chunk appended', {
        chunkIndex: chunkIndex + 1,
        chunkElapsedMs: Date.now() - mergeChunkStartedAt,
        mergedPageCount: mergedDocument.getPageCount(),
      });
    }

    await throwIfCancelled(request);
    await appendAnalysisLog(request, 'pdf merge save started', {
      pageCount: mergedDocument.getPageCount(),
    });
    const saveStartedAt = Date.now();
    const mergedBytes = await mergedDocument.save();
    await throwIfCancelled(request);
    await appendAnalysisLog(request, 'pdf merge save finished', {
      saveMs: Date.now() - saveStartedAt,
      mergedBytes: mergedBytes.length,
    });
    await writeFile(request.outputPdfPath, mergedBytes);
    await appendAnalysisLog(request, 'pdf merge finished', {
      mergeMs: Date.now() - mergeStartedAt,
      outputPdfPath: request.outputPdfPath,
      mergedBytes: mergedBytes.length,
    });

    for (const chunkPdfPath of chunkPdfPaths) {
      await unlink(chunkPdfPath).catch(() => undefined);
    }
    await appendAnalysisLog(request, 'chunk pdf cleanup finished', {
      chunkCount: chunkPdfPaths.length,
    });

    writeResult({
      jobId: request.jobId,
      ok: true,
      outputPdfPath: request.outputPdfPath,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cancelled = error instanceof PrintJobCancelledError;
    await appendAnalysisLog(request, 'pdf job failed', {
      errorMessage: message,
      cancelled,
      durationMs: Date.now() - startedAt,
    });
    writeResult({
      jobId: request.jobId,
      ok: false,
      outputPdfPath: request.outputPdfPath,
      durationMs: Date.now() - startedAt,
      errorCode: cancelled ? 'CANCELLED' : 'PDF_EXPORT_FAILED',
      errorMessage: message,
    });
  } finally {
    await browser.close().catch(() => undefined);
    await appendAnalysisLog(request, 'browser closed', {
      durationMs: Date.now() - startedAt,
    });
  }
}

async function handleProbeJob(): Promise<void> {
  const startedAt = Date.now();
  const jobId = 'puppeteer-runtime-probe';

  writeProgress({
    jobId,
    phase: 'spawned',
    completedPages: 0,
    totalPages: 0,
    batchIndex: 0,
    message: 'Puppeteer runtime probe started',
  });

  const executableCandidates = await getBrowserExecutableCandidates();
  if (executableCandidates.length === 0) {
    writeResult({
      jobId,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorCode: 'BROWSER_NOT_FOUND',
      errorMessage: '사용 가능한 Chromium/Edge/Chrome 실행 파일을 찾지 못했습니다.',
    });
    return;
  }

  writeProgress({
    jobId,
    phase: 'loading',
    completedPages: 0,
    totalPages: 0,
    batchIndex: 0,
    message: `Browser executable candidates: ${executableCandidates.join(' | ')}`,
  });

  let browser: import('puppeteer-core').Browser | null = null;
  try {
    const launched = await launchBrowserForJob();
    browser = launched.browser;

    const page = await browser.newPage();
    await page.goto('about:blank');

    writeProgress({
      jobId,
      phase: 'completed',
      completedPages: 0,
      totalPages: 0,
      batchIndex: 0,
      message: `Puppeteer runtime ready with ${launched.executablePath}`,
    });

    writeResult({
      jobId,
      ok: true,
      outputPdfPath: launched.executablePath,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeResult({
      jobId,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorCode: 'PUPPETEER_LAUNCH_FAILED',
      errorMessage: message,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

async function loadRequestFromManifest(manifestPath: string): Promise<PrintJobRequest> {
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as PrintJobRequest;
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === '--probe-browser') {
    await handleProbeJob();
    return;
  }

  if (mode === '--generate-pdf') {
    const manifestPath = process.argv[3];
    if (!manifestPath) {
      writeResult({
        jobId: 'unknown',
        ok: false,
        durationMs: 0,
        errorCode: 'WORKER_MANIFEST_ERROR',
        errorMessage: 'PDF mode requires a manifest path argument.',
      });
      return;
    }

    try {
      const request = await loadRequestFromManifest(manifestPath);
      await handlePdfJob(request);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`[print-worker] ${message}\n`);
      writeResult({
        jobId: 'unknown',
        ok: false,
        durationMs: 0,
        errorCode: 'WORKER_MANIFEST_ERROR',
        errorMessage: message,
      });
      return;
    }
  }

  const manifestPath = mode;
  if (manifestPath) {
    try {
      const request = await loadRequestFromManifest(manifestPath);
      await handleJob(request);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`[print-worker] ${message}\n`);
      writeResult({
        jobId: 'unknown',
        ok: false,
        durationMs: 0,
        errorCode: 'WORKER_MANIFEST_ERROR',
        errorMessage: message,
      });
      return;
    }
  }

  const rl = createInterface({
    input: stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const request = JSON.parse(trimmed) as PrintJobRequest;
      await handleJob(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`[print-worker] ${message}\n`);
      writeResult({
        jobId: 'unknown',
        ok: false,
        durationMs: 0,
        errorCode: 'WORKER_PARSE_ERROR',
        errorMessage: message,
      });
    }
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`[print-worker:fatal] ${message}\n`);
  process.exitCode = 1;
});
