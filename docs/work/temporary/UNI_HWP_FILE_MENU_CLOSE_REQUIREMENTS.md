# Uni-HWP File Menu Close Requirements

## 1. Purpose

Add a `닫기` command under the `파일` menu so users can close the currently opened document using a familiar document-editor workflow.

The menu command must behave exactly the same as the document-level close `X` button.

## 2. Scope

This change belongs to the Uni-HWP app shell and command layer.

The RHWP engine core must not be modified.

## 3. Required Behavior

### 3.1 File Menu Item

- Add `닫기` under the `파일` menu.
- The menu item must execute the existing `file:close` command.
- The menu item must be disabled when no document is open.
- The menu item must be enabled when a document is open.

### 3.2 Shared Close Flow

The following entry points must use the same close command and produce the same result:

- Document-level close `X` button.
- `파일 -> 닫기` menu item.

Both entry points must:

- Close the current document when the document is clean.
- Show the unsaved-change confirmation dialog when the document is dirty.
- Respect `저장`, `저장 안 함`, and `취소`.
- Return the editor to the empty document state after a successful close.
- Keep the app process open.

### 3.3 Unsaved Change Guard

If the current document has unsaved changes, the close flow must show:

`'<파일명>' 문서를 저장하겠습니까?`

The dialog behavior must be identical to the existing document close `X` behavior.

### 3.4 Disabled State

When no document is open:

- `파일 -> 닫기` must be disabled.
- The document-level close `X` must remain disabled or visually inactive.

## 4. UX Notes

- The label must be `닫기`.
- The menu command must match common document editor behavior, such as MS Word-style document close semantics.
- The app-level window close `X` remains app exit.
- The document close `X` and `파일 -> 닫기` remain document close.

## 5. Non-Goals

- Do not add multi-document tab support.
- Do not close the whole app from `파일 -> 닫기`.
- Do not modify RHWP parser, model, layout, rendering, WASM core, or engine internals.
- Do not introduce a separate close implementation.

## 6. Acceptance Criteria

- `파일 -> 닫기` appears in the file menu.
- `파일 -> 닫기` is disabled with no open document.
- `파일 -> 닫기` is enabled with an open document.
- `파일 -> 닫기` and document `X` share the same `file:close` behavior.
- Dirty document close confirmation works from both entry points.
- Clean document close returns to the empty editor state.
- App window remains open after document close.
- `npm run build` passes.
- `cargo check` passes.
