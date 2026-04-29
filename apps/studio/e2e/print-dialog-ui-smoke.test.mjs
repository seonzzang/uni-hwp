import {
  runTest,
  loadHwpFile,
  screenshot,
  assert,
  setTestCase,
} from './helpers.mjs';

async function waitForCondition(page, predicate, timeoutMs = 10000, intervalMs = 200) {
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

await runTest('보존 프레임워크 스모크: 인쇄 대화창 UI/UX', async ({ page }) => {
  setTestCase('TC-1: 문서 로드');
  const { pageCount } = await loadHwpFile(page, 'biz_plan.hwp');
  assert(pageCount >= 1, `biz_plan.hwp 로드 성공 (${pageCount}페이지)`);

  setTestCase('TC-2: 인쇄 대화창 열기');
  await page.evaluate(() => window.__printBaseline?.());
  const dialogOpened = await waitForCondition(
    page,
    () => !!document.querySelector('.modal-overlay .dialog-wrap'),
    10000,
  );
  assert(dialogOpened, '인쇄 대화창 표시');

  const initialState = await page.evaluate(() => {
    const overlay = document.querySelector('.modal-overlay');
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const helperText = Array.from(document.querySelectorAll('div'))
      .find((el) => (el.textContent ?? '').includes('PDF 내보내기') || (el.textContent ?? '').includes('인쇄 창 열기'));
    const buttons = Array.from(document.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');
    return {
      hasOverlay: !!overlay,
      radioCount: radios.length,
      helperText: helperText?.textContent?.trim() ?? '',
      buttons,
      pageSummary: document.body.textContent?.includes(`문서 전체 (${window.__wasm?.pageCount ?? 0}쪽)`) ?? false,
    };
  });

  assert(initialState.hasOverlay, '모달 오버레이 존재');
  assert(initialState.radioCount >= 5, `라디오 입력 존재: ${initialState.radioCount}`);
  assert(initialState.pageSummary, '문서 전체 페이지 수 표시');
  assert(initialState.helperText.includes('PDF 내보내기'), `기본 helper text 확인: ${initialState.helperText}`);
  assert(initialState.buttons.includes('인쇄'), '인쇄 버튼 존재');
  assert(initialState.buttons.includes('취소'), '취소 버튼 존재');

  setTestCase('TC-3: 현재 페이지 선택');
  await page.evaluate(() => {
    const currentRow = Array.from(document.querySelectorAll('label'))
      .find((label) => (label.textContent ?? '').includes('현재 페이지'));
    currentRow?.click();
  });

  const currentState = await page.evaluate(() => {
    const helperText = Array.from(document.querySelectorAll('div'))
      .find((el) => (el.textContent ?? '').includes('PDF 내보내기') || (el.textContent ?? '').includes('인쇄 창 열기'));
    return {
      text: helperText?.textContent?.trim() ?? '',
    };
  });
  assert(currentState.text.includes('1쪽'), `현재 페이지 helper text 반영: ${currentState.text}`);

  setTestCase('TC-4: 페이지 범위 선택');
  await page.evaluate(() => {
    const rangeRow = Array.from(document.querySelectorAll('label'))
      .find((label) => (label.textContent ?? '').includes('페이지 범위'));
    rangeRow?.click();
  });
  const rangeState = await page.evaluate(() => {
    const helperText = Array.from(document.querySelectorAll('div'))
      .find((el) => (el.textContent ?? '').includes('PDF 내보내기') || (el.textContent ?? '').includes('인쇄 창 열기'));
    return {
      text: helperText?.textContent?.trim() ?? '',
    };
  });
  assert(rangeState.text.includes('1-6쪽') || rangeState.text.includes('1-10쪽'), `페이지 범위 helper text 반영: ${rangeState.text}`);

  setTestCase('TC-5: 인쇄 방식 전환');
  await page.evaluate(() => {
    const legacyRow = Array.from(document.querySelectorAll('label'))
      .find((label) => (label.textContent ?? '').includes('브라우저 window.print()'));
    legacyRow?.click();
  });
  const legacyState = await page.evaluate(() => {
    const helperText = Array.from(document.querySelectorAll('div'))
      .find((el) => (el.textContent ?? '').includes('PDF 내보내기') || (el.textContent ?? '').includes('인쇄 창 열기'));
    return {
      text: helperText?.textContent?.trim() ?? '',
    };
  });
  assert(legacyState.text.includes('인쇄 창 열기'), `legacy helper text 반영: ${legacyState.text}`);

  await screenshot(page, 'print-dialog-ui-smoke-01');

  setTestCase('TC-6: 취소로 닫기');
  await page.evaluate(() => {
    const cancelButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === '취소');
    cancelButton?.click();
  });
  const dialogClosed = await waitForCondition(
    page,
    () => !document.querySelector('.modal-overlay .dialog-wrap'),
    5000,
  );
  assert(dialogClosed, '취소로 인쇄 대화창 닫힘');
});
