import type { HwpDocument } from '@wasm/rhwp.js';
import type { BookmarkInfo, DocumentPosition, FieldInfoResult, PageOfPositionResult, ReplaceAllResult, ReplaceResult, SearchResult } from './types';

type WithOptionalDoc = <T>(fallback: T, callback: (doc: HwpDocument) => T) => T;
type ParseOptionalDocJson = <T>(fallback: T, callback: (doc: HwpDocument) => string) => T;
type ParseOptionalDocMethodJson = <T>(methodName: string, fallback: T, ...args: any[]) => T;
type GetOptionalDocMethod = <T extends (...args: any[]) => any>(methodName: string) => T | null;

export function getFieldList(doc: HwpDocument): Array<{
  fieldId: number;
  fieldType: string;
  name: string;
  guide: string;
  command: string;
  value: string;
  location: { sectionIndex: number; paraIndex: number; path?: Array<any> };
}> {
  return JSON.parse((doc as any).getFieldList());
}

export function getFieldValue(doc: HwpDocument, fieldId: number): { ok: boolean; value: string } {
  return JSON.parse((doc as any).getFieldValue(fieldId));
}

export function getFieldValueByName(doc: HwpDocument, name: string): { ok: boolean; fieldId: number; value: string } {
  return JSON.parse((doc as any).getFieldValueByName(name));
}

export function setFieldValue(doc: HwpDocument, fieldId: number, value: string): { ok: boolean; fieldId: number; oldValue: string; newValue: string } {
  return JSON.parse((doc as any).setFieldValue(fieldId, value));
}

export function setFieldValueByName(doc: HwpDocument, name: string, value: string): { ok: boolean; fieldId: number; oldValue: string; newValue: string } {
  return JSON.parse((doc as any).setFieldValueByName(name, value));
}

export function getFieldInfoAt(doc: HwpDocument, pos: DocumentPosition): FieldInfoResult {
  const candidate = doc as any;
  if ((pos.cellPath?.length ?? 0) > 1 && pos.parentParaIndex !== undefined) {
    return JSON.parse(candidate.getFieldInfoAtByPath(
      pos.sectionIndex,
      pos.parentParaIndex,
      JSON.stringify(pos.cellPath),
      pos.charOffset,
    ));
  }
  if (pos.parentParaIndex !== undefined && pos.controlIndex !== undefined) {
    return JSON.parse(candidate.getFieldInfoAtInCell(
      pos.sectionIndex,
      pos.parentParaIndex,
      pos.controlIndex,
      pos.cellIndex ?? 0,
      pos.cellParaIndex ?? 0,
      pos.charOffset,
      pos.isTextBox ?? false,
    ));
  }
  return JSON.parse(candidate.getFieldInfoAt(pos.sectionIndex, pos.paragraphIndex, pos.charOffset));
}

export function removeFieldAt(doc: HwpDocument, pos: DocumentPosition): { ok: boolean } {
  const candidate = doc as any;
  if (pos.parentParaIndex !== undefined && pos.controlIndex !== undefined) {
    return JSON.parse(candidate.removeFieldAtInCell(
      pos.sectionIndex,
      pos.parentParaIndex,
      pos.controlIndex,
      pos.cellIndex ?? 0,
      pos.cellParaIndex ?? 0,
      pos.charOffset,
      pos.isTextBox ?? false,
    ));
  }
  return JSON.parse(candidate.removeFieldAt(pos.sectionIndex, pos.paragraphIndex, pos.charOffset));
}

export function setActiveField(doc: HwpDocument | null, pos: DocumentPosition): boolean {
  if (!doc) return false;
  const candidate = doc as any;
  if ((pos.cellPath?.length ?? 0) > 1 && pos.parentParaIndex !== undefined) {
    return candidate.setActiveFieldByPath(
      pos.sectionIndex,
      pos.parentParaIndex,
      JSON.stringify(pos.cellPath),
      pos.charOffset,
    );
  }
  if (pos.parentParaIndex !== undefined && pos.controlIndex !== undefined) {
    return candidate.setActiveFieldInCell(
      pos.sectionIndex,
      pos.parentParaIndex,
      pos.controlIndex,
      pos.cellIndex ?? 0,
      pos.cellParaIndex ?? 0,
      pos.charOffset,
      pos.isTextBox ?? false,
    );
  }
  return candidate.setActiveField(pos.sectionIndex, pos.paragraphIndex, pos.charOffset);
}

