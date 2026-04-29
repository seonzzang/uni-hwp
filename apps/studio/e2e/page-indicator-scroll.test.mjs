import {
  runTest,
  loadHwpFileViaApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

function extractCurrentPage(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/(\d+)\s*\/\s*(\d+)\s*쪽/);
  if (!match) return null;
  return {
    currentPage: Number.parseInt(match[1], 10),
    totalPages: Number.parseInt(match[2], 10),
  };
}

await runTest('보존 프레임워크 스모크: 상태바 페이지 표시와 스크롤 동기화', async ({ page }) => {
  setTestCase('TC-1: 큰 문서 로드');
  const { pageCount } = await loadHwpFileViaApp(page, 'kps-ai.hwp');
  assert(pageCount > 1, `큰 문서 로드 성공 (${pageCount}페이지)`);

  const initialPageInfo = extractCurrentPage(await page.$eval('#sb-page', (el) => el.textContent ?? ''));
  assert(initialPageInfo?.currentPage === 1, `초기 상태바 페이지는 1쪽 (${initialPageInfo?.currentPage})`);
  assert(initialPageInfo?.totalPages === pageCount, `상태바 전체 페이지 수 일치 (${initialPageInfo?.totalPages})`);

  setTestCase('TC-2: 아래로 스크롤 시 현재 페이지 증가');
  await page.evaluate(() => {
    const container = document.getElementById('scroll-container');
    if (!container) return;
    container.scrollTop = Math.floor(container.scrollHeight * 0.7);
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await page.waitForFunction(() => {
    const text = document.getElementById('sb-page')?.textContent ?? '';
    const match = text.match(/(\d+)\s*\/\s*(\d+)\s*쪽/);
    if (!match) return false;
    return Number.parseInt(match[1], 10) > 1;
  }, { timeout: 10000 });

  const scrolledPageInfo = extractCurrentPage(await page.$eval('#sb-page', (el) => el.textContent ?? ''));
  assert((scrolledPageInfo?.currentPage ?? 0) > 1, `스크롤 후 현재 페이지 증가 (${scrolledPageInfo?.currentPage})`);

  setTestCase('TC-3: 위로 스크롤 복귀 시 1쪽 복귀');
  await page.evaluate(() => {
    const container = document.getElementById('scroll-container');
    if (!container) return;
    container.scrollTop = 0;
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await page.waitForFunction(() => {
    const text = document.getElementById('sb-page')?.textContent ?? '';
    const match = text.match(/(\d+)\s*\/\s*(\d+)\s*쪽/);
    if (!match) return false;
    return Number.parseInt(match[1], 10) === 1;
  }, { timeout: 10000 });

  const restoredPageInfo = extractCurrentPage(await page.$eval('#sb-page', (el) => el.textContent ?? ''));
  assert(restoredPageInfo?.currentPage === 1, `맨 위 복귀 후 현재 페이지 1쪽 (${restoredPageInfo?.currentPage})`);

  await screenshot(page, 'page-indicator-scroll-01');
});
