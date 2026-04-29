import type { UniHwpEngine } from '@/engine-boundary/uni-hwp-engine';

export async function setupPdfDevtoolsApi(wasm: UniHwpEngine): Promise<void> {
  const linkDrop = await import('@/command/link-drop');
  const {
    createPdfDevtoolsApi,
    createPdfPreviewRange,
  } = await import('@/pdf/pdf-devtools');
  const { PdfPreviewController } = await import('@/pdf/pdf-preview-controller');
  const pdfDevtoolsApi = createPdfDevtoolsApi(wasm);
  const workerPreview = new PdfPreviewController();

  (window as any).__pdfExport = (params?: Record<string, unknown>) =>
    pdfDevtoolsApi.exportPdf(params);
  (window as any).__pdfPreview = (params?: Record<string, unknown>) =>
    pdfDevtoolsApi.previewPdf(params);
  (window as any).__pdfPreviewRange = (start: number, end: number) =>
    pdfDevtoolsApi.previewPdf({ range: createPdfPreviewRange(start, end) });
  (window as any).__disposePdfPreview = () =>
    pdfDevtoolsApi.disposePreview();
  (window as any).__disposeWorkerPdfPreview = () =>
    workerPreview.dispose();

  (window as any).__openGeneratedWorkerPdfInApp = async (path: string) => {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke('debug_read_generated_pdf', { path }) as number[];
    await invoke('cleanup_print_worker_temp_output_path', { path }).catch((error) => {
      console.warn('[print-worker-devtools] temp cleanup failed', { path, error });
    });
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    await workerPreview.open(blob, { title: path.split(/[/\\\\]/).pop() ?? 'Generated PDF' });
    return { path, size: bytes.length };
  };

  (window as any).__debugExtractLinkDropCandidates = (snapshot?: {
    files?: Array<{ name: string; type?: string; size?: number }>;
    downloadUrl?: string | null;
    uriList?: string | null;
    plainText?: string | null;
    html?: string | null;
  }) => {
    const files = (snapshot?.files ?? []).map(
      (file) => new File([''], file.name, { type: file.type ?? 'application/octet-stream' }),
    );
    const candidates = linkDrop.extractDropCandidatesFromSnapshot({
      files,
      downloadUrl: snapshot?.downloadUrl ?? null,
      uriList: snapshot?.uriList ?? null,
      plainText: snapshot?.plainText ?? null,
      html: snapshot?.html ?? null,
    });
    return linkDrop.summarizeDropCandidates(candidates);
  };

  (window as any).__debugPickPrimaryLinkDropCandidate = (snapshot?: {
    files?: Array<{ name: string; type?: string; size?: number }>;
    downloadUrl?: string | null;
    uriList?: string | null;
    plainText?: string | null;
    html?: string | null;
  }) => {
    const files = (snapshot?.files ?? []).map(
      (file) => new File([''], file.name, { type: file.type ?? 'application/octet-stream' }),
    );
    const candidates = linkDrop.extractDropCandidatesFromSnapshot({
      files,
      downloadUrl: snapshot?.downloadUrl ?? null,
      uriList: snapshot?.uriList ?? null,
      plainText: snapshot?.plainText ?? null,
      html: snapshot?.html ?? null,
    });
    const primary = linkDrop.pickPrimaryDropCandidate(candidates);
    if (!primary) return null;
    return linkDrop.summarizeDropCandidates([primary])[0] ?? null;
  };
}

export async function setupRemoteLinkDropDevtoolsApi(params: {
  setStatusMessage: (message: string) => void;
  loadBytes: (
    data: Uint8Array,
    fileName: string,
    fileHandle: null,
    startTime?: number,
  ) => Promise<void>;
}): Promise<void> {
  const remoteLinkDrop = await import('@/app/remote-link-drop');

  (window as any).__debugOpenRemoteHwpUrl = async (
    url: string,
    suggestedName?: string,
  ) => {
    await remoteLinkDrop.openRemoteDocumentFromUrl({
      url,
      suggestedName,
      setStatusMessage: params.setStatusMessage,
      loadBytes: params.loadBytes,
    });

    return {
      ok: true,
      url,
      suggestedName: suggestedName ?? null,
    };
  };
}

