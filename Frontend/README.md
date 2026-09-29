# Frontend — Gestión de Freelancers

Interfaz web (HTML + Tailwind + JavaScript puro) que consume las dos APIs de
`api's/`. Inspirada en el estilo de SGPE: panel lateral, modo claro/oscuro,
tarjetas de resumen, tablas y modales.

## Cómo abrirlo

1. Levanta **las dos** APIs, porque cada una gestiona unas entidades
   distintas sobre la misma base de datos:

   ```bash
   cd ../api's/Express-nodejs && npm start        # http://localhost:3000
   cd ../api's/Python && python app.py            # http://localhost:5000
   ```

2. Sirve esta carpeta con cualquier servidor estático:

   ```bash
   npm run serve          # python -m http.server 5500
   ```

3. Abre `http://127.0.0.1:5500` en el navegador.

El CSS de Tailwind ya está generado en `styles/tailwind.css`, así que la
interfaz funciona sin internet. Si tocas el HTML o el JS y quieres
regenerarlo, o para ver los cambios en vivo:

```bash
npm run build:css     # una vez
npm run watch:css     # cada vez que guardes (recompila solo)
```

## Qué API usa cada pantalla

No hay selector: cada método de `API` va a la API que gestiona esa entidad.

| Pantalla | Contenido | API |
| --- | --- | --- |
| Dashboard | contadores y listados | las dos |
| Proyectos | proyectos, categorías, progreso, association | Node + Python |
| Trabajadores | trabajadores, postulaciones, historial | Node |
| Asignaciones | asignaciones, horas, temporizador | Python |
| Facturas | facturación y aprobaciones | Python |

Los puertos se cambian en `js/config.js` (se guardan en `localStorage`).

## Estructura

```
Frontend/
├── index.html                 shell: menú lateral, cabecera y contenedores
├── package.json               scripts de Tailwind y servidor estático
├── js/
│   ├── config.js              URLs de las dos APIs
│   ├── api.js                 cliente HTTP (fetch) que enruta a cada API
│   ├── ui.js                  helpers: tablas, badges, modales, toasts
│   ├── app.js                 enrutado por hash, tema y arranque
│   └── views/
│       ├── dashboard.js       contadores, gráficas y listados recientes
│       ├── proyectos.js       filtros por categoría, progreso y asociación
│       ├── trabajadores.js    especialidad, disponibilidad, postulaciones
│       ├── asignaciones.js    temporizador en vivo, horas y estado de tiempo
│       └── facturas.js        generación, congelamiento, aprobación y pago
├── styles/
│   ├── tailwind.src.css       fuente: tema, componentes y animaciones
│   └── tailwind.css           generado (no editar a mano)
└── legacy/                    archivos del proyecto anterior (sin uso)
```

## El CSS y Tailwind

`styles/tailwind.src.css` es la fuente y ahí se cambia todo lo visual:

- **Tema y colores:** bloque `@theme` (paleta `brand`, sombra `card`).
- **Modo oscuro:** `@custom-variant dark`, activado con la clase `dark` en `<html>`.
- **Componentes:** bloque `@layer components` con `card`, `nav-link`, `label`,
  `input`, `input-compact`, `btn-primario`, `btn-sec`, `badge`, `badge-neutra`,
  `th`, `td`, `tr`. Se escriben con `@apply` y se compilan al CSS final.
- **Clases que ve el compilador:** los `@source` del principio del archivo
  apuntan a `index.html` y a `js/`, por eso detecta las clases que se generan
  con JavaScript (por ejemplo las etiquetas de estado de las tablas).
- **Animaciones:** `aparece` (toasts y modales) y `crece` (barras del dashboard).

`styles/tailwind.css` se genera con `npm run build:css`; no hay que editarlo a mano.
Para agregar un color nuevo basta con añadirlo al bloque `@theme` y reconstruir.

## Pantallas

| Vista | Ruta | Qué hace |
| --- | --- | --- |
| Dashboard | `#/dashboard` | Contadores, horas por estado, proyectos por categoría, listados recientes |
| Proyectos | `#/proyectos` | Filtro por las 5 categorías, progreso, asociar asignación, generar factura |
| Trabajadores | `#/trabajadores` | Filtro por especialidad/disponibilidad, postular, historial de trabajos |
| Asignaciones | `#/asignaciones` | Temporizador con reloj en vivo, registrar horas, calcular valor, aprobar y congelar |
| Facturas | `#/facturas` | Resumen por estado, generar, detalle, congelar horas, aprobar/rechazar y pagar |

## Relación con el diagrama

| Método del diagrama | Dónde se usa en la interfaz | API |
| --- | --- | --- |
| `Cliente.crearProyecto()` | Proyectos → filtrar por categoría (el alta se hace por API) | Node |
| `Proyecto.asociarAsignacion()` | Proyectos → botón **Asignar** | Python |
| `Proyecto.consultarProgreso()` | Proyectos → botón **Ver** | Node |
| `Trabajador.postularAProyecto()` | Trabajadores → botón **Postular** | Node |
| `Trabajador.consultarHistorialTrabajos()` | Trabajadores → botón **Historial** | Node |
| `Asignacion.iniciarTemporizador()` | Asignaciones → **▶ Iniciar** | Python |
| `Asignacion.detenerTemporizador()` | Asignaciones → **■ Detener** | Python |
| `Asignacion.registrarHorasManual()` | Asignaciones → **+ Horas** | Python |
| `Asignacion.calcularValorTarea()` | Asignaciones → **Valor** | Python |
| `Asignacion.congelarRegistros()` | Asignaciones → **❄ Congelar** | Python |
| `Factura.generarFactura()` | Proyectos / Facturas → **Generar factura** | Python |
| `Factura.congelarHorasIncluidas()` | Facturas → **❄ Congelar horas** | Python |
| `Cliente.aprobarFactura()` | Facturas → **Aprobar** / **Rechazar** | Python |

Pendiente para más adelante: login, registro y verificación de sesión.

## Personalización

- **Colores:** bloque `@theme` en `styles/tailwind.src.css` (paleta `brand`).
- **Componentes:** bloque `@layer components` del mismo archivo.
- **URLs de las APIs:** `js/config.js` (`node` y `python`).
