import type { CommandServices } from '@/command/types';
import { showPrintOptionsDialog } from '@/ui/print-options-dialog';
import {
  DEFAULT_PDF_WORKER_BATCH_SIZE,
  DEFAULT_PDF_WORKER_SVG_BATCH_SIZE,
  previewCurrentDocPdfChunk,
} from '@/print/export-current-doc';
import { runLegacyPrintPreview } from '@/print/legacy-print';

export async function runPrintDialogFlow(
  services: CommandServices,
  currentPage: number,
): Promise<void> {
  const options = await showPrintOptionsDialog(currentPage, services.wasm.pageCount);
  if (!options) return;

  if (options.mode === 'legacy') {
    await runLegacyPrintPreview(services, {
      startPage: options.startPage,
      endPage: options.endPage,
    });
    return;
  }

  await previewCurrentDocPdfChunk(services, {
    startPage: options.startPage,
    chunkSize: options.endPage - options.startPage + 1,
    batchSize: DEFAULT_PDF_WORKER_BATCH_SIZE,
    svgBatchSize: DEFAULT_PDF_WORKER_SVG_BATCH_SIZE,
  });
}
