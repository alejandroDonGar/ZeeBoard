mod images;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Cada plugin se registra una sola vez
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build()) // SQLite local
        .plugin(tauri_plugin_fs::init()) // copias de seguridad
        .plugin(tauri_plugin_dialog::init()) // selectores de archivos y carpetas
        .invoke_handler(tauri::generate_handler![
            images::import_image_from_path,
            images::import_image_from_bytes,
            images::delete_image_files,
            images::cleanup_orphan_images,
            images::storage_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
