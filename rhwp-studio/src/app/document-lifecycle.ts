import type { DocumentInfo } from '@/core/types';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { CanvasView } from '@/view/canvas-view';
import type { InputHandler } from '@/engine/input-handler';
import type { Toolbar } from '@/ui/toolbar';
import { initializeLoadedDocument } from '@/app/document-initializer';
import { createBlankDocument, loadDocumentBytes, loadDocumentFile } from '@/app/document-load-actions';
import { loadDocumentFromUrlParam } from '@/app/url-param-load';

type LifecycleDeps = {
  wasm: UniHwpEngine;
  getCanvasView: () => CanvasView | null;
  getInputHandler: () => InputHandler | null;
  getToolbar: () => Toolbar | null;
  getStatusElement: () => HTMLElement;
  setDocumentTransitioning: (isTransitioning: boolean) => void;
  setTotalSections: (count: number) => void;
  getTotalSections: () => number;
  setSectionText: (text: string) => void;
};

export function createDocumentLifecycle(deps: LifecycleDeps) {
  const {
    wasm,
    getCanvasView,
    getInputHandler,
    getToolbar,
    getStatusElement,
    setDocumentTransitioning,
    setTotalSections,
    setSectionText,
  } = deps;

  async function initializeDocument(docInfo: DocumentInfo, displayName: string): Promise<void> {
    await initializeLoadedDocument({
      wasm,
      docInfo,
      displayName,
      canvasView: getCanvasView(),
      inputHandler: getInputHandler(),
      toolbar: getToolbar(),
      getStatusElement,
      setTotalSections,
      setSectionText,
    });
  }

  async function loadFile(file: File): Promise<void> {
    await loadDocumentFile({
      file,
      setStatusMessage: (message) => {
        getStatusElement().textContent = message;
      },
      loadBytes,
    });
  }

  async function loadBytes(
    data: Uint8Array,
    fileName: string,
    fileHandle: typeof wasm.currentFileHandle,
    startTime = performance.now(),
  ): Promise<void> {
    await loadDocumentBytes({
      wasm,
      data,
      fileName,
      fileHandle,
      startTime,
      setDocumentTransitioning,
      deactivateInput: () => {
        getInputHandler()?.deactivate();
      },
      initializeDocument,
      getStatusElement,
    });
  }

  async function createNewDocument(): Promise<void> {
    await createBlankDocument({
      wasm,
      setStatusMessage: (message) => {
        getStatusElement().textContent = message;
      },
      initializeDocument,
    });
  }

  async function loadFromUrlParam(): Promise<void> {
    await loadDocumentFromUrlParam({
      wasm,
      getStatusElement,
      initializeDocument,
    });
  }

  return {
    createNewDocument,
    initializeDocument,
    loadBytes,
    loadFile,
    loadFromUrlParam,
  };
}

