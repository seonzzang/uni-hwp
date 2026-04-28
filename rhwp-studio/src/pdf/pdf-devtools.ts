import type { PrintRangeRequest } from '@/core/types';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import {
  PdfExportManager,
  type PdfExportOptions,
  type PdfExportResult,
} from './pdf-export-manager';
import { PdfPreviewController } from './pdf-preview-controller';

export interface PdfDevtoolsApi {
  exportPdf: (options?: PdfExportOptions) => Promise<PdfExportResult>;
  previewPdf: (options?: PdfExportOptions) => Promise<void>;
  disposePreview: () => void;
}

export function createPdfDevtoolsApi(wasm: UniHwpEngine): PdfDevtoolsApi {
  const preview = new PdfPreviewController();
  const exporter = new PdfExportManager({
    getFileName: () => wasm.fileName,
    getPageCount: () => wasm.pageCount,
    getPageViewport: async (pageIndex) => {
      const pageInfo = wasm.getPageInfo(pageIndex);
      return {
        width: pageInfo.width,
        height: pageInfo.height,
      };
    },
    renderPageSvg: async (pageIndex) => wasm.renderPageSvg(pageIndex),
  });

  return {
    exportPdf: async (options?: PdfExportOptions) => exporter.exportRangeToPdf(options),
    previewPdf: async (options?: PdfExportOptions) => {
      const result = await exporter.exportRangeToPdf(options);
      await preview.open(result.blob, { title: result.fileName });
    },
    disposePreview: () => preview.dispose(),
  };
}

export function createPdfPreviewRange(start: number, end: number): PrintRangeRequest {
  return {
    type: 'pageRange',
    start,
    end,
  };
}

