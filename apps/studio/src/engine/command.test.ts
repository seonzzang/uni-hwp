import { strict as assert } from 'node:assert';
import test from 'node:test';
import { ReplaceRangeCommand } from './command';

test('ReplaceRangeCommand keeps emoji undo/redo lengths in engine character units', () => {
  let text = 'A😀BC';
  const calls: Array<[number, number, string]> = [];
  const wasm = {
    getTextRange: (_section: number, _paragraph: number, start: number, length: number) => {
      assert.equal(start, 1);
      assert.equal(length, 1);
      return text.slice(1, 3);
    },
    replaceRange: (_section: number, _paragraph: number, start: number, length: number, replacement: string) => {
      calls.push([start, length, replacement]);
      const chars = Array.from(text);
      text = chars.slice(0, start).concat(Array.from(replacement), chars.slice(start + length)).join('');
      return { ok: true, newLength: Array.from(replacement).length };
    },
  } as any;

  const command = new ReplaceRangeCommand(0, 0, 1, 1, '🚀');
  assert.deepEqual(command.execute(wasm), { sectionIndex: 0, paragraphIndex: 0, charOffset: 2 });
  assert.equal(text, 'A🚀BC');
  assert.deepEqual(calls[0], [1, 1, '🚀']);

  assert.deepEqual(command.undo(wasm), { sectionIndex: 0, paragraphIndex: 0, charOffset: 2 });
  assert.equal(text, 'A😀BC');
  assert.deepEqual(calls[1], [1, 1, '😀']);
});
