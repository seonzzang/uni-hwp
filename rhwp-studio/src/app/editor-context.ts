import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { EventBus } from '@/core/event-bus';
import type { EditorContext, CommandServices } from '@/command/types';
import type { InputHandler } from '@/engine/input-handler';
import type { CanvasView } from '@/view/canvas-view';

export function createEditorContextRuntime(params: {
  wasm: UniHwpEngine;
  eventBus: EventBus;
  getInputHandler: () => InputHandler | null;
  getCanvasView: () => CanvasView | null;
}): {
  getContext: () => EditorContext;
  commandServices: CommandServices;
} {
  const { wasm, eventBus, getInputHandler, getCanvasView } = params;

  function getContext(): EditorContext {
    const inputHandler = getInputHandler();
    const canvasView = getCanvasView();
    const hasDoc = wasm.pageCount > 0;

    return {
      hasDocument: hasDoc,
      hasSelection: inputHandler?.hasSelection() ?? false,
      inTable: inputHandler?.isInTable() ?? false,
      inCellSelectionMode: inputHandler?.isInCellSelectionMode() ?? false,
      inTableObjectSelection: inputHandler?.isInTableObjectSelection() ?? false,
      inPictureObjectSelection: inputHandler?.isInPictureObjectSelection() ?? false,
      inField: inputHandler?.isInField() ?? false,
      isEditable: true,
      canUndo: inputHandler?.canUndo() ?? false,
      canRedo: inputHandler?.canRedo() ?? false,
      zoom: canvasView?.getViewportManager().getZoom() ?? 1.0,
      showControlCodes: wasm.getShowControlCodes(),
      sourceFormat: hasDoc ? (wasm.getSourceFormat() as 'hwp' | 'hwpx') : undefined,
    };
  }

  return {
    getContext,
    commandServices: {
      eventBus,
      wasm,
      getContext,
      getInputHandler,
      getViewportManager: () => getCanvasView()?.getViewportManager() ?? null,
    },
  };
}

