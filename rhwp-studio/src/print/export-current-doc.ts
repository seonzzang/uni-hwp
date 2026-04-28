import { invoke } from '@tauri-apps/api/core';
import type { CommandServices } from '@/command/types';
import { PdfPreviewController } from '@/pdf/pdf-preview-controller';
import { PrintProgressOverlay } from '@/ui/print-progress-overlay';
import { showToast } from '@/ui/toast';
import {
  estimateRemainingPostDataSeconds,
  loadPrintEstimateStats,
  updatePrintEstimateOpenSeconds,
  updatePrintEstimateStatsFromEntries,
} from '@/print/estimate';
import {
  PDF_PROGRESS_TOTAL_UNITS,
  renderPrintProgress,
  startPrintWorkerLogPolling,
} from '@/print/progress';
import { parseWorkerAnalysisEntries } from '@/print/worker-analysis';
import { clearPdfPreviewTrace, pushPdfPreviewTrace } from '@/print/debug-trace';

export const DEFAULT_PDF_WORKER_BATCH_SIZE = 30;
export const DEFAULT_PDF_WORKER_SVG_BATCH_SIZE = 30;

const workerPdfPreview = new PdfPreviewController();

type CurrentDocPdfExportParams = {
  startPage?: number;
  chunkSize?: number;
  batchSize?: number;
  svgBatchSize?: number;
};

type PrintWorkerResultMessage = {
  type?: string;
  result?: {
    ok?: boolean;
    outputPdfPath?: string;
    errorCode?: string;
    errorMessage?: string;
  };
};

let tauriPrintWorkerRuntimeAvailable: boolean | null = null;

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function shouldFallbackToBrowserPreview(error: unknown): boolean {
  const message = getErrorMessage(error);
  return /invoke|ipc|tauri|channel|message port|cannot read properties of undefined/i.test(message);
}

async function canUseTauriPrintWorkerRuntime(): Promise<boolean> {
  if (tauriPrintWorkerRuntimeAvailable !== null) {
    return tauriPrintWorkerRuntimeAvailable;
  }

  try {
    const probeMessages = await invoke('debug_probe_print_worker_runtime') as PrintWorkerResultMessage[];
    const probeResult = [...probeMessages]
      .reverse()
      .find((message) => message.type === 'result')
      ?.result;
    tauriPrintWorkerRuntimeAvailable = probeResult?.ok === true;
  } catch (error) {
    console.warn('[print-pdf-analysis] Tauri print worker runtime probe failed', error);
    tauriPrintWorkerRuntimeAvailable = false;
  }

  return tauriPrintWorkerRuntimeAvailable;
}

async function previewCurrentDocPdfInBrowser(
  services: CommandServices,
  startPage: number,
  endPage: number,
): Promise<void> {
  const { createPdfDevtoolsApi, createPdfPreviewRange } = await import('@/pdf/pdf-devtools');
  const api = createPdfDevtoolsApi(services.wasm);
  await api.previewPdf({
    range: createPdfPreviewRange(startPage, endPage),
  });
}

async function updatePrintEstimateStatsFromWorkerLog(jobId: string): Promise<void> {
  try {
    const logText = await invoke('debug_read_print_worker_analysis_log', { jobId }) as string;
    const entries = parseWorkerAnalysisEntries(logText);
    if (entries.length === 0) return;
    updatePrintEstimateStatsFromEntries(entries);
  } catch (error) {
    console.warn('[print-pdf-analysis] estimate stats update failed', error);
  }
}

async function cleanupPrintWorkerTempOutputPath(path: string): Promise<void> {
  try {
    await invoke('cleanup_print_worker_temp_output_path', { path });
  } catch (error) {
    console.warn('[print-pdf-analysis] print worker temp cleanup failed', { path, error });
  }
}

