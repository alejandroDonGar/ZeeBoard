//! Guarda un texto (los CSV de "Export data") en la ruta que el usuario eligió en el cuadro de guardar.
//! Va en Rust para no depender de los permisos de archivos del lado web.

use std::fs;

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|error| format!("Could not write {path}: {error}"))
}

/// Lee un archivo de texto (el CSV de respuestas que deja el script de Drive).
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("Could not read {path}: {error}"))
}
