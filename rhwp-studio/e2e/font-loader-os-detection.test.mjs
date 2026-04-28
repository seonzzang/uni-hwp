import {
  runTest,
  loadApp,
  loadHwpFileViaApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

await runTest('보존 프레임워크 스모크: OS 폰트 감지 동작', async ({ page }) => {
  const consoleMessages = [];

  page.on('console', (message) => {
    consoleMessages.push(message.text());
  });

  setTestCase('TC-1: 문서 로드 시 OS 폰트 감지 로그');
  await loadApp(page);
  const { pageCount } = await loadHwpFileViaApp(page, 'biz_plan.hwp');
  assert(pageCount > 0, `문서 로드 성공 (${pageCount}페이지)`);

  const osFontLog = consoleMessages.find((text) => text.includes('[FontLoader] OS 폰트 감지:'));
  assert(!!osFontLog, 'OS 폰트 감지 로그 존재');

  await screenshot(page, 'font-loader-os-detection-01');
}, { skipLoadApp: true });
