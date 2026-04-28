import {
  runTest,
  loadHwpFileViaApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

await runTest('보존 프레임워크 스모크: 페이지 메타데이터 일관성', async ({ page }) => {
  setTestCase('TC-1: 큰 문서 로드 및 초기 메타데이터 수집');
  const { pageCount } = await loadHwpFileViaApp(page, 'kps-ai.hwp');
  assert(pageCount > 2, `큰 문서 로드 성공 (${pageCount}페이지)`);

  const targetIndexes = [0, Math.floor(pageCount / 2), pageCount - 1];
  const initialMetadata = await page.evaluate((indexes) => {
    return indexes.map((index) => {
      const info = window.__wasm?.getPageInfo(index);
      return {
        index,
        width: info?.width ?? 0,
        height: info?.height ?? 0,
        sectionIndex: info?.sectionIndex ?? -1,
      };
    });
  }, targetIndexes);

  assert(initialMetadata.every((info) => info.width > 0 && info.height > 0), '초기 페이지 메타데이터 폭/높이 확보');

  setTestCase('TC-2: 스크롤 후 메타데이터 재수집');
  await page.evaluate(() => {
    const container = document.getElementById('scroll-container');
    if (!container) return;
    container.scrollTop = Math.floor(container.scrollHeight * 0.8);
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));

  const scrolledMetadata = await page.evaluate((indexes) => {
    return indexes.map((index) => {
      const info = window.__wasm?.getPageInfo(index);
      return {
        index,
        width: info?.width ?? 0,
        height: info?.height ?? 0,
        sectionIndex: info?.sectionIndex ?? -1,
      };
    });
  }, targetIndexes);

  const metadataConsistent = initialMetadata.every((info, idx) => {
    const next = scrolledMetadata[idx];
    return (
      info.index === next.index
      && info.width === next.width
      && info.height === next.height
      && info.sectionIndex === next.sectionIndex
    );
  });

  assert(metadataConsistent, '스크롤 전후 페이지 메타데이터 일관성 유지');

  await screenshot(page, 'page-metadata-consistency-01');
});
