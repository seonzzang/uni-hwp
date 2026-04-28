export class PrintProgressOverlay {
  private overlay: HTMLDivElement | null = null;
  private titleEl: HTMLDivElement | null = null;
  private messageEl: HTMLDivElement | null = null;
  private progressFillEl: HTMLDivElement | null = null;
  private progressTextEl: HTMLDivElement | null = null;
  private activityTextEl: HTMLDivElement | null = null;
  private cancelButtonEl: HTMLButtonElement | null = null;
  private abortController: AbortController | null = null;
  private animationFrameId: number | null = null;
  private activityTimerId: number | null = null;
  private displayedProcessed = 0;
  private targetProcessed = 0;
  private currentTotal = 1;
  private shownAt = 0;
  private lastEtaSeconds: number | null = null;
  private etaLabel = '남은 시간';

  show(title = '인쇄 준비 중'): AbortSignal {
    if (this.overlay) {
      return this.abortController?.signal ?? new AbortController().signal;
    }

    this.abortController = new AbortController();

    const overlay = document.createElement('div');
    overlay.className = 'print-progress-overlay';

    const card = document.createElement('div');
    card.className = 'print-progress-card';

    const headerEl = document.createElement('div');
    headerEl.className = 'print-progress-header';

    const statusPillEl = document.createElement('div');
    statusPillEl.className = 'print-progress-status-pill';
    statusPillEl.textContent = '작업 중';

    const titleEl = document.createElement('div');
    titleEl.className = 'print-progress-title';
    titleEl.textContent = title;

    headerEl.append(statusPillEl, titleEl);

    const messageEl = document.createElement('div');
    messageEl.className = 'print-progress-message';
    messageEl.textContent = '인쇄용 페이지를 준비하고 있습니다...';

    const progressHeaderEl = document.createElement('div');
    progressHeaderEl.className = 'print-progress-metrics';

    const progressLabelEl = document.createElement('div');
    progressLabelEl.className = 'print-progress-label';
    progressLabelEl.textContent = '전체 진행률';

    const progressTextEl = document.createElement('div');
    progressTextEl.className = 'print-progress-text';
    progressTextEl.textContent = '0%';

    progressHeaderEl.append(progressLabelEl, progressTextEl);

    const bar = document.createElement('div');
    bar.className = 'print-progress-bar';

    const fill = document.createElement('div');
    fill.className = 'print-progress-bar-fill';
    bar.appendChild(fill);

    const activityEl = document.createElement('div');
    activityEl.className = 'print-progress-activity';

    const spinnerEl = document.createElement('div');
    spinnerEl.className = 'print-progress-spinner';
    spinnerEl.setAttribute('aria-hidden', 'true');

    const activityTextEl = document.createElement('div');
    activityTextEl.className = 'print-progress-activity-text';
    activityTextEl.textContent = '백그라운드에서 PDF 작업을 진행 중입니다.';

    activityEl.append(spinnerEl, activityTextEl);

    const cancelButton = document.createElement('button');
    cancelButton.className = 'dialog-btn';
    cancelButton.textContent = '취소';
    cancelButton.addEventListener('click', () => {
      this.abortController?.abort();
      this.updateMessage('인쇄 준비를 취소하는 중...');
      cancelButton.disabled = true;
    });

    const footerEl = document.createElement('div');
    footerEl.className = 'print-progress-footer';
    footerEl.append(activityEl, cancelButton);

    card.append(headerEl, messageEl, progressHeaderEl, bar, footerEl);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.titleEl = titleEl;
    this.messageEl = messageEl;
    this.progressFillEl = fill;
    this.progressTextEl = progressTextEl;
    this.activityTextEl = activityTextEl;
    this.cancelButtonEl = cancelButton;
    this.displayedProcessed = 0;
    this.targetProcessed = 0;
    this.currentTotal = 1;
    this.shownAt = performance.now();
    this.lastEtaSeconds = null;
    this.etaLabel = '남은 시간';
    this.startActivityTimer();

    return this.abortController.signal;
  }

  updateProgress(
    processed: number,
    total: number,
    message?: string,
    options: { animationMs?: number } = {},
  ): void {
    const safeTotal = Math.max(1, total);
    const safeProcessed = Math.max(0, Math.min(safeTotal, processed));
    const animationMs = Math.max(0, options.animationMs ?? 500);

    if (message) {
      this.updateMessage(message);
    }

    this.currentTotal = safeTotal;
    this.targetProcessed = Math.max(this.targetProcessed, safeProcessed);
    this.animateProgress(animationMs);
  }

  private animateProgress(animationMs: number): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const startedAt = performance.now();
    const fromProcessed = this.displayedProcessed;
    const toProcessed = this.targetProcessed;

    if (animationMs <= 0 || Math.abs(toProcessed - fromProcessed) < 0.1) {
      this.displayedProcessed = toProcessed;
      this.renderProgress(toProcessed, this.currentTotal);
      return;
    }

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / animationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.displayedProcessed = fromProcessed + ((toProcessed - fromProcessed) * eased);
      this.renderProgress(this.displayedProcessed, this.currentTotal);

      if (t < 1) {
        this.animationFrameId = window.requestAnimationFrame(tick);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = window.requestAnimationFrame(tick);
  }

  private renderProgress(processed: number, total: number): void {
    const safeTotal = Math.max(1, total);
    const percentValue = Math.max(0, Math.min(100, (processed / safeTotal) * 100));
    const percent = percentValue >= 10
      ? Math.round(percentValue)
      : Math.round(percentValue * 10) / 10;

    if (this.progressFillEl) {
      this.progressFillEl.style.width = `${percentValue}%`;
    }
    if (this.progressTextEl) {
      this.progressTextEl.textContent = total === 1000
        ? `${percent}%`
        : `${percent}% (${Math.round(processed)}/${total})`;
    }
  }

  updateMessage(message: string): void {
    if (this.messageEl) {
      this.messageEl.textContent = message;
    }
  }

  private startActivityTimer(): void {
    if (this.activityTimerId !== null) {
      window.clearInterval(this.activityTimerId);
    }

    this.activityTimerId = window.setInterval(() => {
      if (!this.activityTextEl) return;
      const elapsedSeconds = Math.max(0, Math.floor((performance.now() - this.shownAt) / 1000));
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const elapsedText = minutes > 0
        ? `${minutes}분 ${seconds.toString().padStart(2, '0')}초`
        : `${seconds}초`;
      const etaText = this.lastEtaSeconds === null
        ? `${this.etaLabel} 계산 중`
        : `${this.etaLabel} 약 ${this.formatDuration(this.lastEtaSeconds)}`;
      this.activityTextEl.textContent = `경과 ${elapsedText} · ${etaText}`;
    }, 1000);
  }

  updateEta(etaSeconds: number | null, label = '남은 시간'): void {
    this.etaLabel = label;

    if (etaSeconds === null || !Number.isFinite(etaSeconds)) {
      this.lastEtaSeconds = null;
      return;
    }

    const normalizedEtaSeconds = Math.max(0, etaSeconds);
    this.lastEtaSeconds = this.lastEtaSeconds === null
      ? normalizedEtaSeconds
      : (this.lastEtaSeconds * 0.72) + (normalizedEtaSeconds * 0.28);
  }

  private formatDuration(secondsValue: number): string {
    const rounded = Math.max(0, Math.round(secondsValue));
    const minutes = Math.floor(rounded / 60);
    const seconds = rounded % 60;
    if (minutes <= 0) {
      return `${seconds}초`;
    }
    return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
  }

  get aborted(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }

  hide(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.activityTimerId !== null) {
      window.clearInterval(this.activityTimerId);
      this.activityTimerId = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    this.titleEl = null;
    this.messageEl = null;
    this.progressFillEl = null;
    this.progressTextEl = null;
    this.activityTextEl = null;
    this.cancelButtonEl = null;
    this.abortController = null;
    this.displayedProcessed = 0;
    this.targetProcessed = 0;
    this.currentTotal = 1;
    this.shownAt = 0;
    this.lastEtaSeconds = null;
    this.etaLabel = '남은 시간';
  }
}
