import { setupRemoteLinkDrop } from '@/app/remote-link-drop';

type DocumentLifecycle = {
  loadFile: (file: File) => Promise<void>;
  loadBytes: (
    data: Uint8Array,
    fileName: string,
    fileHandle: any,
    startTime?: number,
  ) => Promise<void>;
};

export function installFileInput(params: {
  documentLifecycle: DocumentLifecycle;
  setStatusMessage: (message: string) => void;
}): void {
  const { documentLifecycle, setStatusMessage } = params;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const container = document.getElementById('scroll-container')!;

  setupRemoteLinkDrop({
    container,
    fileInput,
    setStatusMessage,
    loadFile: documentLifecycle.loadFile,
    loadBytes: documentLifecycle.loadBytes,
  });
}
