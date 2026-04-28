export interface PdfPreviewOpenOptions {
  title?: string;
  statusText?: string;
}

type PdfPreviewCloseReason = 'replace' | 'user' | 'escape' | 'external';

import { pushPdfPreviewTrace } from '@/print/debug-trace';

export class PdfPreviewController {
  private container: HTMLDivElement | null = null;
  private headerTitleEl: HTMLDivElement | null = null;
  private headerStatusEl: HTMLDivElement | null = null;
  private closeButtonEl: HTMLButtonElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private currentUrl: string | null = null;
  private lastOptions: PdfPreviewOpenOptions = {};
  private openedAt = 0;
  private restoreTimerId: number | null = null;
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close('escape');
    }
  };

  async open(blob: Blob, options: PdfPreviewOpenOptions = {}): Promise<void> {
    this.close('replace');

    this.currentUrl = URL.createObjectURL(blob);
    this.lastOptions = options;
    this.openedAt = performance.now();
    document.body.classList.add('pdf-preview-active');
    pushPdfPreviewTrace('preview controller open start');
    this.render();
    window.addEventListener('keydown', this.handleKeyDown);
    window.setTimeout(() => {
      if (!this.container || !this.container.isConnected) {
        pushPdfPreviewTrace('preview container missing after open; restoring');
        console.warn('[pdf-preview] preview container disappeared after open; restoring');
        this.render();
      } else {
        pushPdfPreviewTrace('preview container attached');
      }
    }, 120);
  }

  dispose(): void {
    this.close('external');
  }

  private close(reason: PdfPreviewCloseReason): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.restoreTimerId !== null) {
      window.clearTimeout(this.restoreTimerId);
      this.restoreTimerId = null;
    }

    const shouldRestore = reason === 'external'
      && this.currentUrl !== null
      && performance.now() - this.openedAt < 1500;
    pushPdfPreviewTrace(`preview close ${reason}`);

    this.container?.remove();
    this.container = null;
    this.headerTitleEl = null;
    this.headerStatusEl = null;
    this.closeButtonEl = null;
    this.iframe?.remove();
    this.iframe = null;

    if (shouldRestore) {
      console.warn('[pdf-preview] unexpected dispose detected; reattaching preview shell');
      this.restoreTimerId = window.setTimeout(() => {
        this.restoreTimerId = null;
        if (!this.currentUrl || this.container) return;
        document.body.classList.add('pdf-preview-active');
        pushPdfPreviewTrace('preview restored after unexpected dispose');
        this.render();
        window.addEventListener('keydown', this.handleKeyDown);
      }, 0);
      return;
    }

    document.body.classList.remove('pdf-preview-active');
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  private render(): void {
    if (!this.currentUrl) return;
    pushPdfPreviewTrace('preview render');

    const container = document.createElement('div');
    container.className = 'pdf-preview-shell';

    const header = document.createElement('div');
    header.className = 'pdf-preview-header';

    const closeButton = document.createElement('button');
    closeButton.className = 'pdf-preview-return-button';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '편집기로 돌아가기');
    closeButton.title = '편집기로 돌아가기';
    closeButton.innerHTML = '<span class="pdf-preview-return-icon" aria-hidden="true">‹</span>';
    closeButton.addEventListener('click', () => {
      this.close('user');
    });

    const titleEl = document.createElement('div');
    titleEl.className = 'pdf-preview-title';
    titleEl.textContent = this.lastOptions.title ?? 'PDF 미리보기';

    const statusEl = document.createElement('div');
    statusEl.className = 'pdf-preview-status';
    statusEl.textContent = this.lastOptions.statusText ?? '생성된 PDF를 확인 중입니다.';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'pdf-preview-title-group';
    titleGroup.append(titleEl, statusEl);

    header.append(closeButton, titleGroup);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-label', this.lastOptions.title ?? 'PDF Preview');
    iframe.className = 'pdf-preview-frame';
    iframe.src = this.currentUrl;

    container.append(header, iframe);
    document.body.appendChild(container);

    this.container = container;
    this.headerTitleEl = titleEl;
    this.headerStatusEl = statusEl;
    this.closeButtonEl = closeButton;
    this.iframe = iframe;
  }
}
