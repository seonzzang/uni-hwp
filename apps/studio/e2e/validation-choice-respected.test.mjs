import {
  runTest,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

async function waitForCondition(page, predicate, timeoutMs = 10000, intervalMs = 100) {
  return await page.evaluate(
    async ({ predicateSource, timeoutMs: timeout, intervalMs: interval }) => {
      const predicate = new Function(`return (${predicateSource})();`);
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeout) {
        try {
          if (predicate()) return true;
        } catch {
          // retry
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return false;
    },
    {
      predicateSource: predicate.toString(),
      timeoutMs,
      intervalMs,
    },
  );
}

async function startValidationScenario(page, scenarioName) {
  await page.evaluate(async (scenario) => {
    const { runDocumentValidation } = await import('/src/app/document-validation.ts');
    const report = {
      count: 1,
      summary: { LinesegArrayEmpty: 1 },
      warnings: [
        {
          kind: 'LinesegArrayEmpty',
          section: 0,
          paragraph: 12,
        },
      ],
    };

    const state = {
      scenario,
      statusMessages: [],
      reflowCalls: 0,
      canvasLoads: 0,
      done: false,
    };

    (window).__validationChoiceTest = state;

    const fakeWasm = {
      isNewDocument: false,
      getValidationWarnings: () => report,
      reflowLinesegs: () => {
        state.reflowCalls += 1;
        return 1;
      },
    };

    const fakeCanvasView = {
      loadDocument: (pageCount) => {
        state.canvasLoads += 1;
        state.lastCanvasPageCount = pageCount;
      },
    };

    runDocumentValidation({
      wasm: fakeWasm,
      canvasView: fakeCanvasView,
      pageCount: 3,
      displayName: `${scenario}.hwpx`,
      setStatusMessage: (message) => {
        state.statusMessages.push(message);
        state.lastStatusMessage = message;
      },
    }).then(() => {
      state.done = true;
    });
  }, scenarioName);
}

async function readValidationState(page) {
  return await page.evaluate(() => window.__validationChoiceTest);
}

await runTest('보존 프레임워크 스모크: validation 선택 반영', async ({ page }) => {
  setTestCase('TC-1: 그대로 보기 선택 시 자동 보정 미실행');
  await startValidationScenario(page, 'as-is');

  const modalShown = await waitForCondition(
    page,
    () => {
      const title = document.querySelector('.dialog-title');
      return !!title && (title.textContent ?? '').includes('HWPX 비표준 감지');
    },
    5000,
  );
  assert(modalShown, '강한 validation 경고에서는 모달이 표시됨');

  await page.click('.dialog-footer .dialog-btn:last-child');

  const asIsDone = await waitForCondition(page, () => window.__validationChoiceTest?.done === true);
  assert(asIsDone, '`그대로 보기` 선택 후 검증 흐름 종료');
  const asIsState = await readValidationState(page);
  assert(asIsState.reflowCalls === 0, '`그대로 보기` 선택 시 reflowLinesegs 미호출');
  assert(asIsState.canvasLoads === 0, '`그대로 보기` 선택 시 canvas reload 미호출');

  setTestCase('TC-2: 자동 보정 선택 시 보정과 canvas reload 실행');
  await startValidationScenario(page, 'auto-fix');

  const modalShownAgain = await waitForCondition(
    page,
    () => {
      const title = document.querySelector('.dialog-title');
      return !!title && (title.textContent ?? '').includes('HWPX 비표준 감지');
    },
    5000,
  );
  assert(modalShownAgain, '두 번째 강한 validation 경고에서도 모달이 표시됨');

  await page.click('.dialog-footer .dialog-btn-primary');

  const autoFixDone = await waitForCondition(page, () => window.__validationChoiceTest?.done === true);
  assert(autoFixDone, '`자동 보정` 선택 후 검증 흐름 종료');
  const autoFixState = await readValidationState(page);
  assert(autoFixState.reflowCalls === 1, '`자동 보정` 선택 시 reflowLinesegs 1회 호출');
  assert(autoFixState.canvasLoads === 1, '`자동 보정` 선택 시 canvas reload 1회 호출');
  assert(
    String(autoFixState.lastStatusMessage ?? '').includes('자동 보정됨'),
    '`자동 보정` 선택 시 상태 메시지에 보정 완료 안내 포함',
  );

  await screenshot(page, 'validation-choice-respected-01');
});
