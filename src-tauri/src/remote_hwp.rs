use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::blocking::{Client, Response};
use reqwest::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use reqwest::redirect::Policy;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteHwpOpenResult {
    pub file_name: String,
    pub final_url: String,
    pub temp_path: String,
    pub bytes: Vec<u8>,
    pub content_type: Option<String>,
    pub content_disposition: Option<String>,
    pub detection_method: String,
}

#[derive(Debug)]
struct RemoteProbe {
    file_name: String,
    final_url: String,
    content_type: Option<String>,
    content_disposition: Option<String>,
    detection_method: String,
}

fn remote_hwp_temp_root() -> PathBuf {
    std::env::temp_dir().join("uni-hwp-link-drop")
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(Policy::limited(10))
        .user_agent("Uni-HWP/0.7")
        .build()
        .map_err(|error| format!("HTTP 클라이언트 초기화 실패: {error}"))
}

fn ensure_http_url(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        Ok(())
    } else {
        Err("HTTP/HTTPS 링크만 지원합니다.".to_string())
    }
}

fn lower_path_from_url(url: &str) -> String {
    let base = url.split(['#', '?']).next().unwrap_or(url);
    base.to_ascii_lowercase()
}

fn file_name_from_url(url: &str) -> Option<String> {
    let base = url.split(['#', '?']).next().unwrap_or(url);
    let segment = base.rsplit('/').next()?;
    if segment.is_empty() {
        return None;
    }
    Some(segment.to_string())
}

fn sanitize_file_name(name: &str) -> String {
    let trimmed = name.trim();
    let fallback = "downloaded-document.hwp";
    if trimmed.is_empty() {
        return fallback.to_string();
    }

    let mut sanitized = trimmed
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect::<String>();

    if sanitized.is_empty() {
        sanitized = fallback.to_string();
    }

    let lower = sanitized.to_ascii_lowercase();
    if !lower.ends_with(".hwp") && !lower.ends_with(".hwpx") {
        sanitized.push_str(".hwp");
    }

    sanitized
}

fn extract_filename_from_content_disposition(value: &str) -> Option<String> {
    value
        .split(';')
        .find_map(|part| {
            let trimmed = part.trim();
            let (_, filename) = trimmed.split_once('=')?;
            if !trimmed.to_ascii_lowercase().starts_with("filename=") {
                return None;
            }
            Some(filename.trim_matches('"').to_string())
        })
}

fn is_hwp_like_content_type(content_type: Option<&str>) -> bool {
    let Some(value) = content_type else {
        return false;
    };

    let lower = value.to_ascii_lowercase();
    lower.contains("hwp")
        || lower.contains("hwpx")
        || lower.contains("haansoft")
        || lower.contains("hancom")
}

fn is_hwp_file_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".hwp") || lower.ends_with(".hwpx")
}

fn direct_file_extension_probe(url: &str) -> Option<RemoteProbe> {
    let lower = lower_path_from_url(url);
    if !lower.ends_with(".hwp") && !lower.ends_with(".hwpx") {
        return None;
    }

    let file_name = file_name_from_url(url)
        .map(|name| sanitize_file_name(&name))
        .unwrap_or_else(|| "downloaded-document.hwp".to_string());

    Some(RemoteProbe {
        file_name,
        final_url: url.to_string(),
        content_type: None,
        content_disposition: None,
        detection_method: "direct-extension".to_string(),
    })
}

