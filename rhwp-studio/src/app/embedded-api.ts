import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';

type DocumentLifecycle = {
  initializeDocument: (docInfo: any, displayName: string) => Promise<void>;
};

export function installEmbeddedApi(params: {
  wasm: UniHwpEngine;
  documentLifecycle: DocumentLifecycle;
}): void {
  const { wasm, documentLifecycle } = params;

  window.addEventListener('message', async (event) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'hwpctl-load' && message.data) {
      try {
        const bytes = new Uint8Array(message.data);
        const docInfo = wasm.loadDocument(bytes, message.fileName || 'document.hwp');
        await documentLifecycle.initializeDocument(
          docInfo,
          `${message.fileName || 'document'} — ${docInfo.pageCount}페이지`,
        );
        event.source?.postMessage(
          {
            type: 'rhwp-response',
            id: message.id,
            result: { pageCount: docInfo.pageCount },
          },
          { targetOrigin: '*' },
        );
      } catch (error: any) {
        event.source?.postMessage(
          {
            type: 'rhwp-response',
            id: message.id,
            error: error.message || String(error),
          },
          { targetOrigin: '*' },
        );
      }
      return;
    }

    if (message.type !== 'rhwp-request' || !message.method) return;

    const { id, method, params: methodParams } = message;
    const reply = (result?: unknown, error?: string) => {
      event.source?.postMessage(
        { type: 'rhwp-response', id, result, error },
        { targetOrigin: '*' },
      );
    };

    try {
      switch (method) {
        case 'loadFile': {
          const bytes = new Uint8Array(methodParams.data);
          const docInfo = wasm.loadDocument(bytes, methodParams.fileName || 'document.hwp');
          await documentLifecycle.initializeDocument(
            docInfo,
            `${methodParams.fileName || 'document'} — ${docInfo.pageCount}페이지`,
          );
          reply({ pageCount: docInfo.pageCount });
          break;
        }
        case 'pageCount':
          reply(wasm.pageCount);
          break;
        case 'getPageSvg':
          reply(wasm.renderPageSvg(methodParams.page ?? 0));
          break;
        case 'ready':
          reply(true);
          break;
        default:
          reply(undefined, `Unknown method: ${method}`);
      }
    } catch (error: any) {
      reply(undefined, error.message || String(error));
    }
  });
}

