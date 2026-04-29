import { WasmBridge } from '@/core/wasm-bridge';

export type UniHwpEngine = WasmBridge;

export function createUniHwpEngine(): UniHwpEngine {
  return new WasmBridge();
}
