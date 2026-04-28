import type { HwpDocument } from '@wasm/rhwp.js';
import type { CharProperties, ParaProperties } from './types';

type WithDoc = <T>(callback: (doc: HwpDocument) => T) => T;
type ParseDocJson = <T>(callback: (doc: HwpDocument) => string) => T;
type RequireDoc = () => HwpDocument;

export function getCharPropertiesAt(
  parseDocJson: ParseDocJson,
  sec: number,
  para: number,
  charOffset: number,
): CharProperties {
  return parseDocJson((doc) => doc.getCharPropertiesAt(sec, para, charOffset));
}

export function getCellCharPropertiesAt(
  parseDocJson: ParseDocJson,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
  charOffset: number,
): CharProperties {
  return parseDocJson((doc) => doc.getCellCharPropertiesAt(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset));
}

export function applyCharFormat(
  withDoc: WithDoc,
  sec: number,
  para: number,
  startOffset: number,
  endOffset: number,
  propsJson: string,
): string {
  return withDoc((doc) => doc.applyCharFormat(sec, para, startOffset, endOffset, propsJson));
}

export function applyCharFormatInCell(
  withDoc: WithDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
  startOffset: number,
  endOffset: number,
  propsJson: string,
): string {
  return withDoc((doc) => doc.applyCharFormatInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, startOffset, endOffset, propsJson));
}

export function findOrCreateFontId(withDoc: WithDoc, name: string): number {
  return withDoc((doc) => doc.findOrCreateFontId(name));
}

export function findOrCreateFontIdForLang(requireDoc: RequireDoc, lang: number, name: string): number {
  return (requireDoc() as any).findOrCreateFontIdForLang(lang, name) as number;
}

export function getParaPropertiesAt(
  parseDocJson: ParseDocJson,
  sec: number,
  para: number,
): ParaProperties {
  return parseDocJson((doc) => doc.getParaPropertiesAt(sec, para));
}

export function getCellParaPropertiesAt(
  parseDocJson: ParseDocJson,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
): ParaProperties {
  return parseDocJson((doc) => doc.getCellParaPropertiesAt(sec, parentPara, controlIdx, cellIdx, cellParaIdx));
}

export function setNumberingRestart(requireDoc: RequireDoc, sec: number, para: number, mode: number, startNum: number): string {
  return (requireDoc() as any).setNumberingRestart(sec, para, mode, startNum);
}

export function applyParaFormat(withDoc: WithDoc, sec: number, para: number, propsJson: string): string {
  return withDoc((doc) => doc.applyParaFormat(sec, para, propsJson));
}

export function applyParaFormatInCell(
  withDoc: WithDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
  propsJson: string,
): string {
  return withDoc((doc) => doc.applyParaFormatInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, propsJson));
}

export function getParaPropertiesInHf(
  parseDocJson: ParseDocJson,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
): ParaProperties {
  return parseDocJson((doc) => doc.getParaPropertiesInHf(sec, isHeader, applyTo, hfParaIdx));
}

export function applyParaFormatInHf(
  withDoc: WithDoc,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
  propsJson: string,
): string {
  return withDoc((doc) => doc.applyParaFormatInHf(sec, isHeader, applyTo, hfParaIdx, propsJson));
}

export function insertFieldInHf(
  parseDocJson: ParseDocJson,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  hfParaIdx: number,
  charOffset: number,
  fieldType: number,
): { ok: boolean; charOffset: number } {
  return parseDocJson((doc) => doc.insertFieldInHf(sec, isHeader, applyTo, hfParaIdx, charOffset, fieldType));
}

export function applyHfTemplate(
  parseDocJson: ParseDocJson,
  sec: number,
  isHeader: boolean,
  applyTo: number,
  templateId: number,
): { ok: boolean } {
  return parseDocJson((doc) => doc.applyHfTemplate(sec, isHeader, applyTo, templateId));
}

export function getStyleList(requireDoc: RequireDoc): Array<{ id: number; name: string; englishName: string; type: number; nextStyleId: number; paraShapeId: number; charShapeId: number }> {
  return JSON.parse((requireDoc() as any).getStyleList());
}

export function getStyleDetail(requireDoc: RequireDoc, styleId: number): { charProps: CharProperties; paraProps: ParaProperties } {
  return JSON.parse((requireDoc() as any).getStyleDetail(styleId));
}

export function updateStyle(requireDoc: RequireDoc, styleId: number, json: string): boolean {
  return (requireDoc() as any).updateStyle(styleId, json);
}

export function updateStyleShapes(requireDoc: RequireDoc, styleId: number, charModsJson: string, paraModsJson: string): boolean {
  return (requireDoc() as any).updateStyleShapes(styleId, charModsJson, paraModsJson);
}

export function createStyle(requireDoc: RequireDoc, json: string): number {
  return (requireDoc() as any).createStyle(json);
}

export function deleteStyle(requireDoc: RequireDoc, styleId: number): boolean {
  return (requireDoc() as any).deleteStyle(styleId);
}

export function getNumberingList(requireDoc: RequireDoc): Array<{ id: number; levelFormats: string[]; startNumber: number }> {
  return JSON.parse((requireDoc() as any).getNumberingList());
}

export function getBulletList(requireDoc: RequireDoc): Array<{ id: number; char: string; rawCode: number }> {
  return JSON.parse((requireDoc() as any).getBulletList());
}

export function ensureDefaultNumbering(requireDoc: RequireDoc): number {
  return (requireDoc() as any).ensureDefaultNumbering();
}

export function createNumbering(requireDoc: RequireDoc, json: string): number {
  return (requireDoc() as any).createNumbering(json);
}

export function ensureDefaultBullet(requireDoc: RequireDoc, bulletChar: string): number {
  return (requireDoc() as any).ensureDefaultBullet(bulletChar);
}

export function getStyleAt(requireDoc: RequireDoc, sec: number, para: number): { id: number; name: string } {
  return JSON.parse((requireDoc() as any).getStyleAt(sec, para));
}

export function getCellStyleAt(
  requireDoc: RequireDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
): { id: number; name: string } {
  return JSON.parse((requireDoc() as any).getCellStyleAt(sec, parentPara, controlIdx, cellIdx, cellParaIdx));
}

export function applyStyle(requireDoc: RequireDoc, sec: number, para: number, styleId: number): { ok: boolean } {
  return JSON.parse((requireDoc() as any).applyStyle(sec, para, styleId));
}

export function applyCellStyle(
  requireDoc: RequireDoc,
  sec: number,
  parentPara: number,
  controlIdx: number,
  cellIdx: number,
  cellParaIdx: number,
  styleId: number,
): { ok: boolean } {
  return JSON.parse((requireDoc() as any).applyCellStyle(sec, parentPara, controlIdx, cellIdx, cellParaIdx, styleId));
}
