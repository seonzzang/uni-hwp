import init, { HwpDocument, version } from '@wasm/rhwp.js';
import type { DocumentInfo, PageInfo, PageDef, SectionDef, CursorRect, HitTestResult, LineInfo, TableDimensions, CellInfo, CellBbox, CellProperties, TableProperties, DocumentPosition, MoveVerticalResult, SelectionRect, CharProperties, ParaProperties, CellPathEntry, NavContextEntry, FieldInfoResult, BookmarkInfo, PageOfPositionResult, ReplaceAllResult, ReplaceResult, SearchResult } from './types';
import type { ValidationReport } from './wasm-bridge-types';
import {
  createNewDocumentState,
  getPageCountOrReset,
  getValidationWarnings as getValidationWarningsDocument,
  loadDocumentState,
  reflowLinesegs as reflowLinesegsDocument,
} from './wasm-bridge-document';
import { substituteCssFontFamily } from './wasm-bridge-fonts';
import {
  addBookmark as addBookmarkField,
  clearActiveField as clearActiveFieldField,
  deleteBookmark as deleteBookmarkField,
  getBookmarks as getBookmarksField,
  getClickHereProps as getClickHerePropsField,
  getFieldInfoAt as getFieldInfoAtField,
  getFieldList as getFieldListField,
  getFieldValue as getFieldValueField,
  getFieldValueByName as getFieldValueByNameField,
  getPageOfPosition as getPageOfPositionField,
  getPositionOfPage as getPositionOfPageField,
  removeFieldAt as removeFieldAtField,
  renameBookmark as renameBookmarkField,
  replaceAll as replaceAllField,
  replaceText as replaceTextField,
  searchText as searchTextField,
  setActiveField as setActiveFieldField,
  setFieldValue as setFieldValueField,
  setFieldValueByName as setFieldValueByNameField,
  updateClickHereProps as updateClickHerePropsField,
} from './wasm-bridge-fields';
import {
  applyCellStyle as applyCellStyleFormatting,
  applyCharFormat as applyCharFormatFormatting,
  applyCharFormatInCell as applyCharFormatInCellFormatting,
  applyHfTemplate as applyHfTemplateFormatting,
  applyParaFormat as applyParaFormatFormatting,
  applyParaFormatInCell as applyParaFormatInCellFormatting,
  applyParaFormatInHf as applyParaFormatInHfFormatting,
  applyStyle as applyStyleFormatting,
  createNumbering as createNumberingFormatting,
  createStyle as createStyleFormatting,
  deleteStyle as deleteStyleFormatting,
  ensureDefaultBullet as ensureDefaultBulletFormatting,
  ensureDefaultNumbering as ensureDefaultNumberingFormatting,
  findOrCreateFontId as findOrCreateFontIdFormatting,
  findOrCreateFontIdForLang as findOrCreateFontIdForLangFormatting,
  getBulletList as getBulletListFormatting,
  getCellCharPropertiesAt as getCellCharPropertiesAtFormatting,
  getCellParaPropertiesAt as getCellParaPropertiesAtFormatting,
  getCellStyleAt as getCellStyleAtFormatting,
  getCharPropertiesAt as getCharPropertiesAtFormatting,
  getNumberingList as getNumberingListFormatting,
  getParaPropertiesAt as getParaPropertiesAtFormatting,
  getParaPropertiesInHf as getParaPropertiesInHfFormatting,
  getStyleAt as getStyleAtFormatting,
  getStyleDetail as getStyleDetailFormatting,
  getStyleList as getStyleListFormatting,
  insertFieldInHf as insertFieldInHfFormatting,
  setNumberingRestart as setNumberingRestartFormatting,
  updateStyle as updateStyleFormatting,
  updateStyleShapes as updateStyleShapesFormatting,
} from './wasm-bridge-formatting';
import {
  getFormObjectAt as getFormObjectAtForm,
  getFormObjectInfo as getFormObjectInfoForm,
  getFormValue as getFormValueForm,
  setFormValue as setFormValueForm,
  setFormValueInCell as setFormValueInCellForm,
} from './wasm-bridge-form';
import {
  discardSnapshot as discardSnapshotView,
  getShowControlCodes as getShowControlCodesView,
  getShowTransparentBorders as getShowTransparentBordersView,
  restoreSnapshot as restoreSnapshotView,
  saveSnapshot as saveSnapshotView,
  setClipEnabled as setClipEnabledView,
  setShowControlCodes as setShowControlCodesView,
  setShowParagraphMarks as setShowParagraphMarksView,
  setShowTransparentBorders as setShowTransparentBordersView,
} from './wasm-bridge-view';
import {
  createHeaderFooter as createHeaderFooterHf,
  deleteHeaderFooter as deleteHeaderFooterHf,
  deleteTextInHeaderFooter as deleteTextInHeaderFooterHf,
  getCursorRectInHeaderFooter as getCursorRectInHeaderFooterHf,
  getHeaderFooter as getHeaderFooterHf,
  getHeaderFooterList as getHeaderFooterListHf,
  getHeaderFooterParaInfo as getHeaderFooterParaInfoHf,
  hitTestHeaderFooter as hitTestHeaderFooterHf,
  hitTestInHeaderFooter as hitTestInHeaderFooterHf,
  insertTextInHeaderFooter as insertTextInHeaderFooterHf,
  mergeParagraphInHeaderFooter as mergeParagraphInHeaderFooterHf,
  navigateHeaderFooterByPage as navigateHeaderFooterByPageHf,
  splitParagraphInHeaderFooter as splitParagraphInHeaderFooterHf,
  toggleHideHeaderFooter as toggleHideHeaderFooterHf,
} from './wasm-bridge-header-footer';
import {
  getPageDef as getPageDefPaging,
  getPageInfo as getPageInfoPaging,
  getSectionDef as getSectionDefPaging,
  isPagingFinished as isPagingFinishedPaging,
  renderPageSvg as renderPageSvgPaging,
  renderPageToCanvas as renderPageToCanvasPaging,
  setPageDef as setPageDefPaging,
  setSectionDef as setSectionDefPaging,
  setSectionDefAll as setSectionDefAllPaging,
  startProgressivePaging as startProgressivePagingPaging,
  stepProgressivePaging as stepProgressivePagingPaging,
  supportsProgressivePaging as supportsProgressivePagingPaging,
} from './wasm-bridge-paging';
import {
  clipboardHasControl as clipboardHasControlSelection,
  copyControl as copyControlSelection,
  copySelection as copySelectionSelection,
  copySelectionInCell as copySelectionInCellSelection,
  deleteRange as deleteRangeSelection,
  deleteRangeInCell as deleteRangeInCellSelection,
  exportControlHtml as exportControlHtmlSelection,
  exportSelectionHtml as exportSelectionHtmlSelection,
  exportSelectionInCellHtml as exportSelectionInCellHtmlSelection,
  getClipboardText as getClipboardTextSelection,
  getControlImageData as getControlImageDataSelection,
  getControlImageMime as getControlImageMimeSelection,
  getSelectionRects as getSelectionRectsSelection,
  getSelectionRectsInCell as getSelectionRectsInCellSelection,
  hasInternalClipboard as hasInternalClipboardSelection,
  pasteControl as pasteControlSelection,
  pasteHtml as pasteHtmlSelection,
  pasteHtmlInCell as pasteHtmlInCellSelection,
  pasteInternal as pasteInternalSelection,
  pasteInternalInCell as pasteInternalInCellSelection,
} from './wasm-bridge-selection';
import type { FileSystemFileHandleLike } from '@/command/file-system-access';

