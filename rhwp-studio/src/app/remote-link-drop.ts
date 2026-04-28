import { invoke } from '@tauri-apps/api/core';
import { showToast } from '@/ui/toast';
import { extractDropCandidates, pickPrimaryDropCandidate, summarizeDropCandidates } from '@/command/link-drop';

type RemoteHwpOpenResult = {
  fileName: string;
  finalUrl: string;
  tempPath: string;
  bytes: number[];
  contentType?: string | null;
  contentDisposition?: string | null;
  detectionMethod: string;
};

type SetupRemoteLinkDropParams = {
  container: HTMLElement;
  fileInput: HTMLInputElement;
  setStatusMessage: (message: string) => void;
  loadFile: (file: File) => Promise<void>;
  loadBytes: (
    data: Uint8Array,
    fileName: string,
    fileHandle: null,
    startTime?: number,
  ) => Promise<void>;
};

export function setupRemoteLinkDrop(params: SetupRemoteLinkDropParams): void {
  const { container, fileInput, setStatusMessage, loadFile, loadBytes } = params;

  fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.hwp') && !name.endsWith('.hwpx')) {
      alert('HWP/HWPX 파일만 지원합니다.');
      return;
    }
    await loadFile(file);
  });

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('drag-over');
  });
  container.addEventListener('dragleave', () => {
    container.classList.remove('drag-over');
  });
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');
    const candidates = extractDropCandidates(e.dataTransfer);
    console.log('[link-drop] candidates', summarizeDropCandidates(candidates));
    const candidate = pickPrimaryDropCandidate(candidates);
    console.log('[link-drop] selected candidate', candidate
      ? {
        kind: candidate.kind,
        source: candidate.source,
        name: candidate.name,
        url: candidate.url,
        fileName: candidate.file?.name,
      }
      : null);
    if (!candidate) return;

    if (candidate.kind === 'file') {
      const file = candidate.file;
      if (!file) return;
      const dropName = file.name.toLowerCase();
      if (!dropName.endsWith('.hwp') && !dropName.endsWith('.hwpx')) {
        alert('HWP/HWPX 파일만 지원합니다.');
        return;
      }
      await loadFile(file);
      return;
    }

    if (candidate.kind === 'url' && candidate.url) {
      await loadRemoteCandidate({
        url: candidate.url,
        name: candidate.name,
        source: candidate.source,
        setStatusMessage,
        loadBytes,
      });
    }
  });
}

export async function loadRemoteCandidate(params: {
  url: string;
  name?: string;
  source?: string;
  setStatusMessage: (message: string) => void;
  loadBytes: (
    data: Uint8Array,
    fileName: string,
    fileHandle: null,
    startTime?: number,
  ) => Promise<void>;
}): Promise<void> {
  const { url, name, source, setStatusMessage, loadBytes } = params;
  let tempPathToCleanup: string | null = null;
  try {
    setStatusMessage('링크에서 문서를 확인하는 중...');
    const result = await invoke('resolve_remote_hwp_url', {
      url,
      suggestedName: name ?? null,
    }) as RemoteHwpOpenResult;
    tempPathToCleanup = result.tempPath;
    setStatusMessage('문서를 다운로드하는 중...');
    const data = new Uint8Array(result.bytes);
    await loadBytes(data, result.fileName, null);
    showToast({
      message: `${result.fileName} 문서를 링크에서 열었습니다.`,
      durationMs: 3000,
    });
    console.log('[link-drop] remote document opened', {
      url,
      source,
      suggestedName: name,
      finalUrl: result.finalUrl,
      tempPath: result.tempPath,
      detectionMethod: result.detectionMethod,
      contentType: result.contentType,
      contentDisposition: result.contentDisposition,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    setStatusMessage(`링크 문서 열기 실패: ${errMsg}`);
    console.error('[link-drop] remote document open failed:', errMsg, {
      url,
      source,
      suggestedName: name,
      rawError: error,
    });
    showToast({
      message: `링크 문서 열기 실패: ${errMsg}`,
      durationMs: 5000,
    });
  } finally {
    if (tempPathToCleanup) {
      invoke('cleanup_remote_hwp_temp_path', { path: tempPathToCleanup }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Command cleanup_remote_hwp_temp_path not found')) {
          return;
        }
        console.warn('[link-drop] temp cleanup skipped', { path: tempPathToCleanup, error });
      });
    }
  }
}

export async function openRemoteDocumentFromUrl(params: {
  url: string;
  suggestedName?: string;
  setStatusMessage: (message: string) => void;
  loadBytes: (
    data: Uint8Array,
    fileName: string,
    fileHandle: null,
    startTime?: number,
  ) => Promise<void>;
}): Promise<void> {
  await loadRemoteCandidate({
    url: params.url,
    name: params.suggestedName,
    source: 'debug-url-open',
    setStatusMessage: params.setStatusMessage,
    loadBytes: params.loadBytes,
  });
}