fn headers_from_response(response: &Response) -> (Option<String>, Option<String>) {
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let content_disposition = response
        .headers()
        .get(CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    (content_type, content_disposition)
}

fn probe_remote_hwp(
    client: &Client,
    url: &str,
    suggested_name: Option<&str>,
) -> Result<RemoteProbe, String> {
    if let Some(probe) = direct_file_extension_probe(url) {
        return Ok(probe);
    }

    let suggested_name = suggested_name
        .filter(|name| is_hwp_file_name(name))
        .map(sanitize_file_name);

    let mut head_error: Option<String> = None;

    match client.head(url).send() {
        Ok(response) => {
            if response.status().is_success() {
                let final_url = response.url().to_string();
                let (content_type, content_disposition) = headers_from_response(&response);
                let disposition_name = content_disposition
                    .as_deref()
                    .and_then(extract_filename_from_content_disposition);

                if is_hwp_like_content_type(content_type.as_deref())
                    || disposition_name.as_deref().map(is_hwp_file_name).unwrap_or(false)
                    || suggested_name.is_some()
                {
                    let file_name = disposition_name
                        .or_else(|| suggested_name.clone())
                        .or_else(|| file_name_from_url(&final_url))
                        .map(|name| sanitize_file_name(&name))
                        .unwrap_or_else(|| "downloaded-document.hwp".to_string());

                    return Ok(RemoteProbe {
                        file_name,
                        final_url,
                        content_type,
                        content_disposition,
                        detection_method: "response-headers".to_string(),
                    });
                }
            }
        }
        Err(error) => {
            head_error = Some(error.to_string());
        }
    }

    let response = client
        .get(url)
        .send()
        .map_err(|error| format!("다운로드 링크 확인 실패: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("다운로드 링크 응답 실패: HTTP {}", status.as_u16()));
    }

    let final_url = response.url().to_string();
    let (content_type, content_disposition) = headers_from_response(&response);
    let disposition_name = content_disposition
        .as_deref()
        .and_then(extract_filename_from_content_disposition);

    if is_hwp_like_content_type(content_type.as_deref())
        || disposition_name.as_deref().map(is_hwp_file_name).unwrap_or(false)
        || suggested_name.is_some()
    {
        let file_name = disposition_name
            .or_else(|| suggested_name)
            .or_else(|| file_name_from_url(&final_url))
            .map(|name| sanitize_file_name(&name))
            .unwrap_or_else(|| "downloaded-document.hwp".to_string());

        Ok(RemoteProbe {
            file_name,
            final_url,
            content_type,
            content_disposition,
            detection_method: "header-fallback-get".to_string(),
        })
    } else {
        Err(match head_error {
            Some(error) => format!("지원되지 않는 링크입니다. (HEAD 실패: {error})"),
            None => "지원되지 않는 링크입니다. HWP/HWPX 파일로 확인되지 않았습니다.".to_string(),
        })
    }
}

fn temp_download_path(file_name: &str) -> Result<PathBuf, String> {
    cleanup_stale_remote_downloads();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("시간 계산 실패: {error}"))?
        .as_millis();
    let dir = remote_hwp_temp_root().join(format!("drop-{timestamp}"));
    fs::create_dir_all(&dir).map_err(|error| format!("임시 디렉터리 생성 실패: {error}"))?;
    Ok(dir.join(file_name))
}

fn write_downloaded_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    fs::write(path, bytes).map_err(|error| format!("임시 파일 저장 실패: {error}"))
}

fn looks_like_hwp_bytes(bytes: &[u8]) -> bool {
    const HWP_CFB_MAGIC: &[u8; 8] = b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";
    bytes.len() >= HWP_CFB_MAGIC.len() && &bytes[..HWP_CFB_MAGIC.len()] == HWP_CFB_MAGIC
}

fn looks_like_hwpx_bytes(bytes: &[u8]) -> bool {
    // ZIP local file header / empty archive / spanned archive
    matches!(
        bytes.get(0..4),
        Some([0x50, 0x4B, 0x03, 0x04] | [0x50, 0x4B, 0x05, 0x06] | [0x50, 0x4B, 0x07, 0x08])
    )
}

fn sniff_downloaded_document(bytes: &[u8]) -> Result<(), String> {
    if looks_like_hwp_bytes(bytes) || looks_like_hwpx_bytes(bytes) {
        return Ok(());
    }

    let prefix = bytes
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join(", ");

    if let Ok(text_prefix) = std::str::from_utf8(bytes.get(0..16).unwrap_or(bytes)) {
        let trimmed = text_prefix.trim_start();
        if trimmed.starts_with("<!DOCTYPE") || trimmed.starts_with("<html") {
            return Err("문서 링크가 아니라 HTML 페이지가 내려왔습니다.".to_string());
        }
    }

    Err(format!(
        "지원되지 않는 다운로드 데이터입니다. HWP/HWPX 시그니처가 아닙니다. [{prefix}]"
    ))
}

fn cleanup_stale_remote_downloads() {
    let root = remote_hwp_temp_root();
    let Ok(entries) = fs::read_dir(&root) else {
        return;
    };

    let now = SystemTime::now();
    let ttl = Duration::from_secs(60 * 60 * 24);

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if !metadata.is_dir() {
            continue;
        }

        let is_stale = metadata
            .modified()
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .map(|age| age >= ttl)
            .unwrap_or(false);

        if is_stale {
            let _ = fs::remove_dir_all(path);
        }
    }
}

#[tauri::command]
pub fn cleanup_remote_hwp_temp_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    let canonical_target = target
        .canonicalize()
        .map_err(|error| format!("임시 파일 경로 확인 실패: {error}"))?;

    let root = remote_hwp_temp_root();
    let canonical_root = root.canonicalize().unwrap_or(root);

    if !canonical_target.starts_with(&canonical_root) {
        return Err("허용되지 않은 임시 파일 경로입니다.".to_string());
    }

    if canonical_target.is_file() {
        fs::remove_file(&canonical_target)
            .map_err(|error| format!("임시 파일 삭제 실패: {error}"))?;
    }

    if let Some(parent) = canonical_target.parent() {
        let _ = fs::remove_dir(parent);
    }

    Ok(())
}

