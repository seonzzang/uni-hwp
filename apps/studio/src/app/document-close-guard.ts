import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import type { DocumentSession } from '@/app/document-session';
import { saveCurrentDocument } from '@/app/document-save';
import { showSaveConfirm } from '@/ui/save-confirm-dialog';

type UnsavedGuardDeps = {
  wasm: UniHwpEngine;
  documentSession: DocumentSession;
};

function getDisplayFileName(fileName: string): string {
  const trimmed = fileName.trim();
  return trimmed.length > 0 ? trimmed : '새 문서.hwp';
}

export async function ensureDocumentCanCloseOrReplace(deps: UnsavedGuardDeps): Promise<boolean> {
  const { wasm, documentSession } = deps;
  if (!documentSession.isDirty()) {
    return true;
  }

  const choice = await showSaveConfirm(getDisplayFileName(wasm.fileName));
  if (choice === 'cancel') {
    return false;
  }
  if (choice === 'discard') {
    return true;
  }

  const result = await saveCurrentDocument(wasm);
  if (result === 'saved') {
    documentSession.markClean();
    return true;
  }

  return false;
}