export async function setupPrintWorkerDevtoolsApi(wasm: UniHwpEngine): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  type CurrentDocPdfPreviewParams = {
    startPage?: number;
    endPage?: number;
    inApp?: boolean;
    batchSize?: number;
    svgBatchSize?: number;
  };

  const extractOutputPdfPath = (messages: unknown): string | null => {
    if (!Array.isArray(messages)) return null;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const item = messages[index] as {
        type?: string;
        result?: { ok?: boolean; outputPdfPath?: string };
      };

      if (item?.type === 'result' && item.result?.ok && item.result.outputPdfPath) {
        return item.result.outputPdfPath;
      }
    }

    return null;
  };

  const extractWorkerResult = (messages: unknown): {
    ok: boolean;
    outputPdfPath?: string;
    durationMs?: number;
    errorCode?: string;
    errorMessage?: string;
  } | null => {
    if (!Array.isArray(messages)) return null;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const item = messages[index] as {
        type?: string;
        result?: {
          ok?: boolean;
          outputPdfPath?: string;
          durationMs?: number;
          errorCode?: string;
          errorMessage?: string;
        };
      };

      if (item?.type === 'result' && item.result) {
        return {
          ok: item.result.ok === true,
          outputPdfPath: item.result.outputPdfPath,
          durationMs: item.result.durationMs,
          errorCode: item.result.errorCode,
          errorMessage: item.result.errorMessage,
        };
      }
    }

    return null;
  };

  (window as any).__testPrintWorkerEcho = async () => {
    const messages = await invoke('debug_run_print_worker_echo') as unknown;
    console.log('[print-worker-echo] messages', messages);
    return messages;
  };

  (window as any).__testPrintWorkerTimeout = async () => {
    try {
      const messages = await invoke('debug_run_print_worker_timeout_echo') as unknown;
      console.log('[print-worker-timeout] unexpected success', messages);
      return messages;
    } catch (error) {
      console.log('[print-worker-timeout] expected timeout', error);
      return error;
    }
  };

  (window as any).__testPrintWorkerManifestEcho = async () => {
    const messages = await invoke('debug_run_print_worker_manifest_echo') as unknown;
    console.log('[print-worker-manifest-echo] messages', messages);
    return messages;
  };

  (window as any).__probePrintWorkerRuntime = async () => {
    const messages = await invoke('debug_probe_print_worker_runtime') as unknown;
    console.log('[print-worker-probe] messages', messages);
    return messages;
  };

  (window as any).__testPrintWorkerPdfExport = async () => {
    const messages = await invoke('debug_run_print_worker_pdf_export') as unknown;
    console.log('[print-worker-pdf-export] messages', messages);
    return messages;
  };

  (window as any).__previewPrintWorkerPdfExport = async () => {
    const messages = await invoke('debug_run_print_worker_pdf_export') as unknown;
    const result = extractWorkerResult(messages);
    const outputPdfPath = extractOutputPdfPath(messages);
    console.log('[print-worker-pdf-preview] messages', messages);

    if (!outputPdfPath) {
      throw new Error(
        result?.errorMessage
          ? `PDF export failed (${result.errorCode ?? 'UNKNOWN'}): ${result.errorMessage}`
          : 'PDF export did not return an output path.',
      );
    }

    await invoke('debug_open_generated_pdf', { path: outputPdfPath });
    return {
      outputPdfPath,
      messages,
    };
  };

  const previewCurrentDocPdfExport = async (
    params: CurrentDocPdfPreviewParams = {},
  ) => {
    if (wasm.pageCount <= 0) {
      throw new Error('문서가 로드되지 않았습니다.');
    }

    const startPage = Math.max(1, Math.min(params.startPage ?? 1, wasm.pageCount));
    const endPage = Math.max(startPage, Math.min(params.endPage ?? Math.min(wasm.pageCount, 20), wasm.pageCount));
    const pageIndexes = Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage - 1 + index,
    );
    const batchSize = Math.max(1, Math.round(params.batchSize ?? 5));
    const svgBatchSize = Math.max(1, Math.round(params.svgBatchSize ?? 20));
    const startedAt = performance.now();
    const svgExtractStartedAt = performance.now();
    const svgPages: string[] = [];

    for (let startIndex = 0; startIndex < pageIndexes.length; startIndex += svgBatchSize) {
      const batchPageIndexes = pageIndexes.slice(startIndex, startIndex + svgBatchSize);
      for (const pageIndex of batchPageIndexes) {
        svgPages.push(wasm.renderPageSvg(pageIndex));
      }

      const completedPages = Math.min(startIndex + batchPageIndexes.length, pageIndexes.length);
      console.log('[print-worker-current-doc-pdf] svg extract progress', {
        completedPages,
        totalPages: pageIndexes.length,
        svgBatchSize,
      });

      if (completedPages < pageIndexes.length) {
        await yieldToBrowser();
      }
    }

    const svgExtractElapsedMs = Math.round(performance.now() - svgExtractStartedAt);
    const firstPageInfo = wasm.getPageInfo(pageIndexes[0]);
    const widthPx = Math.max(1, Math.round(firstPageInfo.width));
    const heightPx = Math.max(1, Math.round(firstPageInfo.height));

    const messages = await invoke('debug_run_print_worker_pdf_export_for_current_doc', {
      payload: {
        jobId: `current-doc-pdf-${Date.now()}`,
        sourceFileName: wasm.fileName,
        widthPx,
        heightPx,
        batchSize,
        svgPages,
      },
    }) as unknown;

    const result = extractWorkerResult(messages);
    const outputPdfPath = extractOutputPdfPath(messages);
    console.log('[print-worker-current-doc-pdf] messages', messages);

    if (!outputPdfPath) {
      throw new Error(
        result?.errorMessage
          ? `Current document PDF export failed (${result.errorCode ?? 'UNKNOWN'}): ${result.errorMessage}`
          : 'Current document PDF export did not return an output path.',
      );
    }

    const elapsedMs = Math.round(performance.now() - startedAt);
    const progressMessages = Array.isArray(messages)
      ? messages.filter((item) => (item as { type?: string }).type === 'progress')
      : [];

    if (params.inApp) {
      const { invoke } = await import('@tauri-apps/api/core');
      const { PdfPreviewController } = await import('@/pdf/pdf-preview-controller');
      const preview = new PdfPreviewController();
      const bytes = await invoke('debug_read_generated_pdf', { path: outputPdfPath }) as number[];
      await invoke('cleanup_print_worker_temp_output_path', { path: outputPdfPath }).catch((error) => {
        console.warn('[print-worker-current-doc-pdf] temp cleanup failed', { path: outputPdfPath, error });
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      await preview.open(blob, {
        title: `${wasm.fileName} (${startPage}-${endPage})`,
      });
      (window as any).__currentDocWorkerPdfPreview = preview;
    } else {
      await invoke('debug_open_generated_pdf', { path: outputPdfPath });
    }

    console.log('[print-worker-current-doc-pdf] preview ready', {
      outputPdfPath,
      inApp: params.inApp === true,
      startPage,
      endPage,
      batchSize,
      svgBatchSize,
      progressCount: progressMessages.length,
      elapsedMs,
      svgExtractElapsedMs,
      workerDurationMs: result?.durationMs,
    });
    return {
      outputPdfPath,
      pageRange: {
        startPage,
        endPage,
      },
      batchSize,
      svgBatchSize,
      elapsedMs,
      svgExtractElapsedMs,
      workerDurationMs: result?.durationMs,
      messages,
    };
  };

  (window as any).__previewCurrentDocPdfExport = previewCurrentDocPdfExport;

  (window as any).__previewCurrentDocPdfChunk = async (
    params: {
      startPage?: number;
      chunkSize?: number;
      inApp?: boolean;
      batchSize?: number;
      svgBatchSize?: number;
    } = {},
  ) => {
    if (wasm.pageCount <= 0) {
      throw new Error('문서가 로드되지 않았습니다.');
    }

    const chunkSize = Math.max(1, Math.round(params.chunkSize ?? 20));
    const startPage = Math.max(1, Math.min(params.startPage ?? 1, wasm.pageCount));
    const endPage = Math.min(wasm.pageCount, startPage + chunkSize - 1);

    const result = await previewCurrentDocPdfExport({
      startPage,
      endPage,
      inApp: params.inApp ?? true,
      batchSize: params.batchSize ?? 30,
      svgBatchSize: params.svgBatchSize ?? 30,
    });

    (window as any).__currentDocPdfChunkCursor = {
      nextStartPage: endPage + 1,
      chunkSize,
      inApp: params.inApp ?? true,
      batchSize: params.batchSize ?? 30,
      svgBatchSize: params.svgBatchSize ?? 30,
      totalPages: wasm.pageCount,
    };

    console.log('[print-worker-current-doc-pdf] chunk preview ready', {
      startPage,
      endPage,
      chunkSize,
      nextStartPage: endPage + 1,
      totalPages: wasm.pageCount,
    });

    return result;
  };

  (window as any).__previewNextCurrentDocPdfChunk = async () => {
    const cursor = (window as any).__currentDocPdfChunkCursor as
      | {
          nextStartPage: number;
          chunkSize: number;
          inApp: boolean;
          batchSize: number;
          svgBatchSize: number;
          totalPages: number;
        }
      | undefined;

    if (!cursor) {
      throw new Error('먼저 __previewCurrentDocPdfChunk()를 실행해주세요.');
    }

    if (cursor.nextStartPage > cursor.totalPages) {
      throw new Error('더 이상 미리보기할 다음 페이지 구간이 없습니다.');
    }

    return (window as any).__previewCurrentDocPdfChunk({
      startPage: cursor.nextStartPage,
      chunkSize: cursor.chunkSize,
      inApp: cursor.inApp,
      batchSize: cursor.batchSize,
      svgBatchSize: cursor.svgBatchSize,
    });
  };
}

