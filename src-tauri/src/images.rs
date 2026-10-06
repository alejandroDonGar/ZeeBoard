//! Procesado y almacenamiento de imágenes.
//!
//! Los lienzos originales pueden pesar 40–70 MB. La app solo guarda dos copias ligeras:
//! - una versión para ver, de como mucho `VIEW_MAX_SIDE` px de lado, en WebP;
//! - una miniatura de `THUMB_MAX_SIDE` px para tarjetas, listas y carruseles.
//!
//! Los archivos se nombran con el hash del original: importar dos veces la misma imagen
//! reutiliza los archivos que ya existen.

use std::fs;
use std::io::Cursor;
use std::path::{Component, Path, PathBuf};

use fast_image_resize::images::{Image as ResizedImage, ImageRef};
use fast_image_resize::{FilterType, PixelType, ResizeAlg, ResizeOptions, Resizer};
use image::{DynamicImage, ImageDecoder, ImageReader, Limits, RgbaImage};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

const VIEW_MAX_SIDE: u32 = 2560;
const THUMB_MAX_SIDE: u32 = 480;
const VIEW_QUALITY: f32 = 82.0;
const THUMB_QUALITY: f32 = 72.0;

const IMAGES_DIR: &str = "images";
const THUMBS_DIR: &str = "images/thumbs";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredImage {
    /// Ruta relativa a la carpeta de datos de la app, p. ej. `images/ab12….webp`
    path: String,
    thumb_path: String,
    width: u32,
    height: u32,
    /// Tamaño en bytes de la versión para ver
    bytes: u64,
    /// `true` si la imagen ya existía y no hubo que procesarla
    reused: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    image_count: u32,
    images_bytes: u64,
    thumbs_bytes: u64,
    database_bytes: u64,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

/// Lee la imagen con su orientación correcta (fotos de móvil) y sin límite de tamaño.
fn decode(bytes: &[u8]) -> Result<RgbaImage, String> {
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| format!("No se pudo leer la imagen: {error}"))?;
    reader.limits(Limits::no_limits());

    let mut decoder = reader
        .into_decoder()
        .map_err(|error| format!("Formato de imagen no compatible: {error}"))?;
    let orientation = decoder.orientation().ok();

    let mut image = DynamicImage::from_decoder(decoder)
        .map_err(|error| format!("No se pudo decodificar la imagen: {error}"))?;
    if let Some(orientation) = orientation {
        image.apply_orientation(orientation);
    }

    Ok(image.into_rgba8())
}

/// Reduce la imagen para que su lado mayor no pase de `max_side`. Nunca la amplía.
fn shrink(source: &RgbaImage, max_side: u32) -> Result<RgbaImage, String> {
    let (width, height) = source.dimensions();
    let longest = width.max(height);

    if longest <= max_side {
        return Ok(source.clone());
    }

    let scale = max_side as f64 / longest as f64;
    let new_width = ((width as f64 * scale).round() as u32).max(1);
    let new_height = ((height as f64 * scale).round() as u32).max(1);

    let source_ref = ImageRef::new(width, height, source.as_raw(), PixelType::U8x4)
        .map_err(|error| error.to_string())?;
    let mut target = ResizedImage::new(new_width, new_height, PixelType::U8x4);

    Resizer::new()
        .resize(
            &source_ref,
            &mut target,
            &ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FilterType::Lanczos3)),
        )
        .map_err(|error| error.to_string())?;

    RgbaImage::from_raw(new_width, new_height, target.into_vec())
        .ok_or_else(|| "No se pudo crear la imagen reducida".to_string())
}

fn encode_webp(image: &RgbaImage, quality: f32) -> Vec<u8> {
    let (width, height) = image.dimensions();
    webp::Encoder::from_rgba(image.as_raw(), width, height)
        .encode(quality)
        .to_vec()
}

