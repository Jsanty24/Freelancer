# API Freelancer — Node.js + Express

API REST que gestiona las **personas y los proyectos** de una plataforma de
freelancers: **Usuario, Trabajador, Cliente, Proyecto** y las
**postulaciones**, más las **5 categorías de proyecto**.

## Reparto con la otra API

El diagrama UML se ha partido en dos APIs que worked sobre la misma base de
datos MySQL (phpMyAdmin):

| API | Puerto | Entidades que gestiona |
| --- | --- | --- |
| **Node.js** (esta) | 3000 | Usuario, Trabajador, Cliente, Proyecto, Postulación, categorías |
| **Python + Flask** | 5000 | Asignación, horas, temporizador, EstadoTiempo, Factura |

Lo que aquí no existe (asignaciones y facturas) se referencia solo por id: son
las claves foráneas de las tablas de la base de datos común. El frontend
llama a cada API según la entidad que necesita.

## Requisitos

- Node.js 18 o superior
- Dependencias ya instaladas (`express`)

## Ejecutar

```bash
npm start          # http://localhost:3000
npm run dev        # con recarga automática (node --watch)
npm run test:smoke # prueba de humo del flujo completo
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Estructura

```
api.js                      arranque del servidor
src/
  app.js                    configuración de Express y montaje de rutas
  database.js               capa de datos (memoria ahora, MySQL después)
  models/
    Usuario.js              clase Usuario (base de Cliente y Trabajador)
    Trabajador.js           especialidad, disponibilidad, postulaciones
    Cliente.js              razón social, dirección de facturación
    Proyecto.js             proyectos y progreso
    Categorias.js           las 5 categorías del diagrama
  services/index.js         lógica de negocio
  routes/
    usuarios.js             usuarios, trabajadores, postulaciones y clientes
    proyectos.js            proyectos, progreso y categorías
  middleware/errores.js     404 y manejador de errores
  utils/                    validaciones y errores tipados
pruebas/smoke.js            prueba de humo
```

## Clases y endpoints

| Método del diagrama | Endpoint |
| --- | --- |
| `Usuario.registrarse()` | `POST /api/usuarios/registrarse` |
| `Usuario.registrarse()` (cliente) | `POST /api/clientes/registrarse` |
| `Usuario.registrarse()` (trabajador) | `POST /api/trabajadores/registrarse` |
| `Usuario.iniciarSesion()` | `POST /api/usuarios/login` |
| `Usuario.actualizarDatos()` | `PUT /api/usuarios/:id` |
| `Trabajador.postularAProyecto()` | `POST /api/trabajadores/:id/postular` |
| `Trabajador.consultarHistorialTrabajos()` | `GET /api/trabajadores/:id/historial` |
| — (disponibilidad) | `PUT /api/trabajadores/:id/disponibilidad` |
| `Cliente.crearProyecto()` | `POST /api/clientes/:id/proyectos` |
| `Proyecto.consultarProgreso()` | `GET /api/proyectos/:id/progreso` |
| — (listar proyectos) | `GET /api/proyectos` |
| — (listar categorías) | `GET /api/categorias` |
| `EstadoTiempo` (enumeración) | `GET /api/estados-tiempo` (en la API de Python) |

Endpoints de consulta: `GET /api/usuarios`, `GET /api/trabajadores`, `GET /api/clientes` y `GET /api/proyectos` (aceptan filtros por query string).

Las asignaciones, las horas, el temporizador y las facturas están en la API de
Python (`http://localhost:5000`); ver su README.

## Relaciones y multiplicidades

Las que gestiona esta API:

- `Cliente 1 -> N Proyecto`: cada proyecto pertenece a un cliente.
- `Trabajador N <-> N Proyecto`: postulación y asociación posterior.
- `Usuario 1 -> N Factura`: las facturas se filtran por `usuarioId` (las
  consulta Python, pero el `usuarioId` es el de esta tabla).

Las que gestiona la API de Python, sobre los ids que se guardan aquí:

- `Factura 1 -> 1 Asignacion`: una asignación no puede tener dos facturas
  (`POST /api/facturas` responde 409 si ya está facturada).
- `Proyecto 1 -> N Asignacion`: crear una asignación es `POST
  /api/proyectos/:id/asignaciones` en Python, no aquí.
