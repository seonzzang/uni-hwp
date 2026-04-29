import {
  runTest,
  loadApp,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

await runTest('보존 프레임워크 스모크: 웹폰트 실패 캐시로 재시도 억제', async ({ page }) => {
  await loadApp(page);

  setTestCase('TC-1: 강제 실패 후 동일 폰트 재요청 억제');
  const result = await page.evaluate(async () => {
    const originalFontFace = window.FontFace;
    let loadCallCount = 0;

    class FailingFontFace extends originalFontFace {
      async load() {
        loadCallCount += 1;
        throw new Error('forced font load failure');
      }
    }

    window.FontFace = FailingFontFace;

    try {
      const mod = await import('/src/core/font-loader.ts');
      await mod.loadWebFonts(['HY헤드라인M']);
      const afterFirstLoad = loadCallCount;
      await mod.loadWebFonts(['HY헤드라인M']);
      const afterSecondLoad = loadCallCount;

      return {
        afterFirstLoad,
        afterSecondLoad,
      };
    } finally {
      window.FontFace = originalFontFace;
    }
  });

  assert(result.afterFirstLoad >= 1, `첫 실패 시도에서 FontFace.load 호출 발생 (${result.afterFirstLoad})`);
  assert(result.afterSecondLoad === result.afterFirstLoad, `실패 캐시 후 재요청 시 추가 load 호출 없음 (${result.afterSecondLoad})`);

  await screenshot(page, 'font-loader-failure-cache-01');
}, { skipLoadApp: true });