/// Escribe primero en un archivo temporal y luego lo renombra:
/// así nunca queda una imagen a medias si la app se cierra durante la escritura.
fn write_atomically(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

fn process(base_dir: &Path, original: &[u8]) -> Result<StoredImage, String> {
    let hash = Sha256::digest(original);
    let name: String = hash.iter().take(12).map(|byte| format!("{byte:02x}")).collect();

    let path = format!("{IMAGES_DIR}/{name}.webp");
    let thumb_path = format!("{THUMBS_DIR}/{name}.webp");
    let full_path = base_dir.join(&path);
    let full_thumb_path = base_dir.join(&thumb_path);

    fs::create_dir_all(base_dir.join(THUMBS_DIR)).map_err(|error| error.to_string())?;

    // La misma imagen ya se importó antes: se reutilizan sus archivos
    if full_path.exists() && full_thumb_path.exists() {
        let (width, height) =
            image::image_dimensions(&full_path).map_err(|error| error.to_string())?;
        let bytes = fs::metadata(&full_path).map_err(|error| error.to_string())?.len();
        return Ok(StoredImage { path, thumb_path, width, height, bytes, reused: true });
    }

    let decoded = decode(original)?;
    let view = shrink(&decoded, VIEW_MAX_SIDE)?;
    drop(decoded); // libera la memoria del lienzo completo cuanto antes
    let thumb = shrink(&view, THUMB_MAX_SIDE)?;

    let view_bytes = encode_webp(&view, VIEW_QUALITY);
    write_atomically(&full_path, &view_bytes)?;
    write_atomically(&full_thumb_path, &encode_webp(&thumb, THUMB_QUALITY))?;

    let (width, height) = view.dimensions();
    Ok(StoredImage {
        path,
        thumb_path,
        width,
        height,
        bytes: view_bytes.len() as u64,
        reused: false,
    })
}

/// Solo se aceptan rutas relativas dentro de `images/`: nunca se borra nada fuera de ahí.
fn safe_image_path(base_dir: &Path, relative: &str) -> Option<PathBuf> {
    let relative_path = Path::new(relative);
    let inside_images = relative.starts_with(&format!("{IMAGES_DIR}/"));
    let only_normal_parts = relative_path
        .components()
        .all(|component| matches!(component, Component::Normal(_)));

    (inside_images && only_normal_parts).then(|| base_dir.join(relative_path))
}

fn folder_size(folder: &Path) -> (u32, u64) {
    let Ok(entries) = fs::read_dir(folder) else {
        return (0, 0);
    };

    entries
        .flatten()
        .filter_map(|entry| entry.metadata().ok().filter(|metadata| metadata.is_file()))
        .fold((0, 0), |(count, total), metadata| (count + 1, total + metadata.len()))
}

/// Importa una imagen desde un archivo del disco (selector, arrastrar y soltar, migración).
#[tauri::command]
pub async fn import_image_from_path(app: AppHandle, path: String) -> Result<StoredImage, String> {
    let base_dir = data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        let original = fs::read(&path).map_err(|error| format!("No se pudo abrir {path}: {error}"))?;
        process(&base_dir, &original)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Importa una imagen recibida como bytes (pegar desde el portapapeles).
/// Los bytes llegan en binario, sin pasar por JSON ni base64.
#[tauri::command]
pub async fn import_image_from_bytes(
    app: AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<StoredImage, String> {
    let tauri::ipc::InvokeBody::Raw(original) = request.body() else {
        return Err("Se esperaban los bytes de la imagen".to_string());
    };
    let original = original.clone();
    let base_dir = data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || process(&base_dir, &original))
        .await
        .map_err(|error| error.to_string())?
}

/// Borra archivos de imagen (versión para ver y miniatura).
#[tauri::command]
pub fn delete_image_files(app: AppHandle, paths: Vec<String>) -> Result<u32, String> {
    let base_dir = data_dir(&app)?;
    let mut deleted = 0;

    for path in paths.iter().filter_map(|relative| safe_image_path(&base_dir, relative)) {
        if fs::remove_file(&path).is_ok() {
            deleted += 1;
        }
    }

    Ok(deleted)
}

/// Borra las imágenes y miniaturas que no aparecen en `used_paths`.
#[tauri::command]
pub fn cleanup_orphan_images(app: AppHandle, used_paths: Vec<String>) -> Result<u32, String> {
    let base_dir = data_dir(&app)?;
    let used: std::collections::HashSet<String> = used_paths.into_iter().collect();
    let mut deleted = 0;

    for folder in [IMAGES_DIR, THUMBS_DIR] {
        let Ok(entries) = fs::read_dir(base_dir.join(folder)) else {
            continue;
        };

        for entry in entries.flatten() {
            let is_file = entry.metadata().map(|metadata| metadata.is_file()).unwrap_or(false);
            let relative = format!("{folder}/{}", entry.file_name().to_string_lossy());

            if is_file && !used.contains(&relative) && fs::remove_file(entry.path()).is_ok() {
                deleted += 1;
            }
        }
    }

    Ok(deleted)
}

/// Espacio que ocupan las imágenes, las miniaturas y la base de datos.
#[tauri::command]
pub fn storage_stats(app: AppHandle) -> Result<StorageStats, String> {
    let base_dir = data_dir(&app)?;
    let (image_count, images_bytes) = folder_size(&base_dir.join(IMAGES_DIR));
    let (_, thumbs_bytes) = folder_size(&base_dir.join(THUMBS_DIR));
    let database_bytes = fs::metadata(base_dir.join("zeeboard.db"))
        .map(|metadata| metadata.len())
        .unwrap_or(0);

    Ok(StorageStats { image_count, images_bytes, thumbs_bytes, database_bytes })
}
