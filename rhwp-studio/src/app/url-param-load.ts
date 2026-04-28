import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { DocumentInfo } from '@/core/types';

type InitializeDocumentFn = (docInfo: DocumentInfo, displayName: string) => Promise<void>;

export async function loadDocumentFromUrlParam(params: {
  wasm: UniHwpEngine;
  getStatusElement: () => HTMLElement;
  initializeDocument: InitializeDocumentFn;
}): Promise<void> {
  const queryParams = new URLSearchParams(window.location.search);
  const fileUrl = queryParams.get('url');
  if (!fileUrl) return;

  const fileName =
    queryParams.get('filename')
    || fileUrl.split('/').pop()?.split('?')[0]
    || 'document.hwp';
  const statusElement = params.getStatusElement();

  try {
    statusElement.textContent = '파일 로딩 중...';
    console.log(`[loadFromUrlParam] ${fileUrl}`);

    let response: Response;

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        response = await fetch(fileUrl);
      } catch {
        const result = await chrome.runtime.sendMessage({ type: 'fetch-file', url: fileUrl });
        if (result.error) throw new Error(result.error);
        const data = new Uint8Array(result.data);
        const docInfo = params.wasm.loadDocument(data, fileName);
        await params.initializeDocument(docInfo, `${fileName} — ${docInfo.pageCount}페이지`);
        return;
      }
    } else {
      response = await fetch(fileUrl);
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    const docInfo = params.wasm.loadDocument(data, fileName);
    await params.initializeDocument(docInfo, `${fileName} — ${docInfo.pageCount}페이지`);
  } catch (error) {
    const errorMessage = `파일 로드 실패: ${error}`;
    statusElement.textContent = errorMessage;
    console.error('[loadFromUrlParam]', error);
  }
}

