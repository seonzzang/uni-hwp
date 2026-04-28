# RHWP Engine API Inventory

## Purpose

This document tracks the RHWP engine APIs that BBDG HWP Editor depends on. Use it during RHWP engine updates to quickly identify breakage points and adapter changes.

## Boundary Rule

BBDG app code should depend on `WasmBridge` instead of directly depending on raw RHWP WASM APIs.

Preferred call chain:

```text
BBDG UI / Services -> WasmBridge -> RHWP WASM HwpDocument
```

## Primary Adapter

File:

`rhwp-studio/src/core/wasm-bridge.ts`

Role:

- Initialize RHWP WASM
- Own current `HwpDocument`
- Manage document replacement
- Expose stable app-facing document API
- Hide RHWP API changes from the rest of the app

## Raw RHWP Import

Current import:

```ts
import init, { HwpDocument, version } from '@wasm/rhwp.js';
```

Expected location:

- `rhwp-studio/src/core/wasm-bridge.ts`
- controlled dev-only helpers may import preview utilities, but product code should avoid raw engine calls.

## App-Facing WasmBridge API

The following methods/properties are treated as BBDG stable adapter API.

### Initialization

- `initialize()`
- `installMeasureTextWidth()`

Risk if broken:
- App cannot initialize RHWP.
- Text measurement/fallback rendering may fail.

### Document Lifecycle

- `loadDocument(data, fileName?)`
- `createNewDocument()`
- `freeDocument(doc, reason)`
- retired document handling

Risk if broken:
- HWP/HWPX load failure.
- Repeated link drops may crash.
- WASM null pointer/free errors may return.

### Document Identity

- `fileName`
- `currentFileHandle`
- `isNewDocument`
- `getSourceFormat()`

Risk if broken:
- Save/export behavior may be incorrect.
- UI title/status may be wrong.

### Export

- `exportHwp()`
- `exportHwpx()`

Risk if broken:
- Save/export fails.

### Validation And Repair

- `getValidationWarnings()`
- `reflowLinesegs()`

Risk if broken:
- Non-standard HWPX warning flow may fail.
- User repair/as-is choice may break.

### Page And Rendering

Expected functions include:

- `pageCount`
- `getPageInfo(pageIndex)`
- `renderPageSvg(pageIndex)`
- page rendering related helpers

Risk if broken:
- Editor canvas cannot render.
- PDF export cannot collect SVG pages.
- Page count display may be wrong.

### Input And HitTest

Expected functions include:

- `hitTest(...)`
- cursor/selection related calls
- vertical movement/navigation calls

Risk if broken:
- Mouse click editing fails.
- Caret movement fails.
- Pre-load input guard may regress.

### Editing

Expected functions include:

- text insertion/deletion
- formatting operations
- table/cell operations
- picture/control operations
- field/bookmark operations

Risk if broken:
- Editing features fail even if rendering still works.

## RHWP Generated Package

Generated files:

- `pkg/rhwp.js`
- `pkg/rhwp_bg.wasm`
- `pkg/rhwp.d.ts`
- `pkg/rhwp_bg.wasm.d.ts`

Rules:

- Do not manually edit generated package files.
- Regenerate them from RHWP Rust source.
- Treat manual changes as disposable.

## High-Risk RHWP Source APIs

Files:

- `src/wasm_api.rs`
- `src/lib.rs`
- renderer modules under `src/renderer/**`
- document model/parser modules under `src/model/**`

Rules:

- Do not add BBDG product UX here.
- Only add general RHWP engine behavior here.
- Prefer upstreamable changes.

## Known BBDG Feature Dependencies

### PDF Export

Depends on:

- `pageCount`
- `getPageInfo(pageIndex)`
- `renderPageSvg(pageIndex)`
- `fileName`

Implemented outside engine:

- PDF worker
- chunk generation
- merge
- progress
- cancel
- ETA
- in-app PDF viewer

### Remote Link Drop

Depends on:

- `loadDocument(data, fileName)`
- validation warning flow

Implemented outside engine:

- URL candidate detection
- download
- header detection
- temp cleanup

### Editor Rendering

Depends on:

- document load
- page count
- page info
- render page
- hitTest

Implemented outside engine:

