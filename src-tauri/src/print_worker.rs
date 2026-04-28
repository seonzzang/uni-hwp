use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::print_job::{
    create_debug_print_job_request, create_print_job_request_from_svg_pages,
    write_print_job_manifest, PrintJobRequest, PrintWorkerMessage,
};

const PRINT_WORKER_CANCEL_FILE_NAME: &str = "print-worker-cancel.request";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn configure_background_command(command: &mut Command) -> &mut Command {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendPdfExportRequest {
    pub job_id: String,
    pub source_file_name: String,
    pub width_px: u32,
    pub height_px: u32,
    pub batch_size: Option<u32>,
    pub svg_pages: Vec<String>,
}

fn pdf_export_timeout_for_page_count(page_count: u32) -> Duration {
    let scaled_seconds = 30 + u64::from(page_count).saturating_mul(2);
    Duration::from_secs(scaled_seconds.clamp(60, 1800))
}

fn workspace_root() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "workspace root를 찾을 수 없습니다".to_string())
}

fn print_worker_script_path() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("scripts").join("print-worker.ts"))
}

fn validate_print_worker_job_id(job_id: &str) -> Result<(), String> {
    if job_id.is_empty()
        || !job_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return Err("invalid print worker job id".to_string());
    }

    Ok(())
}

fn print_worker_temp_dir(job_id: &str) -> Result<PathBuf, String> {
    validate_print_worker_job_id(job_id)?;
    Ok(std::env::temp_dir().join(job_id))
}

fn print_worker_cancel_path(job_id: &str) -> Result<PathBuf, String> {
    Ok(print_worker_temp_dir(job_id)?.join(PRINT_WORKER_CANCEL_FILE_NAME))
}

fn cleanup_print_worker_temp_output_path_inner(path: &Path) -> Result<(), String> {
    let canonical_target = path
        .canonicalize()
        .map_err(|error| format!("print worker output path 확인 실패: {error}"))?;

    let temp_root = std::env::temp_dir();
    let canonical_temp_root = temp_root.canonicalize().unwrap_or(temp_root);
    if !canonical_target.starts_with(&canonical_temp_root) {
        return Err("허용되지 않은 print worker 임시 파일 경로입니다.".to_string());
    }

    let file_name = canonical_target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "print worker output file name을 확인할 수 없습니다.".to_string())?;
    if file_name != "output.pdf" && file_name != "sample.pdf" {
        return Err("print worker 출력 PDF 경로 형식이 올바르지 않습니다.".to_string());
    }

    let parent = canonical_target
        .parent()
        .ok_or_else(|| "print worker 임시 디렉터리를 확인할 수 없습니다.".to_string())?;
    if !parent.join("print-worker-analysis.log").exists() {
        return Err("print worker 임시 디렉터리 확인에 실패했습니다.".to_string());
    }

    let _ = std::fs::remove_file(&canonical_target);
    let _ = std::fs::remove_file(parent.join(PRINT_WORKER_CANCEL_FILE_NAME));
    std::fs::remove_dir_all(parent)
        .map_err(|error| format!("print worker 임시 디렉터리 삭제 실패: {error}"))?;
    Ok(())
}

fn parse_worker_messages(stdout_output: &str) -> Result<Vec<PrintWorkerMessage>, String> {
    let mut messages = Vec::new();
    for line in stdout_output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let message = serde_json::from_str::<PrintWorkerMessage>(trimmed)
            .map_err(|error| format!("print worker stdout parse failed: {error}; raw={trimmed}"))?;
        messages.push(message);
    }

    Ok(messages)
}

pub fn run_print_worker_echo_with_timeout(
    request: &PrintJobRequest,
    timeout: Duration,
) -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_with_timeout(request, timeout, WorkerRequestMode::Stdin)
}

#[derive(Debug, Clone, Copy)]
enum WorkerRequestMode {
    Stdin,
    Manifest,
}

