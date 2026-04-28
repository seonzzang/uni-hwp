import PDFDocumentStandalone from 'pdfkit/js/pdfkit.standalone.js';
import SVGtoPDF from 'svg-to-pdfkit';

export interface PdfRuntime {
  PDFDocument: typeof import('pdfkit');
  SVGtoPDF: typeof SVGtoPDF;
}

export function getPdfRuntime(): PdfRuntime {
  return {
    PDFDocument: PDFDocumentStandalone as unknown as typeof import('pdfkit'),
    SVGtoPDF,
  };
}