- canvas window
- canvas pool
- UI status
- input guards

## Update Checklist For API Changes

When RHWP API changes:

- [ ] Identify changed raw API.
- [ ] Update `WasmBridge`.
- [ ] Keep app-facing method name stable if possible.
- [ ] Run TypeScript build.
- [ ] Run document load test.
- [ ] Run rendering test.
- [ ] Run PDF export test.
- [ ] Run link drop test.
- [ ] Document any app-facing API change.

## Open Inventory Task

This document should be expanded during Phase 1 by automatically listing every `this.doc.*` and `HwpDocument.*` usage in `wasm-bridge.ts`.

## Current Adapter Usage Snapshot

Updated during current refactoring pass.

The following counts show where `wasm.*` adapter calls are currently concentrated in `rhwp-studio/src/**`.

### Top WasmBridge Call Hotspots

- `engine/input-handler.ts`: 79
- `engine/command.ts`: 59
- `engine/input-handler-keyboard.ts`: 55
- `engine/cursor.ts`: 38
- `engine/input-handler-text.ts`: 26
- `command/commands/table.ts`: 22
- `engine/input-handler-mouse.ts`: 20
- `view/canvas-view.ts`: 19
- `command/commands/page.ts`: 19
- `command/commands/insert.ts`: 18

Interpretation:

- High counts under `engine/*` are expected and currently acceptable because editing, cursor movement, hit testing, and selection depend heavily on the adapter boundary.
- High counts under `command/commands/*` are acceptable but should be watched so command files do not become a second adapter layer.
- New product behavior should not bypass `WasmBridge` and should not import raw RHWP WASM directly.

### Top `services.wasm.*` Hotspots

These are command/dialog areas most tightly coupled to the adapter through command services.

- `command/commands/table.ts`: 22
- `command/commands/page.ts`: 19
- `command/commands/insert.ts`: 18
- `command/commands/view.ts`: 8
- `command/commands/format.ts`: 4
- `ui/bookmark-dialog.ts`: 4
- `command/commands/edit.ts`: 3
- `ui/find-dialog.ts`: 3
- `ui/goto-dialog.ts`: 3
- `command/commands/file.ts`: 2

Interpretation:

- `table`, `page`, and `insert` are the heaviest command-side consumers and should be treated as high-risk during RHWP engine updates.
- `file.ts` is now low-count after refactoring, which is good and should be preserved.

## Boundary Conclusion

Current boundary posture is acceptable:

- raw RHWP WASM stays concentrated in `rhwp-studio/src/core/wasm-bridge.ts`
- app/services/UI mostly depend on `WasmBridge`
- the next structural risk is not raw engine leakage but adapter surface size and concentration in a few high-traffic engine files

## Next Inventory Expansion

The next useful expansion is:

- classify `WasmBridge` methods by functional domain
  - document lifecycle
  - rendering/layout
  - text editing
  - table/cell
  - shape/picture
  - header/footer
  - search/bookmark/field
- mark each method as
  - `core RHWP stable`
  - `BBDG critical`
  - `optional / feature-gated`

## RHWP Raw Bypass Candidates

The following paths currently touch RHWP WASM more directly than normal app code.
They are not all violations, but they must be treated as explicit boundary exceptions.

### Confirmed Direct RHWP Import Points

- `rhwp-studio/src/core/wasm-bridge.ts`
  - primary adapter boundary
  - expected and allowed
- `rhwp-studio/src/hwpctl/index.ts`
  - dynamically imports `@wasm/rhwp.js`
  - creates `HwpDocument.createEmpty()` for compatibility-layer usage
  - allowed as a compatibility exception, but should remain isolated under `hwpctl`

### Notes

- Search also finds many comment-only references to `rhwp` in `hwpctl/actions/*`; these are documentation/mapping comments, not runtime bypasses.
- No new direct `@wasm/rhwp.js` imports were found under `app`, `print`, `ui`, `engine`, or `command` during this pass.

### Boundary Rule From This Snapshot

- New BBDG product code must not import `@wasm/rhwp.js` directly.
- If a new exception is unavoidable, it must be recorded in this inventory and justified as either:
  - adapter boundary infrastructure, or
  - compatibility-layer infrastructure.
