//! Saves text (the "Export data" CSVs) to the path the user chose in the save dialog.
//! Lives in Rust so it doesn't depend on web-side file permissions.

use std::fs;

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|error| format!("Could not write {path}: {error}"))
}

/// Reads a text file (the responses CSV the Drive script leaves).
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("Could not read {path}: {error}"))
}
