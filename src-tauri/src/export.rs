//! Guarda un texto (los CSV de "Export data") en la ruta que el usuario eligió en el cuadro de guardar.
//! Va en Rust para no depender de los permisos de archivos del lado web.

use std::fs;

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|error| format!("Could not write {path}: {error}"))
}
