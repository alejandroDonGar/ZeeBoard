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
- [ ] Procesado en Rust, en segundo plano: copia para ver (~2560 px, WebP) y miniatura (~480 px)
- [ ] Nombres de archivo por contenido (sin duplicados)
- [ ] Añadir imágenes con el selector, arrastrando y soltando, o pegando con Ctrl+V
- [ ] Un único sistema para imágenes de etapas, referencias de comisión y de personaje
- [ ] Migración automática de las imágenes antiguas y compactar la base de datos
- [ ] Miniaturas en tarjetas y listas, carga diferida (`loading="lazy"`)
- [ ] En Ajustes: espacio usado y limpieza de huérfanas

## Fase 2 · Sistema de diseño
- [ ] Colores, tipografía, radios y sombras como variables de Tailwind (`@theme`)
- [ ] Modo claro y oscuro
- [ ] Componentes base: botón, tarjeta, modal, campos de formulario, etiqueta, estado vacío
- [ ] Iconos (lucide-react) y barra lateral rediseñada
- [ ] Animaciones discretas

## Fase 3 · Pantalla por pantalla
Dividir cada pantalla en componentes y aplicar el nuevo diseño.
- [ ] Comisiones (tablero)
- [ ] Detalle de comisión y galería
- [ ] Clientes y personajes (incluye poder borrar personajes)
- [ ] Plantillas
- [ ] Etiquetas
- [ ] Terminadas
- [ ] Dashboard
- [ ] Ajustes
- [ ] Dividir `database.ts` por entidades

## Fase 4 · Pulido y calidad
- [ ] Restaurar copias de seguridad
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
- [ ] Modo privado para directos (ocultar clientes y precios)
- [ ] Anotaciones de correcciones sobre las imágenes

**Negocio**
- [ ] Precios por plantilla con extras
- [ ] Pagos parciales e ingreso neto (comisiones de PayPal, Ko-fi…)
- [ ] Contador de revisiones incluidas
- [ ] Origen del cliente (X, Instagram, Discord…)
- [ ] Gastos y beneficio real
- [ ] Varias monedas
- [ ] Resumen de ingresos por trimestre (CSV)
- [ ] Estadísticas

**Flujo de trabajo**
- [ ] Recordatorios de fechas de entrega
- [ ] Lista de espera y plazas abiertas
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
- [ ] Copias de seguridad automáticas
- [ ] Exportar los datos a CSV
- [ ] App en español e inglés
