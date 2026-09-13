/**
 * Studio E2E supervisor.
 *
 * Contract: --fresh starts a new run; --resume <run-id|output-dir> resumes
 * an existing run in place. --run-id and --output-dir are explicit selectors.
 * summary.json and state.json are atomically updated after every child.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRunsDir = path.resolve(root, '../output/e2e/runs');

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { mode: 'fresh', target: null, runId: null, outputDir: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--fresh') args.mode = 'fresh';
    else if (arg === '--resume') { args.mode = 'resume'; if (argv[i + 1] && !argv[i + 1].startsWith('--')) args.target = argv[++i]; }
    else if (arg === '--run-id') args.runId = argv[++i];
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.mode === 'resume' && args.target && (args.runId || args.outputDir)) throw new Error('--resume <target> cannot be combined with --run-id/--output-dir');
  return args;
}

export function resolveOutputDir(args, cwd = process.cwd()) {
  const explicit = args.outputDir || process.env.E2E_OUTPUT_DIR;
  if (args.mode === 'resume') {
    const target = args.target || args.runId || explicit;
    if (!target) throw new Error('Resume target required: use --resume <run-id|output-dir>, --run-id <id>, or --output-dir <dir>');
    const candidate = path.isAbsolute(target) ? target : (target.includes(path.sep) || target.includes('/') ? path.resolve(cwd, target) : path.join(defaultRunsDir, target));
    if (!existsSync(path.join(candidate, 'summary.json')) && !existsSync(path.join(candidate, 'state.json'))) throw new Error(`No resumable E2E state found in ${candidate}`);
    return candidate;
  }
  if (explicit) return path.resolve(root, explicit);
  return path.join(defaultRunsDir, args.runId || new Date().toISOString().replace(/[:.]/g, '-'));
}

export function loadDurableState(outputDir) {
  for (const file of [path.join(outputDir, 'state.json'), path.join(outputDir, 'summary.json')]) {
    if (!existsSync(file)) continue;
    try { const state = JSON.parse(readFileSync(file, 'utf8')); if (Array.isArray(state.results)) return state; } catch { /* try the other durable copy */ }
  }
  return null;
}

export function discoverTests(dir = e2eDir) {
  return readdirSync(dir).filter(name => name.endsWith('.test.mjs') && name !== 'run-all.unit.test.mjs').sort().map(name => path.join(dir, name));
}

