import { strict as assert } from 'node:assert';
import test from 'node:test';
import { engineTextLength, installEmbeddedApi } from './embedded-api';

test('embedded replaceRange reports engine character length for non-BMP text', () => {
  assert.equal(engineTextLength('A😀🚀B'), 4);
  assert.equal(engineTextLength('𐐷'), 1);
});

type PostedMessage = { payload: any; targetOrigin: string };

function installForTest(overrides: Partial<Parameters<typeof installEmbeddedApi>[0]> = {}) {
  const listeners: Array<(event: MessageEvent) => void> = [];
  const posted: PostedMessage[] = [];
  const source = { postMessage: (payload: any, options: { targetOrigin: string }) => {
    posted.push({ payload, targetOrigin: options.targetOrigin });
  } } as unknown as MessageEventSource;
  const wasm = {
    pageCount: 1,
    loadDocument: () => ({ pageCount: 1 }),
    renderPageSvg: () => '<svg />',
    replaceRange: () => ({ ok: true, newLength: 1 }),
    getVersionInfo: () => ({ productName: 'Uni-HWP', adapterVersion: 'test', engineVersion: 'test' }),
    getCapabilities: () => ({ rangeReplace: true, fieldAutomation: true, progressivePaging: true }),
    ...(overrides.wasm ?? {}),
  };
  (globalThis as any).window = {
    location: { origin: 'https://host.test' },
    addEventListener: (_name: string, listener: (event: MessageEvent) => void) => listeners.push(listener),
  };
  installEmbeddedApi({
    wasm: wasm as any,
    documentLifecycle: { initializeDocument: async () => {} },
    ...overrides,
  });
  return { listeners, posted, source };
}

function dispatch(
  listeners: Array<(event: MessageEvent) => void>,
  source: MessageEventSource,
  data: unknown,
  origin = 'https://host.test',
): void {
  // Node's MessageEvent requires a real MessagePort for `source`; the
  // browser API only relies on this small structural subset here.
  listeners[0]({ data, origin, source } as MessageEvent);
}

test('embedded API rejects malformed RPC input with a correlated error', async () => {
  const { listeners, posted, source } = installForTest();
  dispatch(listeners, source, {
    type: 'rhwp-request', id: 'bad-1', method: 'replaceRange',
    params: { sectionIndex: 0, paragraphIndex: 0, startOffset: -1, length: 1, newText: 'x' },
  });
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(posted, [{
    payload: { type: 'rhwp-response', id: 'bad-1', error: 'Invalid RPC request' },
    targetOrigin: 'https://host.test',
  }]);
});

test('embedded API ignores a valid-looking RPC from a disallowed origin', async () => {
  let calls = 0;
  const { listeners, posted, source } = installForTest({
    wasm: { pageCount: 1, replaceRange: () => { calls += 1; return { ok: true, newLength: 1 }; } } as any,
    allowedOrigins: ['https://host.test'],
  });
  dispatch(listeners, source, { type: 'rhwp-request', id: 7, method: 'pageCount' }, 'https://evil.test');
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(calls, 0);
  assert.deepEqual(posted, []);
});
