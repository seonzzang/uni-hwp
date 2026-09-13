import { WasmBridge } from '@/core/wasm-bridge';

export interface UniHwpVersionInfo {
  productName: 'Uni-HWP';
  adapterVersion: string;
  engineVersion: string;
}

export interface UniHwpCapabilities {
  rangeReplace: boolean;
  fieldAutomation: boolean;
  progressivePaging: boolean;
}

/** Stable, intentionally small surface exposed to embedded consumers. */
export interface UniHwpPublicApi {
  loadDocument(data: ArrayBuffer | ArrayLike<number>, fileName?: string): any;
  get pageCount(): number;
  renderPageSvg(page?: number): string;
  replaceRange(sectionIndex: number, paragraphIndex: number, startOffset: number, length: number, newText: string): any;
  getVersionInfo(): UniHwpVersionInfo;
  getCapabilities(): UniHwpCapabilities;
}

/**
 * Product-facing engine contract.
 *
 * `WasmBridge` is deliberately kept on the implementation side of this
 * module.  Consumers receive this surface instead of depending on the
 * bridge class (or on the RHWP-generated WASM document type that it owns).
 * `keyof` includes only public members, so private document handles and
 * bridge lifecycle state cannot become part of the product contract.
 *
 * Keeping the surface structurally derived for now is intentional: the
 * bridge is already the compatibility layer for the large editor command
 * surface.  A future engine can implement the same public surface without
 * changing the product imports.
 */
type EngineSurface = Pick<WasmBridge, keyof WasmBridge>;

export type UniHwpEngine = EngineSurface;

export function createUniHwpEngine(): UniHwpEngine {
  return new WasmBridge();
}
