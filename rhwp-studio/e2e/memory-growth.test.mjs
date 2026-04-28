import {
  runTest,
  loadApp,
  loadHwpFileViaApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

const SAMPLE_DOCS = [
  'biz_plan.hwp',
  'form-002.hwpx',
  'kps-ai.hwp',
  'biz_plan.hwp',
  'kps-ai.hwp',
];

await runTest('보존 프레임워크 스모크: memory growth', async ({ page }) => {
  await loadApp(page);

  const readHeap = async () => await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);

  setTestCase('TC-1: 초기 heap 측정');
  const before = await readHeap();
  assert(typeof before === 'number' && before > 0, `초기 usedJSHeapSize 측정 가능 (${before})`);

  setTestCase('TC-2: 반복 문서 교체 후 heap 측정');
  for (const filename of SAMPLE_DOCS) {
    const result = await loadHwpFileViaApp(page, filename);
    assert(result.pageCount > 0, `${filename} 반복 로드 성공 (${result.pageCount}페이지)`);
  }

  const after = await readHeap();
  assert(typeof after === 'number' && after > 0, `반복 로드 후 usedJSHeapSize 측정 가능 (${after})`);

  const delta = typeof before === 'number' && typeof after === 'number' ? after - before : null;
  const acceptable = delta === null ? false : delta <= (50 * 1024 * 1024);
  assert(acceptable, `반복 문서 교체 후 heap 증가가 허용 범위 이내 (${delta} bytes)`);

  console.log('[memory-growth]', {
    before,
    after,
    delta,
    allowedDelta: 50 * 1024 * 1024,
    sampleDocs: SAMPLE_DOCS,
  });

  await screenshot(page, 'memory-growth-01');
}, { skipLoadApp: true });
