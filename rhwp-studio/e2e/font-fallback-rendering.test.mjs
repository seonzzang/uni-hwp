import {
  runTest,
  loadApp,
  loadHwpFile,
  waitForCanvas,
  screenshot,
  assert,
  setTestCase,
} from './helpers.mjs';

await runTest(
  '보존 프레임워크 스모크: 누락 웹폰트 fallback 렌더링',
  async ({ page }) => {
    await page.evaluateOnNewDocument(() => {
      const OriginalFontFace = window.FontFace;
      class FailingFontFace extends OriginalFontFace {
        async load() {
          throw new Error('forced font load failure for fallback rendering test');
        }
      }
      window.FontFace = FailingFontFace;
    });

    await loadApp(page);

    setTestCase('TC-1: 웹폰트 실패 강제 후에도 문서가 렌더링됨');
    const result = await loadHwpFile(page, 'biz_plan.hwp');
    assert(result.pageCount > 0, `문서 페이지 수 유지: ${result.pageCount}`);
    await waitForCanvas(page);

    const renderState = await page.evaluate(() => {
      const canvas = document.querySelector('#scroll-container canvas');
      if (!(canvas instanceof HTMLCanvasElement)) {
        return {
          hasCanvas: false,
          nonWhitePixels: 0,
          statusText: '',
          currentPageText: '',
        };
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return {
          hasCanvas: true,
          nonWhitePixels: 0,
          statusText: '',
          currentPageText: '',
        };
      }

      const sampleWidth = Math.min(canvas.width, 400);
      const sampleHeight = Math.min(canvas.height, 400);
      const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      let nonWhitePixels = 0;
      for (let index = 0; index < imageData.length; index += 16) {
        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        const a = imageData[index + 3];
        if (a > 0 && (r < 245 || g < 245 || b < 245)) {
          nonWhitePixels += 1;
        }
      }

      const statusText = document.getElementById('sb-message')?.textContent ?? '';
      const currentPageText = document.getElementById('sb-page')?.textContent ?? '';
      return {
        hasCanvas: true,
        nonWhitePixels,
        statusText,
        currentPageText,
      };
    });

    assert(renderState.hasCanvas, '캔버스 렌더링 유지');
    assert(renderState.nonWhitePixels > 20, `fallback 상태에서도 비어 있지 않은 페이지 렌더 유지: ${renderState.nonWhitePixels}`);
    assert(String(renderState.currentPageText).includes('/'), `상태바 페이지 표시 유지: ${renderState.currentPageText}`);

    await screenshot(page, 'font-fallback-rendering-01');
  },
  { skipLoadApp: true },
);
