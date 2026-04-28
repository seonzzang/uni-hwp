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

await runTest('보존 프레임워크 스모크: 인쇄 실행 분기', async ({ page }) => {
  setTestCase('TC-1: 문서 로드');
  const { pageCount } = await loadHwpFile(page, 'biz_plan.hwp');
  assert(pageCount >= 1, `biz_plan.hwp 로드 성공 (${pageCount}페이지)`);

  setTestCase('TC-2: PDF 내보내기 분기');
  await page.evaluate(() => window.__printBaseline?.());
  await waitForCondition(page, () => !!document.querySelector('.modal-overlay .dialog-wrap'), 10000);
  await page.evaluate(() => {
    const currentRow = Array.from(document.querySelectorAll('label'))
      .find((label) => (label.textContent ?? '').includes('현재 페이지'));
    currentRow?.click();
    const printButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === '인쇄');
    printButton?.click();
  });

  const pdfPreviewOpened = await waitForCondition(
    page,
    () => !!document.querySelector('.pdf-preview-shell iframe.pdf-preview-frame'),
    20000,
  );
  assert(pdfPreviewOpened, '현재 페이지 + PDF 내보내기 + 인쇄 -> 내부 PDF 뷰어 오픈');
  await screenshot(page, 'print-execution-smoke-01-pdf');

  await page.keyboard.press('Escape');
  await waitForCondition(page, () => !document.querySelector('.pdf-preview-shell'), 5000);

  setTestCase('TC-3: Legacy print 분기');
  await page.evaluate(() => {
    window.__legacyPrintCalled = false;
    const originalPrint = window.print;
    window.__legacyPrintOriginal = originalPrint;
    window.print = () => {
      window.__legacyPrintCalled = true;
    };
  });

  await page.evaluate(() => window.__printBaseline?.());
  await waitForCondition(page, () => !!document.querySelector('.modal-overlay .dialog-wrap'), 10000);
  await page.evaluate(() => {
    const currentRow = Array.from(document.querySelectorAll('label'))
      .find((label) => (label.textContent ?? '').includes('현재 페이지'));
    currentRow?.click();
    const legacyRow = Array.from(document.querySelectorAll('label'))
      .find((label) => (label.textContent ?? '').includes('브라우저 window.print()'));
    legacyRow?.click();
    const printButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === '인쇄');
    printButton?.click();
  });

  const legacyInvoked = await waitForCondition(
    page,
    () => window.__legacyPrintCalled === true,
    20000,
  );
  assert(legacyInvoked, '현재 페이지 + 인쇄 + 인쇄 -> window.print 경로 호출');

  await screenshot(page, 'print-execution-smoke-02-legacy');

  await page.evaluate(() => {
    if (window.__legacyPrintOriginal) {
      window.print = window.__legacyPrintOriginal;
    }
    delete window.__legacyPrintOriginal;
    delete window.__legacyPrintCalled;
  });
});
