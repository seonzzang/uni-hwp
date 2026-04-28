import { HwpDocument } from '@wasm/rhwp.js';
import type { DocumentInfo } from './types';
import type { ValidationReport } from './wasm-bridge-types';
import type { FileSystemFileHandleLike } from '@/command/file-system-access';

export function loadDocumentState(
  currentDoc: HwpDocument | null,
  retiredDocs: HwpDocument[],
  data: Uint8Array,
  fileName: string | undefined,
  freeDocument: (doc: HwpDocument | null, reason: string) => void,
): {
  doc: HwpDocument;
  fileName: string;
  currentFileHandle: FileSystemFileHandleLike | null;
  info: DocumentInfo;
} {
  if (currentDoc) {
    retiredDocs.push(currentDoc);
  }

  const nextFileName = fileName ?? 'document.hwp';
  let nextDoc: HwpDocument | null = null;
  try {
    nextDoc = new HwpDocument(data);
    nextDoc.convertToEditable();
    nextDoc.setFileName(nextFileName);
    const info: DocumentInfo = JSON.parse(nextDoc.getDocumentInfo());
    console.log(`[WasmBridge] 문서 로드: ${info.pageCount}페이지`);
    return {
      doc: nextDoc,
      fileName: nextFileName,
      currentFileHandle: null,
      info,
    };
  } catch (error) {
    freeDocument(nextDoc, 'load-failure');
    throw error;
  }
}

export function createNewDocumentState(currentDoc: HwpDocument | null): {
  doc: HwpDocument;
  fileName: string;
  currentFileHandle: FileSystemFileHandleLike | null;
  info: DocumentInfo;
} {
  const doc = currentDoc ?? HwpDocument.createEmpty();
  const info: DocumentInfo = JSON.parse(doc.createBlankDocument());
  const fileName = '새 문서.hwp';
  doc.setFileName(fileName);
  console.log(`[WasmBridge] 새 문서 생성: ${info.pageCount}페이지`);
  return {
    doc,
    fileName,
    currentFileHandle: null,
    info,
  };
}

export function getValidationWarnings(doc: HwpDocument): ValidationReport {
  const raw = (doc as any).getValidationWarnings?.();
  if (!raw) return { count: 0, summary: {}, warnings: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { count: 0, summary: {}, warnings: [] };
  }
}

export function reflowLinesegs(doc: HwpDocument): number {
  return (doc as any).reflowLinesegs?.() ?? 0;
}

export function getPageCountOrReset(
  doc: HwpDocument | null,
  reset: () => void,
): number {
  if (!doc) return 0;
  try {
    return doc.pageCount();
  } catch (error) {
    console.warn('[WasmBridge] pageCount 조회 실패, 문서 참조를 초기화합니다', error);
    reset();
    return 0;
  }
}
