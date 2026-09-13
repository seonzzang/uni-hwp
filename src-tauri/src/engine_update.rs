use serde::Serialize;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use tauri::Emitter;

const UPSTREAM_REPOSITORY: &str = "https://api.github.com/repos/edwardkim/rhwp/releases/latest";

#[derive(Debug, Serialize)]
pub struct EngineReleaseInfo {
    pub repository: String,
    pub tag: String,
    pub commit_hint: String,
    pub installed_tag: Option<String>,
    pub product_version: String,
    pub installed_product_version: Option<String>,
    pub is_newer: bool,
}

#[derive(Debug, Serialize)]
pub struct InstalledEngineInfo {
    pub engine_version: Option<String>,
    pub product_version: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct GitHubRelease {
    tag_name: Option<String>,
    target_commitish: Option<String>,
    draft: Option<bool>,
    prerelease: Option<bool>,
}

#[tauri::command]
pub fn check_latest_engine_release(current_tag: Option<String>) -> Result<EngineReleaseInfo, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("Uni-HWP-engine-updater")
        .build()
        .map_err(|error| format!("GitHub 클라이언트를 만들 수 없습니다: {error}"))?;
    let response = client
        .get(UPSTREAM_REPOSITORY)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|error| format!("RHWP 최신 릴리스 조회에 실패했습니다: {error}"))?
        .error_for_status()
        .map_err(|error| format!("RHWP 릴리스 서버 응답 오류: {error}"))?;
    let release = serde_json::from_str::<GitHubRelease>(&response.text().map_err(|error| format!("RHWP 릴리스 응답을 읽을 수 없습니다: {error}"))?)
        .map_err(|error| format!("RHWP 릴리스 응답을 해석할 수 없습니다: {error}"))?;

    if release.draft.unwrap_or(false) || release.prerelease.unwrap_or(false) {
        return Err("최신 릴리스가 안정 버전이 아닙니다.".to_string());
    }
    let tag = release
        .tag_name
        .filter(|value| value.starts_with('v'))
        .ok_or_else(|| "RHWP 릴리스 버전 태그가 없습니다.".to_string())?;

    let installed_tag = installed_engine_tag(current_tag);
    let installed_product_version = installed_tag.as_deref().and_then(product_version_for_engine_tag);
    let product_version = product_version_for_engine_tag(&tag)
        .ok_or_else(|| "RHWP 릴리스 버전 형식이 올바르지 않습니다.".to_string())?;
    Ok(EngineReleaseInfo {
        repository: "https://github.com/edwardkim/rhwp".to_string(),
        is_newer: installed_tag.as_deref() != Some(tag.as_str()),
        tag,
        commit_hint: release.target_commitish.unwrap_or_default(),
        installed_tag,
        product_version,
        installed_product_version,
    })
}

#[derive(Debug, Serialize)]
pub struct EngineUpdateResult {
    pub changed: bool,
    pub stage: String,
    pub message: String,
    pub candidate: Option<String>,
}

#[derive(Debug, Serialize, serde::Deserialize)]
pub struct EngineUpdateProgress {
    pub percent: u8,
    pub stage: String,
    pub message: String,
}

fn updater_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn installed_engine_tag(fallback: Option<String>) -> Option<String> {
    let current = updater_root().join("tools").join("engine-update").join("state").join("current.json");
    let from_pointer = std::fs::read_to_string(current)
        .ok()
        .and_then(|contents| serde_json::from_str::<serde_json::Value>(&contents).ok())
        .and_then(|metadata| metadata.get("upstream_tag").and_then(serde_json::Value::as_str).map(str::to_string));
    if from_pointer.is_some() {
        return from_pointer;
    }
    let package = updater_root().join("pkg").join("package.json");
    let from_installed_package = std::fs::read_to_string(package)
        .ok()
        .and_then(|contents| serde_json::from_str::<serde_json::Value>(&contents).ok())
        .and_then(|value| value.get("version").and_then(serde_json::Value::as_str).map(|version| format!("v{version}")));
    from_installed_package.or(fallback)
}

fn product_version_for_engine_tag(tag: &str) -> Option<String> {
    let mut parts = tag.strip_prefix('v')?.split('.');
    let _engine_major = parts.next()?.parse::<u64>().ok()?;
    let _engine_minor = parts.next()?.parse::<u64>().ok()?;
    let engine_patch = parts.next()?.parse::<u64>().ok()?;
    Some(format!("8.{engine_patch}.0"))
}

#[tauri::command]
pub fn get_installed_engine_release() -> InstalledEngineInfo {
    let engine_version = installed_engine_tag(None);
    let product_version = engine_version.as_deref().and_then(product_version_for_engine_tag);
    InstalledEngineInfo { engine_version, product_version }
}

#[tauri::command]
pub fn run_engine_update(app: tauri::AppHandle) -> Result<EngineUpdateResult, String> {
    let root = updater_root();
    let script = root.join("tools").join("engine-update").join("cli.py");
    if !script.is_file() {
        return Err("Uni-HWP 엔진 업데이트 도구가 배포 패키지에 포함되어 있지 않습니다.".to_string());
    }
    let mut child = Command::new("python")
        .arg(&script)
        .arg("update")
        .current_dir(&root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("엔진 업데이트 실행기를 시작할 수 없습니다: {error}"))?;
    let stdout_pipe = child.stdout.take().ok_or_else(|| "엔진 업데이트 stdout 연결에 실패했습니다".to_string())?;
    let stderr_pipe = child.stderr.take().ok_or_else(|| "엔진 업데이트 stderr 연결에 실패했습니다".to_string())?;
    let stdout_thread = thread::spawn(move || {
        let mut output = String::new();
        let mut reader = BufReader::new(stdout_pipe);
        let _ = reader.read_to_string(&mut output);
        output
    });
    let progress_app = app.clone();
    let stderr_thread = thread::spawn(move || {
        let mut messages = Vec::new();
        for line in BufReader::new(stderr_pipe).lines().map_while(Result::ok) {
            if let Ok(progress) = serde_json::from_str::<EngineUpdateProgress>(&line) {
                let _ = progress_app.emit("engine-update-progress", &progress);
            } else if !line.trim().is_empty() {
                messages.push(line);
            }
        }
        messages.join("\n")
    });
    let output = child.wait().map_err(|error| format!("엔진 업데이트가 종료되지 않았습니다: {error}"))?;
    let stdout = stdout_thread.join().unwrap_or_default().trim().to_string();
    let stderr = stderr_thread.join().unwrap_or_default().trim().to_string();
    if !output.success() {
        // Keep implementation details in the developer console only. The
        // product UI receives a plain-language recovery message.
        eprintln!("[engine-update] updater failed (code {:?}): {} {}", output.code(), stderr, stdout);
        return Ok(EngineUpdateResult {
            changed: false,
            stage: "blocked".to_string(),
            message: "업데이트를 완료하지 못했습니다. 현재 버전은 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.".to_string(),
            candidate: None,
        });
    }
    let payload: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|error| format!("엔진 업데이트 결과를 해석할 수 없습니다: {error}"))?;
    let changed = payload.get("changed").and_then(serde_json::Value::as_bool).unwrap_or(false);
    let candidate = payload.get("candidate").and_then(serde_json::Value::as_str).map(str::to_string);
    let result = EngineUpdateResult {
        changed,
        stage: if changed { "applied" } else { "current" }.to_string(),
        message: if changed { "RHWP 엔진 업데이트가 적용되었습니다." } else { "이미 최신 엔진입니다." }.to_string(),
        candidate,
    };
    Ok(result)
}
