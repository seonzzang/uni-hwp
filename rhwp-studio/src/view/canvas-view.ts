import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import { EventBus } from '@/core/event-bus';
import type { PageInfo } from '@/core/types';
import { DEFAULT_PAGE_WINDOW_RADIUS, VirtualScroll } from './virtual-scroll';
import { CanvasPool } from './canvas-pool';
import { PageRenderer } from './page-renderer';
import { ViewportManager } from './viewport-manager';
import { CoordinateSystem } from './coordinate-system';

const DEBUG_PROGRESSIVE_PAGING = import.meta.env.DEV;

export class CanvasView {
  private virtualScroll: VirtualScroll;
  private canvasPool: CanvasPool;
  private pageRenderer: PageRenderer;
  private viewportManager: ViewportManager;
  private coordinateSystem: CoordinateSystem;

  private scrollContent: HTMLElement;
  private pages: PageInfo[] = [];
  private currentVisiblePages: number[] = [];
  private unsubscribers: (() => void)[] = [];
  private lastWindowLogSignature = '';
  private loadGeneration = 0;

  constructor(
    private container: HTMLElement,
    private wasm: UniHwpEngine,
    private eventBus: EventBus,
  ) {
    this.virtualScroll = new VirtualScroll();
    this.canvasPool = new CanvasPool();
    this.pageRenderer = new PageRenderer(wasm);
    this.viewportManager = new ViewportManager(eventBus);
    this.coordinateSystem = new CoordinateSystem(this.virtualScroll);

    this.scrollContent = container.querySelector('#scroll-content')!;
    this.viewportManager.attachTo(container);

    this.unsubscribers.push(
      eventBus.on('viewport-scroll', () => this.updateVisiblePages()),
      eventBus.on('viewport-resize', () => this.onViewportResize()),
      eventBus.on('zoom-changed', (zoom) => this.onZoomChanged(zoom as number)),
      eventBus.on('document-changed', () => this.refreshPages()),
    );
  }

