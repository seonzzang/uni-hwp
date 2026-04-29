import type { HwpDocument } from '@wasm/rhwp.js';

type WithDoc = <T>(callback: (doc: HwpDocument) => T) => T;
type WithOptionalDoc = <T>(fallback: T, callback: (doc: HwpDocument) => T) => T;

export function setShowParagraphMarks(withDoc: WithDoc, enabled: boolean): void {
  withDoc((doc) => {
    doc.setShowParagraphMarks(enabled);
  });
}

export function getShowControlCodes(withOptionalDoc: WithOptionalDoc): boolean {
  return withOptionalDoc(false, (doc) => (doc as any).getShowControlCodes());
}

export function setShowControlCodes(withDoc: WithDoc, enabled: boolean): void {
  withDoc((doc) => {
    (doc as any).setShowControlCodes(enabled);
  });
}

export function getShowTransparentBorders(withOptionalDoc: WithOptionalDoc): boolean {
  return withOptionalDoc(false, (doc) => doc.getShowTransparentBorders());
}

export function setShowTransparentBorders(withDoc: WithDoc, enabled: boolean): void {
  withDoc((doc) => {
    doc.setShowTransparentBorders(enabled);
  });
}

export function setClipEnabled(withDoc: WithDoc, enabled: boolean): void {
  withDoc((doc) => {
    doc.setClipEnabled(enabled);
  });
}

export function saveSnapshot(withDoc: WithDoc): number {
  return withDoc((doc) => doc.saveSnapshot());
}

export function restoreSnapshot(withDoc: WithDoc, id: number): void {
  withDoc((doc) => {
    doc.restoreSnapshot(id);
  });
}

export function discardSnapshot(withDoc: WithDoc, id: number): void {
  withDoc((doc) => {
    doc.discardSnapshot(id);
  });
}
