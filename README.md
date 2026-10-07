# ZeeBoard

Aplicación de escritorio para gestionar **comisiones de arte**: solicitudes, clientes, personajes, etapas de trabajo, imágenes de progreso, pagos y fechas de entrega, todo en un tablero sencillo y **local**.

Pensada para artistas que trabajan por encargo y quieren tener cada comisión organizada sin depender de servicios en la nube. Funciona en español y en inglés.

## Qué hace

- **Comisiones** con su cliente, plantilla, precio, pagos y fecha de entrega, y una tira de etapas con las imágenes de cada paso (con alternativas y modo enfoque).
- **Correcciones por etapa** que cuentan como revisiones, con el límite incluido en cada plantilla.
- **Pagos parciales** con las tarifas de cada plataforma (PayPal, Ko-fi…): ves lo que pagó el cliente, lo que te llega y lo que falta.
- **Solicitudes**: plazas abiertas, lista de espera e importación automática de las respuestas de un formulario de Google. Al aceptar una solicitud se crean el cliente, la comisión, el precio y las etiquetas.
- **Clientes y personajes**, con referencias, foto de perfil (Bluesky, Telegram o a mano) y email de pago.
- **Plantillas** de flujo de trabajo con precio base y revisiones incluidas, y **etiquetas** por categorías.
- **Avisos** de entrega, de comisiones paradas y de comisiones que pasaron del boceto sin cobrar, con notificaciones de Windows.
- **Importación de pagos de PayPal** desde su CSV de actividad, cruzando cada cobro con el cliente por su email.
- **Buscador global** (`Ctrl+K`) con acciones, y atajos de teclado.
- **Modo privado** para streams: oculta nombres de clientes y precios (`Ctrl+Shift+P`).
- **Exportación a CSV** (comisiones, pagos y resumen trimestral) y **copias de seguridad** manuales y automáticas.
- Tema claro, oscuro o el del sistema.

## Atajos

| Atajo | Qué hace |
|---|---|
| `Ctrl+K` | Buscador y acciones |
| `Ctrl+1` … `Ctrl+8` | Ir a una pantalla (orden del menú) |
| `Ctrl+N` | Nueva comisión |
| `Ctrl+Shift+P` | Modo privado |
| `?` | Lista de atajos |

## Instalación

Descarga el instalador (`ZeeBoard_x.y.z_x64-setup.exe`), ábrelo y sigue el asistente. Windows puede avisar de que la aplicación no está firmada: pulsa *Más información* y *Ejecutar de todos modos*.

Para pasar tus datos a otro equipo: en el equipo de origen haz una copia (*Ajustes → Backups → Export*) y, en el nuevo, usa *Restore* con esa carpeta.

## Tus datos

Todo se guarda **en tu ordenador**, en `%APPDATA%\com.zeeboard.app\`:

- `zeeboard.db`: base de datos SQLite.
- `images/`: imágenes de etapas, referencias y fotos de clientes.

Desinstalar la aplicación no borra tus datos salvo que lo pidas en el desinstalador.

## Para desarrollar

Requisitos: [Node.js](https://nodejs.org), [Rust](https://www.rust-lang.org/tools/install) y los [requisitos de Tauri para Windows](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev      # modo desarrollo
npm run tauri build    # genera el instalador en src-tauri/target/release/bundle/nsis
```

Comprobaciones rápidas de la lógica:

```bash
npx tsx scripts/check-payments.ts   # y check-reminders, check-export, check-form-import,
                                    # check-avatars, check-paypal, check-search, check-i18n
cd src-tauri && cargo test
```

## Tecnologías

| Parte | Tecnología |
|---|---|
| Aplicación de escritorio | [Tauri 2](https://tauri.app) (Rust) |
| Interfaz | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS 4 |
| Datos | SQLite (`tauri-plugin-sql`) |
| Imágenes | Procesado en Rust (WebP + miniaturas) |
| Iconos y letra | Tabler Icons, Fraunces y Manrope |

## Estructura

```
src/
├── App.tsx              menú, atajos y navegación
├── pages/               una página por sección
├── components/          componentes compartidos (buscador, pagos, filtros…)
└── lib/                 base de datos, imágenes, copias, importación, avisos, idioma…
src-tauri/               aplicación Tauri (Rust), iconos y configuración
scripts/                 comprobaciones rápidas de la lógica
```

## Hoja de ruta

Las mejoras previstas están en [ROADMAP.md](ROADMAP.md).
