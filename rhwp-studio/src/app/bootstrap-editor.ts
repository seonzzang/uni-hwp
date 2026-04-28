import type { EventBus } from '@/core/event-bus';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { CommandDispatcher } from '@/command/dispatcher';
import type { CommandRegistry } from '@/command/registry';
import { CanvasView } from '@/view/canvas-view';
import { InputHandler } from '@/engine/input-handler';
import { Toolbar } from '@/ui/toolbar';
import { MenuBar } from '@/ui/menu-bar';
import { ContextMenu } from '@/ui/context-menu';
import { CommandPalette } from '@/ui/command-palette';
import { CellSelectionRenderer } from '@/engine/cell-selection-renderer';
import { TableObjectRenderer } from '@/engine/table-object-renderer';
import { TableResizeRenderer } from '@/engine/table-resize-renderer';
import { Ruler } from '@/view/ruler';

export type BootstrappedEditor = {
  canvasView: CanvasView;
  inputHandler: InputHandler;
  ruler: Ruler;
  toolbar: Toolbar;
};

type BootstrapEditorParams = {
  wasm: UniHwpEngine;
  eventBus: EventBus;
  dispatcher: CommandDispatcher;
  registry: CommandRegistry;
};

export function bootstrapEditor(params: BootstrapEditorParams): BootstrappedEditor {
  const { wasm, eventBus, dispatcher, registry } = params;
  const container = document.getElementById('scroll-container')!;
  const canvasView = new CanvasView(container, wasm, eventBus);

  const ruler = new Ruler(
    document.getElementById('h-ruler') as HTMLCanvasElement,
    document.getElementById('v-ruler') as HTMLCanvasElement,
    container,
    eventBus,
    wasm,
    canvasView.getVirtualScroll(),
    canvasView.getViewportManager(),
  );

  const inputHandler = new InputHandler(
    container,
    wasm,
    eventBus,
    canvasView.getVirtualScroll(),
    canvasView.getViewportManager(),
  );

  const toolbar = new Toolbar(document.getElementById('style-bar')!, wasm, eventBus, dispatcher);
  toolbar.setEnabled(false);

  inputHandler.setDispatcher(dispatcher);
  inputHandler.setContextMenu(new ContextMenu(dispatcher, registry));
  inputHandler.setCommandPalette(new CommandPalette(registry, dispatcher));
  inputHandler.setCellSelectionRenderer(
    new CellSelectionRenderer(container, canvasView.getVirtualScroll()),
  );
  inputHandler.setTableObjectRenderer(
    new TableObjectRenderer(container, canvasView.getVirtualScroll()),
  );
  inputHandler.setTableResizeRenderer(
    new TableResizeRenderer(container, canvasView.getVirtualScroll()),
  );
  inputHandler.setPictureObjectRenderer(
    new TableObjectRenderer(container, canvasView.getVirtualScroll(), true),
  );

  new MenuBar(document.getElementById('menu-bar')!, eventBus, dispatcher);

  return {
    canvasView,
    inputHandler,
    ruler,
    toolbar,
  };
}

