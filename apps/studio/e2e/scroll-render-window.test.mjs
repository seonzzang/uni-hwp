import {
  runTest,
  loadHwpFileViaApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

await runTest('보존 프레임워크 스모크: 스크롤 전후 페이지 렌더 윈도우 유지', async ({ page }) => {
  const readSnapshot = async () => page.evaluate(() => {
    const canvasView = window.__canvasView;
    const canvasPool = canvasView?.canvasPool;
    return {
      currentVisiblePages: Array.isArray(canvasView?.currentVisiblePages)
        ? [...canvasView.currentVisiblePages]
        : [],
      activePages: canvasPool?.activePages
        ? Array.from(canvasPool.activePages)
        : [],
    };
  });

  setTestCase('TC-1: 초기 렌더 윈도우');
  const { pageCount } = await loadHwpFileViaApp(page, 'kps-ai.hwp');
  assert(pageCount > 1, `큰 문서 로드 성공 (${pageCount}페이지)`);

  const topSnapshot = await readSnapshot();
  assert(topSnapshot.currentVisiblePages.length > 0, `초기 visible pages 확보 (${topSnapshot.currentVisiblePages.join(', ')})`);
  assert(topSnapshot.currentVisiblePages.includes(0), '초기 visible pages에 첫 페이지 포함');

  setTestCase('TC-2: 아래 스크롤 시 뒤쪽 페이지 렌더');
  await page.evaluate(() => {
    const container = document.getElementById('scroll-container');
    if (!container) return;
    container.scrollTop = Math.floor(container.scrollHeight * 0.7);
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await page.waitForFunction(() => {
    const pages = window.__canvasView?.currentVisiblePages;
    return Array.isArray(pages) && pages.some((pageIndex) => pageIndex > 10);
  }, { timeout: 10000 });

  const downSnapshot = await readSnapshot();
  assert(downSnapshot.currentVisiblePages.some((pageIndex) => pageIndex > 10), `뒤쪽 visible pages 확보 (${downSnapshot.currentVisiblePages.join(', ')})`);
  assert(downSnapshot.activePages.some((pageIndex) => pageIndex > 10), `뒤쪽 active pages 확보 (${downSnapshot.activePages.join(', ')})`);

  setTestCase('TC-3: 위로 복귀 시 앞쪽 페이지 재렌더');
  await page.evaluate(() => {
    const container = document.getElementById('scroll-container');
    if (!container) return;
    container.scrollTop = 0;
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await page.waitForFunction(() => {
    const pages = window.__canvasView?.currentVisiblePages;
    return Array.isArray(pages) && pages.includes(0);
  }, { timeout: 10000 });

  const restoredSnapshot = await readSnapshot();
  assert(restoredSnapshot.currentVisiblePages.includes(0), `앞쪽 visible pages 복귀 (${restoredSnapshot.currentVisiblePages.join(', ')})`);
  assert(restoredSnapshot.activePages.includes(0), `앞쪽 active pages 복귀 (${restoredSnapshot.activePages.join(', ')})`);

  await screenshot(page, 'scroll-render-window-01');
});