#[tauri::command]
pub fn resolve_remote_hwp_url(
    url: String,
    suggested_name: Option<String>,
) -> Result<RemoteHwpOpenResult, String> {
    ensure_http_url(&url)?;
    let client = build_client()?;
    let probe = probe_remote_hwp(&client, &url, suggested_name.as_deref())?;

    let response = client
        .get(&probe.final_url)
        .send()
        .map_err(|error| format!("파일 다운로드 실패: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("파일 다운로드 실패: HTTP {}", status.as_u16()));
    }

    let mut bytes = response
        .bytes()
        .map_err(|error| format!("다운로드 데이터 읽기 실패: {error}"))?
        .to_vec();

    if bytes.is_empty() {
        return Err("다운로드된 파일이 비어 있습니다.".to_string());
    }

    sniff_downloaded_document(&bytes)?;

    let file_name = sanitize_file_name(&probe.file_name);
    let temp_path = temp_download_path(&file_name)?;
    if let Err(error) = write_downloaded_bytes(&temp_path, &bytes) {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    Ok(RemoteHwpOpenResult {
        file_name,
        final_url: probe.final_url,
        temp_path: temp_path.to_string_lossy().to_string(),
        bytes: std::mem::take(&mut bytes),
        content_type: probe.content_type,
        content_disposition: probe.content_disposition,
        detection_method: probe.detection_method,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    const TEST_HWPX_BYTES: &[u8] = b"PK\x03\x04test-hwpx";

    fn spawn_test_server(
        route: &'static str,
        content_type: &'static str,
        content_disposition: Option<&'static str>,
        body: &'static [u8],
        request_count: usize,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let address = listener.local_addr().expect("local addr");

        thread::spawn(move || {
            for _ in 0..request_count {
                let (mut stream, _) = listener.accept().expect("accept request");
                let mut buffer = [0u8; 2048];
                let read = stream.read(&mut buffer).expect("read request");
                let request = String::from_utf8_lossy(&buffer[..read]);
                let method = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().next())
                    .unwrap_or("GET");

                let (status, response_body) = if request.contains(route) {
                    if method.eq_ignore_ascii_case("HEAD") {
                        ("200 OK", Vec::new())
                    } else {
                        ("200 OK", body.to_vec())
                    }
                } else {
                    ("404 Not Found", Vec::new())
                };

                let mut headers = vec![
                    format!("HTTP/1.1 {status}"),
                    format!("Content-Type: {content_type}"),
                    format!("Content-Length: {}", response_body.len()),
                    "Connection: close".to_string(),
                ];
                if let Some(value) = content_disposition {
                    headers.push(format!("Content-Disposition: {value}"));
                }
                headers.push(String::new());
                headers.push(String::new());

                let mut response = headers.join("\r\n").into_bytes();
                response.extend_from_slice(&response_body);
                stream.write_all(&response).expect("write response");
                stream.flush().expect("flush response");
            }
        });

        format!("http://127.0.0.1:{}{}", address.port(), route)
    }

    #[test]
    fn resolve_remote_hwp_url_accepts_direct_extension_download() {
        let url = spawn_test_server(
            "/sample.hwpx",
            "application/octet-stream",
            None,
            TEST_HWPX_BYTES,
            1,
        );

        let result = resolve_remote_hwp_url(url.clone(), None).expect("resolve direct extension");
        assert_eq!(result.file_name, "sample.hwpx");
        assert_eq!(result.final_url, url);
        assert_eq!(result.detection_method, "direct-extension");
        assert_eq!(result.bytes, TEST_HWPX_BYTES);
        assert!(Path::new(&result.temp_path).exists());
        cleanup_remote_hwp_temp_path(result.temp_path).expect("cleanup temp file");
    }

    #[test]
    fn resolve_remote_hwp_url_accepts_header_detected_download() {
        let url = spawn_test_server(
            "/download",
            "application/haansoft-hwpx",
            Some("attachment; filename=\"header-detected.hwpx\""),
            TEST_HWPX_BYTES,
            2,
        );

        let result = resolve_remote_hwp_url(url.clone(), None).expect("resolve header detected");
        assert_eq!(result.file_name, "header-detected.hwpx");
        assert_eq!(result.final_url, url);
        assert_eq!(result.detection_method, "response-headers");
        assert_eq!(result.bytes, TEST_HWPX_BYTES);
        assert!(Path::new(&result.temp_path).exists());
        cleanup_remote_hwp_temp_path(result.temp_path).expect("cleanup temp file");
    }

    #[test]
    fn resolve_remote_hwp_url_rejects_html_page_response() {
        let url = spawn_test_server(
            "/fake.hwpx",
            "text/html; charset=utf-8",
            None,
            b"<!DOCTYPE html><html><body>not a document</body></html>",
            1,
        );

        let error = resolve_remote_hwp_url(url, None).expect_err("html page should be rejected");
        assert!(
            error.contains("HTML 페이지"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn resolve_remote_hwp_url_rejects_invalid_download_signature() {
        let url = spawn_test_server(
            "/bad-download.hwpx",
            "application/octet-stream",
            None,
            b"NOT-HWPX-DATA",
            1,
        );

        let error =
            resolve_remote_hwp_url(url, None).expect_err("invalid binary signature should fail");
        assert!(
            error.contains("지원되지 않는 다운로드 데이터"),
            "unexpected error: {error}"
        );
    }
}
