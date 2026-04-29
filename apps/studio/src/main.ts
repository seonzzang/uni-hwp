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
import { DocumentSession } from '@/app/document-session';
import { createDocumentLifecycle } from '@/app/document-lifecycle';
import { createEditorContextRuntime } from '@/app/editor-context';
import { getStatusElements, setDocumentTransitioning } from '@/app/editor-dom';
import { installEmbeddedApi } from '@/app/embedded-api';
import { installEditorEventBindings } from '@/app/event-bindings';
import { initializeEditorApp } from '@/app/initialize-editor';
import { installWindowCloseGuard } from '@/app/window-close-guard';

const wasm = createUniHwpEngine();
const eventBus = new EventBus();
const documentSession = new DocumentSession();
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
  documentSession,
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
  eventBus,
  getCanvasView: () => canvasView,
  getInputHandler: () => inputHandler,
  getToolbar: () => toolbar,
  getStatusElement: sbMessage,
  setDocumentTransitioning,
  setTotalSections: (count) => {
    totalSections = count;
  },
  setSectionText: (text) => {
    sbSection().textContent = text;
  },
  markDocumentClean: () => {
    documentSession.markClean();
  },
  resetToEmptyState: () => {
    sbMessage().textContent = 'HWP 파일을 선택해주세요.';
    sbPage().textContent = '1 / 1 쪽';
    sbSection().textContent = '구역: 1 / 1';
  },
});

eventBus.on('document-changed', () => {
  if (wasm.pageCount > 0) {
    documentSession.markDirty();
  }
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
void installWindowCloseGuard({
  wasm,
  documentSession,
});
installEmbeddedApi({
  wasm,
  documentLifecycle,
});