fn run_print_worker_with_timeout(
    request: &PrintJobRequest,
    timeout: Duration,
    mode: WorkerRequestMode,
) -> Result<Vec<PrintWorkerMessage>, String> {
    let script_path = print_worker_script_path()?;
    if !script_path.exists() {
        return Err(format!("print worker script not found: {}", script_path.display()));
    }

    let started_at = Instant::now();
    let mut command = Command::new("node");
    configure_background_command(&mut command)
        .arg("--experimental-strip-types")
        .arg(script_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let manifest_path = match mode {
        WorkerRequestMode::Stdin => {
            command.stdin(Stdio::piped());
            None
        }
        WorkerRequestMode::Manifest => {
            command.stdin(Stdio::null());
            let manifest_path = write_print_job_manifest(request)?;
            command.arg(&manifest_path);
            Some(manifest_path)
        }
    };

    let mut child = command
        .spawn()
        .map_err(|error| format!("print worker spawn failed: {error}"))?;

    if matches!(mode, WorkerRequestMode::Stdin) {
        let payload = serde_json::to_string(request)
            .map_err(|error| format!("print worker request serialize failed: {error}"))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(payload.as_bytes())
                .and_then(|_| stdin.write_all(b"\n"))
                .map_err(|error| format!("print worker stdin write failed: {error}"))?;
        }
    }
    let status = loop {
        match child
            .try_wait()
            .map_err(|error| format!("print worker try_wait failed: {error}"))?
        {
            Some(status) => break status,
            None => {
                if started_at.elapsed() >= timeout {
                    child
                        .kill()
                        .map_err(|error| format!("print worker kill failed: {error}"))?;
                    let _ = child.wait();
                    if let Some(path) = &manifest_path {
                        let _ = std::fs::remove_file(path);
                    }
                    return Err(format!(
                        "print worker timed out after {}ms and was terminated",
                        timeout.as_millis()
                    ));
                }
                thread::sleep(Duration::from_millis(10));
            }
        }
    };

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "print worker stdout pipe is missing".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "print worker stderr pipe is missing".to_string())?;

    let mut stdout_output = String::new();
    BufReader::new(stdout)
        .read_to_string(&mut stdout_output)
        .map_err(|error| format!("print worker stdout read failed: {error}"))?;

    let mut stderr_output = String::new();
    BufReader::new(stderr)
        .read_to_string(&mut stderr_output)
        .map_err(|error| format!("print worker stderr read failed: {error}"))?;

    if !status.success() {
        if let Some(path) = &manifest_path {
            let _ = std::fs::remove_file(path);
        }
        return Err(format!(
            "print worker exited with status {:?} after {}ms{}",
            status.code(),
            started_at.elapsed().as_millis(),
            if stderr_output.is_empty() {
                String::new()
            } else {
                format!(": {stderr_output}")
            }
        ));
    }

    let messages = parse_worker_messages(&stdout_output);
    if let Some(path) = &manifest_path {
        let _ = std::fs::remove_file(path);
    }
    messages
}

pub fn run_print_worker_echo(request: &PrintJobRequest) -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_echo_with_timeout(request, Duration::from_secs(5))
}

pub fn run_print_worker_manifest_echo(
    request: &PrintJobRequest,
) -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_with_timeout(request, Duration::from_secs(5), WorkerRequestMode::Manifest)
}

