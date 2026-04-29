import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { CanvasView } from '@/view/canvas-view';
import type { InputHandler } from '@/engine/input-handler';
import type { CommandDispatcher } from '@/command/dispatcher';
import {
  setupPdfDevtoolsApi as installPdfDevtoolsApi,
  setupPrintWorkerDevtoolsApi as installPrintWorkerDevtoolsApi,
  setupRemoteLinkDropDevtoolsApi as installRemoteLinkDropDevtoolsApi,
} from '@/app/devtools';

export function exposeDevGlobals(params: {
  wasm: UniHwpEngine;
  eventBus: unknown;
}): void {
  if (!import.meta.env.DEV) return;
  (window as any).__wasm = params.wasm;
  (window as any).__eventBus = params.eventBus;
}

export async function setupDevRuntime(params: {
  wasm: UniHwpEngine;
  inputHandler: InputHandler | null;
  canvasView: CanvasView | null;
  dispatcher: CommandDispatcher;
  setStatusMessage: (message: string) => void;
  loadBytes: (
    data: Uint8Array,
    fileName: string,
    fileHandle: null,
    startTime?: number,
  ) => Promise<void>;
}): Promise<void> {
  if (!import.meta.env.DEV) return;

  (window as any).__inputHandler = params.inputHandler;
  (window as any).__canvasView = params.canvasView;
  (window as any).__printBaseline = (extraParams: Record<string, unknown> = {}) =>
    params.dispatcher.dispatch('file:print', extraParams);

  await installPdfDevtoolsApi(params.wasm);
  await installPrintWorkerDevtoolsApi(params.wasm);
  await installRemoteLinkDropDevtoolsApi({
    setStatusMessage: params.setStatusMessage,
    loadBytes: params.loadBytes,
  });
}

