export type SaveConfirmChoice = 'save' | 'discard' | 'cancel';

class SaveConfirmDialog {
  private overlay: HTMLDivElement;
  private dialog: HTMLDivElement;
  private resolve!: (value: SaveConfirmChoice) => void;
  private settled = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(private fileName: string) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';

    this.dialog = document.createElement('div');
    this.dialog.className = 'dialog-wrap';
    this.dialog.style.width = '420px';
  }

  private settle(value: SaveConfirmChoice): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
    this.hide();
  }

  private build(): void {
    const titleBar = document.createElement('div');
    titleBar.className = 'dialog-title';
    titleBar.textContent = '문서 저장';

    const closeButton = document.createElement('button');
    closeButton.className = 'dialog-close';
    closeButton.textContent = '\u00D7';
    closeButton.addEventListener('click', () => this.settle('cancel'));
    titleBar.appendChild(closeButton);
    this.dialog.appendChild(titleBar);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.style.padding = '18px 20px';
    body.style.lineHeight = '1.6';

    const headline = document.createElement('div');
    headline.style.fontSize = '14px';
    headline.style.fontWeight = '600';
    headline.style.marginBottom = '8px';
    headline.textContent = `'${this.fileName}' 문서를 저장하겠습니까?`;
    body.appendChild(headline);

    const description = document.createElement('div');
    description.style.fontSize = '13px';
    description.style.color = 'var(--color-text-hint)';
    description.textContent = '저장하지 않은 변경 내용은 닫거나 종료하면 사라집니다.';
    body.appendChild(description);

    this.dialog.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'dialog-footer';

    const saveButton = document.createElement('button');
    saveButton.className = 'dialog-btn dialog-btn-primary';
    saveButton.textContent = '저장';
    saveButton.addEventListener('click', () => this.settle('save'));

    const discardButton = document.createElement('button');
    discardButton.className = 'dialog-btn';
    discardButton.textContent = '저장 안 함';
    discardButton.addEventListener('click', () => this.settle('discard'));

    const cancelButton = document.createElement('button');
    cancelButton.className = 'dialog-btn';
    cancelButton.textContent = '취소';
    cancelButton.addEventListener('click', () => this.settle('cancel'));

    footer.appendChild(saveButton);
    footer.appendChild(discardButton);
    footer.appendChild(cancelButton);
    this.dialog.appendChild(footer);

    this.overlay.appendChild(this.dialog);
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.settle('cancel');
      }
    });
  }

  private installKeyHandler(): void {
    this.keydownHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.settle('cancel');
        return;
      }

      if (event.key === 'Enter' && !isEditable) {
        event.preventDefault();
        event.stopPropagation();
        this.settle('save');
        return;
      }

      event.stopPropagation();
      if (!isEditable) {
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', this.keydownHandler, true);
  }

  show(): Promise<SaveConfirmChoice> {
    this.build();
    this.installKeyHandler();
    document.body.appendChild(this.overlay);

    const saveButton = this.dialog.querySelector('.dialog-btn-primary') as HTMLButtonElement | null;
    saveButton?.focus();

    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private hide(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    this.overlay.remove();
  }
}

export function showSaveConfirm(fileName: string): Promise<SaveConfirmChoice> {
  return new SaveConfirmDialog(fileName).show();
}
