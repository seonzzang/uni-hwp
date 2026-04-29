import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';
import { showSaveAs } from '@/ui/save-as-dialog';
import {
  saveDocumentToFileSystem,
  type FileSystemWindowLike,
} from '@/command/file-system-access';

export type SaveDocumentResult = 'saved' | 'cancelled' | 'failed';

export async function saveCurrentDocument(wasm: UniHwpEngine): Promise<SaveDocumentResult> {
  try {
    const saveName = wasm.fileName;
    const sourceFormat = wasm.getSourceFormat();
    const isHwpx = sourceFormat === 'hwpx';
    const bytes = isHwpx ? wasm.exportHwpx() : wasm.exportHwp();
    const mimeType = isHwpx ? 'application/hwp+zip' : 'application/x-hwp';
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    console.log(`[file:save] format=${sourceFormat}, isHwpx=${isHwpx}, ${bytes.length} bytes`);

    try {
      const saveResult = await saveDocumentToFileSystem({
        blob,
        suggestedName: saveName,
        currentHandle: wasm.currentFileHandle,
        windowLike: window as FileSystemWindowLike,
      });

      if (saveResult.method !== 'fallback') {
        wasm.currentFileHandle = saveResult.handle;
        wasm.fileName = saveResult.fileName;
        console.log(`[file:save] ${saveResult.fileName} (${(bytes.length / 1024).toFixed(1)}KB)`);
        return 'saved';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      console.warn('[file:save] File System Access API 실패, 폴백:', error);
    }

    let downloadName = saveName;
    if (wasm.isNewDocument) {
      const baseName = saveName.replace(/\.(hwp|hwpx)$/i, '');
      const result = await showSaveAs(baseName);
      if (!result) return 'cancelled';
      downloadName = result;
      wasm.fileName = downloadName;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    console.log(`[file:save] ${downloadName} (${(bytes.length / 1024).toFixed(1)}KB)`);
    return 'saved';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[file:save] 저장 실패:', message);
    alert(`파일 저장에 실패했습니다:\n${message}`);
    return 'failed';
  }
}
