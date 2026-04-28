# RHWP Engine Compatibility Checklist

Project:
- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## Purpose

Use this checklist after any RHWP engine update to confirm that BBDG HWP Editor still preserves the current upgraded feature set, UI/UX flow, and performance expectations.

## Baseline

- Critical branch: `origin/bbdg-rebuild-0.7.32`
- Critical feature baseline commit: `f8e606d`
- Snapshot record commit: `4dc8497`
- Baseline document: `BBDG_CRITICAL_BRANCH_SNAPSHOT.md`

## Pass Rule

An RHWP engine update is not complete until every required item below is checked or explicitly documented as an accepted exception.

If any required item fails, stop the update work and fix that stage before proceeding.

The guardian review in `RHWP_ENGINE_GUARDIAN_AGENT.md` must also pass. A compatibility checklist without guardian review is incomplete.

Phase progression requires two gates:

- Error verification gate
- Feature preservation verification gate

Both must pass before the next phase starts.

## 1. Build And Startup

- [x] Error verification gate passed for this phase.
- [x] `cargo check` passes.
- [x] `cargo test` passes where practical.
- [x] `npm run build` passes in `rhwp-studio`.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- [x] App launches successfully.
- [x] No repeated `localhost refused` failure after startup.
- [x] No unexpected duplicate app windows.

## 2. Basic Document Loading

- [x] Local `.hwp` file opens.
- [x] Local `.hwpx` file opens.
- [x] Document page count is displayed.
- [x] First page renders.
- [x] Current page indicator updates while scrolling.
- [x] Large document opens without immediate crash.
- [x] No WASM panic appears during normal load.
- [x] No null pointer error appears during normal load.

## 3. Rendering And Interaction

- [x] Canvas/page window rendering works.
- [x] Scrolling forward renders later pages.
- [x] Scrolling backward re-renders earlier pages.
- [x] Page metadata remains consistent.
- [x] Click/hitTest works after document load.
- [x] Click before document load does not produce noisy fatal errors.
- [x] Validation warning dialog policy is applied as intended.
- [x] User choice for validation warning is respected.

## 4. Font Loading

- [x] OS font detection still runs.
- [x] Web font loading does not retry known failed fonts repeatedly.
- [x] Failed font logs do not spam infinitely.
- [x] Documents with missing fonts still render with fallback fonts.

## 5. Remote HWP/HWPX Link Drop

- [x] Browser-dragged direct `.hwp` URL is detected.
- [x] Browser-dragged direct `.hwpx` URL is detected.
- [x] `text/uri-list` candidate is detected.
- [x] `text/plain` candidate is detected where available.
- [x] Browser drag candidate selection logs are still useful.
- [x] URL extension based detection works.
- [x] Header based detection works when URL extension is hidden.
- [x] Non-document download is rejected before WASM load.
- [x] Failed download produces useful error message.
- [x] Successful remote document opens.
- [x] Repeated link drops do not crash the app.
- [x] Temporary remote download cleanup runs.
- [x] Stale cleanup warnings are suppressed or harmless.

## 6. Print Dialog UX

- [x] File menu contains a single `[인쇄]` entry.
- [x] Obsolete PDF chunk preview menu entries do not reappear.
- [x] `[인쇄]` opens the print dialog.
- [x] Print range section is visible.
- [x] Print mode section is visible.
- [x] Default mode is `PDF 내보내기`.
- [x] Secondary mode is `인쇄`.
- [x] Whole document range works.
- [x] Current page range works.
- [x] Page range selection works.
- [x] Clicking a page range number input auto-selects `페이지 범위`.
- [x] End page input accepts Enter to trigger print.
- [x] Bottom helper text is concise.

## 7. PDF Export

- [x] PDF export starts from the print dialog.
- [x] Selected page range is respected.
- [x] Whole document export is supported.
- [x] Large document export is chunked.
- [x] PDF generation does not freeze the UI without feedback.
- [x] Generated PDF opens in the in-app PDF viewer.
- [x] Generated PDF does not open unexpectedly in the external browser/PDF app.
- [x] Output PDF pages are not broken or blank.
- [x] Output PDF preserves page order.

