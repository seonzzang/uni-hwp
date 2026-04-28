export type DroppedResourceCandidate = {
  kind: 'file' | 'url';
  source: 'file' | 'download-url' | 'uri-list' | 'plain-text' | 'html';
  name?: string;
  url?: string;
  file?: File;
};

export type DropTransferSnapshot = {
  files?: File[];
  downloadUrl?: string | null;
  uriList?: string | null;
  plainText?: string | null;
  html?: string | null;
};

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function parseDownloadUrl(value: string): { name?: string; url: string } | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^([^:]+):([^:]+):(https?:\/\/.+)$/i);
  if (!match) return null;
  return {
    name: match[2]?.trim() || undefined,
    url: match[3].trim(),
  };
}

export function extractDropCandidatesFromSnapshot(
  snapshot: DropTransferSnapshot | null | undefined,
): DroppedResourceCandidate[] {
  if (!snapshot) return [];
  const candidates: DroppedResourceCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const file of Array.from(snapshot.files ?? [])) {
    candidates.push({
      kind: 'file',
      source: 'file',
      name: file.name,
      file,
    });
  }

  const pushUrl = (
    source: DroppedResourceCandidate['source'],
    url: string | null,
    name?: string,
  ): void => {
    if (!url) return;
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    candidates.push({
      kind: 'url',
      source,
      name,
      url,
    });
  };

  const downloadUrl = snapshot.downloadUrl ?? '';
  if (downloadUrl) {
    const parsed = parseDownloadUrl(downloadUrl);
    pushUrl('download-url', normalizeUrl(parsed?.url ?? ''), parsed?.name);
  }

  const uriList = snapshot.uriList ?? '';
  if (uriList) {
    for (const line of uriList.split(/\r?\n/)) {
      const candidate = line.trim();
      if (!candidate || candidate.startsWith('#')) continue;
      pushUrl('uri-list', normalizeUrl(candidate));
    }
  }

  const plainText = snapshot.plainText ?? '';
  if (plainText) {
    pushUrl('plain-text', normalizeUrl(plainText));
  }

  const html = snapshot.html ?? '';
  if (html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = Array.from(doc.querySelectorAll('a[href], img[src]'));
    for (const element of elements) {
      const href = element.getAttribute('href') ?? element.getAttribute('src');
      const text = element.textContent?.trim() || undefined;
      pushUrl('html', normalizeUrl(href ?? ''), text);
    }
  }

  return candidates;
}

export function createDropTransferSnapshot(
  dataTransfer: DataTransfer | null,
): DropTransferSnapshot | null {
  if (!dataTransfer) return null;
  return {
    files: Array.from(dataTransfer.files ?? []),
    downloadUrl: dataTransfer.getData('DownloadURL'),
    uriList: dataTransfer.getData('text/uri-list'),
    plainText: dataTransfer.getData('text/plain'),
    html: dataTransfer.getData('text/html'),
  };
}

export function extractDropCandidates(dataTransfer: DataTransfer | null): DroppedResourceCandidate[] {
  return extractDropCandidatesFromSnapshot(createDropTransferSnapshot(dataTransfer));
}

function looksLikeHwpName(value?: string): boolean {
  if (!value) return false;
  const lower = value.trim().toLowerCase();
  return lower.endsWith('.hwp') || lower.endsWith('.hwpx');
}

function looksLikeHwpUrl(value?: string): boolean {
  if (!value) return false;
  const lower = value.split(/[?#]/, 1)[0]?.toLowerCase() ?? value.toLowerCase();
  return lower.endsWith('.hwp') || lower.endsWith('.hwpx');
}

export function pickPrimaryDropCandidate(
  candidates: DroppedResourceCandidate[],
): DroppedResourceCandidate | null {
  if (candidates.length === 0) return null;

  const fileCandidate = candidates.find((candidate) => candidate.kind === 'file');
  if (fileCandidate) return fileCandidate;

  const score = (candidate: DroppedResourceCandidate): number => {
    let value = 0;

    if (candidate.source === 'download-url') value += 40;
    if (candidate.source === 'html') value += 15;
    if (candidate.source === 'uri-list') value += 10;
    if (candidate.source === 'plain-text') value += 5;
    if (looksLikeHwpUrl(candidate.url)) value += 60;
    if (looksLikeHwpName(candidate.name)) value += 30;

    return value;
  };

  return [...candidates].sort((left, right) => score(right) - score(left))[0] ?? null;
}

export function summarizeDropCandidates(
  candidates: DroppedResourceCandidate[],
): Array<Record<string, unknown>> {
  return candidates.map((candidate) => ({
    kind: candidate.kind,
    source: candidate.source,
    name: candidate.name,
    url: candidate.url,
    fileName: candidate.file?.name,
    fileType: candidate.file?.type,
    fileSize: candidate.file?.size,
  }));
}
