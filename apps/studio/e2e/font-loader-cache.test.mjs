import {
  runTest,
  loadApp,
  loadHwpFileViaApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

await runTest('보존 프레임워크 스모크: 웹폰트 캐시로 동일 문서 재로드 시 재시도 억제', async ({ page }) => {
  const consoleMessages = [];

  page.on('console', (message) => {
    consoleMessages.push(message.text());
  });

  await loadApp(page);

  setTestCase('TC-1: 첫 로드에서 웹폰트 로드 시작');
  await loadHwpFileViaApp(page, 'biz_plan.hwp');
  const firstLoadStartLogs = consoleMessages.filter((text) =>
    text.includes('[FontLoader] 웹폰트 로드 시작:'),
  );
  assert(firstLoadStartLogs.length >= 1, `첫 로드에서 웹폰트 로드 시작 로그 존재 (${firstLoadStartLogs.length})`);

  const logCheckpoint = consoleMessages.length;

  setTestCase('TC-2: 같은 문서 재로드 시 웹폰트 재시작 억제');
  await loadHwpFileViaApp(page, 'biz_plan.hwp');
  const secondLoadLogs = consoleMessages.slice(logCheckpoint);
  const secondLoadStartLogs = secondLoadLogs.filter((text) =>
    text.includes('[FontLoader] 웹폰트 로드 시작:'),
  );
  assert(secondLoadStartLogs.length === 0, `동일 문서 재로드 시 웹폰트 로드 재시작 없음 (${secondLoadStartLogs.length})`);

  await screenshot(page, 'font-loader-cache-01');
}, { skipLoadApp: true });
