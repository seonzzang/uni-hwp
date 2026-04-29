import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { CanvasView } from '@/view/canvas-view';
import { showValidationModalIfNeeded } from '@/ui/validation-modal';

const SOFT_WARNING_KIND = 'LinesegTextRunReflow';

export async function runDocumentValidation(params: {
  wasm: UniHwpEngine;
  canvasView: CanvasView | null;
  pageCount: number;
  displayName: string;
  setStatusMessage: (message: string) => void;
}): Promise<void> {
  const { wasm, canvasView, pageCount, displayName, setStatusMessage } = params;

  try {
    if (wasm.isNewDocument) return;

    const report = wasm.getValidationWarnings();
    console.log(`[validation] ${report.count} warnings`, report.summary);
    if (report.count <= 0) return;

    const hasOnlySoftWarnings = report.warnings.every(
      (warning) => warning.kind === SOFT_WARNING_KIND,
    );

    if (hasOnlySoftWarnings) {
      setStatusMessage('일부 문단 표시를 자동 보정할 수 있습니다.');
      window.setTimeout(() => {
        setStatusMessage(displayName);
      }, 4000);
      return;
    }

    const choice = await showValidationModalIfNeeded(report);
    console.log(`[validation] user choice: ${choice}`);
    if (choice !== 'auto-fix') return;

    const reflowedParagraphCount = wasm.reflowLinesegs();
    console.log(`[validation] reflowed ${reflowedParagraphCount} paragraphs`);
    canvasView?.loadDocument(pageCount);
    setStatusMessage(`${displayName} (비표준 lineseg ${reflowedParagraphCount}건 자동 보정됨)`);
  } catch (error) {
    console.warn('[validation] 감지/보정 실패 (치명적이지 않음):', error);
  }
}

