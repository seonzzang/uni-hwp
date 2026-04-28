import {
  runTest,
  loadHwpFileViaApp,
  screenshot,
  assert,
  setTestCase,
} from './helpers.mjs';

async function waitForCondition(page, predicate, timeoutMs = 10000, intervalMs = 150) {
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

await runTest('보존 프레임워크 스모크: validation modal 경계', async ({ page }) => {
  setTestCase('TC-1: 새 문서에서는 validation modal 미표시');
  await page.evaluate(() => window.__eventBus?.emit('create-new-document'));
  const newDocModalShown = await waitForCondition(
    page,
    () => {
      const title = document.querySelector('.dialog-title');
      return !!title && (title.textContent ?? '').includes('HWPX 비표준 감지');
    },
    2500,
  );
  assert(!newDocModalShown, '새 문서에서는 validation modal이 뜨지 않음');

  setTestCase('TC-2: R3 단독 경고 문서는 상태바 약한 안내');
  await loadHwpFileViaApp(page, 'BlogForm_BookReview.hwp');
  const softWarningModalShown = await waitForCondition(
    page,
    () => {
      const title = document.querySelector('.dialog-title');
      return !!title && (title.textContent ?? '').includes('HWPX 비표준 감지');
    },
    2500,
  );
  assert(!softWarningModalShown, 'R3 단독 경고 문서에서는 validation modal이 뜨지 않음');
  await screenshot(page, 'validation-modal-smoke-01-soft-warning');
});
