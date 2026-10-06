//! Restaurar una copia de seguridad hecha con "Export backup":
//! una carpeta con `zeeboard.db` e `images/` (y `images/thumbs/`).
//!
//! El frontend cierra antes la base de datos (Windows no deja reemplazar un archivo abierto)
//! y recarga la app después; al arrancar, las migraciones ponen al día los backups antiguos.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const DB_FILE: &str = "zeeboard.db";

fn is_sqlite_file(path: &Path) -> bool {
    let mut header = [0u8; 16];
    fs::File::open(path)
        .and_then(|mut file| std::io::Read::read_exact(&mut file, &mut header))
        .map(|_| &header == b"SQLite format 3\0")
        .unwrap_or(false)
}

/// Copia los archivos de `from` a `to` que aún no existen allí. Las imágenes se nombran por su
/// contenido, así que un nombre repetido es la misma imagen: nunca se sobrescribe ni se borra nada.
fn copy_missing_files(from: &Path, to: &Path) -> Result<u32, String> {
    let Ok(entries) = fs::read_dir(from) else {
        return Ok(0);
    };

    fs::create_dir_all(to).map_err(|error| error.to_string())?;
    let mut copied = 0;

    for entry in entries.flatten() {
        let target = to.join(entry.file_name());

        if entry.path().is_file() && !target.exists() {
            fs::copy(entry.path(), &target).map_err(|error| error.to_string())?;
            copied += 1;
        }
    }

    Ok(copied)
}

/// Devuelve la carpeta donde quedó la copia de seguridad de los datos que había antes.
fn restore(backup_dir: &Path, data_dir: &Path, stamp: &str) -> Result<PathBuf, String> {
    let backup_db = backup_dir.join(DB_FILE);

    if !is_sqlite_file(&backup_db) {
        return Err(format!(
            "{} doesn't look like a ZeeBoard backup (no valid {DB_FILE} inside)",
            backup_dir.display()
        ));
    }

    // 1. Copia de seguridad de lo que hay ahora, por si el backup no era el que querías
    let safety_dir = data_dir.join("before-restore").join(stamp);
    fs::create_dir_all(&safety_dir).map_err(|error| error.to_string())?;

    for name in [DB_FILE, "zeeboard.db-wal", "zeeboard.db-shm", "zeeboard.db-journal"] {
        let current = data_dir.join(name);

        if current.exists() {
            fs::copy(&current, safety_dir.join(name)).map_err(|error| error.to_string())?;
        }
    }

    // 2. Restos del diario de la base de datos actual: aplicados sobre la restaurada la corromperían
    for name in ["zeeboard.db-wal", "zeeboard.db-shm", "zeeboard.db-journal"] {
        let _ = fs::remove_file(data_dir.join(name));
    }

    // 3. Base de datos e imágenes del backup
    fs::copy(&backup_db, data_dir.join(DB_FILE)).map_err(|error| error.to_string())?;
    copy_missing_files(&backup_dir.join("images"), &data_dir.join("images"))?;
    copy_missing_files(&backup_dir.join("images").join("thumbs"), &data_dir.join("images").join("thumbs"))?;

    Ok(safety_dir)
}

#[tauri::command]
pub fn restore_backup(app: AppHandle, backup_dir: String, stamp: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;

    restore(Path::new(&backup_dir), &data_dir, &stamp).map(|path| path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("zeeboard-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn restores_database_and_merges_images_keeping_a_safety_copy() {
        let backup = temp_dir("backup");
        let data = temp_dir("data");

        fs::write(backup.join(DB_FILE), b"SQLite format 3\0backup").unwrap();
        fs::create_dir_all(backup.join("images/thumbs")).unwrap();
        fs::write(backup.join("images/old.webp"), b"old").unwrap();
        fs::write(backup.join("images/thumbs/old.webp"), b"old thumb").unwrap();

        fs::write(data.join(DB_FILE), b"SQLite format 3\0current").unwrap();
        fs::write(data.join("zeeboard.db-wal"), b"stale").unwrap();
        fs::create_dir_all(data.join("images")).unwrap();
        fs::write(data.join("images/new.webp"), b"new").unwrap();

        let safety = restore(&backup, &data, "test").unwrap();

        assert_eq!(fs::read(data.join(DB_FILE)).unwrap(), b"SQLite format 3\0backup");
        assert!(!data.join("zeeboard.db-wal").exists());
        assert!(data.join("images/old.webp").exists());
        assert!(data.join("images/thumbs/old.webp").exists());
        assert!(data.join("images/new.webp").exists(), "current images are never deleted");
        assert_eq!(fs::read(safety.join(DB_FILE)).unwrap(), b"SQLite format 3\0current");
        assert_eq!(fs::read(safety.join("zeeboard.db-wal")).unwrap(), b"stale");
    }

    #[test]
    fn refuses_a_folder_without_a_database() {
        let backup = temp_dir("empty");
        let data = temp_dir("data-untouched");
        fs::write(data.join(DB_FILE), b"SQLite format 3\0current").unwrap();

        assert!(restore(&backup, &data, "test").is_err());
        assert_eq!(fs::read(data.join(DB_FILE)).unwrap(), b"SQLite format 3\0current");
        assert!(!data.join("before-restore").exists(), "nothing is touched when the backup is invalid");
    }
}
