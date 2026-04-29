import type { HwpDocument } from '@wasm/rhwp.js';
import type { PageDef, PageInfo, SectionDef } from './types';

type WithDoc = <T>(callback: (doc: HwpDocument) => T) => T;
type ParseDocJson = <T>(callback: (doc: HwpDocument) => string) => T;

export function supportsProgressivePaging(doc: HwpDocument | null): boolean {
  const candidate = doc as any;
  return !!candidate
    && typeof candidate.startProgressivePaging === 'function'
    && typeof candidate.stepProgressivePaging === 'function'
    && typeof candidate.isPagingFinished === 'function';
}

export function startProgressivePaging(doc: HwpDocument): void {
  const candidate = doc as any;
  if (typeof candidate.startProgressivePaging !== 'function') {
    throw new Error('현재 WASM 빌드는 증분 페이징을 지원하지 않습니다');
  }
  candidate.startProgressivePaging();
}

export function stepProgressivePaging(doc: HwpDocument, chunkSize: number): number {
  const candidate = doc as any;
  if (typeof candidate.stepProgressivePaging !== 'function') {
    throw new Error('현재 WASM 빌드는 증분 페이징을 지원하지 않습니다');
  }
  return candidate.stepProgressivePaging(chunkSize);
}

export function isPagingFinished(doc: HwpDocument | null): boolean {
  if (!doc) return true;
  const candidate = doc as any;
  if (typeof candidate.isPagingFinished !== 'function') {
    return true;
  }
  return candidate.isPagingFinished();
}

export function getPageInfo(parseDocJson: ParseDocJson, pageNum: number): PageInfo {
  return parseDocJson((doc) => doc.getPageInfo(pageNum));
}

export function getPageDef(parseDocJson: ParseDocJson, sectionIdx: number): PageDef {
  return parseDocJson((doc) => doc.getPageDef(sectionIdx));
}

export function setPageDef(
  parseDocJson: ParseDocJson,
  sectionIdx: number,
  pageDef: PageDef,
): { ok: boolean; pageCount: number } {
  return parseDocJson((doc) => doc.setPageDef(sectionIdx, JSON.stringify(pageDef)));
}

export function getSectionDef(parseDocJson: ParseDocJson, sectionIdx: number): SectionDef {
  return parseDocJson((doc) => doc.getSectionDef(sectionIdx));
}

export function setSectionDef(
  parseDocJson: ParseDocJson,
  sectionIdx: number,
  sectionDef: SectionDef,
): { ok: boolean; pageCount: number } {
  return parseDocJson((doc) => doc.setSectionDef(sectionIdx, JSON.stringify(sectionDef)));
}

export function setSectionDefAll(
  parseDocJson: ParseDocJson,
  sectionDef: SectionDef,
): { ok: boolean; pageCount: number } {
  return parseDocJson((doc) => doc.setSectionDefAll(JSON.stringify(sectionDef)));
}

export function renderPageToCanvas(
  withDoc: WithDoc,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number,
): void {
  withDoc((doc) => {
    doc.renderPageToCanvas(pageNum, canvas, scale);
  });
}

export function renderPageSvg(withDoc: WithDoc, pageNum: number): string {
  return withDoc((doc) => doc.renderPageSvg(pageNum));
}
