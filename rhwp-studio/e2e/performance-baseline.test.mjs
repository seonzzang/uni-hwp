import {
  runTest,
  loadApp,
  loadHwpFileViaApp,
  screenshot,
  assert,
  setTestCase,
} from './helpers.mjs';

await runTest('보존 프레임워크 스모크: performance baseline', async ({ page }) => {
  setTestCase('TC-1: 앱 부팅 시간 측정');
  const appLoadStartedAt = Date.now();
  await loadApp(page);
  const appLoadElapsedMs = Date.now() - appLoadStartedAt;

  assert(appLoadElapsedMs > 0, `앱 부팅 시간 측정값 확보 (${appLoadElapsedMs}ms)`);
  assert(appLoadElapsedMs < 30000, `앱 부팅 시간이 과도하게 길지 않음 (${appLoadElapsedMs}ms)`);

  setTestCase('TC-2: 첫 문서 로드 시간 측정');
  const docLoadStartedAt = Date.now();
  const { pageCount } = await loadHwpFileViaApp(page, 'kps-ai.hwp');
  const docLoadElapsedMs = Date.now() - docLoadStartedAt;

  assert(pageCount > 0, `대상 문서 로드 성공 (${pageCount}페이지)`);
  assert(docLoadElapsedMs > 0, `첫 문서 로드 시간 측정값 확보 (${docLoadElapsedMs}ms)`);
  assert(docLoadElapsedMs < 30000, `첫 문서 로드 시간이 과도하게 길지 않음 (${docLoadElapsedMs}ms)`);

  await screenshot(page, 'performance-baseline-01');

  console.log('[performance-baseline]', {
    appLoadElapsedMs,
    docLoadElapsedMs,
    sample: 'kps-ai.hwp',
    pageCount,
  });
}, { skipLoadApp: true });
