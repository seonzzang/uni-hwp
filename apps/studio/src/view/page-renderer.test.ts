import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IncrementalRenderScheduler, type FrameDriver } from './incremental-render-scheduler';
import { calculateCanvasDpr, getPhysicalCanvasSize } from './dpr';
import { PageRenderer } from './page-renderer';

function manualDriver(): { driver: FrameDriver; frames: Array<(time: number) => void> } {
  const frames: Array<(time: number) => void> = [];
  return { frames, driver: { request: (callback) => { frames.push(callback); return frames.length; } } };
}

test('frame budget splits oversized mock WASM renders and drains FIFO queue', () => {
  let clock = 0;
  const manual = manualDriver();
  const scheduler = new IncrementalRenderScheduler(5, () => clock, manual.driver);
  const rendered: number[] = [];
  for (let page = 0; page < 3; page++) {
    scheduler.enqueue(page, () => { rendered.push(page); clock += 6; }, 'prefetch');
  }

  assert.equal(manual.frames.length, 1);
  manual.frames.shift()!(0);
  assert.deepEqual(rendered, [0]);
  assert.equal(scheduler.pendingCount, 2);
  manual.frames.shift()!(6);
  assert.deepEqual(rendered, [0, 1]);
  manual.frames.shift()!(12);
  assert.deepEqual(rendered, [0, 1, 2]);
  assert.equal(scheduler.pendingCount, 0);
  assert.equal(scheduler.getMetrics().budgetOverruns, 3);
});

test('priority ordering is stable FIFO and duplicate pages coalesce', () => {
  let now = 0;
  const manual = manualDriver();
  const scheduler = new IncrementalRenderScheduler(10, () => now, manual.driver);
  const rendered: string[] = [];
  scheduler.enqueue(4, () => rendered.push('old'), 'background');
  scheduler.enqueue(4, () => rendered.push('latest'), 'visible');
  scheduler.enqueue(2, () => rendered.push('page-2'), 'visible');
  manual.frames.shift()!(0);
  assert.deepEqual(rendered, ['latest', 'page-2']);
  assert.equal(scheduler.getMetrics().coalesced, 1);
  now = 1;
});

test('generation change discards queued stale render before mock WASM call', () => {
  const manual = manualDriver();
  const scheduler = new IncrementalRenderScheduler(8, () => 0, manual.driver);
  let wasmCalls = 0;
  scheduler.enqueue(1, () => { wasmCalls += 1; });
  scheduler.invalidate();
  manual.frames.shift()!(0);
  assert.equal(wasmCalls, 0);
  assert.equal(scheduler.getMetrics().staleDiscarded, 1);
});

test('DPR module computes physical canvas dimensions independently', () => {
  const page = { width: 1000, height: 1000 };
  assert.equal(calculateCanvasDpr(page, 1, 2), 2);
  assert.equal(calculateCanvasDpr(page, 10, 2, 1_000_000), 1);
  assert.deepEqual(getPhysicalCanvasSize(page, 1.25, 1.5), { width: 1875, height: 1875 });
});

test('PageRenderer invokes the mock WASM render through the scheduler and records timing', () => {
  let clock = 0;
  const manual = manualDriver();
  const calls: Array<[number, number]> = [];
  const wasm = {
    renderPageToCanvas(page: number, _canvas: HTMLCanvasElement, scale: number) {
      calls.push([page, scale]);
      clock += 3;
    },
    getPageInfo: () => ({ pageIndex: 0, width: 100, height: 100, sectionIndex: 0, marginLeft: 1, marginRight: 1, marginTop: 1, marginBottom: 1, marginHeader: 0, marginFooter: 0 }),
  } as any;
  const renderer = new PageRenderer(wasm, { frameBudgetMs: 5, now: () => clock, frameDriver: manual.driver });
  const canvas = { parentElement: {}, getContext: () => null } as unknown as HTMLCanvasElement;
  renderer.renderPage(7, canvas, 2, wasm.getPageInfo(0));
  renderer.scheduler.runFrame(0);
  assert.deepEqual(calls, [[7, 2]]);
  assert.equal(renderer.scheduler.getMetrics().rendered, 1);
  assert.equal(renderer.scheduler.getMetrics().totalRenderMs, 3);
  renderer.cancelAll();
});
