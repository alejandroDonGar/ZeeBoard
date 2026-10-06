# Hoja de ruta de ZeeBoard

Objetivo: una app **bonita, elegante y sencilla, pero completamente funcional** para gestionar comisiones de arte.

Cada fase termina con una **revisión**: ejecutar la app (`npm run tauri dev`), probarla y decidir qué cambiar antes de seguir.

---

## Fase 0 · Estabilizar y ordenar el repositorio
- [x] Registrar cada plugin de Tauri una sola vez
- [x] Que `npm run build` compile sin errores
- [x] Guardar la refactorización de `App.tsx` en commits
- [x] README y hoja de ruta
- [x] Fusionar las ramas en `main` y usar `main` como rama principal

## Fase 1 · Imágenes ligeras
Los lienzos originales pesan 40–70 MB; la app solo necesita copias ligeras (los originales se guardan aparte).
- [x] Procesado en Rust, en segundo plano: copia para ver (~2560 px, WebP) y miniatura (~480 px)
- [x] Nombres de archivo por contenido (sin duplicados)
- [x] Añadir imágenes con el selector, arrastrando y soltando, o pegando con Ctrl+V
- [x] Un único sistema para imágenes de etapas, referencias de comisión y de personaje
- [x] Migración automática de las imágenes antiguas y compactar la base de datos
- [x] Miniaturas en tarjetas y listas, carga diferida (`loading="lazy"`)
- [x] En Ajustes: espacio usado y limpieza de huérfanas

## Fase 2 · Sistema de diseño
- [x] Colores y radios como variables de Tailwind (`@theme`); esquinas rectas, sin barras de scroll
- [ ] Tipografía y sombras
- [x] Modo claro y oscuro
- [ ] Componentes base: botón, tarjeta, modal, campos de formulario, etiqueta, estado vacío
- [ ] Iconos (lucide-react) y barra lateral rediseñada
- [ ] Animaciones discretas

## Fase 3 · Pantalla por pantalla
Dividir cada pantalla en componentes y aplicar el nuevo diseño.
- [x] Comisiones (tablero)
- [x] Detalle de comisión y galería
- [x] Clientes y personajes (incluye poder borrar personajes)
- [x] Plantillas
- [x] Etiquetas
- [x] Terminadas
- [x] Dashboard
- [x] Ajustes
- [ ] Dividir `database.ts` por entidades

## Fase 4 · Pulido y calidad
- [x] Restaurar copias de seguridad
- [ ] Atajos de teclado y buscador global
- [ ] Rendimiento con muchas comisiones
- [ ] Icono, nombre e instalador
- [ ] README con capturas

## Fase 5 · ZeeBoard en el iPad (por wifi, sin nube)
- [ ] Servidor local en la app + código QR para abrirla desde el iPad
- [ ] Enviar imágenes de progreso desde el iPad a una comisión
- [ ] Vista del tablero adaptada al iPad

---

## Ideas para ir incorporando

**Prioritarias**
- [ ] Papelera con deshacer (Ctrl+Z)
- [ ] Cronómetro por comisión y etapa, con el precio real por hora
- [x] Modo privado para directos (ocultar clientes y precios)
- [ ] Anotaciones de correcciones sobre las imágenes

**Negocio**
- [x] Precios por plantilla con extras (precio base + 50 % por personaje extra)
- [x] Pagos parciales e ingreso neto (comisiones de PayPal, Ko-fi…)
- [x] Email del cliente e importación del CSV de PayPal (cruza cobros por email, sin duplicar)
- [x] Botón "Copy description": texto corto para la factura de PayPal (plantilla, personajes y tu usuario)
- [x] Recordatorio de pago: comisión fuera de la primera etapa y sin ningún pago (Dashboard + notificación)
- [x] Contador de revisiones incluidas (correcciones por etapa)
- [ ] Origen del cliente (X, Instagram, Discord…)
- [ ] Gastos y beneficio real
- [ ] Varias monedas
- [x] Resumen de ingresos por trimestre (CSV)
- [ ] Estadísticas

**Flujo de trabajo**
- [x] Recordatorios de fechas de entrega (también aviso de comisiones paradas)
- [x] Lista de espera y plazas abiertas (con importación del formulario de Google)
- [x] Foto de perfil de los clientes: Bluesky → Telegram → a mano (arrastrar, pegar o clic), guardada en disco
- [ ] Mensajes predefinidos para clientes
- [ ] Marca de agua al exportar WIPs
- [ ] Lista de entregables por comisión
- [ ] Brief o cuestionario de pedido y derechos de uso
- [ ] Planificador de carga semanal
- [ ] Moodboard de referencias (estilo PureRef)
- [ ] Paleta de colores automática desde las referencias
- [ ] Comparador antes/después entre etapas

**Comodidad**
- [ ] Paleta de comandos (Ctrl+K)
- [x] Copias de seguridad automáticas
- [x] Exportar los datos a CSV
- [ ] App en español e inglés
