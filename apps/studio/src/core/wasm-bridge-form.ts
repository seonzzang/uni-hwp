import type { FormObjectHitResult, FormObjectInfoResult, FormValueResult } from './types';

type ParseOptionalDocMethodJson = <T>(methodName: string, fallback: T, ...args: any[]) => T;

export function getFormObjectAt(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  pageNum: number,
  x: number,
  y: number,
): FormObjectHitResult {
  return parseOptionalDocMethodJson('getFormObjectAt', { found: false }, pageNum, x, y);
}

export function getFormValue(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  sec: number,
  para: number,
  ci: number,
): FormValueResult {
  return parseOptionalDocMethodJson('getFormValue', { ok: false }, sec, para, ci);
}

export function setFormValue(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  sec: number,
  para: number,
  ci: number,
  valueJson: string,
): { ok: boolean } {
  return parseOptionalDocMethodJson('setFormValue', { ok: false }, sec, para, ci, valueJson);
}

export function setFormValueInCell(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  sec: number,
  tablePara: number,
  tableCi: number,
  cellIdx: number,
  cellPara: number,
  formCi: number,
  valueJson: string,
): { ok: boolean } {
  return parseOptionalDocMethodJson(
    'setFormValueInCell',
    { ok: false },
    sec,
    tablePara,
    tableCi,
    cellIdx,
    cellPara,
    formCi,
    valueJson,
  );
}

export function getFormObjectInfo(
  parseOptionalDocMethodJson: ParseOptionalDocMethodJson,
  sec: number,
  para: number,
  ci: number,
): FormObjectInfoResult {
  return parseOptionalDocMethodJson('getFormObjectInfo', { ok: false }, sec, para, ci);
}
