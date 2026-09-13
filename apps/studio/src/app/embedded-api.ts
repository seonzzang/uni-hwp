import type { UniHwpPublicApi } from '@/engine-boundary/uni-hwp-engine';
import type { InputHandler } from '@/engine/input-handler';
import { ReplaceRangeCommand } from '@/engine/command';

/** Length in the engine's Unicode scalar-value character units (Rust `char`). */
export function engineTextLength(text: string): number {
  return Array.from(text).length;
}

export type EmbeddedRpcRequest =
  | { type: 'rhwp-request'; id: string | number; method: 'loadFile'; params: { data: ArrayBuffer | ArrayLike<number>; fileName?: string } }
  | { type: 'rhwp-request'; id: string | number; method: 'getPageSvg'; params: { page?: number } }
  | { type: 'rhwp-request'; id: string | number; method: 'replaceRange'; params: { sectionIndex: number; paragraphIndex: number; startOffset: number; length: number; newText: string } }
  | { type: 'rhwp-request'; id: string | number; method: 'pageCount' | 'getVersionInfo' | 'getCapabilities' | 'ready'; params?: Record<string, never> };

type EmbeddedLoadMessage = {
  type: 'hwpctl-load';
  /** Optional for compatibility with the original one-way hwpctl protocol. */
  id?: string | number;
  data: ArrayBuffer | ArrayLike<number>;
  fileName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRequestId(value: unknown): value is string | number {
  return (typeof value === 'string' && value.length > 0)
    || (typeof value === 'number' && Number.isFinite(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isByteSource(value: unknown): value is ArrayBuffer | ArrayLike<number> {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
  return Array.isArray(value)
    && value.every((byte) => typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255);
}

function hasOnlyEmptyParams(value: unknown): boolean {
  return value === undefined || (isRecord(value) && Object.keys(value).length === 0);
}

function isRpcRequest(value: unknown): value is EmbeddedRpcRequest {
  if (!isRecord(value) || value.type !== 'rhwp-request' || !isRequestId(value.id)) return false;

  switch (value.method) {
    case 'pageCount':
    case 'getVersionInfo':
    case 'getCapabilities':
    case 'ready':
      return hasOnlyEmptyParams(value.params);
    case 'loadFile':
      return isRecord(value.params)
        && isByteSource(value.params.data)
        && (value.params.fileName === undefined || typeof value.params.fileName === 'string');
    case 'getPageSvg':
      return isRecord(value.params)
        && (value.params.page === undefined || isNonNegativeInteger(value.params.page));
    case 'replaceRange':
      return isRecord(value.params)
        && isNonNegativeInteger(value.params.sectionIndex)
        && isNonNegativeInteger(value.params.paragraphIndex)
        && isNonNegativeInteger(value.params.startOffset)
        && isNonNegativeInteger(value.params.length)
        && typeof value.params.newText === 'string';
    default:
      return false;
  }
}

function isLoadMessage(value: unknown): value is EmbeddedLoadMessage {
  return isRecord(value)
    && value.type === 'hwpctl-load'
    && (value.id === undefined || isRequestId(value.id))
    && isByteSource(value.data)
    && (value.fileName === undefined || typeof value.fileName === 'string');
}

function isAllowedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

function postEmbeddedMessage(
  source: MessageEventSource | null,
  origin: string,
  allowedOrigins: readonly string[],
  payload: unknown,
): void {
  if (!source || !isAllowedOrigin(origin, allowedOrigins)) return;
  source.postMessage(payload, {
    targetOrigin: allowedOrigins.includes('*') ? '*' : origin,
  });
}

function toBytes(value: ArrayBuffer | ArrayLike<number>): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(value);
}

type DocumentLifecycle = {
  initializeDocument: (docInfo: any, displayName: string) => Promise<void>;
};

export function installEmbeddedApi(params: {
  wasm: UniHwpPublicApi;
  getInputHandler?: () => InputHandler | null;
  documentLifecycle: DocumentLifecycle;
  /** Explicit origins allowed to call the embedded API. Same-origin by default. */
  allowedOrigins?: readonly string[];
}): void {
  const { wasm, documentLifecycle } = params;
  const allowedOrigins = params.allowedOrigins ?? [window.location.origin];

  window.addEventListener('message', async (event) => {
    const message: unknown = event.data;

    if (!isAllowedOrigin(event.origin, allowedOrigins)) return;

    if (isLoadMessage(message)) {
      try {
        const bytes = toBytes(message.data);
        const docInfo = wasm.loadDocument(bytes, message.fileName || 'document.hwp');
        await documentLifecycle.initializeDocument(
          docInfo,
          `${message.fileName || 'document'} — ${docInfo.pageCount}페이지`,
        );
        if (message.id !== undefined) {
          postEmbeddedMessage(event.source, event.origin, allowedOrigins, {
            type: 'rhwp-response',
            id: message.id,
            result: { pageCount: docInfo.pageCount },
          });
        }
      } catch (error: any) {
        if (message.id !== undefined) {
          postEmbeddedMessage(event.source, event.origin, allowedOrigins, {
            type: 'rhwp-response',
            id: message.id,
            error: error.message || String(error),
          });
        }
      }
      return;
    }

    if (!isRpcRequest(message)) {
      // A recognizable request with malformed params gets a response instead
      // of being silently dropped, so callers can distinguish bad input from
      // an unavailable embedded API.
      if (isRecord(message) && message.type === 'rhwp-request' && isRequestId(message.id)) {
        postEmbeddedMessage(event.source, event.origin, allowedOrigins, {
          type: 'rhwp-response', id: message.id, error: 'Invalid RPC request',
        });
      }
      return;
    }

    const { id, method, params: methodParams } = message;
    const reply = (result?: unknown, error?: string) => {
      postEmbeddedMessage(event.source, event.origin, allowedOrigins, {
        type: 'rhwp-response', id, result, error,
      });
    };

    try {
      switch (method) {
        case 'loadFile': {
          const bytes = toBytes(methodParams.data);
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
          reply(wasm.renderPageSvg(methodParams?.page ?? 0));
          break;
        case 'getVersionInfo':
          reply(wasm.getVersionInfo());
          break;
        case 'getCapabilities':
          reply(wasm.getCapabilities());
          break;
        case 'replaceRange':
          {
            const inputHandler = params.getInputHandler?.();
            if (inputHandler) {
              inputHandler.executeOperation({
                kind: 'command',
                command: new ReplaceRangeCommand(methodParams.sectionIndex, methodParams.paragraphIndex,
                  methodParams.startOffset, methodParams.length, methodParams.newText),
              });
              reply({ ok: true, newLength: engineTextLength(methodParams.newText) });
            } else {
              reply(wasm.replaceRange(methodParams.sectionIndex, methodParams.paragraphIndex,
                methodParams.startOffset, methodParams.length, methodParams.newText));
            }
          }
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

