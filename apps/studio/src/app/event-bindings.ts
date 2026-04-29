import type { EventBus } from '@/core/event-bus';
import type { CommandDispatcher } from '@/command/dispatcher';

type DocumentLifecycle = {
  closeCurrentDocument: () => Promise<void>;
  createNewDocument: () => Promise<void>;
  loadBytes: (
    data: Uint8Array,
    fileName: string,
    fileHandle: any,
    startTime?: number,
  ) => Promise<void>;
};

export function installEditorEventBindings(params: {
  eventBus: EventBus;
  dispatcher: CommandDispatcher;
  documentLifecycle: DocumentLifecycle;
}): void {
  const { eventBus, dispatcher, documentLifecycle } = params;

  eventBus.on('create-new-document', () => {
    void documentLifecycle.createNewDocument();
  });

  eventBus.on('close-current-document', () => {
    void documentLifecycle.closeCurrentDocument();
  });

  eventBus.on('open-document-bytes', async (payload) => {
    const data = payload as {
      bytes: Uint8Array;
      fileName: string;
      fileHandle: any;
    };
    await documentLifecycle.loadBytes(data.bytes, data.fileName, data.fileHandle);
  });

  eventBus.on('equation-edit-request', () => {
    dispatcher.dispatch('insert:equation-edit');
  });
}