export type { ValidationReport } from './wasm-bridge-types';

export class WasmBridge {
  private doc: HwpDocument | null = null;
  private retiredDocs: HwpDocument[] = [];
  private initialized = false;
  private _fileName = 'document.hwp';
  private _currentFileHandle: FileSystemFileHandleLike | null = null;

  private requireDoc(): HwpDocument {
    if (!this.doc) throw new Error('문서가 로드되지 않았습니다');
    return this.doc;
  }

  private withDoc<T>(callback: (doc: HwpDocument) => T): T {
    return callback(this.requireDoc());
  }

  private withOptionalDoc<T>(fallback: T, callback: (doc: HwpDocument) => T): T {
    if (!this.doc) return fallback;
    return callback(this.doc);
  }

  private parseDocJson<T>(callback: (doc: HwpDocument) => string): T {
    return this.withDoc((doc) => JSON.parse(callback(doc)));
  }

  private parseOptionalDocJson<T>(fallback: T, callback: (doc: HwpDocument) => string): T {
    return this.withOptionalDoc(fallback, (doc) => JSON.parse(callback(doc)));
  }

  private getOptionalDocMethod<T extends (...args: any[]) => any>(methodName: string): T | null {
    if (!this.doc) return null;
    const candidate = (this.doc as any)[methodName];
    return typeof candidate === 'function' ? candidate.bind(this.doc) as T : null;
  }

  private callOptionalDocMethod<T>(methodName: string, fallback: T, ...args: any[]): T {
    const method = this.getOptionalDocMethod<(...callArgs: any[]) => T>(methodName);
    if (!method) return fallback;
    return method(...args);
  }

  private parseOptionalDocMethodJson<T>(methodName: string, fallback: T, ...args: any[]): T {
    const method = this.getOptionalDocMethod<(...callArgs: any[]) => string>(methodName);
    if (!method) return fallback;
    return JSON.parse(method(...args));
  }