pub fn run_print_worker_runtime_probe() -> Result<Vec<PrintWorkerMessage>, String> {
    let script_path = print_worker_script_path()?;
    if !script_path.exists() {
        return Err(format!("print worker script not found: {}", script_path.display()));
    }

    let started_at = Instant::now();
    let mut command = Command::new("node");
    let mut child = configure_background_command(&mut command)
        .arg("--experimental-strip-types")
        .arg(script_path)
        .arg("--probe-browser")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("print worker probe spawn failed: {error}"))?;

    let status = child
        .wait()
        .map_err(|error| format!("print worker probe wait failed: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "print worker probe stdout pipe is missing".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "print worker probe stderr pipe is missing".to_string())?;

    let mut stdout_output = String::new();
    BufReader::new(stdout)
        .read_to_string(&mut stdout_output)
        .map_err(|error| format!("print worker probe stdout read failed: {error}"))?;

    let mut stderr_output = String::new();
    BufReader::new(stderr)
        .read_to_string(&mut stderr_output)
        .map_err(|error| format!("print worker probe stderr read failed: {error}"))?;

    if !status.success() {
        return Err(format!(
            "print worker probe exited with status {:?} after {}ms{}",
            status.code(),
            started_at.elapsed().as_millis(),
            if stderr_output.is_empty() {
                String::new()
            } else {
                format!(": {stderr_output}")
            }
        ));
    }

    parse_worker_messages(&stdout_output)
}

pub fn run_print_worker_pdf_export(
    request: &PrintJobRequest,
    timeout: Duration,
) -> Result<Vec<PrintWorkerMessage>, String> {
    let started_at = Instant::now();
    let script_path = print_worker_script_path()?;
    if !script_path.exists() {
        return Err(format!("print worker script not found: {}", script_path.display()));
    }

    let manifest_started_at = Instant::now();
    let manifest_path = write_print_job_manifest(request)?;
    eprintln!(
        "[print-pdf-analysis] rust run_print_worker_pdf_export manifest_ready job_id={} pages={} manifest_ms={}",
        request.job_id,
        request.page_count,
        manifest_started_at.elapsed().as_millis()
    );

    let spawn_started_at = Instant::now();
    let mut command = Command::new("node");
    let mut child = configure_background_command(&mut command)
        .arg("--experimental-strip-types")
        .arg(script_path)
        .arg("--generate-pdf")
        .arg(&manifest_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("print worker pdf spawn failed: {error}"))?;
    eprintln!(
        "[print-pdf-analysis] rust run_print_worker_pdf_export worker_spawned job_id={} spawn_ms={}",
        request.job_id,
        spawn_started_at.elapsed().as_millis()
    );

    let wait_started_at = Instant::now();
    let cancel_path = print_worker_cancel_path(&request.job_id)?;
    let status = loop {
        match child
            .try_wait()
            .map_err(|error| format!("print worker pdf try_wait failed: {error}"))?
        {
            Some(status) => break status,
            None => {
                if cancel_path.exists() {
                    child
                        .kill()
                        .map_err(|error| format!("print worker pdf cancel kill failed: {error}"))?;
                    let _ = child.wait();
                    let _ = std::fs::remove_file(&manifest_path);
                    return Err("PDF 생성이 취소되었습니다.".to_string());
                }
                if started_at.elapsed() >= timeout {
                    child
                        .kill()
                        .map_err(|error| format!("print worker pdf kill failed: {error}"))?;
                    let _ = child.wait();
                    let _ = std::fs::remove_file(&manifest_path);
                    return Err(format!(
                        "print worker pdf timed out after {}ms and was terminated",
                        timeout.as_millis()
                    ));
                }
                thread::sleep(Duration::from_millis(10));
            }
        }
    };
    eprintln!(
        "[print-pdf-analysis] rust run_print_worker_pdf_export worker_finished job_id={} wait_ms={} total_elapsed_ms={}",
        request.job_id,
        wait_started_at.elapsed().as_millis(),
        started_at.elapsed().as_millis()
    );

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "print worker pdf stdout pipe is missing".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "print worker pdf stderr pipe is missing".to_string())?;

    let stdout_read_started_at = Instant::now();
    let mut stdout_output = String::new();
    BufReader::new(stdout)
        .read_to_string(&mut stdout_output)
        .map_err(|error| format!("print worker pdf stdout read failed: {error}"))?;
    let stdout_read_elapsed_ms = stdout_read_started_at.elapsed().as_millis();

    let stderr_read_started_at = Instant::now();
    let mut stderr_output = String::new();
    BufReader::new(stderr)
        .read_to_string(&mut stderr_output)
        .map_err(|error| format!("print worker pdf stderr read failed: {error}"))?;
    let stderr_read_elapsed_ms = stderr_read_started_at.elapsed().as_millis();
    eprintln!(
        "[print-pdf-analysis] rust run_print_worker_pdf_export output_read job_id={} stdout_bytes={} stderr_bytes={} stdout_read_ms={} stderr_read_ms={} total_elapsed_ms={}",
        request.job_id,
        stdout_output.len(),
        stderr_output.len(),
        stdout_read_elapsed_ms,
        stderr_read_elapsed_ms,
        started_at.elapsed().as_millis()
    );

    let _ = std::fs::remove_file(&manifest_path);

    if !status.success() {
        return Err(format!(
            "print worker pdf exited with status {:?} after {}ms{}",
            status.code(),
            started_at.elapsed().as_millis(),
            if stderr_output.is_empty() {
                String::new()
            } else {
                format!(": {stderr_output}")
            }
        ));
    }

    let messages = parse_worker_messages(&stdout_output)?;
    eprintln!(
        "[print-pdf-analysis] rust run_print_worker_pdf_export parsed_messages job_id={} message_count={} total_elapsed_ms={}",
        request.job_id,
        messages.len(),
        started_at.elapsed().as_millis()
    );
    if let Some(PrintWorkerMessage::Result { result }) = messages.last() {
        if result.ok {
            if let Some(output_pdf_path) = &result.output_pdf_path {
                if !PathBuf::from(output_pdf_path).exists() {
                    return Err(format!(
                        "print worker pdf reported success but output file is missing: {output_pdf_path}"
                    ));
                }
            } else {
                return Err("print worker pdf reported success without output path".to_string());
            }
        }
    }

    Ok(messages)
}