export function clearActiveField(withOptionalDoc: WithOptionalDoc): void {
  withOptionalDoc(undefined, (doc) => {
    (doc as any).clearActiveField();
    return undefined;
  });
}

export function getClickHereProps(
  parseOptionalDocJson: ParseOptionalDocJson,
  fieldId: number,
): { ok: boolean; guide?: string; memo?: string; name?: string; editable?: boolean } {
  return parseOptionalDocJson({ ok: false }, (doc) => (doc as any).getClickHereProps(fieldId));
}

export function updateClickHereProps(
  parseOptionalDocJson: ParseOptionalDocJson,
  fieldId: number,
  guide: string,
  memo: string,
  name: string,
  editable: boolean,
): { ok: boolean } {
  return parseOptionalDocJson({ ok: false }, (doc) => (doc as any).updateClickHereProps(fieldId, guide, memo, name, editable));
}

export function searchText(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  query: string,
  fromSec: number,
  fromPara: number,
  fromChar: number,
  forward: boolean,
  caseSensitive: boolean,
): SearchResult {
  return parseOptionalDocMethodJson('searchText', { found: false }, query, fromSec, fromPara, fromChar, forward, caseSensitive);
}

export function replaceText(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  sec: number,
  para: number,
  charOffset: number,
  length: number,
  newText: string,
): ReplaceResult {
  return parseOptionalDocMethodJson('replaceText', { ok: false }, sec, para, charOffset, length, newText);
}

export function replaceAll(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  query: string,
  newText: string,
  caseSensitive: boolean,
): ReplaceAllResult {
  return parseOptionalDocMethodJson('replaceAll', { ok: false }, query, newText, caseSensitive);
}

export function getPositionOfPage(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  globalPage: number,
): { ok: boolean; sec?: number; para?: number; charOffset?: number } {
  return parseOptionalDocMethodJson('getPositionOfPage', { ok: false }, globalPage);
}

export function getPageOfPosition(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  sectionIdx: number,
  paraIdx: number,
): PageOfPositionResult {
  return parseOptionalDocMethodJson('getPageOfPosition', { ok: false }, sectionIdx, paraIdx);
}

export function getBookmarks(getOptionalDocMethod: GetOptionalDocMethod): BookmarkInfo[] {
  const method = getOptionalDocMethod<() => string | BookmarkInfo[]>('getBookmarks');
  if (!method) return [];
  try {
    const json = method();
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return [];
  }
}

export function addBookmark(
  getOptionalDocMethod: GetOptionalDocMethod,
  sec: number,
  para: number,
  charOffset: number,
  name: string,
): { ok: boolean; error?: string } {
  const method = getOptionalDocMethod<(sec: number, para: number, charOffset: number, name: string) => string | { ok: boolean; error?: string }>('addBookmark');
  if (!method) return { ok: false, error: '문서가 로드되지 않았습니다' };
  try {
    const json = method(sec, para, charOffset, name);
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export function deleteBookmark(
  getOptionalDocMethod: GetOptionalDocMethod,
  sec: number,
  para: number,
  ctrlIdx: number,
): { ok: boolean; error?: string } {
  const method = getOptionalDocMethod<(sec: number, para: number, ctrlIdx: number) => string | { ok: boolean; error?: string }>('deleteBookmark');
  if (!method) return { ok: false, error: '문서가 로드되지 않았습니다' };
  try {
    const json = method(sec, para, ctrlIdx);
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export function renameBookmark(
  getOptionalDocMethod: GetOptionalDocMethod,
  sec: number,
  para: number,
  ctrlIdx: number,
  newName: string,
): { ok: boolean; error?: string } {
  const method = getOptionalDocMethod<(sec: number, para: number, ctrlIdx: number, newName: string) => string | { ok: boolean; error?: string }>('renameBookmark');
  if (!method) return { ok: false, error: '문서가 로드되지 않았습니다' };
  try {
    const json = method(sec, para, ctrlIdx, newName);
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
