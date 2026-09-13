import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { DocumentPosition } from '@/core/types';
import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { EditCommand } from './command';
import { CommandHistory } from './history';

const position: DocumentPosition = { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 };

function command(behavior: { execute?: () => void; undo?: () => void }): EditCommand {
  return {
    type: 'test',
    timestamp: Date.now(),
    execute: () => { behavior.execute?.(); return position; },
    undo: () => { behavior.undo?.(); return position; },
    mergeWith: () => null,
  };
}

const wasm = {} as UniHwpEngine;

test('undo keeps the entry when the WASM undo operation throws', () => {
  const history = new CommandHistory();
  let fail = true;
  history.execute(command({ undo: () => { if (fail) throw new Error('injected WASM undo failure'); } }), wasm);

  assert.throws(() => history.undo(wasm), /injected WASM undo failure/);
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);

  fail = false;
  assert.deepEqual(history.undo(wasm), position);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), true);
});

test('redo keeps the entry when the WASM execute operation throws', () => {
  const history = new CommandHistory();
  let fail = false;
  history.execute(command({ execute: () => { if (fail) throw new Error('injected WASM redo failure'); } }), wasm);
  history.undo(wasm);
  fail = true;

  assert.throws(() => history.redo(wasm), /injected WASM redo failure/);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), true);

  fail = false;
  assert.deepEqual(history.redo(wasm), position);
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);
});
