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

const FATAL_PATTERNS = [
  /null pointer passed to rust/i,
  /wasm panic/i,
  /panic/i,
  /hittest 실패/i,
];

await runTest('보존 프레임워크 스모크: 정상 문서 로드 중 치명 콘솔 오류 없음', async ({ page }) => {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  for (let index = 0; index < SAMPLE_DOCS.length; index += 1) {
    const filename = SAMPLE_DOCS[index];
    setTestCase(`TC-${index + 1}: ${filename} 정상 로드`);
    const result = await loadHwpFileViaApp(page, filename);
    assert(result.pageCount > 0, `${filename} 페이지 수 확보 (${result.pageCount})`);
  }

  const fatalConsoleMessages = consoleMessages.filter((message) =>
    FATAL_PATTERNS.some((pattern) => pattern.test(message.text)),
  );
  const fatalPageErrors = pageErrors.filter((message) =>
    FATAL_PATTERNS.some((pattern) => pattern.test(message)),
  );

  assert(fatalConsoleMessages.length === 0, `치명 console 로그 없음 (${fatalConsoleMessages.length})`);
  assert(fatalPageErrors.length === 0, `치명 pageerror 없음 (${fatalPageErrors.length})`);

  if (fatalConsoleMessages.length > 0 || fatalPageErrors.length > 0) {
    console.log('[normal-load-console-clean] fatalConsoleMessages', fatalConsoleMessages);
    console.log('[normal-load-console-clean] fatalPageErrors', fatalPageErrors);
  }

  await screenshot(page, 'normal-load-console-clean-01');
});
