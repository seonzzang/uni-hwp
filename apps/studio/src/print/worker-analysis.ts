export type PrintWorkerAnalysisLogEntry = {
  message?: string;
  elapsedMs?: number;
  completedPages?: number;
  totalPages?: number;
  chunkIndex?: number;
  totalChunkCount?: number;
  chunkStartPage?: number;
  chunkEndPage?: number;
  chunkCount?: number;
  mergedPageCount?: number;
  pageCount?: number;
  errorMessage?: string;
  readAllSvgMs?: number;
  pdfWriteMs?: number;
  setContentMs?: number;
  htmlBuildMs?: number;
  readMs?: number;
  loadMs?: number;
  copyMs?: number;
  saveMs?: number;
};

export function parseLatestWorkerAnalysisEntry(logText: string): PrintWorkerAnalysisLogEntry | null {
  const lines = logText.trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]) as PrintWorkerAnalysisLogEntry;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Ignore a partially written line and keep walking backward.
    }
  }
  return null;
}

export function parseWorkerAnalysisEntries(logText: string): PrintWorkerAnalysisLogEntry[] {
  return logText
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as PrintWorkerAnalysisLogEntry;
        return parsed && typeof parsed === 'object' ? [parsed] : [];
      } catch {
        return [];
      }
    });
}

export function formatWorkerChunkRange(entry: PrintWorkerAnalysisLogEntry): string {
  if (
    typeof entry.chunkStartPage === 'number'
    && typeof entry.chunkEndPage === 'number'
  ) {
    return `, ${entry.chunkStartPage}-${entry.chunkEndPage}쪽`;
  }
  return '';
}
