/**
 * Internal compatibility factory for the legacy hwpctl wrapper.
 *
 * The generated engine module is imported only inside the engine boundary.
 * HwpCtrl remains a compatibility surface and does not become part of the
 * Uni-HWP public contract.
 */
import init, { HwpDocument } from '@wasm/rhwp.js';

export async function createLegacyDocument(options: {
  wasmUrl?: string;
  wasmModule?: any;
}): Promise<any> {
  if (options.wasmModule) return options.wasmModule;
  await init(options.wasmUrl);
  return HwpDocument.createEmpty();
}