export async function previewCurrentDocPdfChunk(
  services: CommandServices,
  params: CurrentDocPdfExportParams = {},
): Promise<void> {
  const wasm = services.wasm;
  if (wasm.pageCount <= 0) {
    throw new Error('문서가 로드되지 않았습니다.');
  }

  const startPage = Math.max(1, Math.min(params.startPage ?? 1, wasm.pageCount));
  const chunkSize = Math.max(1, Math.round(params.chunkSize ?? wasm.pageCount));
  const endPage = Math.min(wasm.pageCount, startPage + chunkSize - 1);
  const batchSize = Math.max(1, Math.round(params.batchSize ?? DEFAULT_PDF_WORKER_BATCH_SIZE));
  const svgBatchSize = Math.max(1, Math.round(params.svgBatchSize ?? DEFAULT_PDF_WORKER_SVG_BATCH_SIZE));
  const pageIndexes = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage - 1 + index,
  );

  const statusEl = document.getElementById('sb-message');
  const originalStatus = statusEl?.innerHTML ?? '';
  const overlay = new PrintProgressOverlay();
  const abortSignal = overlay.show('PDF 미리보기 준비 중');
  const svgPages: string[] = [];
  const jobId = `menu-pdf-preview-${Date.now()}`;
  let stopWorkerLogPolling: (() => void) | null = null;
  let cancelRequested = false;
  const requestWorkerCancel = () => {
    cancelRequested = true;
    overlay.updateEta(null, '취소 처리');
    overlay.updateProgress(
      1,
      PDF_PROGRESS_TOTAL_UNITS,
      'PDF 작업을 취소하는 중입니다...',
      { animationMs: 0 },
    );
    void invoke('debug_cancel_print_worker_pdf_export', { jobId })
      .catch((error) => console.warn('[print-pdf-analysis] cancel request failed', error));
  };
  const startedAt = performance.now();
  const svgStartedAt = performance.now();
  clearPdfPreviewTrace();
  pushPdfPreviewTrace(`start ${startPage}-${endPage}`);
  abortSignal.addEventListener('abort', requestWorkerCancel, { once: true });

  try {
    if (!(await canUseTauriPrintWorkerRuntime())) {
      pushPdfPreviewTrace('runtime browser-fallback');
      console.warn('[print-pdf-analysis] Tauri print worker runtime unavailable; falling back to browser PDF preview');
      overlay.updateEta(null, '브라우저 폴백');
      overlay.updateProgress(
        PDF_PROGRESS_TOTAL_UNITS,
        PDF_PROGRESS_TOTAL_UNITS,
        `PDF 미리보기를 준비 중입니다... (${startPage}-${endPage}페이지)`,
        { animationMs: 250 },
      );
      await previewCurrentDocPdfInBrowser(services, startPage, endPage);
      pushPdfPreviewTrace('browser preview opened');
      abortSignal.removeEventListener('abort', requestWorkerCancel);
      statusEl && (statusEl.innerHTML = originalStatus);
      overlay.hide();
      showToast({
        message: `PDF ${startPage}-${endPage}페이지를 앱 내부 뷰어로 열었습니다.`,
        durationMs: 3000,
      });
      return;
    }

    for (let startIndex = 0; startIndex < pageIndexes.length; startIndex += svgBatchSize) {
      if (abortSignal.aborted) {
        throw new Error('PDF 미리보기 준비가 취소되었습니다.');
      }

      const batchPageIndexes = pageIndexes.slice(startIndex, startIndex + svgBatchSize);
      for (const pageIndex of batchPageIndexes) {
        if (abortSignal.aborted) {
          throw new Error('PDF 미리보기 준비가 취소되었습니다.');
        }
        svgPages.push(wasm.renderPageSvg(pageIndex));
      }

      const completedPages = Math.min(startIndex + batchPageIndexes.length, pageIndexes.length);
      statusEl && renderPrintProgress(statusEl, completedPages, pageIndexes.length);
      const progressUnits = Math.max(1, Math.round((completedPages / pageIndexes.length) * 320));
      const svgElapsedSeconds = (performance.now() - svgStartedAt) / 1000;
      const svgEtaSeconds = svgElapsedSeconds >= 3 && completedPages > 0 && completedPages < pageIndexes.length
        ? ((pageIndexes.length - completedPages) / (completedPages / svgElapsedSeconds))
        : null;
      const estimateStats = loadPrintEstimateStats();
      overlay.updateEta(
        svgEtaSeconds === null
          ? null
          : svgEtaSeconds + estimateRemainingPostDataSeconds(pageIndexes.length, estimateStats),
        '전체 남은 시간',
      );
      overlay.updateProgress(
        progressUnits,
        PDF_PROGRESS_TOTAL_UNITS,
        `PDF 데이터 준비 중... (${startPage + completedPages - 1}/${endPage}페이지)`,
        { animationMs: 450 },
      );

      if (completedPages < pageIndexes.length) {
        await yieldToBrowser();
      }
    }

    const svgExtractElapsedMs = Math.round(performance.now() - svgStartedAt);
    const svgCharLength = svgPages.reduce((total, svg) => total + svg.length, 0);
    const firstPageInfo = wasm.getPageInfo(pageIndexes[0]);
    statusEl && renderPrintProgress(statusEl, pageIndexes.length, pageIndexes.length);
    overlay.updateEta(
      estimateRemainingPostDataSeconds(pageIndexes.length, loadPrintEstimateStats()),
      '전체 남은 시간',
    );
    overlay.updateProgress(
      330,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 생성 작업 시작 중... (${startPage}-${endPage}페이지)`,
      { animationMs: 900 },
    );
    console.log('[print-pdf-analysis] frontend before invoke', {
      startPage,
      endPage,
      pageCount: pageIndexes.length,
      batchSize,
      svgBatchSize,
      svgExtractElapsedMs,
      svgCount: svgPages.length,
      svgCharLength,
      approxSvgBytes: svgCharLength * 2,
      heapUsedBytes:
        typeof performance !== 'undefined' && 'memory' in performance
          ? (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
          : undefined,
    });
    const invokeStartedAt = performance.now();
    pushPdfPreviewTrace('worker invoke start');
    stopWorkerLogPolling = startPrintWorkerLogPolling(jobId, overlay);
    let messages: PrintWorkerResultMessage[];
    try {
      messages = await invoke('debug_run_print_worker_pdf_export_for_current_doc', {
        payload: {
          jobId,
          sourceFileName: wasm.fileName,
          widthPx: Math.max(1, Math.round(firstPageInfo.width)),
          heightPx: Math.max(1, Math.round(firstPageInfo.height)),
          batchSize,
          svgPages,
        },
      }) as PrintWorkerResultMessage[];
    } catch (error) {
      stopWorkerLogPolling?.();
      stopWorkerLogPolling = null;
      if (!shouldFallbackToBrowserPreview(error)) {
        pushPdfPreviewTrace(`worker invoke failed hard: ${getErrorMessage(error)}`);
        throw error;
      }

      pushPdfPreviewTrace(`worker invoke failed; fallback: ${getErrorMessage(error)}`);
      console.warn('[print-pdf-analysis] print worker invoke failed; falling back to browser PDF preview', error);
      tauriPrintWorkerRuntimeAvailable = false;
      overlay.updateEta(null, '브라우저 폴백');
      overlay.updateProgress(
        PDF_PROGRESS_TOTAL_UNITS,
        PDF_PROGRESS_TOTAL_UNITS,
        `PDF 미리보기를 여는 중입니다... (${startPage}-${endPage}페이지)`,
        { animationMs: 250 },
      );
      await previewCurrentDocPdfInBrowser(services, startPage, endPage);
      pushPdfPreviewTrace('browser preview opened after invoke failure');
      abortSignal.removeEventListener('abort', requestWorkerCancel);
      statusEl && (statusEl.innerHTML = originalStatus);
      overlay.hide();
      showToast({
        message: `PDF ${startPage}-${endPage}페이지를 앱 내부 뷰어로 열었습니다.`,
        durationMs: 3000,
      });
      return;
    }
    const invokeElapsedMs = Math.round(performance.now() - invokeStartedAt);
    pushPdfPreviewTrace(`worker invoke done ${invokeElapsedMs}ms`);
    console.log('[print-pdf-analysis] frontend after invoke', {
      startPage,
      endPage,
      pageCount: pageIndexes.length,
      invokeElapsedMs,
      totalElapsedMs: Math.round(performance.now() - startedAt),
      messageCount: messages.length,
    });

    const resultMessage = [...messages].reverse().find((message) => message.type === 'result')?.result;
    const outputPdfPath = resultMessage?.ok ? resultMessage.outputPdfPath : undefined;
    if (!outputPdfPath) {
      if (resultMessage?.errorCode === 'CANCELLED') {
        cancelRequested = true;
        throw new Error(resultMessage.errorMessage ?? 'PDF 생성이 취소되었습니다.');
      }
      throw new Error(
        resultMessage?.errorMessage
          ? `PDF 미리보기 생성 실패 (${resultMessage.errorCode ?? 'UNKNOWN'}): ${resultMessage.errorMessage}`
          : 'PDF 미리보기 생성 결과를 확인할 수 없습니다.',
      );
    }

    pushPdfPreviewTrace('worker result has output path');
    await updatePrintEstimateStatsFromWorkerLog(jobId);

    const pdfBytes = await invoke('debug_read_generated_pdf', { path: outputPdfPath }) as number[];
    pushPdfPreviewTrace(`pdf bytes read ${pdfBytes.length}`);
    const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    await cleanupPrintWorkerTempOutputPath(outputPdfPath);
    pushPdfPreviewTrace('temp output cleaned');
    overlay.updateEta(loadPrintEstimateStats().openSeconds, 'PDF 열기 남은 시간');
    overlay.updateProgress(998, PDF_PROGRESS_TOTAL_UNITS, '내부 PDF 뷰어 여는 중...', { animationMs: 350 });
    const previewOpenStartedAt = performance.now();
    await workerPdfPreview.open(pdfBlob, {
      title: `${wasm.fileName} (${startPage}-${endPage})`,
    });
    updatePrintEstimateOpenSeconds((performance.now() - previewOpenStartedAt) / 1000);
    pushPdfPreviewTrace('preview.open resolved');

    stopWorkerLogPolling?.();
    stopWorkerLogPolling = null;
    abortSignal.removeEventListener('abort', requestWorkerCancel);
    statusEl && (statusEl.innerHTML = originalStatus);
    overlay.hide();
    showToast({
      message: `PDF ${startPage}-${endPage}페이지를 앱 내부 뷰어로 열었습니다.`,
      durationMs: 3000,
    });
  } catch (error) {
    pushPdfPreviewTrace(`catch ${getErrorMessage(error)}`);
    stopWorkerLogPolling?.();
    stopWorkerLogPolling = null;
    abortSignal.removeEventListener('abort', requestWorkerCancel);
    statusEl && (statusEl.textContent = error instanceof Error ? error.message : String(error));
    overlay.hide();
    if (
      cancelRequested
      || (error instanceof Error && error.message.includes('취소'))
    ) {
      statusEl && (statusEl.innerHTML = originalStatus);
      showToast({
        message: 'PDF 작업을 취소했습니다.',
        durationMs: 2500,
      });
      return;
    }
    throw error;
  }
}
