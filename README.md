# 🦓 ZeeBoard

Aplicación de escritorio para gestionar **comisiones de arte**: clientes, personajes, etapas de trabajo, imágenes de progreso, pagos y fechas de entrega, todo en un tablero sencillo y local.

Pensada para artistas que trabajan por encargo y quieren tener cada comisión organizada sin depender de servicios en la nube.

## Funcionalidades

- **Comisiones** con su cliente, precio, estado de pago y fecha de entrega.
- **Plantillas de trabajo** con etapas (boceto, lineart, color…) para seguir el progreso de cada encargo.
- **Imágenes por etapa** con galería y carrusel de versiones (*alts*).
- **Clientes y personajes**, con referencias visuales de cada personaje.
- **Etiquetas** por categorías para clasificar comisiones.
- **Terminadas**: historial de comisiones completadas.
- **Dashboard** con ingresos por mes y próximas entregas.
- **Pestañas abiertas** que se recuerdan entre sesiones.
- **Copias de seguridad** de la base de datos y las imágenes, y limpieza de imágenes sin usar.

Todos los datos se guardan **en tu ordenador**: nada sale a internet.

## Tecnologías

| Parte | Tecnología |
|---|---|
| Aplicación de escritorio | [Tauri 2](https://tauri.app) (Rust) |
| Interfaz | React 19 + TypeScript + Vite |
| Estilos y animaciones | Tailwind CSS 4 + Framer Motion |
| Datos | SQLite (`tauri-plugin-sql`) |
| Archivos | `tauri-plugin-fs` y `tauri-plugin-dialog` |

## Cómo ejecutarla

Requisitos: [Node.js](https://nodejs.org), [Rust](https://www.rust-lang.org/tools/install) y los [requisitos de Tauri para tu sistema](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

Para generar el instalador:

```bash
npm run tauri build
```

## Dónde se guardan los datos

En la carpeta de datos de la aplicación (`com.zeeboard.app`):

- **Windows:** `%APPDATA%\com.zeeboard.app\`
- `zeeboard.db` → base de datos SQLite
- `images/` → imágenes de las etapas y referencias

## Estructura del proyecto

```
src/
├── App.tsx              navegación entre secciones
├── pages/               una página por sección (Commissions, Clients, Tags…)
├── components/          componentes compartidos (modales, cabeceras, pestañas)
├── context/             avisos (toasts)
└── lib/
    ├── database.ts      esquema y consultas de SQLite
    ├── images.ts        guardado y limpieza de imágenes
    ├── backup.ts        copias de seguridad
    └── commissionHelpers.ts
src-tauri/               aplicación Tauri (Rust) y configuración
```

## Hoja de ruta

Las mejoras previstas están en [ROADMAP.md](ROADMAP.md).
