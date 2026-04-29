import {
  runTest,
  loadHwpFileViaApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

const SAMPLE_DOCS = [
  'biz_plan.hwp',
  'form-002.hwpx',
  'kps-ai.hwp',
];

await runTest('보존 프레임워크 스모크: 반복 문서 교체 안정성', async ({ page }) => {
  const pageCounts = [];

  for (let index = 0; index < SAMPLE_DOCS.length; index += 1) {
    const filename = SAMPLE_DOCS[index];
    setTestCase(`TC-${index + 1}: ${filename} 반복 로드`);

    const result = await loadHwpFileViaApp(page, filename);
    pageCounts.push(result.pageCount);

    assert(result.pageCount > 0, `${filename} 페이지 수 확보 (${result.pageCount})`);

    const snapshot = await page.evaluate(() => ({
      pageCount: window.__wasm?.pageCount ?? 0,
      fileName: window.__wasm?.fileName ?? null,
      hasCanvas: !!document.querySelector('#scroll-container canvas'),
    }));

    assert(snapshot.pageCount > 0, `${filename} 로드 후 WASM 페이지 수 유지 (${snapshot.pageCount})`);
    assert(snapshot.hasCanvas === true, `${filename} 로드 후 캔버스 렌더링 유지`);
  }

  const uniquePageCounts = new Set(pageCounts);
  assert(uniquePageCounts.size >= 2, `반복 로드 후 문서 교체 흔적 확보 (${[...uniquePageCounts].join(', ')})`);

  await screenshot(page, 'repeated-open-stability-01');
});