- `EstadoTiempo` (PENDIENTE / APROBADO / CONGELADO) controla el ciclo de vida
  de una asignación: solo una asignación `APROBADA` o `CONGELADA` puede facturarse.

## Categorías de proyecto

`GET /api/categorias` devuelve los 5 tipos disponibles, que son los que exige
`tipoCategoria` al crear un proyecto:

| tipo | atributos |
| --- | --- |
| `TECNOLOGIA_Y_PROGRAMACION` | `lenguajePrincipal`, `repositorioUrl` |
| `DISENO_Y_MULTIMEDIA` | `softwareUtilizado`, `formatoEntrega` |
| `REDACCION_Y_CONTENIDO` | `cantidadPalabras`, `idioma` |
| `MARKETING_DIGITAL_Y_REDES_SOCIALES` | `plataformaObjetivo`, `tipoCampana` |
| `ASISTENCIA_VIRTUAL_Y_ADMINISTRACION` | `herramientasManejo`, `horasSemanalesRequeridas` |

## Ejemplo de flujo completo

```bash
# 1. Registro
curl -X POST http://localhost:3000/api/clientes/registrarse -H "Content-Type: application/json" \
  -d '{"nombre":"Empresa X","email":"empresa@x.com","telefono":"3000000001","password":"clave123","razonSocial":"Empresa X S.A.","direccionFacturacion":"Carrera 1 # 2-3"}'

curl -X POST http://localhost:3000/api/trabajadores/registrarse -H "Content-Type: application/json" \
  -d '{"nombre":"Dev Uno","email":"dev@uno.com","telefono":"3000000002","password":"clave123","especialidad":"Node.js"}'

# 2. Ese cliente (el id que devolvió el paso 1) crea un proyecto
curl -X POST http://localhost:3000/api/clientes/1/proyectos -H "Content-Type: application/json" \
  -d '{"nombreProyecto":"App móvil","presupuestoEstimado":1500,"tipoCategoria":"TECNOLOGIA_Y_PROGRAMACION","categoria":{"lenguajePrincipal":"JavaScript"}}'

# 3. El trabajador se postula
curl -X POST http://localhost:3000/api/trabajadores/2/postular -H "Content-Type: application/json" \
  -d '{"proyectoId":1}'

# 4. Progreso e historial (las asignaciones las lleva Python)
curl http://localhost:3000/api/proyectos/1/progreso
curl http://localhost:3000/api/trabajadores/2/historial

# 5. A partir de aquí, la API de Python (:5000)
#    Asignar el trabajador al proyecto, registrar horas y facturar
curl -X POST http://localhost:5000/api/proyectos/1/asignaciones -H "Content-Type: application/json" \
  -d '{"usuarioId":2,"rolEnProyecto":"Desarrollador Full Stack","tarifaPorHora":50}'

curl -X POST http://localhost:5000/api/asignaciones/1/horas -H "Content-Type: application/json" -d '{"horas":4,"descripcion":"Modelado"}'
curl -X POST http://localhost:5000/api/asignaciones/1/temporizador/iniciar
curl -X POST http://localhost:5000/api/asignaciones/1/temporizador/detener
curl http://localhost:5000/api/asignaciones/1/valor

curl -X PUT http://localhost:5000/api/asignaciones/1/aprobar
curl -X POST http://localhost:5000/api/facturas -H "Content-Type: application/json" -d '{"idAsignacion":1,"idCliente":1}'
curl -X POST http://localhost:5000/api/facturas/1/congelar-horas
curl -X POST http://localhost:5000/api/clientes/1/facturas/1/aprobar
curl -X POST http://localhost:5000/api/facturas/1/pagar
```

## Formato de respuesta

Éxito:

```json
{ "ok": true, "mensaje": "Proyecto creado", "data": { "idProyecto": 1, "...": "..." } }
```

Error:

```json
{ "ok": false, "error": { "mensaje": "...", "detalles": null } }
```

Códigos usados: `400` validación, `401` credenciales, `404` no existe,
`409` conflicto de estado o duplicado, `500` error del servidor.

## Datos

La API arranca **vacía**: no hay datos de ejemplo. Todo lo que muestre el
frontend vendrá de la base de datos MySQL (phpMyAdmin), que se conectará aquí
más adelante.

Mientras tanto `src/database.js` es un almacén en memoria con la misma interfaz
que tendrá la capa SQL, de forma que al migrar solo cambia ese archivo y las
rutas no se tocan.
