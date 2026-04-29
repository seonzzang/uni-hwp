import type { HwpDocument } from '@wasm/rhwp.js';
import type { CursorRect } from './types';

type WithDoc = <T>(callback: (doc: HwpDocument) => T) => T;
type ParseDocJson = <T>(callback: (doc: HwpDocument) => string) => T;

export function getHeaderFooter(withDoc: WithDoc, sectionIdx: number, isHeader: boolean, applyTo: number): string {
  return withDoc((doc) => doc.getHeaderFooter(sectionIdx, isHeader, applyTo));
}

export function createHeaderFooter(withDoc: WithDoc, sectionIdx: number, isHeader: boolean, applyTo: number): string {
  return withDoc((doc) => doc.createHeaderFooter(sectionIdx, isHeader, applyTo));
}

export function insertTextInHeaderFooter(
  withDoc: WithDoc,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
  charOffset: number,
  text: string,
): string {
  return withDoc((doc) => doc.insertTextInHeaderFooter(sec, isHeader, applyTo, hfParaIdx, charOffset, text));
}

export function deleteTextInHeaderFooter(
  withDoc: WithDoc,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
  charOffset: number,
  count: number,
): string {
  return withDoc((doc) => doc.deleteTextInHeaderFooter(sec, isHeader, applyTo, hfParaIdx, charOffset, count));
}

export function splitParagraphInHeaderFooter(
  withDoc: WithDoc,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
  charOffset: number,
): string {
  return withDoc((doc) => doc.splitParagraphInHeaderFooter(sec, isHeader, applyTo, hfParaIdx, charOffset));
}

export function mergeParagraphInHeaderFooter(
  withDoc: WithDoc,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
): string {
  return withDoc((doc) => doc.mergeParagraphInHeaderFooter(sec, isHeader, applyTo, hfParaIdx));
}

export function getHeaderFooterParaInfo(
  withDoc: WithDoc,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
): string {
  return withDoc((doc) => doc.getHeaderFooterParaInfo(sec, isHeader, applyTo, hfParaIdx));
}

export function getCursorRectInHeaderFooter(
  parseDocJson: ParseDocJson,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
  charOffset: number,
  preferredPage: number,
): CursorRect {
  return parseDocJson((doc) => doc.getCursorRectInHeaderFooter(sec, isHeader, applyTo, hfParaIdx, charOffset, preferredPage));
}

export function hitTestHeaderFooter(
  parseDocJson: ParseDocJson,
  pageNum: number,
  x: number,
  y: number,
): { hit: boolean; isHeader?: boolean; sectionIndex?: number; applyTo?: number } {
  return parseDocJson((doc) => doc.hitTestHeaderFooter(pageNum, x, y));
}

export function hitTestInHeaderFooter(
  parseDocJson: ParseDocJson,
  pageNum: number,
  isHeader: boolean,
  x: number,
  y: number,
): { hit: boolean; paraIndex?: number; charOffset?: number; cursorRect?: { pageIndex: number; x: number; y: number; height: number } } {
  return parseDocJson((doc) => doc.hitTestInHeaderFooter(pageNum, isHeader, x, y));
}

export function deleteHeaderFooter(withDoc: WithDoc, sectionIdx: number, isHeader: boolean, applyTo: number): void {
  withDoc((doc) => {
    doc.deleteHeaderFooter(sectionIdx, isHeader, applyTo);
  });
}

export function getHeaderFooterList(
  parseDocJson: ParseDocJson,
  currentSectionIdx: number,
  currentIsHeader: boolean,
  currentApplyTo: number,
): { ok: boolean; items: { sectionIdx: number; isHeader: boolean; applyTo: number; label: string }[]; currentIndex: number } {
  return parseDocJson((doc) => doc.getHeaderFooterList(currentSectionIdx, currentIsHeader, currentApplyTo));
}

export function toggleHideHeaderFooter(
  parseDocJson: ParseDocJson,
  pageIndex: number,
  isHeader: boolean,
): { hidden: boolean } {
  return parseDocJson((doc) => doc.toggleHideHeaderFooter(pageIndex, isHeader));
}

export function navigateHeaderFooterByPage(
  parseDocJson: ParseDocJson,
  currentPage: number,
  isHeader: boolean,
  direction: number,
): { ok: boolean; pageIndex?: number; sectionIdx?: number; isHeader?: boolean; applyTo?: number } {
  return parseDocJson((doc) => doc.navigateHeaderFooterByPage(currentPage, isHeader, direction));
}