#[tauri::command]
pub fn debug_run_print_worker_echo() -> Result<Vec<PrintWorkerMessage>, String> {
    let request = create_debug_print_job_request("debug-print-worker-echo", 12, None)?;
    run_print_worker_echo(&request)
}

#[tauri::command]
pub fn debug_run_print_worker_timeout_echo() -> Result<Vec<PrintWorkerMessage>, String> {
    let request =
        create_debug_print_job_request("debug-print-worker-timeout-echo", 12, Some(250))?;
    run_print_worker_echo_with_timeout(&request, Duration::from_millis(100))
}

#[tauri::command]
pub fn debug_run_print_worker_manifest_echo() -> Result<Vec<PrintWorkerMessage>, String> {
    let request = create_debug_print_job_request("debug-print-worker-manifest-echo", 12, None)?;
    run_print_worker_manifest_echo(&request)
}

#[tauri::command]
pub fn debug_probe_print_worker_runtime() -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_runtime_probe()
}

#[tauri::command]
pub async fn debug_run_print_worker_pdf_export() -> Result<Vec<PrintWorkerMessage>, String> {
    let request = create_debug_print_job_request("debug-print-worker-pdf-export", 3, None)?;
    tauri::async_runtime::spawn_blocking(move || {
        run_print_worker_pdf_export(&request, Duration::from_secs(20))
    })
    .await
    .map_err(|error| format!("print worker pdf task join failed: {error}"))?
}

#[tauri::command]
pub async fn debug_run_print_worker_pdf_export_for_current_doc(
    payload: FrontendPdfExportRequest,
) -> Result<Vec<PrintWorkerMessage>, String> {
    let page_count = payload.svg_pages.len() as u32;
    let timeout = pdf_export_timeout_for_page_count(page_count);
    let request = create_print_job_request_from_svg_pages(
        &payload.job_id,
        &payload.source_file_name,
        page_count,
        payload.width_px,
        payload.height_px,
        payload.batch_size,
        &payload.svg_pages,
    )?;

    tauri::async_runtime::spawn_blocking(move || run_print_worker_pdf_export(&request, timeout))
        .await
        .map_err(|error| format!("print worker pdf task join failed: {error}"))?
}

#[tauri::command]
pub fn debug_read_generated_pdf(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|error| format!("generated pdf read failed ({path}): {error}"))
}

#[tauri::command]
pub fn cleanup_print_worker_temp_output_path(path: String) -> Result<(), String> {
    cleanup_print_worker_temp_output_path_inner(Path::new(&path))
}

