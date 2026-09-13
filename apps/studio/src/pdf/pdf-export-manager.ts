import type { PrintRangeRequest } from '@/core/types';
import { getPdfRuntime } from './pdf-runtime';

// svg-to-pdfkit은 SVG의 CSS font-family를 PDF 기본 글꼴로만 해석한다.
// PDF 기본 글꼴에는 한글 글리프가 없으므로, 배포 번들에 포함한 Noto Sans KR TTF를
// PDFKit에 등록하고 SVG의 모든 본문 글꼴을 이 임베디드 글꼴로 매핑한다.
const PDF_REGULAR_FONT_URL = new URL(
  '../../../../ttfs/opensource/NotoSansKR-Regular.ttf',
  import.meta.url,
).href;
const PDF_BOLD_FONT_URL = new URL(
  '../../../../ttfs/opensource/NotoSansKR-Regular.ttf',
  import.meta.url,
).href;
const PDF_REGULAR_FONT_NAME = 'UniHwpSans';
const PDF_BOLD_FONT_NAME = 'UniHwpSans-Bold';

type PdfDocument = InstanceType<typeof import('pdfkit')>;

let pdfFontBytesPromise: Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
}> | null = null;

function loadPdfFontBytes(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  if (!pdfFontBytesPromise) {
    pdfFontBytesPromise = Promise.all([
      fetch(PDF_REGULAR_FONT_URL),
      fetch(PDF_BOLD_FONT_URL),
    ]).then(async ([regularResponse, boldResponse]) => {
      if (!regularResponse.ok || !boldResponse.ok) {
        throw new Error(
          `한글 PDF 글꼴을 불러올 수 없습니다 (${regularResponse.status}/${boldResponse.status}).`,
        );
      }
      const [regular, bold] = await Promise.all([
        regularResponse.arrayBuffer(),
        boldResponse.arrayBuffer(),
      ]);
      return {
        regular: new Uint8Array(regular),
        bold: new Uint8Array(bold),
      };
    }).catch((error) => {
      pdfFontBytesPromise = null;
      throw error;
    });
  }
  return pdfFontBytesPromise;
}

async function registerPdfKoreanFonts(doc: PdfDocument): Promise<void> {
  const { regular, bold } = await loadPdfFontBytes();
  doc.registerFont(PDF_REGULAR_FONT_NAME, regular);
  doc.registerFont(PDF_BOLD_FONT_NAME, bold);
}

function pdfFontCallback(
  _family: string,
  bold: boolean,
  italic: boolean,
  fontOptions: { fauxItalic?: boolean },
): string {
  if (italic) {
    // PDFKit/svg-to-pdfkit이 등록된 정자체를 기울여 그리는 faux italic을 사용한다.
    fontOptions.fauxItalic = true;
  }
  if (bold) {
    // 현재 번들에는 정자체 TTF만 있으므로 PDFKit의 faux-bold를 사용한다.
    (fontOptions as { fauxBold?: boolean }).fauxBold = true;
  }
  return bold ? PDF_BOLD_FONT_NAME : PDF_REGULAR_FONT_NAME;
}

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
    await registerPdfKoreanFonts(doc);
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
                fontCallback: pdfFontCallback,
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
