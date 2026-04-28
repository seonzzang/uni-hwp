import type { PrintRangeRequest } from '@/core/types';
import { getPdfRuntime } from './pdf-runtime';

export interface PdfExportProgress {
  completedPages: number;
  totalPages: number;
  batchIndex: number;
  batchStartPage: number;
  batchEndPage: number;
}

export interface PdfExportResult {
  blob: Blob;
  pageCount: number;
  mimeType: 'application/pdf';
  fileName: string;
}

export interface PdfPageViewport {
  width: number;
  height: number;
}

export interface PdfPageRenderResult {
  pageIndex: number;
  svg: string;
  viewport: PdfPageViewport;
}

export interface PdfExportDependencies {
  getFileName: () => string;
  getPageCount: () => number;
  getPageViewport: (pageIndex: number) => Promise<PdfPageViewport> | PdfPageViewport;
  renderPageSvg: (pageIndex: number) => Promise<string> | string;
}

export interface PdfExportOptions {
  range?: PrintRangeRequest;
  signal?: AbortSignal;
  batchSize?: number;
  onProgress?: (progress: PdfExportProgress) => void;
}

export class PdfExportManager {
  constructor(
    private readonly deps: PdfExportDependencies,
  ) {}

  async exportRangeToPdf(options: PdfExportOptions = {}): Promise<PdfExportResult> {
    const targetPages = this.resolveTargetPages(options.range);
    const batchSize = Math.max(1, options.batchSize ?? 20);

    try {
      return {
        blob: await this.createPdfBlob(targetPages, batchSize, options),
        pageCount: targetPages.length,
        mimeType: 'application/pdf',
        fileName: toPdfFileName(this.deps.getFileName()),
      };
    } catch (error) {
      throw normalizePdfExportError(error);
    }
  }

  async generatePdfBatch(
    pageIndexes: number[],
    signal?: AbortSignal,
  ): Promise<PdfPageRenderResult[]> {
    const results: PdfPageRenderResult[] = [];

    for (const pageIndex of pageIndexes) {
      this.throwIfAborted(signal);

      const svg = await this.deps.renderPageSvg(pageIndex);
      const viewport = await this.deps.getPageViewport(pageIndex);

      results.push({
        pageIndex,
        svg,
        viewport,
      });
    }

    return results;
  }

  private resolveTargetPages(range?: PrintRangeRequest): number[] {
    const totalPages = this.deps.getPageCount();
    if (totalPages <= 0) {
      return [];
    }

    if (!range || range.type === 'all') {
      return Array.from({ length: totalPages }, (_, index) => index);
    }

    if (range.type === 'currentPage') {
      return [clampPage(range.page, totalPages) - 1];
    }

    const start = clampPage(range.start, totalPages);
    const end = clampPage(range.end, totalPages);
    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);
    return Array.from(
      { length: normalizedEnd - normalizedStart + 1 },
      (_, index) => normalizedStart - 1 + index,
    );
  }

  private async createPdfBlob(
    targetPages: number[],
    batchSize: number,
    options: PdfExportOptions,
  ): Promise<Blob> {
    const { PDFDocument, SVGtoPDF } = getPdfRuntime();
    const doc = new PDFDocument({
      autoFirstPage: false,
      compress: true,
      margin: 0,
    });
    const chunks: ArrayBuffer[] = [];

    return await new Promise<Blob>((resolve, reject) => {
      const abortHandler = () => {
        try {
          doc.destroy();
        } catch {
          // ignore cleanup failures during abort
        }
        reject(new DOMException('PDF export aborted', 'AbortError'));
      };

      const cleanup = () => {
        options.signal?.removeEventListener('abort', abortHandler);
      };

      doc.on('data', (chunk: Uint8Array) => {
        const copy = new Uint8Array(chunk.byteLength);
        copy.set(chunk);
        chunks.push(copy.buffer);
      });

      doc.once('error', (error: Error) => {
        cleanup();
        reject(error);
      });

      doc.once('end', () => {
        cleanup();
        resolve(new Blob(chunks, { type: 'application/pdf' }));
      });

      options.signal?.addEventListener('abort', abortHandler, { once: true });

      try {
        void (async () => {
          for (let start = 0; start < targetPages.length; start += batchSize) {
            this.throwIfAborted(options.signal);

            const batch = targetPages.slice(start, start + batchSize);
            const batchResults = await this.generatePdfBatch(batch, options.signal);

            for (const page of batchResults) {
              this.throwIfAborted(options.signal);

              const width = pxToPt(page.viewport.width);
              const height = pxToPt(page.viewport.height);

              doc.addPage({
                size: [width, height],
                margin: 0,
              });

              SVGtoPDF(doc, page.svg, 0, 0, {
                assumePt: false,
                width,
                height,
                preserveAspectRatio: 'xMinYMin meet',
              });
            }

            options.onProgress?.({
              completedPages: Math.min(start + batch.length, targetPages.length),
              totalPages: targetPages.length,
              batchIndex: Math.floor(start / batchSize) + 1,
              batchStartPage: batch[0] + 1,
              batchEndPage: batch[batch.length - 1] + 1,
            });

            if (start + batch.length < targetPages.length) {
              await yieldToBrowser();
            }
          }

          doc.end();
        })().catch((error) => {
          cleanup();
          try {
            doc.destroy();
          } catch {
            // ignore cleanup failures during async error handling
          }
          reject(error);
        });
      } catch (error) {
        cleanup();
        try {
          doc.destroy();
        } catch {
          // ignore cleanup failures during error handling
        }
        reject(error);
      }
    });
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new DOMException('PDF export aborted', 'AbortError');
    }
  }
}

function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(totalPages, Math.floor(page)));
}

function toPdfFileName(fileName: string): string {
  if (fileName.toLowerCase().endsWith('.pdf')) {
    return fileName;
  }

  return fileName.replace(/\.[^.]+$/u, '') + '.pdf';
}

function normalizePdfExportError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function pxToPt(px: number): number {
  return (px * 72) / 96;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
