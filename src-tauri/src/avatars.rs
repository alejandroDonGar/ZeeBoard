//! Descarga de fotos de perfil (Bluesky y Telegram) desde Rust, no desde el navegador:
//! así no hay CORS ni choque con la política de seguridad de la app.
//!
//! Solo habla con una lista cerrada de servidores, por https, con límite de tiempo y de tamaño:
//! no sirve para pedir cualquier otra cosa de internet.

use std::time::Duration;

use tauri::ipc::Response;

const MAX_BYTES: usize = 5 * 1024 * 1024;

/// Bluesky (API y fotos) y Telegram (página pública y su CDN de fotos).
fn host_allowed(host: &str) -> bool {
    matches!(host, "public.api.bsky.app" | "cdn.bsky.app" | "t.me")
        || host.ends_with(".cdn-telegram.org")
        || host.ends_with(".telesco.pe")
}

fn url_allowed(url: &reqwest::Url) -> bool {
    url.scheme() == "https" && url.host_str().is_some_and(host_allowed)
}

/// Descarga una dirección permitida y devuelve sus bytes (texto de la API, página HTML o imagen).
#[tauri::command]
pub async fn fetch_avatar_resource(url: String) -> Result<Response, String> {
    let url = reqwest::Url::parse(&url).map_err(|error| error.to_string())?;

    if !url_allowed(&url) {
        return Err(format!("{} is not an allowed address", url.host_str().unwrap_or("?")));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZeeBoard")
        // Una redirección solo se sigue si también va a un servidor permitido
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 {
                attempt.error("too many redirects")
            } else if url_allowed(attempt.url()) {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| error.to_string())?;

    let mut response = client.get(url).send().await.map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!("The server answered {}", response.status()));
    }

    let mut body = Vec::new();

    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        body.extend_from_slice(&chunk);

        if body.len() > MAX_BYTES {
            return Err("The file is too big".to_string());
        }
    }

    Ok(Response::new(body))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allowed(url: &str) -> bool {
        url_allowed(&reqwest::Url::parse(url).unwrap())
    }

    #[test]
    fn only_the_listed_servers_over_https_are_allowed() {
        assert!(allowed("https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=a.bsky.social"));
        assert!(allowed("https://cdn.bsky.app/img/avatar/plain/did:plc:x/y@jpeg"));
        assert!(allowed("https://t.me/someone"));
        assert!(allowed("https://cdn4.cdn-telegram.org/file/abc.jpg"));
        assert!(allowed("https://cdn5.telesco.pe/file/abc.jpg"));

        assert!(!allowed("http://t.me/someone"), "https only");
        assert!(!allowed("https://evil.com/t.me"), "the host decides, not the path");
        assert!(!allowed("https://t.me.evil.com/x"), "a longer host that starts like an allowed one");
        assert!(!allowed("https://evilcdn-telegram.org/x"), "the dot before the suffix is required");
        assert!(!allowed("https://cdn.bsky.app.evil.com/x"));
        assert!(!allowed("https://localhost/x"));
        assert!(!allowed("https://192.168.1.1/x"));
    }
}
