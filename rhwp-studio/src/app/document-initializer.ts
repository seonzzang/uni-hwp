import { loadWebFonts } from '@/core/font-loader';
import type { DocumentInfo } from '@/core/types';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { CanvasView } from '@/view/canvas-view';
import type { InputHandler } from '@/engine/input-handler';
import type { Toolbar } from '@/ui/toolbar';
import { runDocumentValidation } from '@/app/document-validation';

export async function initializeLoadedDocument(params: {
  wasm: UniHwpEngine;
  docInfo: DocumentInfo;
  displayName: string;
  canvasView: CanvasView | null;
  inputHandler: InputHandler | null;
  toolbar: Toolbar | null;
  getStatusElement: () => HTMLElement;
  setTotalSections: (count: number) => void;
  setSectionText: (text: string) => void;
}): Promise<void> {
  const {
    wasm,
    docInfo,
    displayName,
    canvasView,
    inputHandler,
    toolbar,
    getStatusElement,
    setTotalSections,
    setSectionText,
  } = params;

  const statusElement = getStatusElement();

  try {
    console.log('[initDoc] 1. 폰트 로딩 시작');
    if (docInfo.fontsUsed?.length) {
      await loadWebFonts(docInfo.fontsUsed, (loaded, total) => {
        statusElement.textContent = `폰트 로딩 중... (${loaded}/${total})`;
      });
    }
    console.log('[initDoc] 2. 폰트 로딩 완료');
    statusElement.textContent = displayName;
    setTotalSections(docInfo.sectionCount ?? 1);
    setSectionText(`구역: 1 / ${docInfo.sectionCount ?? 1}`);
    console.log('[initDoc] 3. inputHandler deactivate');
    inputHandler?.deactivate();
    console.log('[initDoc] 4. canvasView loadDocument');
    await canvasView?.loadDocument(docInfo.pageCount);
    console.log('[initDoc] 5. toolbar setEnabled');
    toolbar?.setEnabled(true);
    console.log('[initDoc] 6. toolbar initStyleDropdown');
    toolbar?.initStyleDropdown();
    console.log('[initDoc] 7. inputHandler activateWithCaretPosition');
    inputHandler?.activateWithCaretPosition();
    console.log('[initDoc] 8. 완료');

    await runDocumentValidation({
      wasm,
      canvasView,
      pageCount: docInfo.pageCount,
      displayName,
      setStatusMessage: (message) => {
        statusElement.textContent = message;
      },
    });
  } catch (error) {
    console.error('[initDoc] 오류:', error);
    if (window.innerWidth < 768) alert(`초기화 오류: ${error}`);
  }
}

