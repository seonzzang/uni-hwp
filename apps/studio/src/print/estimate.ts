import type { PrintWorkerAnalysisLogEntry } from '@/print/worker-analysis';

const ESTIMATED_PDF_RENDER_SECONDS_PER_CHUNK = 5;
const ESTIMATED_PDF_MERGE_SECONDS_PER_CHUNK = 12;
const ESTIMATED_PDF_SAVE_SECONDS = 8;
const ESTIMATED_PDF_OPEN_SECONDS = 2;

export const DEFAULT_PDF_WORKER_BATCH_SIZE = 30;
export const PRINT_ESTIMATE_STORAGE_KEY = 'uni-hwp.print.pdf.estimate.v1';
const LEGACY_PRINT_ESTIMATE_STORAGE_KEY = 'bbdg.print.pdf.estimate.v1';

export type PrintEstimateStats = {
  dataSecondsPerPage: number;
  renderSecondsPerChunk: number;
  mergeSecondsPerChunk: number;
  saveSeconds: number;
  openSeconds: number;
  sampleCount: number;
  updatedAt: number;
};

export type PrintWorkerProgressEstimator = {
  stats: PrintEstimateStats;
  svgStartedElapsedMs?: number;
  renderStartedElapsedMs?: number;
  mergeStartedElapsedMs?: number;
};

export function estimateRemainingSeconds(params: {
  startedElapsedMs?: number;
  currentElapsedMs?: number;
  completed: number;
  total: number;
}): number | null {
  const { startedElapsedMs, currentElapsedMs, completed, total } = params;
  if (
    startedElapsedMs === undefined
    || currentElapsedMs === undefined
    || completed <= 0
    || total <= 0
    || completed >= total
  ) {
    return completed >= total ? 0 : null;
  }

  const elapsedSeconds = Math.max(0, (currentElapsedMs - startedElapsedMs) / 1000);
  if (elapsedSeconds < 3) return null;

  const rate = completed / elapsedSeconds;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return Math.max(0, (total - completed) / rate);
}

export function defaultPrintEstimateStats(): PrintEstimateStats {
  return {
    dataSecondsPerPage: 0.015,
    renderSecondsPerChunk: ESTIMATED_PDF_RENDER_SECONDS_PER_CHUNK,
    mergeSecondsPerChunk: ESTIMATED_PDF_MERGE_SECONDS_PER_CHUNK,
    saveSeconds: ESTIMATED_PDF_SAVE_SECONDS,
    openSeconds: ESTIMATED_PDF_OPEN_SECONDS,
    sampleCount: 0,
    updatedAt: 0,
  };
}

export function loadPrintEstimateStats(): PrintEstimateStats {
  try {
    const raw = window.localStorage.getItem(PRINT_ESTIMATE_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_PRINT_ESTIMATE_STORAGE_KEY);
    if (!raw) return defaultPrintEstimateStats();
    const parsed = JSON.parse(raw) as Partial<PrintEstimateStats>;
    const defaults = defaultPrintEstimateStats();
    return {
      dataSecondsPerPage: positiveNumberOr(parsed.dataSecondsPerPage, defaults.dataSecondsPerPage),
      renderSecondsPerChunk: positiveNumberOr(parsed.renderSecondsPerChunk, defaults.renderSecondsPerChunk),
      mergeSecondsPerChunk: positiveNumberOr(parsed.mergeSecondsPerChunk, defaults.mergeSecondsPerChunk),
      saveSeconds: positiveNumberOr(parsed.saveSeconds, defaults.saveSeconds),
      openSeconds: positiveNumberOr(parsed.openSeconds, defaults.openSeconds),
      sampleCount: Math.max(0, Math.floor(positiveNumberOr(parsed.sampleCount, 0))),
      updatedAt: Math.max(0, Math.floor(positiveNumberOr(parsed.updatedAt, 0))),
    };
  } catch {
    return defaultPrintEstimateStats();
  }
}

function positiveNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampEstimate(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function blendEstimate(previous: number, next: number, sampleCount: number): number {
  const alpha = sampleCount <= 0 ? 1 : 0.28;
  return (previous * (1 - alpha)) + (next * alpha);
}

export function savePrintEstimateStats(stats: PrintEstimateStats): void {
  try {
    window.localStorage.setItem(PRINT_ESTIMATE_STORAGE_KEY, JSON.stringify(stats));
    window.localStorage.removeItem(LEGACY_PRINT_ESTIMATE_STORAGE_KEY);
  } catch (error) {
    console.warn('[print-pdf-analysis] estimate stats save failed', error);
  }
}

export function estimateMergeAndSaveSeconds(
  chunkCount: number,
  completedChunkProgress = 0,
  stats = loadPrintEstimateStats(),
): number {
  const safeChunkCount = Math.max(1, chunkCount);
  const remainingChunks = Math.max(0, safeChunkCount - completedChunkProgress);
  return (remainingChunks * stats.mergeSecondsPerChunk) + stats.saveSeconds + stats.openSeconds;
}

export function estimateRenderSeconds(
  chunkCount: number,
  completedChunkProgress = 0,
  stats = loadPrintEstimateStats(),
): number {
  const safeChunkCount = Math.max(1, chunkCount);
  const remainingChunks = Math.max(0, safeChunkCount - completedChunkProgress);
  return remainingChunks * stats.renderSecondsPerChunk;
}

export function estimateWorkerChunkCount(
  pageCount: number,
  batchSize = DEFAULT_PDF_WORKER_BATCH_SIZE,
): number {
  return Math.max(1, Math.ceil(Math.max(1, pageCount) / Math.max(1, batchSize)));
}

export function estimateRemainingPostDataSeconds(
  pageCount: number,
  stats = loadPrintEstimateStats(),
  batchSize = DEFAULT_PDF_WORKER_BATCH_SIZE,
): number {
  const chunkCount = estimateWorkerChunkCount(pageCount, batchSize);
  return estimateRenderSeconds(chunkCount, 0, stats) + estimateMergeAndSaveSeconds(chunkCount, 0, stats);
}

export function updatePrintEstimateStatsFromEntries(entries: PrintWorkerAnalysisLogEntry[]): void {
  const currentStats = loadPrintEstimateStats();
  const nextStats = { ...currentStats };
  const sampleCount = currentStats.sampleCount;

  const allSvgLoaded = [...entries].reverse().find((entry) => entry.message === 'all svg pages loaded');
  if (
    typeof allSvgLoaded?.readAllSvgMs === 'number'
    && typeof allSvgLoaded?.totalPages === 'number'
    && allSvgLoaded.totalPages > 0
  ) {
    const secondsPerPage = clampEstimate(
      allSvgLoaded.readAllSvgMs / 1000 / allSvgLoaded.totalPages,
      0.001,
      2,
    );
    nextStats.dataSecondsPerPage = blendEstimate(
      currentStats.dataSecondsPerPage,
      secondsPerPage,
      sampleCount,
    );
  }

  const renderFinished = [...entries].reverse().find(
    (entry) => entry.message === 'browser page closed after chunk rendering',
  );
  const browserCreated = entries.find((entry) => entry.message === 'browser page created');
  if (
    typeof renderFinished?.elapsedMs === 'number'
    && typeof browserCreated?.elapsedMs === 'number'
    && typeof renderFinished.totalChunkCount === 'number'
    && renderFinished.totalChunkCount > 0
    && renderFinished.elapsedMs > browserCreated.elapsedMs
  ) {
    const secondsPerChunk = clampEstimate(
      (renderFinished.elapsedMs - browserCreated.elapsedMs) / 1000 / renderFinished.totalChunkCount,
      0.5,
      180,
    );
    nextStats.renderSecondsPerChunk = blendEstimate(
      currentStats.renderSecondsPerChunk,
      secondsPerChunk,
      sampleCount,
    );
  }

  const mergeSaveStarted = entries.find((entry) => entry.message === 'pdf merge save started');
  const mergeStarted = entries.find((entry) => entry.message === 'pdf merge started');
  const mergeChunkCount = Math.max(
    0,
    ...entries
      .filter((entry) => entry.message?.startsWith('pdf merge chunk') && typeof entry.chunkCount === 'number')
      .map((entry) => entry.chunkCount ?? 0),
  );
  if (
    typeof mergeSaveStarted?.elapsedMs === 'number'
    && typeof mergeStarted?.elapsedMs === 'number'
    && mergeChunkCount > 0
    && mergeSaveStarted.elapsedMs > mergeStarted.elapsedMs
  ) {
    const secondsPerChunk = clampEstimate(
      (mergeSaveStarted.elapsedMs - mergeStarted.elapsedMs) / 1000 / mergeChunkCount,
      0.5,
      240,
    );
    nextStats.mergeSecondsPerChunk = blendEstimate(
      currentStats.mergeSecondsPerChunk,
      secondsPerChunk,
      sampleCount,
    );
  }

  const saveFinished = [...entries].reverse().find((entry) => entry.message === 'pdf merge save finished');
  if (typeof saveFinished?.saveMs === 'number') {
    const saveSeconds = clampEstimate(saveFinished.saveMs / 1000, 0.5, 180);
    nextStats.saveSeconds = blendEstimate(currentStats.saveSeconds, saveSeconds, sampleCount);
  }

  nextStats.sampleCount = sampleCount + 1;
  nextStats.updatedAt = Date.now();
  savePrintEstimateStats(nextStats);
  console.log('[print-pdf-analysis] estimate stats updated', nextStats);
}

export function updatePrintEstimateOpenSeconds(observedSeconds: number): void {
  const currentStats = loadPrintEstimateStats();
  const nextStats = { ...currentStats };
  const normalizedSeconds = clampEstimate(observedSeconds, 0.1, 30);
  nextStats.openSeconds = blendEstimate(
    currentStats.openSeconds,
    normalizedSeconds,
    currentStats.sampleCount,
  );
  nextStats.updatedAt = Date.now();
  savePrintEstimateStats(nextStats);
  console.log('[print-pdf-analysis] open estimate updated', nextStats);
}
