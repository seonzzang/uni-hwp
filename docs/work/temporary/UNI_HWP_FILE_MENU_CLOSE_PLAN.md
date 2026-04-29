# Uni-HWP File Menu Close Plan

## 1. Goal

Implement a `파일 -> 닫기` menu item that reuses the existing document close command.

The implementation must preserve the RHWP engine boundary and keep the behavior identical to the document close `X` button.

## 2. Current Assumptions

- The document close command already exists as `file:close`.
- The document close `X` already dispatches `file:close`.
- Dirty document protection is already handled by the shared close guard.
- Command enabled state is already exposed through the command dispatcher.

## 3. Implementation Steps

### Step 1. Inspect Existing Menu Structure

Review:

- `rhwp-studio/src/ui/menu-bar.ts`
- Existing file menu item definitions.
- Command enable/disable update flow.

Confirm where `파일` menu entries are registered.

### Step 2. Add File Menu Item

Add a `닫기` item under the `파일` menu.

The item must dispatch:

`file:close`

No separate close function should be introduced.

### Step 3. Wire Enabled State

Ensure the menu item follows the enabled state of `file:close`.

Expected behavior:

- Disabled when no document is open.
- Enabled when a document is open.

If file menu state is not currently refreshed from command state, extend the existing refresh mechanism without creating a second state source.

### Step 4. Verify Shared Behavior

Manually verify:

- Document close `X` closes a clean document.
- `파일 -> 닫기` closes a clean document.
- Both show the same save confirmation when dirty.
- `취소` keeps the document open.
- `저장 안 함` closes the document.
- App window stays open.

### Step 5. Build Validation

Run:

```powershell
npm run build
```

from:

`rhwp-studio`

Run:

```powershell
cargo check
```

from:

`src-tauri`

## 4. Risk Notes

- Risk: menu item remains enabled without a document.
  - Mitigation: bind to `file:close` enabled state.

- Risk: menu item creates a second close path.
  - Mitigation: dispatch only `file:close`.

- Risk: dirty confirmation differs between menu and document `X`.
  - Mitigation: reuse the same command path.

## 5. Files Expected To Change

- `rhwp-studio/src/ui/menu-bar.ts`

Possible, only if needed:

- `rhwp-studio/src/styles/menu-bar.css`
- command state refresh related code near the menu bar.

## 6. Completion Criteria

- Requirements are satisfied.
- RHWP engine files remain untouched.
- Build checks pass.
- User confirms the menu UX behaves as expected.
