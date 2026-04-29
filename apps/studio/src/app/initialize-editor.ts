import { loadWebFonts } from '@/core/font-loader';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { EventBus } from '@/core/event-bus';
import type { CommandDispatcher } from '@/command/dispatcher';
import type { CommandRegistry } from '@/command/registry';
import type { CanvasView } from '@/view/canvas-view';
import type { InputHandler } from '@/engine/input-handler';
import { bootstrapEditor } from '@/app/bootstrap-editor';
import { setupDevRuntime } from '@/app/dev-runtime';
import {
  setupGlobalShortcuts as installGlobalShortcuts,
  setupStatusEventListeners as installStatusEventListeners,
  setupZoomControls as installZoomControls,
} from '@/app/editor-ui';
import { installFileInput } from '@/app/file-input';
import { setupToolbarCommandBindings } from '@/app/toolbar-bindings';

type DocumentLifecycle = {
  loadFromUrlParam: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  loadBytes: (data: Uint8Array, fileName: string, fileHandle: any, startTime?: number) => Promise<void>;
};

export async function initializeEditorApp(params: {
  wasm: UniHwpEngine;
  eventBus: EventBus;
  dispatcher: CommandDispatcher;
  registry: CommandRegistry;
  documentLifecycle: DocumentLifecycle;
  getTotalSections: () => number;
  getStatusMessageElement: () => HTMLElement;
  sbPage: () => HTMLElement;
  sbSection: () => HTMLElement;
  sbZoomVal: () => HTMLElement;
  onBootstrapped: (payload: {
    canvasView: CanvasView;
    inputHandler: InputHandler;
    ruler: unknown;
    toolbar: unknown;
  }) => void;
}): Promise<void> {
  const {
    wasm,
    eventBus,
    dispatcher,
    registry,
    documentLifecycle,
    getTotalSections,
    getStatusMessageElement,
    sbPage,
    sbSection,
    sbZoomVal,
    onBootstrapped,
  } = params;

  const messageElement = getStatusMessageElement();
  messageElement.textContent = '웹폰트 로딩 중...';
  await loadWebFonts([]);
  messageElement.textContent = 'WASM 로딩 중...';
  await wasm.initialize();
  messageElement.textContent = 'HWP 파일을 선택해주세요.';

  const bootstrappedEditor = bootstrapEditor({
    wasm,
    eventBus,
    dispatcher,
    registry,
  });
  onBootstrapped(bootstrappedEditor);

  setupToolbarCommandBindings(dispatcher);
  installFileInput({
    documentLifecycle,
    setStatusMessage: (message) => {
      getStatusMessageElement().textContent = message;
    },
  });
  installZoomControls({ wasm, canvasView: bootstrappedEditor.canvasView });
  installStatusEventListeners({
    eventBus,
    wasm,
    getTotalSections,
    sbPage,
    sbSection,
    sbZoomVal,
  });
  installGlobalShortcuts({
    dispatcher,
    getInputHandler: () => bootstrappedEditor.inputHandler,
  });
  await documentLifecycle.loadFromUrlParam();

  await setupDevRuntime({
    wasm,
    inputHandler: bootstrappedEditor.inputHandler,
    canvasView: bootstrappedEditor.canvasView,
    dispatcher,
    setStatusMessage: (message) => {
      getStatusMessageElement().textContent = message;
    },
    loadBytes: documentLifecycle.loadBytes,
  });
}

