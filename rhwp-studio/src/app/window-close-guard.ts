import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { DocumentSession } from '@/app/document-session';
import { ensureDocumentCanCloseOrReplace } from '@/app/document-close-guard';
import {
  isPdfPreviewActive,
  requestPdfPreviewClose,
} from '@/pdf/pdf-preview-controller';

let closeGuardUnlisten: (() => void) | null = null;

export async function installWindowCloseGuard(params: {
  wasm: UniHwpEngine;
  documentSession: DocumentSession;
}): Promise<void> {
  const { wasm, documentSession } = params;
  let allowBrowserUnload = false;

  window.addEventListener('beforeunload', (event) => {
    if (allowBrowserUnload) return;
    if (!documentSession.isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  const windowLike = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  if (!windowLike.__TAURI__ && !windowLike.__TAURI_INTERNALS__) {
    return;
  }

  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  let allowClose = false;

  if (closeGuardUnlisten) {
    closeGuardUnlisten();
    closeGuardUnlisten = null;
  }

  closeGuardUnlisten = await appWindow.onCloseRequested(async (event) => {
    if (allowClose) return;

    if (isPdfPreviewActive()) {
      const handled = requestPdfPreviewClose();
      if (handled) {
        console.info('[window-close] pdf-preview');
        event.preventDefault();
        return;
      }
    }

    if (!documentSession.isDirty()) {
      console.info('[window-close] clean');
      return;
    }

    console.info('[window-close] dirty');
    event.preventDefault();
    const canClose = await ensureDocumentCanCloseOrReplace({
      wasm,
      documentSession,
    });
    if (!canClose) {
      console.info('[window-close] dirty cancelled');
      return;
    }

    console.info('[window-close] dirty accepted');
    allowBrowserUnload = true;
    allowClose = true;
    await appWindow.destroy();
  });
}
