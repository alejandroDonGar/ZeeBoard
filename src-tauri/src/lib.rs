#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Cada plugin se registra una sola vez
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build()) // SQLite local
        .plugin(tauri_plugin_fs::init()) // imágenes en AppData
        .plugin(tauri_plugin_dialog::init()) // selector de carpetas para las copias de seguridad
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
