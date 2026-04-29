import {
  runTest,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

const FATAL_PATTERNS = [
  /null pointer passed to rust/i,
  /문서가 로드되지 않았습니다/i,
  /\[InputHandler\] hitTest 실패/i,
];

await runTest('보존 프레임워크 스모크: 문서 로드 전 클릭 시 조용한 처리', async ({ page }) => {
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

  setTestCase('TC-1: 문서 없는 상태에서 편집 영역 클릭');
  await page.click('#scroll-container');
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)));

  const fatalConsoleMessages = consoleMessages.filter((message) =>
    FATAL_PATTERNS.some((pattern) => pattern.test(message.text)),
  );
  const fatalPageErrors = pageErrors.filter((message) =>
    FATAL_PATTERNS.some((pattern) => pattern.test(message)),
  );

  assert(fatalConsoleMessages.length === 0, `문서 로드 전 클릭 시 치명 console 로그 없음 (${fatalConsoleMessages.length})`);
  assert(fatalPageErrors.length === 0, `문서 로드 전 클릭 시 치명 pageerror 없음 (${fatalPageErrors.length})`);

  await screenshot(page, 'preload-click-clean-01');
});