## 8. PDF Progress Overlay

- [x] Overlay appears immediately after print starts.
- [x] Progress bar updates.
- [x] Percent text updates.
- [x] Spinner/activity indicator remains alive.
- [x] Elapsed time updates.
- [x] Full remaining-time ETA is shown.
- [x] ETA includes data preparation, PDF generation, merge, save, and open stages.
- [x] ETA is not limited to the current stage only.
- [x] ETA uses learned averages after previous successful jobs.
- [x] Cancel button is visible.
- [x] Cancel button actually stops the worker job.
- [x] Cancel does not leave stale overlay behind.
- [x] Completion hides the overlay.

## 9. PDF Worker And Merge Pipeline

- [x] Print worker launches.
- [x] Worker manifest is created.
- [x] SVG pages are written/read successfully.
- [x] Chunk PDFs are generated.
- [x] Chunk PDFs are merged.
- [x] Merged PDF is saved.
- [x] Worker analysis log is readable.
- [x] Worker progress messages are parsed.
- [x] Worker cancellation request file is respected.
- [x] Worker process is killed on cancel.
- [x] Temporary print files do not accumulate uncontrollably.

## 10. In-App PDF Viewer

- [x] In-app viewer opens after PDF export.
- [x] Viewer title shows document/range.
- [x] Viewer header looks integrated with the app.
- [x] Obsolete previous/next chunk buttons are absent.
- [x] Return-to-editor control is present.
- [x] Return-to-editor control does not look like an unrelated CTA.
- [x] Return-to-editor works.
- [x] Escape key closes viewer if supported.
- [x] Editor state remains usable after returning.

## 11. Legacy Browser Print

- [x] Selecting `인쇄` mode opens browser/window print flow.
- [x] App internal preview screen is not shown before browser print.
- [x] Browser/Chromium print preview limitation is accepted.
- [x] Canceling browser print returns to editor.

## 12. Performance Checks

Record before/after values where possible.

- [x] App startup time is not significantly worse.
- [x] First document load time is not significantly worse.
- [x] Large document first page time is not significantly worse.
- [x] Scroll responsiveness is acceptable.
- [x] PDF data preparation time is recorded.
- [x] PDF generation time is recorded.
- [x] PDF merge time is recorded.
- [x] PDF save time is recorded.
- [x] Total PDF export time is recorded.
- [x] Memory growth is acceptable.
- [x] No long silent freeze without progress feedback.

## 13. Engine Boundary

- [x] BBDG-specific feature code is not added to RHWP core.
- [x] `pkg/*` files are generated, not manually edited.
- [x] RHWP API changes are absorbed in adapter layer where possible.
- [x] App code does not spread raw RHWP API calls unnecessarily.
- [x] Any engine-core change is documented as an exception.

## 14. Guardian Review

- [ ] `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md` was read before implementation.
- [ ] `RHWP_ENGINE_MOMENTUM_MONITOR.md` was read before implementation.
- [ ] `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md` was read before implementation.
- [ ] `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md` was read before implementation.
- [ ] `RHWP_ENGINE_GUARDIAN_AGENT.md` was read before implementation.
- [ ] Guardian review was performed after each phase.
- [x] Guardian review checked the approved requirements document.
- [x] Guardian review checked the approved development spec.
- [x] Guardian review checked the approved development plan.
- [x] Guardian review checked the API inventory.
- [x] Guardian review checked this compatibility checklist.
- [x] Guardian review checked UI/UX preservation.
- [x] Guardian review checked performance preservation.
- [x] Guardian review checked upgraded feature preservation.
- [x] Final guardian decision is `Continue`.

## 15. Momentum Monitor

- [x] Current phase was identified.
- [x] Current blocker was identified if progress stalled.
- [x] Next concrete action was defined.
- [x] Momentum monitor did not bypass error verification.
- [x] Momentum monitor did not bypass feature preservation verification.
- [x] Momentum monitor did not bypass guardian review.

## 16. Baseline Comparison