  private freeDocument(doc: HwpDocument | null, reason: string): void {
    if (!doc) return;
    try {
      doc.free();
    } catch (error) {
      console.warn(`[WasmBridge] 문서 해제 실패 (${reason})`, error);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.installMeasureTextWidth();
    await init();
    this.initialized = true;
    console.log(`[WasmBridge] WASM 초기화 완료 (rhwp ${version()})`);
  }

  /** WASM 렌더러가 호출하는 텍스트 폭 측정 함수를 등록한다 */
  private installMeasureTextWidth(): void {
    if ((globalThis as Record<string, unknown>).measureTextWidth) return;
    let ctx: CanvasRenderingContext2D | null = null;
    let lastFont = '';
    (globalThis as Record<string, unknown>).measureTextWidth = (font: string, text: string): number => {
      if (!ctx) {
        ctx = document.createElement('canvas').getContext('2d');
      }
      const resolved = substituteCssFontFamily(font);
      if (resolved !== lastFont) {
        ctx!.font = resolved;
        lastFont = resolved;
      }
      return ctx!.measureText(text).width;
    };
  }

  loadDocument(data: Uint8Array, fileName?: string): DocumentInfo {
    const nextState = loadDocumentState(
      this.doc,
      this.retiredDocs,
      data,
      fileName,
      this.freeDocument.bind(this),
    );
    this.doc = nextState.doc;
    this._fileName = nextState.fileName;
    this._currentFileHandle = nextState.currentFileHandle;
    return nextState.info;
  }

  createNewDocument(): DocumentInfo {
    const nextState = createNewDocumentState(this.doc);
    this.doc = nextState.doc;
    this._fileName = nextState.fileName;
    this._currentFileHandle = nextState.currentFileHandle;
    return nextState.info;
  }

  closeDocument(): void {
    const doc = this.doc;
    this.doc = null;
    this._fileName = 'document.hwp';
    this._currentFileHandle = null;
    this.freeDocument(doc, 'close-document');
    if (this.retiredDocs.length > 0) {
      for (const retired of this.retiredDocs.splice(0)) {
        this.freeDocument(retired, 'close-document-retired');
      }
    }
  }

  get fileName(): string {
    return this._fileName;
  }

  set fileName(name: string) {
    this._fileName = name;
  }

  get currentFileHandle(): FileSystemFileHandleLike | null {
    return this._currentFileHandle;
  }

  set currentFileHandle(handle: FileSystemFileHandleLike | null) {
    this._currentFileHandle = handle;
  }

  get isNewDocument(): boolean {
    return this._fileName === '새 문서.hwp';
  }

  exportHwp(): Uint8Array {
    return this.withDoc((doc) => doc.exportHwp());
  }

  exportHwpx(): Uint8Array {
    return this.withDoc((doc) => doc.exportHwpx());
  }

  getSourceFormat(): string {
    return this.withOptionalDoc('hwp', (doc) => doc.getSourceFormat?.() ?? 'hwp');
  }

  /** HWPX 비표준 감지 경고 조회 (#177). */
  getValidationWarnings(): ValidationReport {
    return getValidationWarningsDocument(this.requireDoc());
  }

  /** 사용자 명시 요청에 의한 lineseg reflow (#177). 반환: reflow된 문단 수. */
  reflowLinesegs(): number {
    return reflowLinesegsDocument(this.requireDoc());
  }

  get pageCount(): number {
    return getPageCountOrReset(this.doc, () => {
      this.doc = null;
    });
  }

  supportsProgressivePaging(): boolean {
    return supportsProgressivePagingPaging(this.doc);
  }

  startProgressivePaging(): void {
    startProgressivePagingPaging(this.requireDoc());
  }

  stepProgressivePaging(chunkSize: number): number {
    return stepProgressivePagingPaging(this.requireDoc(), chunkSize);
  }

  isPagingFinished(): boolean {
    return isPagingFinishedPaging(this.doc);
  }

  getPageInfo(pageNum: number): PageInfo {
    return getPageInfoPaging(this.parseDocJson.bind(this), pageNum);
  }

  getPageDef(sectionIdx: number): PageDef {
    return getPageDefPaging(this.parseDocJson.bind(this), sectionIdx);
  }

  setPageDef(sectionIdx: number, pageDef: PageDef): { ok: boolean; pageCount: number } {
    return setPageDefPaging(this.parseDocJson.bind(this), sectionIdx, pageDef);
  }

  getSectionDef(sectionIdx: number): SectionDef {
    return getSectionDefPaging(this.parseDocJson.bind(this), sectionIdx);
  }

  setSectionDef(sectionIdx: number, sectionDef: SectionDef): { ok: boolean; pageCount: number } {
    return setSectionDefPaging(this.parseDocJson.bind(this), sectionIdx, sectionDef);
  }

  setSectionDefAll(sectionDef: SectionDef): { ok: boolean; pageCount: number } {
    return setSectionDefAllPaging(this.parseDocJson.bind(this), sectionDef);
  }

  renderPageToCanvas(pageNum: number, canvas: HTMLCanvasElement, scale = 1.0): void {
    renderPageToCanvasPaging(this.withDoc.bind(this), pageNum, canvas, scale);
  }

  renderPageSvg(pageNum: number): string {
    return renderPageSvgPaging(this.withDoc.bind(this), pageNum);
  }

  getCursorRect(sec: number, para: number, charOffset: number): CursorRect {
    return this.parseDocJson((doc) => doc.getCursorRect(sec, para, charOffset));
  }

  hitTest(pageNum: number, x: number, y: number): HitTestResult {
    return this.parseDocJson((doc) => doc.hitTest(pageNum, x, y));
  }

  insertText(sec: number, para: number, charOffset: number, text: string): string {
    return this.withDoc((doc) => doc.insertText(sec, para, charOffset, text));
  }

  deleteText(sec: number, para: number, charOffset: number, count: number): string {
    return this.withDoc((doc) => doc.deleteText(sec, para, charOffset, count));
  }

  splitParagraph(sec: number, para: number, charOffset: number): string {
    return this.withDoc((doc) => doc.splitParagraph(sec, para, charOffset));
  }

  insertPageBreak(sec: number, para: number, charOffset: number): string {
    return (this.requireDoc() as any).insertPageBreak(sec, para, charOffset);
  }

  insertColumnBreak(sec: number, para: number, charOffset: number): string {
    return (this.requireDoc() as any).insertColumnBreak(sec, para, charOffset);
  }

  setColumnDef(sec: number, columnCount: number, columnType: number, sameWidth: number, spacingHu: number): string {
    return (this.requireDoc() as any).setColumnDef(sec, columnCount, columnType, sameWidth, spacingHu);
  }

  mergeParagraph(sec: number, para: number): string {
    return this.withDoc((doc) => doc.mergeParagraph(sec, para));
  }

  splitParagraphInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number): string {
    return this.withDoc((doc) => doc.splitParagraphInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset));
  }

  mergeParagraphInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number): string {
    return this.withDoc((doc) => doc.mergeParagraphInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx));
  }

  getTextRange(sec: number, para: number, charOffset: number, count: number): string {
    return this.withDoc((doc) => doc.getTextRange(sec, para, charOffset, count));
  }

  getParagraphLength(sec: number, para: number): number {
    return this.withDoc((doc) => doc.getParagraphLength(sec, para));
  }

  getParagraphCount(sec: number): number {
    return this.withDoc((doc) => doc.getParagraphCount(sec));
  }

  /** 문단에 텍스트박스 Shape 컨트롤이 있으면 control_index, 없으면 -1 */
  getTextBoxControlIndex(sec: number, para: number): number {
    return this.withDoc((doc) => doc.getTextBoxControlIndex(sec, para));
  }

  /** 문서 트리에서 다음 편집 가능한 컨트롤/본문을 찾는다. delta=+1(앞)/-1(뒤) */
  findNextEditableControl(sec: number, para: number, ctrlIdx: number, delta: number): { type: string; sec: number; para: number; ci: number } {
    return this.parseDocJson((doc) => doc.findNextEditableControl(sec, para, ctrlIdx, delta));
  }

  /** 커서에서 이전 방향으로 가장 가까운 선택 가능 컨트롤을 찾는다 (F11 키) */
  findNearestControlBackward(sec: number, para: number, charOffset: number): { type: string; sec: number; para: number; ci: number } {
    return this.parseDocJson((doc) => doc.findNearestControlBackward(sec, para, charOffset));
  }

  /** 현재 위치 이후의 가장 가까운 선택 가능 컨트롤 (Shift+F11) */
  findNearestControlForward(sec: number, para: number, charOffset: number): { type: string; sec: number; para: number; ci: number; charPos?: number } {
    return JSON.parse((this.requireDoc() as any).findNearestControlForward(sec, para, charOffset));
  }

  /** 문단 내 컨트롤의 텍스트 위치 배열 반환 */
  getControlTextPositions(sec: number, para: number): number[] {
    try {
      return this.parseOptionalDocJson([], (doc) => (doc as any).getControlTextPositions(sec, para));
    } catch { return []; }
  }

  /** 문서 트리 DFS 기반 다음/이전 편집 가능 위치 반환 */
  navigateNextEditable(
    sec: number, para: number, charOffset: number, delta: number,
    contextJson: string,
  ): { type: string; sec: number; para: number; charOffset: number; context: NavContextEntry[] } {
    return this.parseDocJson((doc) => doc.navigateNextEditable(sec, para, charOffset, delta, contextJson));
  }

  // ─── 셀 편집 API ─────────────────────────────────────────

  getCursorRectInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number): CursorRect {
    return this.parseDocJson((doc) => doc.getCursorRectInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset));
  }

  insertTextInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, text: string): string {
    return this.withDoc((doc) => doc.insertTextInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset, text));
  }

  deleteTextInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, count: number): string {
    return this.withDoc((doc) => doc.deleteTextInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset, count));
  }

  // ─── 중첩 표 path 기반 편집 API ──────────────────────────

  insertTextInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number, text: string): string {
    return (this.requireDoc() as any).insertTextInCellByPath(sec, parentPara, pathJson, charOffset, text);
  }

  deleteTextInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number, count: number): string {
    return (this.requireDoc() as any).deleteTextInCellByPath(sec, parentPara, pathJson, charOffset, count);
  }

  splitParagraphInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number): string {
    return (this.requireDoc() as any).splitParagraphInCellByPath(sec, parentPara, pathJson, charOffset);
  }

  mergeParagraphInCellByPath(sec: number, parentPara: number, pathJson: string): string {
    return (this.requireDoc() as any).mergeParagraphInCellByPath(sec, parentPara, pathJson);
  }

  getTextInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, count: number): string {
    return this.withDoc((doc) => doc.getTextInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset, count));
  }

  getTextInCellByPath(sec: number, parentPara: number, pathJson: string, charOffset: number, count: number): string {
    return (this.requireDoc() as any).getTextInCellByPath(sec, parentPara, pathJson, charOffset, count);
  }

  getCellParagraphLength(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number): number {
    return this.withDoc((doc) => doc.getCellParagraphLength(sec, parentPara, controlIdx, cellIdx, cellParaIdx));
  }

  getCellParagraphCount(sec: number, parentPara: number, controlIdx: number, cellIdx: number): number {
    return this.withDoc((doc) => doc.getCellParagraphCount(sec, parentPara, controlIdx, cellIdx));
  }

  getCellParagraphCountByPath(sec: number, parentPara: number, pathJson: string): number {
    return this.withDoc((doc) => doc.getCellParagraphCountByPath(sec, parentPara, pathJson));
  }

  getCellParagraphLengthByPath(sec: number, parentPara: number, pathJson: string): number {
    return this.withDoc((doc) => doc.getCellParagraphLengthByPath(sec, parentPara, pathJson));
  }

  getCellTextDirection(sec: number, parentPara: number, controlIdx: number, cellIdx: number): number {
    return this.withDoc((doc) => doc.getCellTextDirection(sec, parentPara, controlIdx, cellIdx));
  }

  // ─── 커서 이동 API ─────────────────────────────────────────

  getLineInfo(sec: number, para: number, charOffset: number): LineInfo {
    return this.parseDocJson((doc) => doc.getLineInfo(sec, para, charOffset));
  }

  getLineInfoInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number): LineInfo {
    return this.parseDocJson((doc) => doc.getLineInfoInCell(sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset));
  }

  getCaretPosition(): DocumentPosition | null {
    try {
      return this.parseOptionalDocJson<DocumentPosition | null>(null, (doc) => doc.getCaretPosition());
    } catch {
      return null;
    }
  }

  getTableDimensions(sec: number, parentPara: number, controlIdx: number): TableDimensions {
    return this.parseDocJson((doc) => doc.getTableDimensions(sec, parentPara, controlIdx));
  }

  getCellInfo(sec: number, parentPara: number, controlIdx: number, cellIdx: number): CellInfo {
    return this.parseDocJson((doc) => doc.getCellInfo(sec, parentPara, controlIdx, cellIdx));
  }

  getTableCellBboxes(sec: number, parentPara: number, controlIdx: number, pageHint?: number): CellBbox[] {
    return this.parseDocJson((doc) => doc.getTableCellBboxes(sec, parentPara, controlIdx, pageHint ?? undefined));
  }

  getTableBBox(sec: number, parentPara: number, controlIdx: number): { pageIndex: number; x: number; y: number; width: number; height: number } {
    return this.parseDocJson((doc) => doc.getTableBBox(sec, parentPara, controlIdx));
  }

  deleteTableControl(sec: number, parentPara: number, controlIdx: number): { ok: boolean } {
    return this.parseDocJson((doc) => doc.deleteTableControl(sec, parentPara, controlIdx));
  }

  getCellProperties(sec: number, parentPara: number, controlIdx: number, cellIdx: number): CellProperties {
    return this.parseDocJson((doc) => doc.getCellProperties(sec, parentPara, controlIdx, cellIdx));
  }

  setCellProperties(sec: number, parentPara: number, controlIdx: number, cellIdx: number, props: Partial<CellProperties>): { ok: boolean } {
    return this.parseDocJson((doc) => doc.setCellProperties(sec, parentPara, controlIdx, cellIdx, JSON.stringify(props)));
  }

  resizeTableCells(
    sec: number, parentPara: number, controlIdx: number,
    updates: Array<{ cellIdx: number; widthDelta?: number; heightDelta?: number }>,
  ): { ok: boolean } {
    return this.parseDocJson((doc) => doc.resizeTableCells(sec, parentPara, controlIdx, JSON.stringify(updates)));
  }

  moveTableOffset(sec: number, parentPara: number, controlIdx: number, deltaH: number, deltaV: number): { ok: boolean; ppi: number; ci: number } {
    return this.parseDocJson((doc) => doc.moveTableOffset(sec, parentPara, controlIdx, deltaH, deltaV));
  }

  getTableProperties(sec: number, parentPara: number, controlIdx: number): TableProperties {
    return this.parseDocJson((doc) => doc.getTableProperties(sec, parentPara, controlIdx));
  }

  setTableProperties(sec: number, parentPara: number, controlIdx: number, props: Partial<TableProperties>): { ok: boolean } {
    return this.parseDocJson((doc) => doc.setTableProperties(sec, parentPara, controlIdx, JSON.stringify(props)));
  }

  mergeTableCells(sec: number, parentPara: number, controlIdx: number, startRow: number, startCol: number, endRow: number, endCol: number): { ok: boolean; cellCount: number } {
    return this.parseDocJson((doc) => doc.mergeTableCells(sec, parentPara, controlIdx, startRow, startCol, endRow, endCol));
  }

  splitTableCell(sec: number, parentPara: number, controlIdx: number, row: number, col: number): { ok: boolean; cellCount: number } {
    return this.parseDocJson((doc) => doc.splitTableCell(sec, parentPara, controlIdx, row, col));
  }

  splitTableCellInto(
    sec: number, parentPara: number, controlIdx: number,
    row: number, col: number,
    nRows: number, mCols: number,
    equalRowHeight: boolean, mergeFirst: boolean,
  ): { ok: boolean; cellCount: number } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse((this.requireDoc() as any).splitTableCellInto(sec, parentPara, controlIdx, row, col, nRows, mCols, equalRowHeight, mergeFirst));
  }

  splitTableCellsInRange(
    sec: number, parentPara: number, controlIdx: number,
    startRow: number, startCol: number, endRow: number, endCol: number,
    nRows: number, mCols: number, equalRowHeight: boolean,
  ): { ok: boolean; cellCount: number } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse((this.requireDoc() as any).splitTableCellsInRange(sec, parentPara, controlIdx, startRow, startCol, endRow, endCol, nRows, mCols, equalRowHeight));
  }

  insertTableRow(sec: number, parentPara: number, controlIdx: number, rowIdx: number, below: boolean): { ok: boolean; rowCount: number; colCount: number } {
    return this.parseDocJson((doc) => doc.insertTableRow(sec, parentPara, controlIdx, rowIdx, below));
  }

  insertTableColumn(sec: number, parentPara: number, controlIdx: number, colIdx: number, right: boolean): { ok: boolean; rowCount: number; colCount: number } {
    return this.parseDocJson((doc) => doc.insertTableColumn(sec, parentPara, controlIdx, colIdx, right));
  }

  deleteTableRow(sec: number, parentPara: number, controlIdx: number, rowIdx: number): { ok: boolean; rowCount: number; colCount: number } {
    return this.parseDocJson((doc) => doc.deleteTableRow(sec, parentPara, controlIdx, rowIdx));
  }

  deleteTableColumn(sec: number, parentPara: number, controlIdx: number, colIdx: number): { ok: boolean; rowCount: number; colCount: number } {
    return this.parseDocJson((doc) => doc.deleteTableColumn(sec, parentPara, controlIdx, colIdx));
  }

  createTable(sec: number, para: number, charOffset: number, rows: number, cols: number): { ok: boolean; paraIdx: number; controlIdx: number } {
    return this.parseDocJson((doc) => doc.createTable(sec, para, charOffset, rows, cols));
  }

  evaluateTableFormula(sec: number, parentPara: number, controlIdx: number,
    targetRow: number, targetCol: number, formula: string, writeResult: boolean): string {
    return this.withDoc((doc) => doc.evaluateTableFormula(sec, parentPara, controlIdx, targetRow, targetCol, formula, writeResult));
  }

  insertPicture(sec: number, paraIdx: number, charOffset: number,
                imageData: Uint8Array, width: number, height: number,
                naturalWidthPx: number, naturalHeightPx: number,
                extension: string, description: string = ''): { ok: boolean; paraIdx: number; controlIdx: number } {
    return this.parseDocJson((doc) => doc.insertPicture(sec, paraIdx, charOffset, imageData, width, height, naturalWidthPx, naturalHeightPx, extension, description));
  }

  // ── 그림 속성 API ─────────────────────────────────────
  getPageControlLayout(pageNum: number): { controls: import('./types').ControlLayoutItem[] } {
    return this.parseDocJson((doc) => doc.getPageControlLayout(pageNum));
  }

  getPictureProperties(sec: number, para: number, ci: number): import('./types').PictureProperties {
    return this.parseDocJson((doc) => doc.getPictureProperties(sec, para, ci));
  }

  setPictureProperties(sec: number, para: number, ci: number, props: Record<string, unknown>): { ok: boolean } {
    return this.parseDocJson((doc) => doc.setPictureProperties(sec, para, ci, JSON.stringify(props)));
  }

  // ── 수식 속성 API ─────────────────────────────────────
  getEquationProperties(sec: number, para: number, ci: number, cellIdx?: number, cellParaIdx?: number): import('./types').EquationProperties {
    return this.parseDocJson((doc) => doc.getEquationProperties(sec, para, ci, cellIdx ?? -1, cellParaIdx ?? -1));
  }

  setEquationProperties(sec: number, para: number, ci: number, cellIdx: number | undefined, cellParaIdx: number | undefined, props: Record<string, unknown>): { ok: boolean } {
    return this.parseDocJson((doc) => doc.setEquationProperties(sec, para, ci, cellIdx ?? -1, cellParaIdx ?? -1, JSON.stringify(props)));
  }

  renderEquationPreview(script: string, fontSizeHwpunit: number, color: number): string {
    return this.withDoc((doc) => doc.renderEquationPreview(script, fontSizeHwpunit, color));
  }

  deletePictureControl(sec: number, para: number, ci: number): { ok: boolean } {
    return this.parseDocJson((doc) => doc.deletePictureControl(sec, para, ci));
  }

  createShapeControl(params: Record<string, unknown>): { ok: boolean; paraIdx: number; controlIdx: number } {
    return this.parseDocJson((doc) => doc.createShapeControl(JSON.stringify(params)));
  }

  getShapeProperties(sec: number, para: number, ci: number): import('./types').ShapeProperties {
    return this.parseDocJson((doc) => doc.getShapeProperties(sec, para, ci));
  }

  setShapeProperties(sec: number, para: number, ci: number, props: Record<string, unknown>): { ok: boolean } {
    return this.parseDocJson((doc) => doc.setShapeProperties(sec, para, ci, JSON.stringify(props)));
  }

  deleteShapeControl(sec: number, para: number, ci: number): { ok: boolean } {
    return this.parseDocJson((doc) => doc.deleteShapeControl(sec, para, ci));
  }

  changeShapeZOrder(sec: number, para: number, ci: number, operation: string): { ok: boolean; zOrder?: number } {
    return this.parseDocJson((doc) => doc.changeShapeZOrder(sec, para, ci, operation));
  }

  groupShapes(sec: number, targets: { paraIdx: number; controlIdx: number }[]): { ok: boolean; paraIdx: number; controlIdx: number } {
    const json = JSON.stringify({ sectionIdx: sec, targets });
    return JSON.parse((this.requireDoc() as any).groupShapes(json));
  }

  insertFootnote(sec: number, para: number, charOffset: number): { ok: boolean; paraIdx: number; controlIdx: number; footnoteNumber: number } {
    return JSON.parse((this.requireDoc() as any).insertFootnote(sec, para, charOffset));
  }

  getFootnoteInfo(sec: number, para: number, controlIdx: number): { ok: boolean; paraCount: number; totalTextLen: number; number: number; texts: string[] } {
    return JSON.parse((this.requireDoc() as any).getFootnoteInfo(sec, para, controlIdx));
  }

  insertTextInFootnote(sec: number, para: number, controlIdx: number, fnParaIdx: number, charOffset: number, text: string): { ok: boolean; charOffset: number } {
    return JSON.parse((this.requireDoc() as any).insertTextInFootnote(sec, para, controlIdx, fnParaIdx, charOffset, text));
  }

  deleteTextInFootnote(sec: number, para: number, controlIdx: number, fnParaIdx: number, charOffset: number, count: number): { ok: boolean; charOffset: number } {
    return JSON.parse((this.requireDoc() as any).deleteTextInFootnote(sec, para, controlIdx, fnParaIdx, charOffset, count));
  }

  splitParagraphInFootnote(sec: number, para: number, controlIdx: number, fnParaIdx: number, charOffset: number): { ok: boolean; fnParaIndex: number; charOffset: number } {
    return JSON.parse((this.requireDoc() as any).splitParagraphInFootnote(sec, para, controlIdx, fnParaIdx, charOffset));
  }

  mergeParagraphInFootnote(sec: number, para: number, controlIdx: number, fnParaIdx: number): { ok: boolean; fnParaIndex: number; charOffset: number } {
    return JSON.parse((this.requireDoc() as any).mergeParagraphInFootnote(sec, para, controlIdx, fnParaIdx));
  }

  getPageFootnoteInfo(pageNum: number, footnoteIndex: number): { ok: boolean; sectionIdx: number; paraIdx: number; controlIdx: number; sourceType: string } | null {
    if (!this.doc) return null;
    try {
      return JSON.parse((this.doc as any).getPageFootnoteInfo(pageNum, footnoteIndex));
    } catch { return null; }
  }

  hitTestFootnote(pageNum: number, x: number, y: number): { hit: boolean; footnoteIndex?: number } {
    if (!this.doc) return { hit: false };
    return JSON.parse((this.doc as any).hitTestFootnote(pageNum, x, y));
  }

  hitTestInFootnote(pageNum: number, x: number, y: number): { hit: boolean; fnParaIndex?: number; charOffset?: number; footnoteIndex?: number; cursorRect?: { pageIndex: number; x: number; y: number; height: number } } {
    if (!this.doc) return { hit: false };
    return JSON.parse((this.doc as any).hitTestInFootnote(pageNum, x, y));
  }

  getCursorRectInFootnote(pageNum: number, footnoteIndex: number, fnParaIdx: number, charOffset: number): { pageIndex: number; x: number; y: number; height: number } | null {
    if (!this.doc) return null;
    try {
      return JSON.parse((this.doc as any).getCursorRectInFootnote(pageNum, footnoteIndex, fnParaIdx, charOffset));
    } catch { return null; }
  }

  moveLineEndpoint(sec: number, para: number, ci: number, sx: number, sy: number, ex: number, ey: number): void {
    if (!this.doc) return;
    (this.doc as any).moveLineEndpoint(sec, para, ci, sx, sy, ex, ey);
  }

  updateConnectorsInSection(sec: number): void {
    if (!this.doc) return;
    (this.doc as any).updateConnectorsInSection(sec);
  }

  ungroupShape(sec: number, para: number, ci: number): { ok: boolean } {
    return JSON.parse((this.requireDoc() as any).ungroupShape(sec, para, ci));
  }

  moveVertical(
    sec: number, para: number, charOffset: number,
    delta: number, preferredX: number,
    parentPara: number, controlIdx: number,
    cellIdx: number, cellParaIdx: number,
  ): MoveVerticalResult {
    return this.parseDocJson((doc) => doc.moveVertical(
      sec, para, charOffset, delta, preferredX,
      parentPara, controlIdx, cellIdx, cellParaIdx,
    ));
  }

  // ─── 경로 기반 중첩 표 API ─────────────────────────────

  getCursorRectByPath(sec: number, parentPara: number, pathJson: string, charOffset: number): CursorRect {
    return this.parseDocJson((doc) => doc.getCursorRectByPath(sec, parentPara, pathJson, charOffset));
  }

  getCellInfoByPath(sec: number, parentPara: number, pathJson: string): CellInfo {
    return this.parseDocJson((doc) => doc.getCellInfoByPath(sec, parentPara, pathJson));
  }

  getTableDimensionsByPath(sec: number, parentPara: number, pathJson: string): TableDimensions {
    return this.parseDocJson((doc) => doc.getTableDimensionsByPath(sec, parentPara, pathJson));
  }

  getTableCellBboxesByPath(sec: number, parentPara: number, pathJson: string): CellBbox[] {
    return this.parseDocJson((doc) => doc.getTableCellBboxesByPath(sec, parentPara, pathJson));
  }

  moveVerticalByPath(
    sec: number, parentPara: number, pathJson: string,
    charOffset: number, delta: number, preferredX: number,
  ): MoveVerticalResult {
    return this.parseDocJson((doc) => doc.moveVerticalByPath(
      sec, parentPara, pathJson, charOffset, delta, preferredX,
    ));
  }

  // ─── Selection API ──────────────────────────────────────

  getSelectionRects(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): SelectionRect[] {
    return getSelectionRectsSelection(this.parseDocJson.bind(this), sec, startPara, startOffset, endPara, endOffset);
  }

  getSelectionRectsInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, startCellPara: number, startOffset: number, endCellPara: number, endOffset: number): SelectionRect[] {
    return getSelectionRectsInCellSelection(this.parseDocJson.bind(this), sec, parentPara, controlIdx, cellIdx, startCellPara, startOffset, endCellPara, endOffset);
  }

  deleteRange(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): { ok: boolean; paraIdx: number; charOffset: number } {
    return deleteRangeSelection(this.parseDocJson.bind(this), sec, startPara, startOffset, endPara, endOffset);
  }

  deleteRangeInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, startCellPara: number, startOffset: number, endCellPara: number, endOffset: number): { ok: boolean; paraIdx: number; charOffset: number } {
    return deleteRangeInCellSelection(this.parseDocJson.bind(this), sec, parentPara, controlIdx, cellIdx, startCellPara, startOffset, endCellPara, endOffset);
  }

  // ─── 클립보드 API ──────────────────────────────────────

  copySelection(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): string {
    return copySelectionSelection(this.withDoc.bind(this), sec, startPara, startOffset, endPara, endOffset);
  }

  copySelectionInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, startCellPara: number, startOffset: number, endCellPara: number, endOffset: number): string {
    return copySelectionInCellSelection(this.withDoc.bind(this), sec, parentPara, controlIdx, cellIdx, startCellPara, startOffset, endCellPara, endOffset);
  }

  pasteInternal(sec: number, para: number, charOffset: number): string {
    return pasteInternalSelection(this.withDoc.bind(this), sec, para, charOffset);
  }

  pasteInternalInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number): string {
    return pasteInternalInCellSelection(this.withDoc.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset);
  }

  hasInternalClipboard(): boolean {
    return hasInternalClipboardSelection(this.withOptionalDoc.bind(this));
  }

  getClipboardText(): string {
    return getClipboardTextSelection(this.withOptionalDoc.bind(this));
  }

  copyControl(sec: number, para: number, ci: number): string {
    return copyControlSelection(this.withDoc.bind(this), sec, para, ci);
  }

  exportControlHtml(sec: number, para: number, ci: number): string {
    return exportControlHtmlSelection(this.withDoc.bind(this), sec, para, ci);
  }

  getControlImageData(sec: number, para: number, ci: number): Uint8Array {
    return getControlImageDataSelection(this.withDoc.bind(this), sec, para, ci);
  }

  getControlImageMime(sec: number, para: number, ci: number): string {
    return getControlImageMimeSelection(this.withDoc.bind(this), sec, para, ci);
  }

  clipboardHasControl(): boolean {
    return clipboardHasControlSelection(this.withOptionalDoc.bind(this));
  }

  pasteControl(sec: number, para: number, charOffset: number): string {
    return pasteControlSelection(this.withDoc.bind(this), sec, para, charOffset);
  }

  exportSelectionHtml(sec: number, startPara: number, startOffset: number, endPara: number, endOffset: number): string {
    return exportSelectionHtmlSelection(this.withDoc.bind(this), sec, startPara, startOffset, endPara, endOffset);
  }

  exportSelectionInCellHtml(sec: number, parentPara: number, controlIdx: number, cellIdx: number, startCellPara: number, startOffset: number, endCellPara: number, endOffset: number): string {
    return exportSelectionInCellHtmlSelection(this.withDoc.bind(this), sec, parentPara, controlIdx, cellIdx, startCellPara, startOffset, endCellPara, endOffset);
  }

  pasteHtml(sec: number, para: number, charOffset: number, html: string): string {
    return pasteHtmlSelection(this.withDoc.bind(this), sec, para, charOffset, html);
  }

  pasteHtmlInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number, html: string): string {
    return pasteHtmlInCellSelection(this.withDoc.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset, html);
  }

  // ─── CharShape (서식) API ──────────────────────────────

  getCharPropertiesAt(sec: number, para: number, charOffset: number): CharProperties {
    return getCharPropertiesAtFormatting(this.parseDocJson.bind(this), sec, para, charOffset);
  }

  getCellCharPropertiesAt(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, charOffset: number): CharProperties {
    return getCellCharPropertiesAtFormatting(this.parseDocJson.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx, charOffset);
  }

  applyCharFormat(sec: number, para: number, startOffset: number, endOffset: number, propsJson: string): string {
    return applyCharFormatFormatting(this.withDoc.bind(this), sec, para, startOffset, endOffset, propsJson);
  }

  applyCharFormatInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, startOffset: number, endOffset: number, propsJson: string): string {
    return applyCharFormatInCellFormatting(this.withDoc.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx, startOffset, endOffset, propsJson);
  }

  findOrCreateFontId(name: string): number {
    return findOrCreateFontIdFormatting(this.withDoc.bind(this), name);
  }

  findOrCreateFontIdForLang(lang: number, name: string): number {
    return findOrCreateFontIdForLangFormatting(this.requireDoc.bind(this), lang, name);
  }

  // ─── 문단 서식 API ──────────────────────────────────────

  getParaPropertiesAt(sec: number, para: number): ParaProperties {
    return getParaPropertiesAtFormatting(this.parseDocJson.bind(this), sec, para);
  }

  getCellParaPropertiesAt(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number): ParaProperties {
    return getCellParaPropertiesAtFormatting(this.parseDocJson.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx);
  }

  setNumberingRestart(sec: number, para: number, mode: number, startNum: number): string {
    return setNumberingRestartFormatting(this.requireDoc.bind(this), sec, para, mode, startNum);
  }

  applyParaFormat(sec: number, para: number, propsJson: string): string {
    return applyParaFormatFormatting(this.withDoc.bind(this), sec, para, propsJson);
  }

  applyParaFormatInCell(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, propsJson: string): string {
    return applyParaFormatInCellFormatting(this.withDoc.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx, propsJson);
  }

  /** 머리말/꼬리말 문단의 문단 속성을 조회한다 */
  getParaPropertiesInHf(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number): ParaProperties {
    return getParaPropertiesInHfFormatting(this.parseDocJson.bind(this), sec, isHeader, applyTo, hfParaIdx);
  }

  /** 머리말/꼬리말 문단에 문단 서식을 적용한다 */
  applyParaFormatInHf(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number, propsJson: string): string {
    return applyParaFormatInHfFormatting(this.withDoc.bind(this), sec, isHeader, applyTo, hfParaIdx, propsJson);
  }

  /** 머리말/꼬리말 문단에 필드 마커를 삽입한다 (1=쪽번호, 2=총쪽수, 3=파일이름) */
  insertFieldInHf(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number, charOffset: number, fieldType: number): { ok: boolean; charOffset: number } {
    return insertFieldInHfFormatting(this.parseDocJson.bind(this), sec, isHeader, applyTo, hfParaIdx, charOffset, fieldType);
  }

  applyHfTemplate(sec: number, isHeader: boolean, applyTo: number, templateId: number): { ok: boolean } {
    return applyHfTemplateFormatting(this.parseDocJson.bind(this), sec, isHeader, applyTo, templateId);
  }

  // ─── 스타일 API ──────────────────────────────────────

  getStyleList(): Array<{ id: number; name: string; englishName: string; type: number; nextStyleId: number; paraShapeId: number; charShapeId: number }> {
    return getStyleListFormatting(this.requireDoc.bind(this));
  }

  getStyleDetail(styleId: number): { charProps: import('./types').CharProperties; paraProps: import('./types').ParaProperties } {
    return getStyleDetailFormatting(this.requireDoc.bind(this), styleId);
  }

  updateStyle(styleId: number, json: string): boolean {
    return updateStyleFormatting(this.requireDoc.bind(this), styleId, json);
  }

  updateStyleShapes(styleId: number, charModsJson: string, paraModsJson: string): boolean {
    return updateStyleShapesFormatting(this.requireDoc.bind(this), styleId, charModsJson, paraModsJson);
  }

  createStyle(json: string): number {
    return createStyleFormatting(this.requireDoc.bind(this), json);
  }

  deleteStyle(styleId: number): boolean {
    return deleteStyleFormatting(this.requireDoc.bind(this), styleId);
  }

  // ─── 번호/글머리표 API ─────────────────────────────────

  getNumberingList(): Array<{ id: number; levelFormats: string[]; startNumber: number }> {
    return getNumberingListFormatting(this.requireDoc.bind(this));
  }

  getBulletList(): Array<{ id: number; char: string; rawCode: number }> {
    return getBulletListFormatting(this.requireDoc.bind(this));
  }

  ensureDefaultNumbering(): number {
    return ensureDefaultNumberingFormatting(this.requireDoc.bind(this));
  }

  createNumbering(json: string): number {
    return createNumberingFormatting(this.requireDoc.bind(this), json);
  }

  ensureDefaultBullet(bulletChar: string): number {
    return ensureDefaultBulletFormatting(this.requireDoc.bind(this), bulletChar);
  }

  getStyleAt(sec: number, para: number): { id: number; name: string } {
    return getStyleAtFormatting(this.requireDoc.bind(this), sec, para);
  }

  getCellStyleAt(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number): { id: number; name: string } {
    return getCellStyleAtFormatting(this.requireDoc.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx);
  }

  applyStyle(sec: number, para: number, styleId: number): { ok: boolean } {
    return applyStyleFormatting(this.requireDoc.bind(this), sec, para, styleId);
  }

  applyCellStyle(sec: number, parentPara: number, controlIdx: number, cellIdx: number, cellParaIdx: number, styleId: number): { ok: boolean } {
    return applyCellStyleFormatting(this.requireDoc.bind(this), sec, parentPara, controlIdx, cellIdx, cellParaIdx, styleId);
  }

  // ─── 보기 옵션 API ──────────────────────────────────

  setShowParagraphMarks(enabled: boolean): void {
    setShowParagraphMarksView(this.withDoc.bind(this), enabled);
  }

  /** 조판부호 표시 여부 반환 */
  getShowControlCodes(): boolean {
    return getShowControlCodesView(this.withOptionalDoc.bind(this));
  }

  setShowControlCodes(enabled: boolean): void {
    setShowControlCodesView(this.withDoc.bind(this), enabled);
  }

  getShowTransparentBorders(): boolean {
    return getShowTransparentBordersView(this.withOptionalDoc.bind(this));
  }

  setShowTransparentBorders(enabled: boolean): void {
    setShowTransparentBordersView(this.withDoc.bind(this), enabled);
  }

  setClipEnabled(enabled: boolean): void {
    setClipEnabledView(this.withDoc.bind(this), enabled);
  }

  // ─── Undo/Redo 스냅샷 API ──────────────────────────

  saveSnapshot(): number {
    return saveSnapshotView(this.withDoc.bind(this));
  }

  restoreSnapshot(id: number): void {
    restoreSnapshotView(this.withDoc.bind(this), id);
  }

  discardSnapshot(id: number): void {
    discardSnapshotView(this.withDoc.bind(this), id);
  }

  // ─── 머리말/꼬리말 API ──────────────────────────────────

  getHeaderFooter(sectionIdx: number, isHeader: boolean, applyTo: number): string {
    return getHeaderFooterHf(this.withDoc.bind(this), sectionIdx, isHeader, applyTo);
  }

  createHeaderFooter(sectionIdx: number, isHeader: boolean, applyTo: number): string {
    return createHeaderFooterHf(this.withDoc.bind(this), sectionIdx, isHeader, applyTo);
  }

  insertTextInHeaderFooter(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number, charOffset: number, text: string): string {
    return insertTextInHeaderFooterHf(this.withDoc.bind(this), sec, isHeader, applyTo, hfParaIdx, charOffset, text);
  }

  deleteTextInHeaderFooter(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number, charOffset: number, count: number): string {
    return deleteTextInHeaderFooterHf(this.withDoc.bind(this), sec, isHeader, applyTo, hfParaIdx, charOffset, count);
  }

  splitParagraphInHeaderFooter(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number, charOffset: number): string {
    return splitParagraphInHeaderFooterHf(this.withDoc.bind(this), sec, isHeader, applyTo, hfParaIdx, charOffset);
  }

  mergeParagraphInHeaderFooter(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number): string {
    return mergeParagraphInHeaderFooterHf(this.withDoc.bind(this), sec, isHeader, applyTo, hfParaIdx);
  }

  getHeaderFooterParaInfo(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number): string {
    return getHeaderFooterParaInfoHf(this.withDoc.bind(this), sec, isHeader, applyTo, hfParaIdx);
  }

  getCursorRectInHeaderFooter(sec: number, isHeader: boolean, applyTo: number, hfParaIdx: number, charOffset: number, preferredPage = -1): CursorRect {
    return getCursorRectInHeaderFooterHf(this.parseDocJson.bind(this), sec, isHeader, applyTo, hfParaIdx, charOffset, preferredPage);
  }

  hitTestHeaderFooter(pageNum: number, x: number, y: number): { hit: boolean; isHeader?: boolean; sectionIndex?: number; applyTo?: number } {
    return hitTestHeaderFooterHf(this.parseDocJson.bind(this), pageNum, x, y);
  }

  hitTestInHeaderFooter(pageNum: number, isHeader: boolean, x: number, y: number): { hit: boolean; paraIndex?: number; charOffset?: number; cursorRect?: { pageIndex: number; x: number; y: number; height: number } } {
    return hitTestInHeaderFooterHf(this.parseDocJson.bind(this), pageNum, isHeader, x, y);
  }

  deleteHeaderFooter(sectionIdx: number, isHeader: boolean, applyTo: number): void {
    deleteHeaderFooterHf(this.withDoc.bind(this), sectionIdx, isHeader, applyTo);
  }

  getHeaderFooterList(currentSectionIdx: number, currentIsHeader: boolean, currentApplyTo: number): { ok: boolean; items: { sectionIdx: number; isHeader: boolean; applyTo: number; label: string }[]; currentIndex: number } {
    return getHeaderFooterListHf(this.parseDocJson.bind(this), currentSectionIdx, currentIsHeader, currentApplyTo);
  }

  toggleHideHeaderFooter(pageIndex: number, isHeader: boolean): { hidden: boolean } {
    return toggleHideHeaderFooterHf(this.parseDocJson.bind(this), pageIndex, isHeader);
  }

  navigateHeaderFooterByPage(currentPage: number, isHeader: boolean, direction: number): { ok: boolean; pageIndex?: number; sectionIdx?: number; isHeader?: boolean; applyTo?: number } {
    return navigateHeaderFooterByPageHf(this.parseDocJson.bind(this), currentPage, isHeader, direction);
  }

  // ─── 필드 API (Task 230) ─────────────────────────────────

  /** 문서 내 모든 필드 목록을 반환한다. */
  getFieldList(): Array<{
    fieldId: number;
    fieldType: string;
    name: string;
    guide: string;
    command: string;
    value: string;
    location: { sectionIndex: number; paraIndex: number; path?: Array<any> };
  }> {
    return getFieldListField(this.requireDoc());
  }

  /** field_id로 필드 값을 조회한다. */
  getFieldValue(fieldId: number): { ok: boolean; value: string } {
    return getFieldValueField(this.requireDoc(), fieldId);
  }

  /** 필드 이름으로 값을 조회한다. */
  getFieldValueByName(name: string): { ok: boolean; fieldId: number; value: string } {
    return getFieldValueByNameField(this.requireDoc(), name);
  }

  /** field_id로 필드 값을 설정한다. */
  setFieldValue(fieldId: number, value: string): { ok: boolean; fieldId: number; oldValue: string; newValue: string } {
    return setFieldValueField(this.requireDoc(), fieldId, value);
  }

  /** 필드 이름으로 값을 설정한다. */
  setFieldValueByName(name: string, value: string): { ok: boolean; fieldId: number; oldValue: string; newValue: string } {
    return setFieldValueByNameField(this.requireDoc(), name, value);
  }

  /** 커서 위치의 필드 범위 정보를 조회한다. */
  getFieldInfoAt(pos: DocumentPosition): FieldInfoResult {
    return getFieldInfoAtField(this.requireDoc(), pos);
  }

  /** 커서 위치의 누름틀 필드를 제거한다 (텍스트 유지). */
  removeFieldAt(pos: DocumentPosition): { ok: boolean } {
    return removeFieldAtField(this.requireDoc(), pos);
  }

  /** 활성 필드를 설정한다 (안내문 숨김용). 변경 시 true 반환. */
  setActiveField(pos: DocumentPosition): boolean {
    return setActiveFieldField(this.doc, pos);
  }

  /** 활성 필드를 해제한다 (안내문 다시 표시). */
  clearActiveField(): void {
    clearActiveFieldField(this.withOptionalDoc.bind(this));
  }

  /** 누름틀 필드 속성을 조회한다. */
  getClickHereProps(fieldId: number): { ok: boolean; guide?: string; memo?: string; name?: string; editable?: boolean } {
    return getClickHerePropsField(this.parseOptionalDocJson.bind(this), fieldId);
  }

  /** 누름틀 필드 속성을 수정한다. */
  updateClickHereProps(fieldId: number, guide: string, memo: string, name: string, editable: boolean): { ok: boolean } {
    return updateClickHerePropsField(this.parseOptionalDocJson.bind(this), fieldId, guide, memo, name, editable);
  }

  // ─────────────────────────────────────────────
  // 양식 개체(Form Object) API
  // ─────────────────────────────────────────────

  /** 페이지 좌표에서 양식 개체를 찾는다. */
  getFormObjectAt(pageNum: number, x: number, y: number): import('./types').FormObjectHitResult {
    return getFormObjectAtForm(this.parseOptionalDocMethodJson.bind(this), pageNum, x, y);
  }

  /** 양식 개체 값을 조회한다. */
  getFormValue(sec: number, para: number, ci: number): import('./types').FormValueResult {
    return getFormValueForm(this.parseOptionalDocMethodJson.bind(this), sec, para, ci);
  }

  /** 양식 개체 값을 설정한다. */
  setFormValue(sec: number, para: number, ci: number, valueJson: string): { ok: boolean } {
    return setFormValueForm(this.parseOptionalDocMethodJson.bind(this), sec, para, ci, valueJson);
  }

  /** 셀 내부 양식 개체 값을 설정한다. */
  setFormValueInCell(sec: number, tablePara: number, tableCi: number, cellIdx: number, cellPara: number, formCi: number, valueJson: string): { ok: boolean } {
    return setFormValueInCellForm(this.parseOptionalDocMethodJson.bind(this), sec, tablePara, tableCi, cellIdx, cellPara, formCi, valueJson);
  }

  /** 양식 개체 상세 정보를 반환한다. */
  getFormObjectInfo(sec: number, para: number, ci: number): import('./types').FormObjectInfoResult {
    return getFormObjectInfoForm(this.parseOptionalDocMethodJson.bind(this), sec, para, ci);
  }

  // ── 검색/치환 API ──

  searchText(query: string, fromSec: number, fromPara: number, fromChar: number, forward: boolean, caseSensitive: boolean): SearchResult {
    return searchTextField(this.parseOptionalDocMethodJson.bind(this), query, fromSec, fromPara, fromChar, forward, caseSensitive);
  }

  replaceText(sec: number, para: number, charOffset: number, length: number, newText: string): ReplaceResult {
    return replaceTextField(this.parseOptionalDocMethodJson.bind(this), sec, para, charOffset, length, newText);
  }

  replaceAll(query: string, newText: string, caseSensitive: boolean): ReplaceAllResult {
    return replaceAllField(this.parseOptionalDocMethodJson.bind(this), query, newText, caseSensitive);
  }

  getPositionOfPage(globalPage: number): { ok: boolean; sec?: number; para?: number; charOffset?: number } {
    return getPositionOfPageField(this.parseOptionalDocMethodJson.bind(this), globalPage);
  }

  getPageOfPosition(sectionIdx: number, paraIdx: number): PageOfPositionResult {
    return getPageOfPositionField(this.parseOptionalDocMethodJson.bind(this), sectionIdx, paraIdx);
  }

  // ── 책갈피 API ──

  getBookmarks(): BookmarkInfo[] {
    return getBookmarksField(this.getOptionalDocMethod.bind(this));
  }

  addBookmark(sec: number, para: number, charOffset: number, name: string): { ok: boolean; error?: string } {
    return addBookmarkField(this.getOptionalDocMethod.bind(this), sec, para, charOffset, name);
  }

  deleteBookmark(sec: number, para: number, ctrlIdx: number): { ok: boolean; error?: string } {
    return deleteBookmarkField(this.getOptionalDocMethod.bind(this), sec, para, ctrlIdx);
  }

  renameBookmark(sec: number, para: number, ctrlIdx: number, newName: string): { ok: boolean; error?: string } {
    return renameBookmarkField(this.getOptionalDocMethod.bind(this), sec, para, ctrlIdx, newName);
  }

  dispose(): void {
    const doc = this.doc;
    this.doc = null;
    this.freeDocument(doc, 'dispose');
    if (this.retiredDocs.length > 0) {
      for (const retired of this.retiredDocs.splice(0)) {
        this.freeDocument(retired, 'dispose-retired');
      }
    }
  }
}
