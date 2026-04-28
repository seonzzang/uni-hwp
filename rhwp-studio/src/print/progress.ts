import { invoke } from '@tauri-apps/api/core';
import { PrintProgressOverlay } from '@/ui/print-progress-overlay';
import {
  estimateMergeAndSaveSeconds,
  estimateRemainingPostDataSeconds,
  estimateRemainingSeconds,
  loadPrintEstimateStats,
  type PrintWorkerProgressEstimator,
} from '@/print/estimate';
import {
  formatWorkerChunkRange,
  parseLatestWorkerAnalysisEntry,
  type PrintWorkerAnalysisLogEntry,
} from '@/print/worker-analysis';

export const PDF_PROGRESS_TOTAL_UNITS = 1000;

export function updateOverlayFromWorkerLogEntry(
  overlay: PrintProgressOverlay,
  entry: PrintWorkerAnalysisLogEntry,
  estimator: PrintWorkerProgressEstimator,
): void {
  const message = entry.message ?? '';

  if (message === 'pdf job failed') {
    overlay.updateProgress(
      1,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 생성 실패: ${entry.errorMessage ?? '원인을 확인하는 중입니다.'}`,
      { animationMs: 0 },
    );
    return;
  }

  if (message === 'svg batch loaded') {
    const completedPages = Math.max(0, entry.completedPages ?? 0);
    const totalPages = Math.max(1, entry.totalPages ?? completedPages);
    const units = 320 + Math.round((completedPages / totalPages) * 120);
    if (estimator.svgStartedElapsedMs === undefined) {
      estimator.svgStartedElapsedMs = entry.elapsedMs ?? 0;
    }
    const dataEtaSeconds = estimateRemainingSeconds({
      startedElapsedMs: estimator.svgStartedElapsedMs,
      currentElapsedMs: entry.elapsedMs,
      completed: completedPages,
      total: totalPages,
    });
    const totalEtaSeconds = dataEtaSeconds === null
      ? null
      : dataEtaSeconds + estimateRemainingPostDataSeconds(totalPages, estimator.stats);
    overlay.updateEta(totalEtaSeconds, '전체 남은 시간');
    overlay.updateProgress(
      units,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 데이터 읽는 중... (${completedPages}/${totalPages}쪽)`,
      { animationMs: 450 },
    );
    return;
  }

  if (message === 'all svg pages loaded' || message === 'browser page created') {
    estimator.renderStartedElapsedMs = entry.elapsedMs ?? estimator.renderStartedElapsedMs;
    overlay.updateEta(null, '전체 남은 시간');
    overlay.updateProgress(450, PDF_PROGRESS_TOTAL_UNITS, 'PDF 엔진 준비 중...', { animationMs: 1200 });
    return;
  }

  if (
    message.includes('html document chunk')
    || message.includes('page.setContent chunk')
    || message.includes('page.pdf chunk')
    || message === 'browser page closed after chunk rendering'
  ) {
    const chunkIndex = Math.max(1, entry.chunkIndex ?? entry.totalChunkCount ?? 1);
    const totalChunkCount = Math.max(1, entry.totalChunkCount ?? chunkIndex);
    const chunkBase = Math.max(0, chunkIndex - 1);
    const chunkWeight = 1 / totalChunkCount;
    const inChunkProgress = (() => {
      if (message === 'browser page closed after chunk rendering') return 1;
      if (message === 'building html document chunk') return 0.02;
      if (message === 'html document chunk built') return 0.04;
      if (message === 'page.setContent chunk started') return 0.08;
      if (message === 'page.setContent chunk finished') return 0.18;
      if (message === 'page.pdf chunk started') return 0.25;
      if (message === 'page.pdf chunk finished') return 1;
      return 0.02;
    })();
    const units = 450 + Math.round(((chunkBase + inChunkProgress) * chunkWeight) * 250);
    if (estimator.renderStartedElapsedMs === undefined) {
      estimator.renderStartedElapsedMs = entry.elapsedMs ?? 0;
    }
    const renderEtaSeconds = estimateRemainingSeconds({
      startedElapsedMs: estimator.renderStartedElapsedMs,
      currentElapsedMs: entry.elapsedMs,
      completed: chunkBase + inChunkProgress,
      total: totalChunkCount,
    });
    const totalEtaSeconds = renderEtaSeconds === null
      ? null
      : renderEtaSeconds + estimateMergeAndSaveSeconds(totalChunkCount, 0, estimator.stats);
    overlay.updateEta(totalEtaSeconds, '전체 남은 시간');
    const animationMs = (() => {
      if (message === 'page.pdf chunk started') return 3200;
      if (message === 'page.setContent chunk started') return 2200;
      if (message === 'browser page closed after chunk rendering') return 700;
      return 700;
    })();
    const phase = message.includes('page.pdf')
      ? 'PDF 파일 생성 중'
      : 'PDF 레이아웃 생성 중';
    overlay.updateProgress(
      units,
      PDF_PROGRESS_TOTAL_UNITS,
      `${phase}... (청크 ${chunkIndex}/${totalChunkCount}${formatWorkerChunkRange(entry)})`,
      { animationMs },
    );
    return;
  }

  if (message === 'pdf merge started') {
    estimator.mergeStartedElapsedMs = entry.elapsedMs ?? estimator.mergeStartedElapsedMs;
    overlay.updateEta(null, '전체 남은 시간');
    overlay.updateProgress(710, PDF_PROGRESS_TOTAL_UNITS, 'PDF 병합 준비 중...', { animationMs: 1000 });
    return;
  }

  if (message.startsWith('pdf merge chunk')) {
    const chunkIndex = Math.max(1, entry.chunkIndex ?? 1);
    const chunkCount = Math.max(1, entry.chunkCount ?? chunkIndex);
    const chunkBase = Math.max(0, chunkIndex - 1);
    const chunkWeight = 1 / chunkCount;
    const inChunkProgress = (() => {
      if (message === 'pdf merge chunk started') return 0.02;
      if (message === 'pdf merge chunk read') return 0.18;
      if (message === 'pdf merge chunk loaded') return 0.82;
      if (message === 'pdf merge chunk copied') return 0.93;
      if (message === 'pdf merge chunk appended') return 1;
      return 0.02;
    })();
    const units = 710 + Math.round(((chunkBase + inChunkProgress) * chunkWeight) * 240);
    if (estimator.mergeStartedElapsedMs === undefined) {
      estimator.mergeStartedElapsedMs = entry.elapsedMs ?? 0;
    }
    const mergeEtaSeconds = estimateRemainingSeconds({
      startedElapsedMs: estimator.mergeStartedElapsedMs,
      currentElapsedMs: entry.elapsedMs,
      completed: chunkBase + inChunkProgress,
      total: chunkCount,
    });
    const totalEtaSeconds = mergeEtaSeconds === null
      ? estimateMergeAndSaveSeconds(chunkCount, chunkBase + inChunkProgress, estimator.stats)
      : mergeEtaSeconds + estimator.stats.saveSeconds + estimator.stats.openSeconds;
    overlay.updateEta(totalEtaSeconds, '전체 남은 시간');
    const animationMs = message === 'pdf merge chunk read' ? 14000 : 650;
    overlay.updateProgress(
      units,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 병합 중... (청크 ${chunkIndex}/${chunkCount}, 병합된 쪽 ${entry.mergedPageCount ?? '-'})`,
      { animationMs },
    );
    return;
  }

  if (message === 'pdf merge save started') {
    overlay.updateEta(estimator.stats.saveSeconds + estimator.stats.openSeconds, '전체 남은 시간');
    overlay.updateProgress(
      965,
      PDF_PROGRESS_TOTAL_UNITS,
      `PDF 저장 중... (${entry.pageCount ?? '-'}쪽)`,
      { animationMs: 2800 },
    );
    return;
  }

  if (message === 'pdf merge save finished') {
    overlay.updateEta(estimator.stats.openSeconds, 'PDF 열기 남은 시간');
    overlay.updateProgress(985, PDF_PROGRESS_TOTAL_UNITS, 'PDF 저장 완료, 뷰어 여는 중...', { animationMs: 500 });
    return;
  }

  if (message === 'pdf merge finished' || message === 'chunk pdf cleanup finished') {
    overlay.updateEta(estimator.stats.openSeconds, 'PDF 열기 남은 시간');
    overlay.updateProgress(995, PDF_PROGRESS_TOTAL_UNITS, 'PDF 열기 준비 중...', { animationMs: 500 });
  }
}

export function startPrintWorkerLogPolling(
  jobId: string,
  overlay: PrintProgressOverlay,
): () => void {
  let stopped = false;
  let polling = false;
  const estimator: PrintWorkerProgressEstimator = {
    stats: loadPrintEstimateStats(),
  };

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      const logText = await invoke('debug_read_print_worker_analysis_log', { jobId }) as string;
      const entry = parseLatestWorkerAnalysisEntry(logText);
      if (entry) {
        updateOverlayFromWorkerLogEntry(overlay, entry, estimator);
      }
    } catch (error) {
      console.warn('[print-pdf-analysis] worker log polling failed', error);
    } finally {
      polling = false;
    }
  };

  const timer = window.setInterval(() => {
    void poll();
  }, 1000);
  void poll();

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

export function renderPrintProgress(
  statusEl: HTMLElement,
  processedPages: number,
  totalPages?: number,
): void {
  const safeTotalPages = totalPages && totalPages > 0 ? totalPages : undefined;
  const clampedProcessedPages = safeTotalPages
    ? Math.min(processedPages, safeTotalPages)
    : processedPages;
  const percent = safeTotalPages
    ? Math.max(0, Math.min(100, Math.round((clampedProcessedPages / safeTotalPages) * 100)))
    : 0;

  statusEl.innerHTML = `
<div style="display:flex; align-items:center; gap:8px; min-width:280px;">
  <span style="white-space:nowrap;">인쇄 준비 중... (${clampedProcessedPages}${safeTotalPages ? `/${safeTotalPages}` : ''}페이지)</span>
  <div style="flex:1; min-width:120px; height:8px; background:#d6dce5; border-radius:999px; overflow:hidden;">
    <div style="width:${percent}%; height:100%; background:linear-gradient(90deg, #2a6cf0 0%, #58a6ff 100%); border-radius:999px;"></div>
  </div>
  <span style="font-variant-numeric:tabular-nums; min-width:40px; text-align:right;">${percent}%</span>
</div>`;
}