- [x] App control verification was attempted where practical.
- [x] Any user-assisted checks were clearly marked.
- [x] Baseline comparison was performed before accepting the update.
- [x] Updated app startup matches the baseline behavior.
- [x] Updated file menu matches the baseline expected menu structure.
- [x] Updated document loading behavior matches the baseline.
- [x] Updated rendering/scrolling behavior matches the baseline.
- [x] Updated remote link-drop behavior matches the baseline.
- [x] Updated print dialog behavior matches the baseline.
- [x] Updated PDF export behavior matches the baseline.
- [x] Updated in-app PDF viewer behavior matches the baseline.
- [x] Updated legacy print behavior matches the baseline.
- [x] Any intentional UI/UX difference is documented.
- [x] Any intentional feature difference is documented.
- [x] Baseline comparison decision is `Pass` or `Pass with documented exceptions`.

## Result

Update result:

- [ ] Pass
- [x] Pass with documented exceptions
- [ ] Fail

Gate result:

- [x] Error verification passed.
- [x] Feature preservation verification passed.

Notes:

```text
Verified evidence on 2026-04-24:
- npm run build PASS
- cargo check --manifest-path src-tauri/Cargo.toml PASS
- cargo test --manifest-path src-tauri/Cargo.toml remote_hwp PASS
- cargo test --manifest-path src-tauri/Cargo.toml print_worker PASS
- node e2e/preservation-smoke.test.mjs PASS
- app-control boot verification PASS
- runtime health:
  - localhost:7700 -> 200
 - rhwp-studio process count -> 1
 - baseline comparison decision:
   - Pass with documented exceptions
 - documented exceptions:
   - history/procedure checkbox set (`before implementation`, `after each phase`) is not fully reconstructable post hoc
   - 일부 app-shell drag-and-drop / viewer UI 비교는 수동 및 보조 증거를 포함함
- tools/run-print-worker-smoke.ps1 PASS
- actual Tauri app-shell [인쇄] -> PDF 내보내기 -> in-app PDF viewer PASS
- root cause of prior failure confirmed as browser launch selection in print-worker
- node e2e/link-drop-smoke.test.mjs PASS
- node e2e/pdf-viewer-ui-smoke.test.mjs PASS
- cargo test --manifest-path src-tauri/Cargo.toml remote_hwp PASS (direct-extension / response-header / HTML reject / invalid signature reject)
- node e2e/print-execution-smoke.test.mjs PASS (branch invocation)
- node e2e/validation-modal-smoke.test.mjs PASS
- node e2e/performance-baseline.test.mjs PASS
- node e2e/repeated-open-stability.test.mjs PASS
- node e2e/page-indicator-scroll.test.mjs PASS
- node e2e/scroll-render-window.test.mjs PASS
- node e2e/normal-load-console-clean.test.mjs PASS
- node e2e/page-metadata-consistency.test.mjs PASS
- node e2e/preload-click-clean.test.mjs PASS
- node e2e/font-loader-os-detection.test.mjs PASS
- node e2e/font-loader-cache.test.mjs PASS
- performance baseline:
  - app startup 3145ms
  - first document load 1870ms
  - sample kps-ai.hwp 78 pages
- actual app-shell [인쇄] -> 현재 페이지 -> 인쇄 -> 인쇄 -> 취소 -> 편집기 복귀 PASS (manual)
- app-shell evidence:
  - mydocs/working/app-control-logs/print-preview-rootcause-error.png
  - mydocs/working/app-control-logs/print-preview-success-check.png
  - mydocs/working/app-control-logs/bbdg-file-menu-only-latest.png
  - mydocs/working/app-control-logs/bbdg-file-print-dialog-latest.png
  - mydocs/working/app-control-logs/bbdg-print-dialog-cancel-latest.png
  - mydocs/working/app-control-logs/bbdg-print-dialog-current-page-latest.png
  - mydocs/working/app-control-logs/bbdg-print-dialog-page-range-latest.png
- link-drop evidence:
  - rhwp-studio/e2e/screenshots/link-drop-smoke-01.png
  - rhwp-studio/output/e2e/link-drop-smoke-report.html
  - mydocs/working/rhwp_link_drop_verification_20260424.md
- pdf viewer UI evidence:
  - rhwp-studio/e2e/screenshots/pdf-viewer-ui-smoke-01-open.png
  - rhwp-studio/output/e2e/pdf-viewer-ui-smoke-report.html
  - mydocs/working/rhwp_pdf_viewer_ui_verification_20260424.md
- print dialog UI evidence:
  - rhwp-studio/e2e/screenshots/print-dialog-ui-smoke-01.png
  - rhwp-studio/output/e2e/print-dialog-ui-smoke-report.html
  - mydocs/working/rhwp_print_dialog_ui_verification_20260424.md
- legacy print evidence:
  - mydocs/working/rhwp_legacy_print_verification_20260424.md
- link-drop app-shell evidence:
  - mydocs/working/rhwp_link_drop_verification_20260424.md
- validation policy evidence:
  - rhwp-studio/e2e/screenshots/validation-modal-smoke-01-soft-warning.png
  - rhwp-studio/output/e2e/validation-modal-smoke-report.html
  - mydocs/working/rhwp_validation_modal_verification_20260424.md
- progress overlay evidence:
  - mydocs/working/rhwp_pdf_progress_overlay_verification_20260424.md
- pdf export manual evidence:
  - mydocs/working/rhwp_pdf_export_manual_verification_20260424.md
- repeated-open evidence:
  - rhwp-studio/e2e/screenshots/repeated-open-stability-01.png
  - rhwp-studio/output/e2e/repeated-open-stability-report.html
  - mydocs/working/rhwp_repeated_open_stability_20260424.md
- page-indicator evidence:
  - rhwp-studio/e2e/screenshots/page-indicator-scroll-01.png
  - rhwp-studio/output/e2e/page-indicator-scroll-report.html
  - mydocs/working/rhwp_page_indicator_scroll_verification_20260424.md
- scroll-render evidence:
  - rhwp-studio/e2e/screenshots/scroll-render-window-01.png
  - rhwp-studio/output/e2e/scroll-render-window-report.html
  - mydocs/working/rhwp_scroll_render_window_verification_20260424.md
- normal-load-console evidence:
  - rhwp-studio/e2e/screenshots/normal-load-console-clean-01.png
  - rhwp-studio/output/e2e/normal-load-console-clean-report.html
  - mydocs/working/rhwp_normal_load_console_clean_verification_20260424.md
- page-metadata evidence:
  - rhwp-studio/e2e/screenshots/page-metadata-consistency-01.png
  - rhwp-studio/output/e2e/page-metadata-consistency-report.html
  - mydocs/working/rhwp_page_metadata_consistency_verification_20260424.md
- preload-click evidence:
  - rhwp-studio/e2e/screenshots/preload-click-clean-01.png
  - rhwp-studio/output/e2e/preload-click-clean-report.html
  - mydocs/working/rhwp_preload_click_clean_verification_20260424.md
- font-loader evidence:
  - rhwp-studio/e2e/screenshots/font-loader-os-detection-01.png
  - rhwp-studio/output/e2e/font-loader-os-detection-report.html
  - mydocs/working/rhwp_font_loader_os_detection_verification_20260424.md
  - rhwp-studio/e2e/screenshots/font-loader-cache-01.png
  - rhwp-studio/output/e2e/font-loader-cache-report.html
  - mydocs/working/rhwp_font_loader_cache_verification_20260424.md

Documented remaining exception:
- Actual Tauri app-shell flow is now confirmed for PDF export and in-app viewer open.
- Actual Tauri app-shell legacy print flow is confirmed by manual verification.
- Actual Tauri app-shell remote link-drop open is confirmed by manual verification.
- Validation warning UX is intentionally policy-filtered in the app layer:
  - new document -> no modal
  - `LinesegTextRunReflow`-only warnings -> no modal, soft status-bar guidance
  - stronger warning kinds -> modal remains allowed
- Remaining gap is full automation depth for drag-and-drop and comprehensive viewer UI/UX comparison, not the core print/PDF path itself.
```