  /** 문서 로드 후 호출 — 페이지 정보 수집 및 가상 스크롤 초기화 */
  async loadDocument(expectedPageCount?: number): Promise<void> {
    this.reset();
    const loadGeneration = this.loadGeneration;

    const traceId = `canvas-load:${Date.now()}`;
    let pageCount = Math.max(expectedPageCount ?? 0, this.wasm.pageCount);
    const initialFullPageCount = pageCount;
    // 현재 Rust paginate_step()은 실제 partial page production이 아니라
    // 최종 단계에서만 pages를 확정한다. release 빌드에서 대용량 문서 blank screen과
    // pageCount 불일치를 유발할 수 있어, 배포 경로에서는 안정적인 full pagination을 사용한다.
    const progressiveEnabled = false && this.wasm.supportsProgressivePaging();
    const progressiveChunkSize = 24;
    if (DEBUG_PROGRESSIVE_PAGING) {
      console.log('[CanvasView] paging capability', {
        traceId,
        supportsProgressivePaging: progressiveEnabled,
        pageCount,
      });
    }

    if (progressiveEnabled) {
      try {
        if (DEBUG_PROGRESSIVE_PAGING) {
          console.time(`[${traceId}] progressive.firstStep`);
        }
        this.wasm.startProgressivePaging();
        pageCount = this.wasm.stepProgressivePaging(progressiveChunkSize);
        if (DEBUG_PROGRESSIVE_PAGING) {
          console.timeEnd(`[${traceId}] progressive.firstStep`);
          console.log('[CanvasView] progressive first step complete', {
            traceId,
            pageCount,
            pagingFinished: this.wasm.isPagingFinished(),
          });
        }

        if (pageCount === 0 && !this.wasm.isPagingFinished()) {
          if (DEBUG_PROGRESSIVE_PAGING) {
            console.warn('[CanvasView] no visible pages after first progressive step; continuing bootstrap steps', {
              traceId,
              progressiveChunkSize,
            });
          }
          const bootstrapResult = await this.waitForFirstProgressivePage(
            traceId,
            loadGeneration,
            progressiveChunkSize,
            1,
          );
          pageCount = bootstrapResult.pageCount;

          if (DEBUG_PROGRESSIVE_PAGING) {
            console.log('[CanvasView] progressive bootstrap steps complete', {
              traceId,
              bootstrapSteps: bootstrapResult.steps,
              pageCount,
              pagingFinished: this.wasm.isPagingFinished(),
            });
          }
        }
      } catch (error) {
        console.error('[CanvasView] progressive paging bootstrap failed, fallback to full collection', error);
        pageCount = Math.max(expectedPageCount ?? 0, this.wasm.pageCount);
      }
    }

    if (DEBUG_PROGRESSIVE_PAGING) {
      console.time(`[${traceId}] collectPageInfo`);
    }
    this.pages = [];
    for (let i = 0; i < pageCount; i++) {
      try {
        this.pages.push(this.wasm.getPageInfo(i));
      } catch (e) {
        console.error(`[CanvasView] 페이지 ${i} 정보 조회 실패:`, e);
      }
    }
    if (DEBUG_PROGRESSIVE_PAGING) {
      console.timeEnd(`[${traceId}] collectPageInfo`);
      console.log('[CanvasView] page info collection summary', {
        traceId,
        requestedPageCount: pageCount,
        collectedPageCount: this.pages.length,
      });
    }

    if (this.pages.length === 0 && initialFullPageCount > 0) {
      console.warn('[CanvasView] progressive bootstrap did not yield visible pages; falling back to initial pagination snapshot', {
        traceId,
        initialFullPageCount,
        pageCount,
      });
      for (let i = 0; i < initialFullPageCount; i++) {
        try {
          this.pages.push(this.wasm.getPageInfo(i));
        } catch (e) {
          console.error(`[CanvasView] 초기 스냅샷 페이지 ${i} 정보 조회 실패:`, e);
          break;
        }
      }
      pageCount = this.pages.length;
    }

    if (this.pages.length === 0) {
      console.error('[CanvasView] 로드된 페이지가 없습니다', {
        traceId,
        expectedPageCount,
        wasmPageCount: this.wasm.pageCount,
      });
      return;
    }

    // 모바일: 문서 로드 시 폭 맞춤 줌 자동 적용
    if (window.innerWidth < 1024 && this.pages.length > 0) {
      const containerWidth = this.container.clientWidth - 20;
      const pageWidth = this.pages[0].width;
      if (pageWidth > 0 && containerWidth > 0) {
        const fitZoom = containerWidth / pageWidth;
        this.viewportManager.setZoom(Math.max(0.1, Math.min(fitZoom, 4.0)));
      }
    }

    this.recalcLayout();

    this.container.scrollTop = 0;
    this.updateVisiblePages();

    if (DEBUG_PROGRESSIVE_PAGING) {
      console.log(`[CanvasView] ${this.pages.length}/${pageCount}페이지 로드, 총 높이: ${this.virtualScroll.getTotalHeight()}px`);
    }

    if (progressiveEnabled && !this.wasm.isPagingFinished()) {
      void this.continueProgressivePagingInBackground(traceId, loadGeneration, pageCount);
    }
  }

  private async waitForFirstProgressivePage(
    traceId: string,
    loadGeneration: number,
    progressiveChunkSize: number,
    initialSteps: number,
  ): Promise<{ pageCount: number; steps: number }> {
    let steps = initialSteps;
    let pageCount = this.wasm.pageCount;

    while (loadGeneration === this.loadGeneration && pageCount === 0 && !this.wasm.isPagingFinished()) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      pageCount = this.wasm.stepProgressivePaging(progressiveChunkSize);
      steps += 1;

      if (DEBUG_PROGRESSIVE_PAGING && steps % 32 === 0) {
        console.log('[CanvasView] progressive bootstrap waiting for first page', {
          traceId,
          steps,
          pageCount,
          pagingFinished: this.wasm.isPagingFinished(),
        });
      }
    }

