import type { HwpDocument } from '@wasm/rhwp.js';
import type { SelectionRect } from './types';

type WithDoc = <T>(callback: (doc: HwpDocument) => T) => T;
type ParseDocJson = <T>(callback: (doc: HwpDocument) => string) => T;
type WithOptionalDoc = <T>(fallback: T, callback: (doc: HwpDocument) => T) => T;

export function getSelectionRects(
  parseDocJson: ParseDocJson,
  sec: number,
  startPara: number,
  startOffset: number,
  endPara: number,
  endOffset: number,
): SelectionRect[] {
  return parseDocJson((doc) => doc.getSelectionRects(sec, startPara, startOffset, endPara, endOffset));
}

export function getSelectionRectsInCell(
  parseDocJson: ParseDocJson,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  startCellPara: number,
  startOffset: number,
  endCellPara: number,
  endOffset: number,
): SelectionRect[] {
  return parseDocJson((doc) => doc.getSelectionRectsInCell(
    sec,
    parentPara,
    controlIdx,
    cellIdx,
    startCellPara,
    startOffset,
    endCellPara,
    endOffset,
  ));
}

export function deleteRange(
  parseDocJson: ParseDocJson,
  sec: number,
  startPara: number,
  startOffset: number,
  endPara: number,
  endOffset: number,
): { ok: boolean; paraIdx: number; charOffset: number } {
  return parseDocJson((doc) => doc.deleteRange(sec, startPara, startOffset, endPara, endOffset));
}

export function deleteRangeInCell(
  parseDocJson: ParseDocJson,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  startCellPara: number,
  startOffset: number,
  endCellPara: number,
  endOffset: number,
): { ok: boolean; paraIdx: number; charOffset: number } {
  return parseDocJson((doc) => doc.deleteRangeInCell(
    sec,
    parentPara,
    controlIdx,
    cellIdx,
    startCellPara,
    startOffset,
    endCellPara,
    endOffset,
  ));
}

export function copySelection(
  withDoc: WithDoc,
  sec: number,
  startPara: number,
  startOffset: number,
  endPara: number,
  endOffset: number,
): string {
  return withDoc((doc) => doc.copySelection(sec, startPara, startOffset, endPara, endOffset));
}

export function copySelectionInCell(
  withDoc: WithDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  startCellPara: number,
  startOffset: number,
  endCellPara: number,
  endOffset: number,
): string {
  return withDoc((doc) => doc.copySelectionInCell(
    sec,
    parentPara,
    controlIdx,
    cellIdx,
    startCellPara,
    startOffset,
    endCellPara,
    endOffset,
  ));
}

export function pasteInternal(withDoc: WithDoc, sec: number, para: number, charOffset: number): string {
  return withDoc((doc) => doc.pasteInternal(sec, para, charOffset));
}

export function pasteInternalInCell(
  withDoc: WithDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
  charOffset: number,
): string {
  return withDoc((doc) => doc.pasteInternalInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset));
}

export function hasInternalClipboard(withOptionalDoc: WithOptionalDoc): boolean {
  return withOptionalDoc(false, (doc) => doc.hasInternalClipboard());
}

export function getClipboardText(withOptionalDoc: WithOptionalDoc): string {
  return withOptionalDoc('', (doc) => doc.getClipboardText());
}

export function copyControl(withDoc: WithDoc, sec: number, para: number, ci: number): string {
  return withDoc((doc) => doc.copyControl(sec, para, ci));
}

export function exportControlHtml(withDoc: WithDoc, sec: number, para: number, ci: number): string {
  return withDoc((doc) => doc.exportControlHtml(sec, para, ci));
}

export function getControlImageData(withDoc: WithDoc, sec: number, para: number, ci: number): Uint8Array {
  return withDoc((doc) => doc.getControlImageData(sec, para, ci));
}

export function getControlImageMime(withDoc: WithDoc, sec: number, para: number, ci: number): string {
  return withDoc((doc) => doc.getControlImageMime(sec, para, ci));
}

export function clipboardHasControl(withOptionalDoc: WithOptionalDoc): boolean {
  return withOptionalDoc(false, (doc) => doc.clipboardHasControl());
}

export function pasteControl(withDoc: WithDoc, sec: number, para: number, charOffset: number): string {
  return withDoc((doc) => doc.pasteControl(sec, para, charOffset));
}

export function exportSelectionHtml(
  withDoc: WithDoc,
  sec: number,
  startPara: number,
  startOffset: number,
  endPara: number,
  endOffset: number,
): string {
  return withDoc((doc) => doc.exportSelectionHtml(sec, startPara, startOffset, endPara, endOffset));
}

export function exportSelectionInCellHtml(
  withDoc: WithDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  startCellPara: number,
  startOffset: number,
  endCellPara: number,
  endOffset: number,
): string {
  return withDoc((doc) => doc.exportSelectionInCellHtml(
    sec,
    parentPara,
    controlIdx,
    cellIdx,
    startCellPara,
    startOffset,
    endCellPara,
    endOffset,
  ));
}

export function pasteHtml(withDoc: WithDoc, sec: number, para: number, charOffset: number, html: string): string {
  return withDoc((doc) => doc.pasteHtml(sec, para, charOffset, html));
}

export function pasteHtmlInCell(
  withDoc: WithDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
  charOffset: number,
  html: string,
): string {
  return withDoc((doc) => doc.pasteHtmlInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset, html));
}