#[tauri::command]
pub fn debug_read_print_worker_analysis_log(job_id: String) -> Result<String, String> {
    let log_path = print_worker_temp_dir(&job_id)?.join("print-worker-analysis.log");
    if !log_path.exists() {
        return Ok(String::new());
    }

    std::fs::read_to_string(&log_path)
        .map_err(|error| format!("print worker analysis log read failed: {error}"))
}

#[tauri::command]
pub fn debug_cancel_print_worker_pdf_export(job_id: String) -> Result<(), String> {
    let temp_dir = print_worker_temp_dir(&job_id)?;
    std::fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("print worker cancel dir create failed: {error}"))?;
    std::fs::write(
        temp_dir.join(PRINT_WORKER_CANCEL_FILE_NAME),
        format!("cancelled_at={:?}\n", std::time::SystemTime::now()),
    )
    .map_err(|error| format!("print worker cancel request write failed: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn debug_open_generated_pdf(path: String) -> Result<(), String> {
    let pdf_path = PathBuf::from(&path);
    if !pdf_path.exists() {
        return Err(format!("generated pdf file not found: {path}"));
    }

    Command::new("explorer.exe")
        .arg(&pdf_path)
        .spawn()
        .map_err(|error| format!("generated pdf open failed ({path}): {error}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn echo_worker_returns_progress_and_result_messages() {
        let request =
            create_debug_print_job_request("unit-test-job", 10, None).expect("debug request");

        let messages = run_print_worker_echo(&request).expect("echo worker should respond");
        assert!(messages.len() >= 2);
        assert!(matches!(messages.first(), Some(PrintWorkerMessage::Progress { .. })));
        assert!(matches!(messages.last(), Some(PrintWorkerMessage::Result { .. })));
    }

    #[test]
    fn echo_worker_times_out_and_reports_termination() {
        let request = create_debug_print_job_request("unit-test-timeout-job", 10, Some(250))
            .expect("debug timeout request");

        let error = run_print_worker_echo_with_timeout(&request, Duration::from_millis(100))
            .expect_err("echo worker should time out");
        assert!(error.contains("timed out"));
    }

    #[test]
    fn echo_worker_reads_request_from_manifest_file() {
        let request = create_debug_print_job_request("unit-test-manifest-job", 10, None)
            .expect("debug manifest request");

        let messages =
            run_print_worker_manifest_echo(&request).expect("manifest echo worker should respond");
        assert!(messages.len() >= 2);
        assert!(matches!(messages.first(), Some(PrintWorkerMessage::Progress { .. })));
        assert!(matches!(messages.last(), Some(PrintWorkerMessage::Result { .. })));
    }

    #[test]
    fn probe_worker_returns_progress_and_result_messages() {
        let messages = run_print_worker_runtime_probe().expect("probe worker should respond");
        assert!(messages.len() >= 2);
        assert!(matches!(messages.first(), Some(PrintWorkerMessage::Progress { .. })));
        assert!(matches!(messages.last(), Some(PrintWorkerMessage::Result { .. })));
    }

    #[test]
    fn cleanup_print_worker_temp_output_path_removes_worker_temp_dir() {
        let temp_dir = std::env::temp_dir().join(format!(
            "current-doc-pdf-unit-test-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp_dir);
        std::fs::create_dir_all(&temp_dir).expect("create temp dir");
        let output_path = temp_dir.join("output.pdf");
        std::fs::write(&output_path, b"%PDF-test").expect("write output pdf");
        std::fs::write(temp_dir.join("print-worker-analysis.log"), b"log").expect("write log");

        cleanup_print_worker_temp_output_path_inner(&output_path).expect("cleanup should succeed");

        assert!(!temp_dir.exists());
    }

    #[test]
    fn cleanup_print_worker_temp_output_path_rejects_non_temp_path() {
        let outside_path = workspace_root()
            .expect("workspace root")
            .join("do-not-delete-output.pdf");
        std::fs::write(&outside_path, b"%PDF-test").expect("write outside file");

        let error = cleanup_print_worker_temp_output_path_inner(&outside_path)
            .expect_err("cleanup should reject non-temp path");
        assert!(error.contains("허용되지 않은"));

        let _ = std::fs::remove_file(&outside_path);
    }
}
