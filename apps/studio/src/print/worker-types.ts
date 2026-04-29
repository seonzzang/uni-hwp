export type PrintJobPhase =
  | 'spawned'
  | 'loading'
  | 'rendering-batch'
  | 'writing-pdf'
  | 'completed'
  | 'failed';

export type PrintJobRange =
  | { type: 'all' }
  | { type: 'currentPage'; currentPage: number }
  | { type: 'pageRange'; startPage: number; endPage: number };

export interface PrintPageSize {
  widthPx: number;
  heightPx: number;
  dpi: 96;
}

export interface PrintJobRequest {
  jobId: string;
  sourceFileName: string;
  outputMode: 'preview' | 'save-pdf';
  pageRange: PrintJobRange;
  batchSize: number;
  tempDir: string;
  outputPdfPath: string;
  pageCount: number;
  pageSize: PrintPageSize;
  svgPagePaths: string[];
  debugDelayMs?: number;
}

export interface PrintJobProgress {
  jobId: string;
  phase: PrintJobPhase;
  completedPages: number;
  totalPages: number;
  batchIndex?: number;
  message: string;
}

export interface PrintJobResult {
  jobId: string;
  ok: boolean;
  outputPdfPath?: string;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface PrintWorkerProgressMessage {
  type: 'progress';
  progress: PrintJobProgress;
}

export interface PrintWorkerResultMessage {
  type: 'result';
  result: PrintJobResult;
}

export type PrintWorkerMessage =
  | PrintWorkerProgressMessage
  | PrintWorkerResultMessage;
