export type PrintMode = 'pdf' | 'legacy';

export interface PrintOptionsResult {
  mode: PrintMode;
  startPage: number;
  endPage: number;
}

class PrintOptionsDialog {
  private overlay: HTMLDivElement | null = null;
  private resolver: ((value: PrintOptionsResult | null) => void) | null = null;
  private captureHandler: ((e: KeyboardEvent) => void) | null = null;

  private readonly currentPage: number;
  private readonly totalPages: number;

  private wholeRadio!: HTMLInputElement;
  private currentRadio!: HTMLInputElement;
  private rangeRadio!: HTMLInputElement;
  private startInput!: HTMLInputElement;
  private endInput!: HTMLInputElement;
  private pdfModeRadio!: HTMLInputElement;
  private legacyModeRadio!: HTMLInputElement;
  private helperText!: HTMLDivElement;
  private printButton!: HTMLButtonElement;

  constructor(currentPage: number, totalPages: number) {
    this.currentPage = currentPage;
    this.totalPages = totalPages;
  }

  showAsync(): Promise<PrintOptionsResult | null> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.build();
      document.body.appendChild(this.overlay!);
      this.bindKeyboard();
      this.updateUiState();
    });
  }

  private build(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog-wrap';
    dialog.style.width = '520px';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = '인쇄';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => this.resolve(null));
    title.appendChild(closeBtn);
    dialog.appendChild(title);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.style.padding = '16px 20px';

    const intro = document.createElement('p');
    intro.style.margin = '0 0 14px 0';
    intro.style.lineHeight = '1.6';
    intro.textContent = '인쇄 범위와 방식을 선택한 뒤 [인쇄]를 누르세요. 기본 인쇄는 PDF를 생성한 뒤 앱 내부 PDF 뷰어로 엽니다.';
    body.appendChild(intro);

    body.appendChild(this.buildRangeSection());
    body.appendChild(this.buildModeSection());

    this.helperText = document.createElement('div');
    this.helperText.style.marginTop = '12px';
    this.helperText.style.padding = '10px 12px';
    this.helperText.style.background = '#f5f6f8';
    this.helperText.style.border = '1px solid #dde1e6';
    this.helperText.style.borderRadius = '4px';
    this.helperText.style.fontSize = '12px';
    this.helperText.style.lineHeight = '1.5';
    body.appendChild(this.helperText);

    dialog.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'dialog-footer';

    const printBtn = document.createElement('button');
    this.printButton = printBtn;
    printBtn.className = 'dialog-btn dialog-btn-primary';
    printBtn.textContent = '인쇄';
    printBtn.addEventListener('click', () => {
      const result = this.collectResult();
      if (!result) return;
      this.resolve(result);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dialog-btn';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', () => this.resolve(null));

    footer.append(printBtn, cancelBtn);
    dialog.appendChild(footer);

    this.overlay.appendChild(dialog);
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.resolve(null);
      }
    });
  }

  private buildRangeSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'dialog-section';

    const title = document.createElement('div');
    title.className = 'dialog-section-title';
    title.textContent = '인쇄 범위';
    section.appendChild(title);

    const name = `print-range-${Date.now()}`;

    this.wholeRadio = this.createRadio(name, true);
    const wholeRow = this.createOptionRow(this.wholeRadio, `문서 전체 (${this.totalPages}쪽)`);
    section.appendChild(wholeRow);

    this.currentRadio = this.createRadio(name, false);
    const currentRow = this.createOptionRow(this.currentRadio, `현재 페이지 (${this.currentPage}쪽)`);
    section.appendChild(currentRow);

    this.rangeRadio = this.createRadio(name, false);
    const rangeRow = document.createElement('label');
    rangeRow.className = 'dialog-row';
    rangeRow.style.display = 'flex';
    rangeRow.style.alignItems = 'center';
    rangeRow.style.gap = '8px';
    rangeRow.style.marginBottom = '8px';
    rangeRow.appendChild(this.rangeRadio);

    const rangeLabel = document.createElement('span');
    rangeLabel.textContent = '페이지 범위';
    rangeLabel.style.minWidth = '72px';
    rangeRow.appendChild(rangeLabel);

    this.startInput = document.createElement('input');
    this.startInput.type = 'number';
    this.startInput.className = 'dialog-input';
    this.startInput.min = '1';
    this.startInput.max = String(this.totalPages);
    this.startInput.value = String(this.currentPage);
    this.startInput.style.width = '76px';

    const dash = document.createElement('span');
    dash.textContent = '-';

    this.endInput = document.createElement('input');
    this.endInput.type = 'number';
    this.endInput.className = 'dialog-input';
    this.endInput.min = '1';
    this.endInput.max = String(this.totalPages);
    this.endInput.value = String(Math.min(this.totalPages, this.currentPage + 9));
    this.endInput.style.width = '76px';

    const pageSuffix = document.createElement('span');
    pageSuffix.textContent = `쪽 / 총 ${this.totalPages}쪽`;

    rangeRow.append(this.startInput, dash, this.endInput, pageSuffix);
    section.appendChild(rangeRow);

    for (const element of [
      this.wholeRadio,
      this.currentRadio,
      this.rangeRadio,
      this.startInput,
      this.endInput,
    ]) {
      element.addEventListener('change', () => this.updateUiState());
      element.addEventListener('input', () => this.updateUiState());
    }

    for (const input of [this.startInput, this.endInput]) {
      input.addEventListener('pointerdown', () => this.activateRangeInputs());
      input.addEventListener('focus', () => this.activateRangeInputs());
    }
    this.endInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.stopPropagation();
      event.preventDefault();
      this.activateRangeInputs();
      this.printButton.click();
    });

    return section;
  }

  private buildModeSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'dialog-section';

    const title = document.createElement('div');
    title.className = 'dialog-section-title';
    title.textContent = '인쇄 방식';
    section.appendChild(title);

    const name = `print-mode-${Date.now()}`;

    this.pdfModeRadio = this.createRadio(name, true);
    const pdfRow = this.createOptionRow(
      this.pdfModeRadio,
      'PDF 내보내기',
      '선택한 범위의 PDF를 생성한 뒤 앱 내부 PDF 뷰어로 엽니다.',
    );
    section.appendChild(pdfRow);

    this.legacyModeRadio = this.createRadio(name, false);
    const legacyRow = this.createOptionRow(
      this.legacyModeRadio,
      '인쇄',
      '브라우저 window.print() 기반 인쇄 옵션 창을 엽니다. 앱 내부 미리보기 화면은 표시하지 않습니다.',
    );
    section.appendChild(legacyRow);

    this.pdfModeRadio.addEventListener('change', () => this.updateUiState());
    this.legacyModeRadio.addEventListener('change', () => this.updateUiState());

    return section;
  }

  private createRadio(name: string, checked: boolean): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.checked = checked;
    return input;
  }

  private createOptionRow(input: HTMLInputElement, label: string, description?: string): HTMLElement {
    const row = document.createElement('label');
    row.className = 'dialog-row';
    row.style.display = 'block';
    row.style.marginBottom = '8px';
    row.style.lineHeight = '1.5';

    const top = document.createElement('div');
    top.style.display = 'flex';
    top.style.alignItems = 'center';
    top.style.gap = '8px';
    top.appendChild(input);

    const title = document.createElement('span');
    title.textContent = label;
    top.appendChild(title);
    row.appendChild(top);

    if (description) {
      const desc = document.createElement('div');
      desc.style.marginLeft = '24px';
      desc.style.fontSize = '12px';
      desc.style.color = '#666';
      desc.textContent = description;
      row.appendChild(desc);
    }

    return row;
  }

  private updateUiState(): void {
    const rangeEnabled = this.rangeRadio.checked;
    this.startInput.readOnly = !rangeEnabled;
    this.endInput.readOnly = !rangeEnabled;
    this.startInput.classList.toggle('dialog-input-readonly', !rangeEnabled);
    this.endInput.classList.toggle('dialog-input-readonly', !rangeEnabled);

    const usingLegacy = this.legacyModeRadio.checked;
    const rangeSummary = this.getSelectedRangeSummary();
    this.helperText.textContent = usingLegacy
      ? `${rangeSummary} 인쇄 창 열기`
      : `${rangeSummary} PDF 내보내기`;
  }

  private activateRangeInputs(): void {
    if (this.rangeRadio.checked) return;
    this.rangeRadio.checked = true;
    this.updateUiState();
  }

  private getSelectedRangeSummary(): string {
    if (this.currentRadio.checked) {
      return `${this.currentPage}쪽`;
    }
    if (this.rangeRadio.checked) {
      const startPage = this.parsePage(this.startInput.value, 1);
      const endPage = this.parsePage(this.endInput.value, startPage);
      return `${startPage}-${Math.max(startPage, endPage)}쪽`;
    }
    return `1-${this.totalPages}쪽`;
  }

  private collectResult(): PrintOptionsResult | null {
    const mode: PrintMode = this.legacyModeRadio.checked ? 'legacy' : 'pdf';

    if (this.currentRadio.checked) {
      return {
        mode,
        startPage: this.currentPage,
        endPage: this.currentPage,
      };
    }

    if (this.rangeRadio.checked) {
      const startPage = this.parsePage(this.startInput.value, 1);
      const endPage = this.parsePage(this.endInput.value, startPage);
      if (startPage > endPage) {
        window.alert('시작 페이지는 끝 페이지보다 클 수 없습니다.');
        this.startInput.focus();
        return null;
      }
      return { mode, startPage, endPage };
    }

    return {
      mode,
      startPage: 1,
      endPage: this.totalPages,
    };
  }

  private parsePage(value: string, fallback: number): number {
    const page = Number.parseInt(value, 10);
    if (!Number.isFinite(page)) return fallback;
    return Math.max(1, Math.min(this.totalPages, page));
  }

  private bindKeyboard(): void {
    this.captureHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        this.resolve(null);
        return;
      }
      if (event.key === 'Enter' && target === this.endInput) {
        event.stopPropagation();
        event.preventDefault();
        this.activateRangeInputs();
        this.printButton.click();
        return;
      }
      if (event.key === 'Enter' && !isEditable) {
        event.stopPropagation();
        event.preventDefault();
        const result = this.collectResult();
        if (result) {
          this.resolve(result);
        }
        return;
      }
      event.stopPropagation();
      if (!isEditable) {
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', this.captureHandler, true);
  }

  private resolve(value: PrintOptionsResult | null): void {
    if (this.captureHandler) {
      document.removeEventListener('keydown', this.captureHandler, true);
      this.captureHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    if (this.resolver) {
      this.resolver(value);
      this.resolver = null;
    }
  }
}

export function showPrintOptionsDialog(currentPage: number, totalPages: number): Promise<PrintOptionsResult | null> {
  return new PrintOptionsDialog(currentPage, totalPages).showAsync();
}