    return { pageCount, steps };
  }

  private async continueProgressivePagingInBackground(
    traceId: string,
    loadGeneration: number,
    initialPageCount: number,
  ): Promise<void> {
    const progressiveChunkSize = 24;
    const maxStepsPerTick = 4;
    let lastPageCount = initialPageCount;
    let steps = 0;

    if (DEBUG_PROGRESSIVE_PAGING) {
      console.log('[CanvasView] progressive background paging start', {
        traceId,
        loadGeneration,
        initialPageCount,
      });
    }

    while (loadGeneration === this.loadGeneration && !this.wasm.isPagingFinished()) {
      await new Promise((resolve) => setTimeout(resolve, 0));

      let pageCount = lastPageCount;
      let stepsThisTick = 0;
      while (stepsThisTick < maxStepsPerTick && !this.wasm.isPagingFinished()) {
        pageCount = this.wasm.stepProgressivePaging(progressiveChunkSize);
        steps += 1;
        stepsThisTick += 1;
        if (pageCount > lastPageCount) {
          break;
        }
      }

      if (pageCount > lastPageCount) {
        for (let i = lastPageCount; i < pageCount; i++) {
          try {
            this.pages.push(this.wasm.getPageInfo(i));
          } catch (error) {
            console.error(`[CanvasView] progressive page info ${i} 조회 실패:`, error);
            break;
          }
        }

        lastPageCount = this.pages.length;
        this.recalcLayout();
        this.updateVisiblePages();

        if (DEBUG_PROGRESSIVE_PAGING) {
          console.log('[CanvasView] progressive pages appended', {
            traceId,
            loadGeneration,
            steps,
            stepsThisTick,
            pageCount,
            pagingFinished: this.wasm.isPagingFinished(),
          });
        }
      }
    }

    if (DEBUG_PROGRESSIVE_PAGING) {
      console.log('[CanvasView] progressive background paging done', {
        traceId,
        loadGeneration,
        steps,
        finalPageCount: this.pages.length,
        pagingFinished: this.wasm.isPagingFinished(),
        aborted: loadGeneration !== this.loadGeneration,
      });
    }
  }

  /** 레이아웃을 재계산한다 (줌/리사이즈 공통) */
  private recalcLayout(): void {
    const zoom = this.viewportManager.getZoom();
    const { width: vpWidth } = this.viewportManager.getViewportSize();
    this.virtualScroll.setPageDimensions(this.pages, zoom, vpWidth);
    this.scrollContent.style.height = `${this.virtualScroll.getTotalHeight()}px`;
    this.scrollContent.style.width = `${this.virtualScroll.getTotalWidth()}px`;

    // 그리드 모드 CSS 클래스 토글
    this.scrollContent.classList.toggle('grid-mode', this.virtualScroll.isGridMode());
  }

  /** 스크롤/리사이즈 시 보이는 페이지를 갱신한다 */
  private updateVisiblePages(): void {
    const scrollY = this.viewportManager.getScrollY();
    const { height: vpHeight } = this.viewportManager.getViewportSize();

    const prefetchPages = this.virtualScroll.getPrefetchPages(scrollY, vpHeight);
    const visiblePages = this.virtualScroll.getVisiblePages(scrollY, vpHeight);
    const vpCenter = scrollY + vpHeight / 2;
    const currentPage = this.virtualScroll.getPageAtY(vpCenter);
    const windowPages = this.getPageWindow(currentPage);
    const retainedPages = Array.from(new Set([...prefetchPages, ...windowPages])).sort((a, b) => a - b);
    const releasedPages: number[] = [];
    const renderedPages: number[] = [];

    // 벗어난 페이지 해제
    const retainedSet = new Set(retainedPages);
    for (const pageIdx of this.canvasPool.activePages) {
      if (!retainedSet.has(pageIdx)) {
        this.pageRenderer.cancelReRender(pageIdx);
        this.canvasPool.release(pageIdx);
        releasedPages.push(pageIdx);
      }
    }

    // 새로 보이는 페이지 렌더링
    for (const pageIdx of retainedPages) {
      if (!this.canvasPool.has(pageIdx)) {
        this.renderPage(pageIdx);
        renderedPages.push(pageIdx);
      }
    }

    // 현재 페이지 번호 갱신
    if (visiblePages.length > 0) {
      this.logPageWindow(currentPage, prefetchPages, visiblePages, retainedPages, releasedPages, renderedPages);
      this.eventBus.emit(
        'current-page-changed',
        currentPage,
        this.virtualScroll.pageCount,
      );
    }

    this.currentVisiblePages = visiblePages;
  }

  private getPageWindow(currentPage: number): number[] {
    const pageCount = this.virtualScroll.pageCount;
    if (pageCount === 0) return [];

    const windowStart = Math.max(0, currentPage - DEFAULT_PAGE_WINDOW_RADIUS);
    const windowEnd = Math.min(pageCount - 1, currentPage + DEFAULT_PAGE_WINDOW_RADIUS);
    const pages: number[] = [];
    for (let pageIdx = windowStart; pageIdx <= windowEnd; pageIdx++) {
      pages.push(pageIdx);
    }
    return pages;
  }

  private logPageWindow(
    currentPage: number,
    prefetchPages: number[],
    visiblePages: number[],
    retainedPages: number[],
    releasedPages: number[],
    renderedPages: number[],
  ): void {
    const windowPages = this.getPageWindow(currentPage);
    const windowStart = windowPages[0] ?? 0;
    const windowEnd = windowPages[windowPages.length - 1] ?? 0;
    const signature = [
      currentPage,
      windowStart,
      windowEnd,
      visiblePages.join(','),
      prefetchPages.join(','),
      retainedPages.join(','),
      releasedPages.join(','),
      renderedPages.join(','),
    ].join('|');

    if (signature === this.lastWindowLogSignature) return;
    this.lastWindowLogSignature = signature;

    if (DEBUG_PROGRESSIVE_PAGING) {
      console.log('[CanvasView] page window', {
        currentPage,
        windowRadius: DEFAULT_PAGE_WINDOW_RADIUS,
        targetWindow: [windowStart, windowEnd],
        visiblePages,
        prefetchPages,
        retainedPages,
        releasedPages,
        renderedPages,
        activeCanvasPages: Array.from(this.canvasPool.activePages).sort((a, b) => a - b),
      });
    }
  }

  /** 단일 페이지를 렌더링한다 */
  private renderPage(pageIdx: number): void {
    const canvas = this.canvasPool.acquire(pageIdx);
    const zoom = this.viewportManager.getZoom();
    const rawDpr = window.devicePixelRatio || 1;

    // iOS WebKit Canvas 최대 크기 제한 (64MP = 67,108,864 pixels)
    // 물리 크기 = pageSize × zoom × dpr 가 제한을 초과하면 dpr을 낮춘다
    const pageInfo = this.pages[pageIdx];
    const MAX_CANVAS_PIXELS = 67108864;
    let dpr = rawDpr;
    if (pageInfo) {
      const physW = pageInfo.width * zoom * dpr;
      const physH = pageInfo.height * zoom * dpr;
      if (physW * physH > MAX_CANVAS_PIXELS) {
        dpr = Math.sqrt(MAX_CANVAS_PIXELS / (pageInfo.width * zoom * pageInfo.height * zoom));
        dpr = Math.max(1, Math.floor(dpr)); // 최소 1, 정수로 내림
      }
    }
    const renderScale = zoom * dpr;

    // Canvas를 DOM에 추가하고 위치를 설정한다
    canvas.style.top = `${this.virtualScroll.getPageOffset(pageIdx)}px`;

    // 그리드 모드: 고정 left 좌표, 단일 열: CSS 중앙 정렬
    const pageLeft = this.virtualScroll.getPageLeft(pageIdx);
    if (pageLeft >= 0) {
      canvas.style.left = `${pageLeft}px`;
      canvas.style.transform = 'none';
    } else {
      canvas.style.left = '50%';
      canvas.style.transform = 'translateX(-50%)';
    }

    this.scrollContent.appendChild(canvas);

    // WASM이 Canvas 크기를 자동 설정한다 (물리 픽셀 = 페이지크기 × zoom × DPR)
    try {
      this.pageRenderer.renderPage(pageIdx, canvas, renderScale, pageInfo);
    } catch (e) {
      console.error(`[CanvasView] 페이지 ${pageIdx} 렌더링 실패:`, e);
      this.canvasPool.release(pageIdx);
      return;
    }

    // CSS 표시 크기 = 물리 픽셀 / DPR (= 페이지크기 × zoom)
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
  }

  /** 뷰포트 리사이즈 처리 */
  private onViewportResize(): void {
    if (this.pages.length === 0) {
      this.updateVisiblePages();
      return;
    }

    // 그리드 모드에서 열 수가 바뀔 수 있으므로 레이아웃 재계산
    const wasGrid = this.virtualScroll.isGridMode();
    this.recalcLayout();
    const isGrid = this.virtualScroll.isGridMode();

    if (wasGrid || isGrid) {
      // 그리드 관련 변경 시 전체 재렌더링
      this.canvasPool.releaseAll();
      this.pageRenderer.cancelAll();
    }
    this.updateVisiblePages();
  }

  /** 줌 변경 처리 */
  private onZoomChanged(zoom: number): void {
    if (this.pages.length === 0) return;

    // 현재 보이는 페이지 기억
    const scrollY = this.viewportManager.getScrollY();
    const { height: vpHeight } = this.viewportManager.getViewportSize();
    const vpCenter = scrollY + vpHeight / 2;
    const focusPage = this.virtualScroll.getPageAtY(vpCenter);
    const oldOffset = this.virtualScroll.getPageOffset(focusPage);
    const relativeY = vpCenter - oldOffset;
    const oldHeight = this.virtualScroll.getPageHeight(focusPage);
    const ratio = oldHeight > 0 ? relativeY / oldHeight : 0;

    // 페이지 크기 재계산
    this.recalcLayout();

    // 스크롤 위치 보정
    const newOffset = this.virtualScroll.getPageOffset(focusPage);
    const newHeight = this.virtualScroll.getPageHeight(focusPage);
    const newCenter = newOffset + newHeight * ratio;
    this.viewportManager.setScrollTop(newCenter - vpHeight / 2);

    // 모든 Canvas 재렌더링
    this.canvasPool.releaseAll();
    this.pageRenderer.cancelAll();
    this.updateVisiblePages();

    this.eventBus.emit('zoom-level-display', zoom);
  }

  /** 편집 후 보이는 페이지를 재렌더링한다 */
  refreshPages(): void {
    if (this.pages.length === 0) return;

    // 페이지 정보 재수집 (페이지 수/크기가 변경될 수 있음)
    const pageCount = this.wasm.pageCount;
    this.pages = [];
    for (let i = 0; i < pageCount; i++) {
      try {
        this.pages.push(this.wasm.getPageInfo(i));
      } catch (e) {
        console.error(`[CanvasView] 페이지 ${i} 정보 조회 실패:`, e);
      }
    }

    this.recalcLayout();

    // 보이는 페이지 재렌더링
    this.canvasPool.releaseAll();
    this.pageRenderer.cancelAll();
    this.updateVisiblePages();
  }

  /** 리소스를 정리한다 */
  private reset(): void {
    this.loadGeneration += 1;
    this.pageRenderer.cancelAll();
    this.canvasPool.releaseAll();
    this.currentVisiblePages = [];
    this.lastWindowLogSignature = '';
    this.pages = [];
    this.scrollContent.innerHTML = '';
  }

  /** 전체 정리 */
  dispose(): void {
    this.reset();
    this.viewportManager.detach();
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  getVirtualScroll(): VirtualScroll {
    return this.virtualScroll;
  }

  getViewportManager(): ViewportManager {
    return this.viewportManager;
  }

  getCoordinateSystem(): CoordinateSystem {
    return this.coordinateSystem;
  }
}

