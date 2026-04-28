use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintPageSize {
    pub width_px: u32,
    pub height_px: u32,
    pub dpi: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PrintJobRange {
    All,
    CurrentPage { current_page: u32 },
    PageRange { start_page: u32, end_page: u32 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintJobRequest {
    pub job_id: String,
    pub source_file_name: String,
    pub output_mode: String,
    pub page_range: PrintJobRange,
    pub batch_size: u32,
    pub temp_dir: String,
    pub output_pdf_path: String,
    pub page_count: u32,
    pub page_size: PrintPageSize,
    pub svg_page_paths: Vec<String>,
    pub debug_delay_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintJobProgress {
    pub job_id: String,
    pub phase: String,
    pub completed_pages: u32,
    pub total_pages: u32,
    pub batch_index: Option<u32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintJobResult {
    pub job_id: String,
    pub ok: bool,
    pub output_pdf_path: Option<String>,
    pub duration_ms: u64,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PrintWorkerMessage {
    Progress { progress: PrintJobProgress },
    Result { result: PrintJobResult },
}

pub fn create_debug_print_job_request(
    job_id: &str,
    page_count: u32,
    debug_delay_ms: Option<u64>,
) -> Result<PrintJobRequest, String> {
    let temp_dir = std::env::temp_dir().join(job_id);
    fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("print worker temp dir create failed: {error}"))?;

    let svg_page_paths = create_debug_svg_pages(&temp_dir, page_count.min(3))?;

    Ok(PrintJobRequest {
        job_id: job_id.to_string(),
        source_file_name: "sample.hwp".to_string(),
        output_mode: "preview".to_string(),
        page_range: PrintJobRange::All,
        batch_size: 5,
        temp_dir: temp_dir.display().to_string(),
        output_pdf_path: temp_dir.join("sample.pdf").display().to_string(),
        page_count,
        page_size: PrintPageSize {
            width_px: 794,
            height_px: 1123,
            dpi: 96,
        },
        svg_page_paths: svg_page_paths
            .into_iter()
            .map(|path| path.display().to_string())
            .collect(),
        debug_delay_ms,
    })
}

pub fn create_print_job_request_from_svg_pages(
    job_id: &str,
    source_file_name: &str,
    page_count: u32,
    width_px: u32,
    height_px: u32,
    batch_size: Option<u32>,
    svg_pages: &[String],
) -> Result<PrintJobRequest, String> {
    let started_at = Instant::now();
    let temp_dir = std::env::temp_dir().join(job_id);
    fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("print worker temp dir create failed: {error}"))?;

    let svg_write_started_at = Instant::now();
    let svg_page_paths = write_svg_pages(&temp_dir, svg_pages)?;
    let svg_write_elapsed_ms = svg_write_started_at.elapsed().as_millis();
    let total_svg_chars: usize = svg_pages.iter().map(|svg| svg.len()).sum();
    eprintln!(
        "[print-pdf-analysis] rust create_print_job_request_from_svg_pages job_id={} pages={} svg_chars={} svg_write_ms={} total_request_prep_ms={}",
        job_id,
        page_count,
        total_svg_chars,
        svg_write_elapsed_ms,
        started_at.elapsed().as_millis()
    );

    Ok(PrintJobRequest {
        job_id: job_id.to_string(),
        source_file_name: source_file_name.to_string(),
        output_mode: "preview".to_string(),
        page_range: PrintJobRange::All,
        batch_size: batch_size.unwrap_or(5).max(1),
        temp_dir: temp_dir.display().to_string(),
        output_pdf_path: temp_dir.join("output.pdf").display().to_string(),
        page_count,
        page_size: PrintPageSize {
            width_px,
            height_px,
            dpi: 96,
        },
        svg_page_paths: svg_page_paths
            .into_iter()
            .map(|path| path.display().to_string())
            .collect(),
        debug_delay_ms: None,
    })
}

pub fn write_print_job_manifest(request: &PrintJobRequest) -> Result<PathBuf, String> {
    let started_at = Instant::now();
    let manifest_path = PathBuf::from(&request.temp_dir).join("print-job.json");
    let payload = serde_json::to_string_pretty(request)
        .map_err(|error| format!("print job manifest serialize failed: {error}"))?;

    fs::write(&manifest_path, &payload)
        .map_err(|error| format!("print job manifest write failed: {error}"))?;

    eprintln!(
        "[print-pdf-analysis] rust write_print_job_manifest job_id={} payload_bytes={} manifest_write_ms={}",
        request.job_id,
        payload.len(),
        started_at.elapsed().as_millis()
    );

    Ok(manifest_path)
}

fn create_debug_svg_pages(temp_dir: &PathBuf, count: u32) -> Result<Vec<PathBuf>, String> {
    let svg_pages = (0..count)
        .map(|index| {
            format!(
                r##"<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
  <rect x="0" y="0" width="794" height="1123" fill="white" stroke="#d5d5d5" />
  <text x="48" y="96" font-size="28" font-family="Malgun Gothic, sans-serif" fill="#1f2937">Debug Print Page {}</text>
  <text x="48" y="144" font-size="18" font-family="Malgun Gothic, sans-serif" fill="#4b5563">Temporary SVG asset for worker IPC pipeline verification.</text>
</svg>"##,
                index + 1
            )
        })
        .collect::<Vec<_>>();

    write_svg_pages(temp_dir, &svg_pages)
}

fn write_svg_pages(temp_dir: &PathBuf, svg_pages: &[String]) -> Result<Vec<PathBuf>, String> {
    let mut svg_paths = Vec::new();

    for (index, svg) in svg_pages.iter().enumerate() {
        let path = temp_dir.join(format!("page-{}.svg", index + 1));
        fs::write(&path, svg)
            .map_err(|error| format!("debug svg write failed ({}): {error}", path.display()))?;
        svg_paths.push(path);
    }

    Ok(svg_paths)
}
