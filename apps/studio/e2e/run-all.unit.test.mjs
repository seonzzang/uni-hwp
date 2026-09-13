import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDurableState, parseArgs, resolveOutputDir, discoverTests } from './run-all.mjs';

test('resume contract requires an explicit target and accepts run id', () => {
  assert.deepEqual(parseArgs(['--resume', 'run-123']), { mode: 'resume', target: 'run-123', runId: null, outputDir: null, help: false });
  assert.throws(() => resolveOutputDir(parseArgs(['--resume'])), /Resume target required/);
});

test('durable state prefers state.json and preserves results including interruptions', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uni-hwp-e2e-'));
  try {
    writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ results: [{ test: 'old.test.mjs', status: 'PASS', exit_code: 0 }] }));
    writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ status: 'INTERRUPTED', results: [{ test: 'old.test.mjs', status: 'INTERRUPTED', exit_code: 130 }] }));
    assert.equal(loadDurableState(dir).results[0].exit_code, 130);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('supervisor test itself is not added to the child test plan', () => {
  assert.ok(discoverTests().every(file => !file.endsWith('run-all.unit.test.mjs')));
});
