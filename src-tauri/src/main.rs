#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod print_worker;
mod print_job;
mod remote_hwp;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            print_worker::debug_run_print_worker_echo,
            print_worker::debug_run_print_worker_timeout_echo,
            print_worker::debug_run_print_worker_manifest_echo,
            print_worker::debug_probe_print_worker_runtime,
            print_worker::debug_run_print_worker_pdf_export,
            print_worker::debug_run_print_worker_pdf_export_for_current_doc,
            print_worker::debug_read_generated_pdf,
            print_worker::cleanup_print_worker_temp_output_path,
            print_worker::debug_read_print_worker_analysis_log,
            print_worker::debug_cancel_print_worker_pdf_export,
            print_worker::debug_open_generated_pdf,
            remote_hwp::resolve_remote_hwp_url,
            remote_hwp::cleanup_remote_hwp_temp_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