function atomicJson(file, value) { const tmp = `${file}.tmp-${process.pid}`; writeFileSync(tmp, JSON.stringify(value, null, 2)); renameSync(tmp, file); }

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { console.log('Usage: node e2e/run-all.mjs [--fresh] [--resume <run-id|output-dir>] [--run-id <id>] [--output-dir <dir>]'); return 0; }
  const outputDir = resolveOutputDir(args);
  const durable = args.mode === 'resume' ? loadDurableState(outputDir) : null;
  const runId = durable?.run_id || path.basename(outputDir);
  const viteUrl = process.env.VITE_URL || 'http://localhost:7710';
  const timeoutMs = Number(process.env.E2E_TEST_TIMEOUT_MS || 120000);
  mkdirSync(outputDir, { recursive: true });
  const tests = discoverTests();
  const results = Array.isArray(durable?.results) ? durable.results.slice() : [];
  const completed = new Set(results.map(r => r.test));
  let vite = null; let interrupted = false; let active = null;
  function snapshot(final = false) {
    const summary = { schema: 2, run_id: runId, status: interrupted ? 'INTERRUPTED' : (final ? (results.some(r => r.exit_code !== 0) ? 'FAIL' : 'PASS') : 'RUNNING'), total: tests.length, completed: results.length, passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length, timed_out: results.filter(r => r.status === 'TIMEOUT').length, interrupted: results.filter(r => r.status === 'INTERRUPTED').length, remaining: tests.length - results.length, updated_utc: new Date().toISOString(), results };
    atomicJson(path.join(outputDir, 'summary.json'), summary);
    const next = tests.find(t => !completed.has(path.basename(t)));
    atomicJson(path.join(outputDir, 'state.json'), { ...summary, next_test: next ? path.basename(next) : null });
    return summary;
  }
  function commandForVite() { const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'; return [npm, ['run', 'dev', '--', '--host', 'localhost', '--port', new URL(viteUrl).port || '7710', '--strictPort']]; }
  async function healthy() { try { const r = await fetch(viteUrl, { signal: AbortSignal.timeout(2000) }); return r.status >= 200 && r.status < 500; } catch { return false; } }
  async function ensureVite() { if (await healthy()) return; const [cmd, a] = commandForVite(); const out = path.join(outputDir, 'vite.stdout.log'); const err = path.join(outputDir, 'vite.stderr.log'); vite = spawn(cmd, a, { cwd: root, env: { ...process.env, BROWSER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: process.platform === 'win32' }); vite.stdout.pipe(createWriteStream(out)); vite.stderr.pipe(createWriteStream(err)); const deadline = Date.now() + 30000; while (Date.now() < deadline) { if (vite.exitCode !== null) throw new Error(`Vite exited with ${vite.exitCode}; see ${err}`); if (await healthy()) return; await new Promise(r => setTimeout(r, 500)); } throw new Error(`Vite health-check timeout; see ${err}`); }
  function stopVite() { if (!vite || vite.exitCode !== null) return; if (process.platform === 'win32') spawn('taskkill', ['/PID', String(vite.pid), '/T', '/F'], { windowsHide: true }); else vite.kill('SIGTERM'); }
  function runOne(file, index) { return new Promise(resolve => { const name = path.basename(file); const stem = name.replace(/\.test\.mjs$/, ''); const stdoutPath = path.join(outputDir, `${String(index + 1).padStart(3, '0')}-${stem}.stdout.log`); const stderrPath = path.join(outputDir, `${String(index + 1).padStart(3, '0')}-${stem}.stderr.log`); const child = spawn(process.execPath, [file, '--mode=headless'], { cwd: root, env: { ...process.env, VITE_URL: viteUrl, E2E_RUN_DIR: outputDir }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); const started = Date.now(); active = { name, child, started }; const out = createWriteStream(stdoutPath); const err = createWriteStream(stderrPath); child.stdout.pipe(out); child.stderr.pipe(err); let timedOut = false; const timer = setTimeout(() => { timedOut = true; if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); else child.kill('SIGTERM'); }, timeoutMs); child.once('close', code => { clearTimeout(timer); out.end(); err.end(); active = null; resolve({ test: name, status: timedOut ? 'TIMEOUT' : (code === 0 ? 'PASS' : 'FAIL'), exit_code: timedOut ? 124 : (code ?? 1), elapsed_ms: Date.now() - started, stdout: path.relative(root, stdoutPath).replaceAll('\\', '/'), stderr: path.relative(root, stderrPath).replaceAll('\\', '/') }); }); }); }
  function interrupt(signal) { if (interrupted) return; interrupted = true; if (active) { results.push({ test: active.name, status: 'INTERRUPTED', exit_code: signal === 'SIGTERM' ? 143 : 130, elapsed_ms: Date.now() - active.started }); completed.add(active.name); try { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(active.child.pid), '/T', '/F'], { windowsHide: true }); else active.child.kill('SIGTERM'); } catch { } } snapshot(false); stopVite(); process.exitCode = signal === 'SIGTERM' ? 143 : 130; }
  process.once('SIGINT', () => interrupt('SIGINT')); process.once('SIGTERM', () => interrupt('SIGTERM'));
  try { await ensureVite(); snapshot(false); for (let i = 0; i < tests.length && !interrupted; i += 1) { const file = tests[i]; const name = path.basename(file); if (completed.has(name)) { console.log(`[${i + 1}/${tests.length}] resume=SKIP ${name}`); continue; } const result = await runOne(file, i); results.push(result); completed.add(name); snapshot(false); console.log(`[${i + 1}/${tests.length}] ${result.status} ${result.test}`); } const summary = snapshot(true); console.log(`E2E summary: ${path.join(outputDir, 'summary.json')}`); process.exitCode = summary.failed || summary.timed_out || summary.interrupted || summary.remaining ? 1 : 0; return process.exitCode; } catch (error) { writeFileSync(path.join(outputDir, 'supervisor-error.txt'), String(error?.stack || error)); snapshot(false); console.error(error?.stack || error); process.exitCode = 1; return 1; } finally { stopVite(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
