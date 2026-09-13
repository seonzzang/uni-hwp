import test from 'node:test';
import assert from 'node:assert/strict';
import { WasmBridge } from './wasm-bridge';

test('P7: paragraph text uses the Uni-HWP adapter name', () => {
  const bridge = new WasmBridge() as any;
  bridge.doc = { getTextRange: () => 'TAC text' };
  assert.equal(bridge.getParagraphText(0, 1, 50), 'TAC text');
});

test('P7: picture input is normalized through insertPictureEx', () => {
  const bridge = new WasmBridge() as any;
  let options = '';
  let bytes: Uint8Array | null = null;
  bridge.doc = {
    insertPictureEx(raw: string, data: Uint8Array) {
      options = raw;
      bytes = data;
      return JSON.stringify({ ok: true, paraIdx: 2, controlIdx: 0 });
    },
  };

  const result = bridge.insertPicture(0, 2, 0, [1, 2, 3], 100, 80, 10, 8, undefined, 42);
  assert.deepEqual(result, { ok: true, paraIdx: 2, controlIdx: 0 });
  assert.deepEqual(Array.from(bytes!), [1, 2, 3]);
  assert.equal(JSON.parse(options).extension, 'png');
  assert.equal(JSON.parse(options).description, '42');
});
