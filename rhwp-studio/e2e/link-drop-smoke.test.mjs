import {
  runTest,
  assert,
  screenshot,
  setTestCase,
} from './helpers.mjs';

await runTest('보존 프레임워크 스모크: link-drop 후보 추출과 우선순위', async ({ page }) => {
  setTestCase('TC-1: direct extension + uri-list 감지');
  const directCandidates = await page.evaluate(() => {
    return window.__debugExtractLinkDropCandidates?.({
      uriList: 'https://example.com/sample.hwpx',
      plainText: 'https://example.com/sample.hwpx',
    });
  });

  assert(Array.isArray(directCandidates), 'link-drop devtools API 존재');
  assert(directCandidates.length === 1, `중복 URL 제거됨: ${directCandidates.length}`);
  assert(directCandidates[0]?.source === 'uri-list', `uri-list 후보 감지: ${directCandidates[0]?.source}`);
  assert(directCandidates[0]?.url === 'https://example.com/sample.hwpx', '직접 .hwpx URL 유지');

  setTestCase('TC-2: HTML 링크 추출');
  const htmlCandidates = await page.evaluate(() => {
    return window.__debugExtractLinkDropCandidates?.({
      html: '<div><a href="https://example.com/from-html.hwpx">자료</a></div>',
    });
  });

  assert(htmlCandidates.length === 1, `HTML 후보 1건 추출: ${htmlCandidates.length}`);
  assert(htmlCandidates[0]?.source === 'html', `HTML source 유지: ${htmlCandidates[0]?.source}`);
  assert(htmlCandidates[0]?.name === '자료', `HTML 링크 텍스트 유지: ${htmlCandidates[0]?.name}`);

  setTestCase('TC-3: DownloadURL 우선순위');
  const primaryDownloadCandidate = await page.evaluate(() => {
    return window.__debugPickPrimaryLinkDropCandidate?.({
      downloadUrl: 'application/octet-stream:downloaded.hwpx:https://example.com/download?id=42',
      uriList: 'https://example.com/other.hwpx',
      plainText: 'https://example.com/plain.hwpx',
    });
  });

  assert(primaryDownloadCandidate?.source === 'download-url', `DownloadURL 우선 선택: ${primaryDownloadCandidate?.source}`);
  assert(primaryDownloadCandidate?.name === 'downloaded.hwpx', `DownloadURL 파일명 유지: ${primaryDownloadCandidate?.name}`);

  setTestCase('TC-4: 파일 후보 최우선');
  const primaryFileCandidate = await page.evaluate(() => {
    return window.__debugPickPrimaryLinkDropCandidate?.({
      files: [{ name: 'local-file.hwpx', type: 'application/octet-stream' }],
      uriList: 'https://example.com/remote.hwpx',
    });
  });

  assert(primaryFileCandidate?.kind === 'file', `파일 드롭이 URL보다 우선: ${primaryFileCandidate?.kind}`);
  assert(primaryFileCandidate?.name === 'local-file.hwpx', `파일 후보 이름 유지: ${primaryFileCandidate?.name}`);

  setTestCase('TC-5: text/plain 단독 후보 감지');
  const plainTextCandidates = await page.evaluate(() => {
    return window.__debugExtractLinkDropCandidates?.({
      plainText: 'https://example.com/plain-only.hwpx',
    });
  });

  assert(plainTextCandidates.length === 1, `plainText 단독 후보 1건 추출: ${plainTextCandidates.length}`);
  assert(plainTextCandidates[0]?.source === 'plain-text', `plainText source 유지: ${plainTextCandidates[0]?.source}`);
  assert(plainTextCandidates[0]?.url === 'https://example.com/plain-only.hwpx', 'plainText URL 유지');

  setTestCase('TC-6: direct extension + uri-list .hwp 감지');
  const hwpCandidates = await page.evaluate(() => {
    return window.__debugExtractLinkDropCandidates?.({
      uriList: 'https://example.com/sample.hwp',
      plainText: 'https://example.com/sample.hwp',
    });
  });

  assert(hwpCandidates.length === 1, `.hwp direct URL 중복 제거됨: ${hwpCandidates.length}`);
  assert(hwpCandidates[0]?.source === 'uri-list', `.hwp uri-list 후보 감지: ${hwpCandidates[0]?.source}`);
  assert(hwpCandidates[0]?.url === 'https://example.com/sample.hwp', '직접 .hwp URL 유지');

  await screenshot(page, 'link-drop-smoke-01');
});
