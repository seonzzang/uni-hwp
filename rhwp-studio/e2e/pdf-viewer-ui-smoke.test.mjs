import {
  runTest,
  loadHwpFile,
  screenshot,
  assert,
  setTestCase,
} from './helpers.mjs';

async function waitForCondition(page, predicate, timeoutMs = 15000, intervalMs = 200) {
  return await page.evaluate(
    async ({ predicateSource, timeoutMs: timeout, intervalMs: interval }) => {
      const predicate = new Function(`return (${predicateSource})();`);
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeout) {
        try {
          if (predicate()) return true;
        } catch {
          // retry
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return false;
    },
    {
      predicateSource: predicate.toString(),
      timeoutMs,
      intervalMs,
    },
  );
}

await runTest('보존 프레임워크 스모크: PDF viewer UI/UX', async ({ page }) => {
  setTestCase('TC-1: 샘플 문서 로드');
  const { pageCount } = await loadHwpFile(page, 'biz_plan.hwp');
  assert(pageCount >= 1, `biz_plan.hwp 로드 성공 (${pageCount}페이지)`);

  setTestCase('TC-2: 내부 PDF 뷰어 열기');
  const result = await page.evaluate(async () => {
    try {
      await window.__pdfPreviewRange(1, 1);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  assert(result.ok === true, `내부 PDF 뷰어 열기 성공: ${result.error ?? 'ok'}`);

  const previewOpened = await waitForCondition(
    page,
    () => !!document.querySelector('.pdf-preview-shell iframe.pdf-preview-frame'),
    15000,
  );
  assert(previewOpened, '내부 PDF 뷰어 iframe 표시');

  const previewUi = await page.evaluate(() => {
    const shell = document.querySelector('.pdf-preview-shell');
    const title = document.querySelector('.pdf-preview-title')?.textContent ?? '';
    const status = document.querySelector('.pdf-preview-status')?.textContent ?? '';
    const returnButton = document.querySelector('.pdf-preview-return-button');
    const studioRoot = document.querySelector('#studio-root');
    const shellStyle = shell ? window.getComputedStyle(shell) : null;
    const studioStyle = studioRoot ? window.getComputedStyle(studioRoot) : null;

    return {
      hasShell: !!shell,
      title,
      status,
      hasReturnButton: !!returnButton,
      hasPrevButton: !!document.querySelector('.pdf-preview-prev-button'),
      hasNextButton: !!document.querySelector('.pdf-preview-next-button'),
      bodyPreviewActive: document.body.classList.contains('pdf-preview-active'),
      studioVisibility: studioStyle?.visibility ?? '',
      shellPosition: shellStyle?.position ?? '',
      shellZIndex: shellStyle?.zIndex ?? '',
      returnButtonWidth: returnButton ? window.getComputedStyle(returnButton).width : '',
      returnButtonHeight: returnButton ? window.getComputedStyle(returnButton).height : '',
    };
  });

  assert(previewUi.hasShell, 'PDF viewer shell 존재');
  assert(previewUi.bodyPreviewActive, 'body.pdf-preview-active 활성화');
  assert(previewUi.studioVisibility === 'hidden', `편집기 루트 숨김 처리: ${previewUi.studioVisibility}`);
  assert(previewUi.shellPosition === 'fixed', `PDF viewer shell fixed layout: ${previewUi.shellPosition}`);
  assert(previewUi.hasReturnButton, '편집기로 돌아가기 버튼 존재');
  assert(!previewUi.hasPrevButton, '이전 버튼 없음');
  assert(!previewUi.hasNextButton, '다음 버튼 없음');
  assert(previewUi.title.toLowerCase().includes('biz_plan'), `뷰어 제목 유지: ${previewUi.title}`);
  assert(previewUi.status.includes('PDF'), `상태 문구 유지: ${previewUi.status}`);
  assert(previewUi.returnButtonWidth === '30px', `복귀 버튼 폭 유지: ${previewUi.returnButtonWidth}`);
  assert(previewUi.returnButtonHeight === '30px', `복귀 버튼 높이 유지: ${previewUi.returnButtonHeight}`);

  await screenshot(page, 'pdf-viewer-ui-smoke-01-open');

  setTestCase('TC-3: Escape로 복귀');
  await page.keyboard.press('Escape');
  const previewClosed = await waitForCondition(
    page,
    () => !document.querySelector('.pdf-preview-shell'),
    5000,
  );
  assert(previewClosed, 'Escape로 내부 PDF 뷰어 닫힘');

  const closedState = await page.evaluate(() => ({
    bodyPreviewActive: document.body.classList.contains('pdf-preview-active'),
    shellExists: !!document.querySelector('.pdf-preview-shell'),
  }));
  assert(!closedState.bodyPreviewActive, '뷰어 닫힌 뒤 body class 해제');
  assert(!closedState.shellExists, '뷰어 닫힌 뒤 shell 제거');
});
