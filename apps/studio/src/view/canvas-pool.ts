export class CanvasPool {
  private static readonly MAX_POOLED_CANVASES = 12;
  private available: HTMLCanvasElement[] = [];
  private inUse = new Map<number, HTMLCanvasElement>();
  private debugEnabled = import.meta.env.DEV;

  private debugLog(action: string, pageIdx?: number): void {
    if (!this.debugEnabled) return;
    console.log('[CanvasPool]', {
      action,
      pageIdx,
      activePages: Array.from(this.inUse.keys()).sort((a, b) => a - b),
      activeCount: this.inUse.size,
      pooledCount: this.available.length,
      totalCount: this.totalCount,
    });
  }

  /** Canvas를 할당한다 (풀에서 꺼내거나 새로 생성) */
  acquire(pageIdx: number): HTMLCanvasElement {
    let canvas = this.available.pop();
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    this.inUse.set(pageIdx, canvas);
    this.debugLog('acquire', pageIdx);
    return canvas;
  }

  /** Canvas를 반환한다 (DOM에서 제거 후 풀에 반환) */
  release(pageIdx: number): void {
    const canvas = this.inUse.get(pageIdx);
    if (canvas) {
      canvas.parentElement?.removeChild(canvas);
      this.inUse.delete(pageIdx);
      // 픽셀 버퍼를 즉시 비워 범위 밖 페이지 메모리 회수를 유도한다.
      canvas.width = 0;
      canvas.height = 0;
      if (this.available.length < CanvasPool.MAX_POOLED_CANVASES) {
        this.available.push(canvas);
        this.debugLog('release', pageIdx);
      } else {
        this.debugLog('discard', pageIdx);
      }
    }
  }

  /** 특정 페이지에 할당된 Canvas를 조회한다 */
  getCanvas(pageIdx: number): HTMLCanvasElement | undefined {
    return this.inUse.get(pageIdx);
  }

  /** 특정 페이지가 이미 할당되어 있는지 확인한다 */
  has(pageIdx: number): boolean {
    return this.inUse.has(pageIdx);
  }

  /** 모든 Canvas를 반환한다 */
  releaseAll(): void {
    const pages = Array.from(this.inUse.keys());
    for (const pageIdx of pages) {
      this.release(pageIdx);
    }
    this.debugLog('releaseAll');
  }

  /** 현재 사용 중인 페이지 인덱스 목록 */
  get activePages(): number[] {
    return Array.from(this.inUse.keys());
  }

  /** 사용 중 + 풀 대기 Canvas 총 수 */
  get totalCount(): number {
    return this.inUse.size + this.available.length;
  }
}
