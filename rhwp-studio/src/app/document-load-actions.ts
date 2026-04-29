import type { DocumentInfo } from '@/core/types';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';

type InitializeDocumentFn = (docInfo: DocumentInfo, displayName: string) => Promise<void>;

export async function loadDocumentFile(params: {
  file: File;
  setStatusMessage: (message: string) => void;
  loadBytes: (data: Uint8Array, fileName: string, fileHandle: any, startTime?: number) => Promise<void>;
}): Promise<void> {
  const { file, setStatusMessage, loadBytes } = params;
  try {
    setStatusMessage('파일 로딩 중...');
    const startTime = performance.now();
    const data = new Uint8Array(await file.arrayBuffer());
    await loadBytes(data, file.name, null, startTime);
  } catch (error) {
    const errorMessage = `파일 로드 실패: ${error}`;
    setStatusMessage(errorMessage);
    console.error('[main] 파일 로드 실패:', error);
    if (window.innerWidth < 768) alert(errorMessage);
  }
}

export async function loadDocumentBytes(params: {
  wasm: UniHwpEngine;
  data: Uint8Array;
  fileName: string;
  fileHandle: any;
  startTime?: number;
  setDocumentTransitioning: (isTransitioning: boolean) => void;
  deactivateInput: () => void;
  initializeDocument: InitializeDocumentFn;
  getStatusElement: () => HTMLElement;
  markDocumentClean: () => void;
}): Promise<void> {
  const {
    wasm,
    data,
    fileName,
    fileHandle,
    startTime = performance.now(),
    setDocumentTransitioning,
    deactivateInput,
    initializeDocument,
    getStatusElement,
    markDocumentClean,
  } = params;

  setDocumentTransitioning(true);
  deactivateInput();
  try {
    const docInfo = wasm.loadDocument(data, fileName);
    wasm.currentFileHandle = fileHandle;
    const elapsed = performance.now() - startTime;
    await initializeDocument(docInfo, `${fileName} — ${docInfo.pageCount}페이지 (${elapsed.toFixed(1)}ms)`);
    markDocumentClean();
  } finally {
    setDocumentTransitioning(false);
  }
}

export async function createBlankDocument(params: {
  wasm: UniHwpEngine;
  setStatusMessage: (message: string) => void;
  initializeDocument: InitializeDocumentFn;
  markDocumentClean: () => void;
}): Promise<void> {
  const { wasm, setStatusMessage, initializeDocument, markDocumentClean } = params;
  try {
    setStatusMessage('새 문서 생성 중...');
    const docInfo = wasm.createNewDocument();
    await initializeDocument(docInfo, `새 문서.hwp — ${docInfo.pageCount}페이지`);
    markDocumentClean();
  } catch (error) {
    setStatusMessage(`새 문서 생성 실패: ${error}`);
    console.error('[main] 새 문서 생성 실패:', error);
  }
}

