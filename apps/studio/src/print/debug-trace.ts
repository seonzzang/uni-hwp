const TRACE_LIMIT = 10;

type TraceEntry = {
  time: string;
  message: string;
};

declare global {
  interface Window {
    __pdfPreviewTrace?: TraceEntry[];
  }
}

function isDev(): boolean {
  return import.meta.env.DEV;
}

function render(entries: TraceEntry[]): void {
  if (!isDev()) return;
  // Keep the trace buffer for debugging, but do not render an on-screen panel.
  void entries;
}

export function pushPdfPreviewTrace(message: string): void {
  if (!isDev()) return;
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  const entries = window.__pdfPreviewTrace ?? [];
  entries.push({ time, message });
  window.__pdfPreviewTrace = entries.slice(-TRACE_LIMIT);
  render(window.__pdfPreviewTrace);
  console.log('[pdf-preview-trace]', message);
}

export function clearPdfPreviewTrace(): void {
  if (!isDev()) return;
  window.__pdfPreviewTrace = [];
  render([]);
}
