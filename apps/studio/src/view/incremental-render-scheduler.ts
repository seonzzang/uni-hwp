export type RenderPriority = 'visible' | 'prefetch' | 'background';

export interface RenderMetrics {
  frames: number;
  rendered: number;
  coalesced: number;
  staleDiscarded: number;
  totalRenderMs: number;
  maxFrameMs: number;
  budgetOverruns: number;
}

export interface FrameDriver {
  request(callback: (timestamp: number) => void): unknown;
  cancel?(handle: unknown): void;
}

interface Task {
  pageIdx: number;
  priority: RenderPriority;
  sequence: number;
  generation: number;
  run: () => void;
}

const PRIORITY_RANK: Record<RenderPriority, number> = { visible: 0, prefetch: 1, background: 2 };

export class IncrementalRenderScheduler {
  private queue: Task[] = [];
  private queuedByPage = new Map<number, Task>();
  private sequence = 0;
  private generation = 0;
  private frameHandle: unknown;
  private metrics: RenderMetrics = {
    frames: 0, rendered: 0, coalesced: 0, staleDiscarded: 0,
    totalRenderMs: 0, maxFrameMs: 0, budgetOverruns: 0,
  };

  constructor(
    private readonly frameBudgetMs = 8,
    private readonly now: () => number = () => performance.now(),
    private readonly driver: FrameDriver = defaultFrameDriver(),
  ) {}

  enqueue(pageIdx: number, run: () => void, priority: RenderPriority = 'prefetch'): number {
    const existing = this.queuedByPage.get(pageIdx);
    if (existing) {
      existing.run = run;
      if (PRIORITY_RANK[priority] < PRIORITY_RANK[existing.priority]) existing.priority = priority;
      this.metrics.coalesced += 1;
      return existing.generation;
    }
    const task: Task = { pageIdx, priority, sequence: this.sequence++, generation: this.generation, run };
    this.queue.push(task);
    this.queuedByPage.set(pageIdx, task);
    this.requestFrame();
    return task.generation;
  }

  invalidate(): number {
    this.generation += 1;
    this.metrics.staleDiscarded += this.queue.length;
    this.queue = [];
    this.queuedByPage.clear();
    if (this.frameHandle !== undefined) this.driver.cancel?.(this.frameHandle);
    this.frameHandle = undefined;
    return this.generation;
  }

  cancel(pageIdx: number): void {
    const task = this.queuedByPage.get(pageIdx);
    if (!task) return;
    this.queuedByPage.delete(pageIdx);
    this.queue = this.queue.filter((candidate) => candidate !== task);
  }

  get pendingCount(): number { return this.queue.length; }
  get currentGeneration(): number { return this.generation; }
  getMetrics(): RenderMetrics { return { ...this.metrics }; }

  /** Test hook and frame-driver callback: drains only the current frame budget. */
  runFrame(timestamp = this.now()): void {
    this.frameHandle = undefined;
    const frameStart = timestamp;
    let renderedThisFrame = 0;
    while (this.queue.length > 0) {
      this.queue.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.sequence - b.sequence);
      const task = this.queue.shift()!;
      this.queuedByPage.delete(task.pageIdx);
      if (task.generation !== this.generation) {
        this.metrics.staleDiscarded += 1;
        continue;
      }
      const started = this.now();
      task.run();
      const duration = Math.max(0, this.now() - started);
      this.metrics.rendered += 1;
      this.metrics.totalRenderMs += duration;
      renderedThisFrame += 1;
      if (duration > this.frameBudgetMs) this.metrics.budgetOverruns += 1;
      if (renderedThisFrame > 0 && this.now() - frameStart >= this.frameBudgetMs) break;
    }
    const frameDuration = Math.max(0, this.now() - frameStart);
    this.metrics.frames += 1;
    this.metrics.maxFrameMs = Math.max(this.metrics.maxFrameMs, frameDuration);
    if (this.queue.length > 0) this.requestFrame();
  }

  private requestFrame(): void {
    if (this.frameHandle !== undefined) return;
    this.frameHandle = this.driver.request((timestamp) => this.runFrame(timestamp));
  }
}

function defaultFrameDriver(): FrameDriver {
  const root = globalThis as typeof globalThis & { requestAnimationFrame?: (cb: FrameRequestCallback) => number };
  if (root.requestAnimationFrame) return { request: (cb) => root.requestAnimationFrame!(cb) };
  return { request: (cb) => setTimeout(() => cb(performance.now()), 0) };
}
