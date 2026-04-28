import { EventBus } from '@/core/event-bus';
import { CanvasView } from '@/view/canvas-view';
import { InputHandler } from '@/engine/input-handler';
import { Toolbar } from '@/ui/toolbar';
import type { EditorContext, CommandServices } from '@/command/types';
import { Ruler } from '@/view/ruler';
import { invoke } from '@tauri-apps/api/core';
import { createUniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import { createCommandRuntime } from '@/app/command-runtime';
import { exposeDevGlobals } from '@/app/dev-runtime';
import { createDocumentLifecycle } from '@/app/document-lifecycle';
import { createEditorContextRuntime } from '@/app/editor-context';
import { getStatusElements, setDocumentTransitioning } from '@/app/editor-dom';
import { installEmbeddedApi } from '@/app/embedded-api';
import { installEditorEventBindings } from '@/app/event-bindings';
import { initializeEditorApp } from '@/app/initialize-editor';

const wasm = createUniHwpEngine();
const eventBus = new EventBus();
const { sbMessage, sbPage, sbSection, sbZoomVal } = getStatusElements();

// E2E 테스트용 전역 노출 (개발 모드 전용)
exposeDevGlobals({ wasm, eventBus });
let canvasView: CanvasView | null = null;
let inputHandler: InputHandler | null = null;
let toolbar: Toolbar | null = null;
let ruler: Ruler | null = null;
const { commandServices } = createEditorContextRuntime({
  wasm,
  eventBus,
  getInputHandler: () => inputHandler,
  getCanvasView: () => canvasView,
});

const { registry, dispatcher } = createCommandRuntime({
  commandServices,
  eventBus,
});

let totalSections = 1;

const documentLifecycle = createDocumentLifecycle({
  wasm,
  getCanvasView: () => canvasView,
  getInputHandler: () => inputHandler,
  getToolbar: () => toolbar,
  getStatusElement: sbMessage,
  setDocumentTransitioning,
  setTotalSections: (count) => {
    totalSections = count;
  },
  getTotalSections: () => totalSections,
  setSectionText: (text) => {
    sbSection().textContent = text;
  },
});

async function initialize(): Promise<void> {
  const msg = sbMessage();
  try {
    await initializeEditorApp({
      wasm,
      eventBus,
      dispatcher,
      registry,
      documentLifecycle,
      getTotalSections: () => totalSections,
      getStatusMessageElement: sbMessage,
      sbPage,
      sbSection,
      sbZoomVal,
      onBootstrapped: (bootstrappedEditor) => {
        canvasView = bootstrappedEditor.canvasView;
        inputHandler = bootstrappedEditor.inputHandler;
        ruler = bootstrappedEditor.ruler as Ruler;
        toolbar = bootstrappedEditor.toolbar as Toolbar;
      },
    });
  } catch (error) {
    msg.textContent = `WASM 초기화 실패: ${error}`;
    console.error('[main] WASM 초기화 실패:', error);
  }
}

installEditorEventBindings({
  eventBus,
  dispatcher,
  documentLifecycle,
});

initialize();
installEmbeddedApi({
  wasm,
  documentLifecycle,
});
