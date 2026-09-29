# API Freelancer — Python + Flask

API REST que gestiona las **asignaciones, las horas y la facturación** de una
plataforma de freelancers: **Asignacion**, **Factura** y la enumeración
**EstadoTiempo**.

## Reparto con la otra API

El diagrama UML se ha partido en dos APIs que trabajan sobre la misma base de
datos MySQL (phpMyAdmin):

| API | Puerto | Entidades que gestiona |
| --- | --- | --- |
| **Node.js + Express** | 3000 | Usuario, Trabajador, Cliente, Proyecto, Postulación, categorías |
| **Python + Flask** (esta) | 5000 | Asignación, horas, temporizador, EstadoTiempo, Factura |

Aquí no se guardan personas ni proyectos: se referencian por `proyectoId` y
`usuarioId`, que serán las claves foráneas de las tablas de la base de datos
común. Por eso, por ejemplo, `tarifaPorHora` es obligatorio al crear una
asignación (el valor por defecto del trabajador lo consulta la API de Node).

## Requisitos

- Python 3.10 o superior
- Flask (`pip install -r requirements.txt`)

## Ejecutar

```bash
pip install -r requirements.txt
python app.py                 # http://localhost:5000
python pruebas/smoke.py       # prueba de humo de esta parte
```

Health check:

```bash
curl http://localhost:5000/api/health
```

## Estructura

```
app.py                    creación de la app Flask y manejadores de error
routes.py                 endpoints (blueprint /api)
servicios.py              lógica de negocio
database.py               capa de datos (memoria ahora, MySQL después)
errors.py                 ApiError y validaciones
models/
  asignacion.py           temporizador, horas y estados de tiempo
  factura.py              facturación y congelamiento de horas
  estado_tiempo.py        enumeración PENDIENTE / APROBADO / CONGELADO
pruebas/smoke.py          prueba de humo
```

## Clases y endpoints

| Método del diagrama | Endpoint |
| --- | --- |
| `Proyecto.asociarAsignacion()` | `POST /api/proyectos/<id>/asignaciones` |
| — (asignaciones de un proyecto) | `GET /api/proyectos/<id>/asignaciones` |
| `Asignacion.iniciarTemporizador()` | `POST /api/asignaciones/<id>/temporizador/iniciar` |
| `Asignacion.detenerTemporizador()` | `POST /api/asignaciones/<id>/temporizador/detener` |
| `Asignacion.registrarHorasManual()` | `POST /api/asignaciones/<id>/horas` |
| `Asignacion.calcularValorTarea()` | `GET /api/asignaciones/<id>/valor` |
| `Asignacion.congelarRegistros()` | `POST /api/asignaciones/<id>/congelar` |
| — (aprobar horas) | `PUT /api/asignaciones/<id>/aprobar` |
| `Factura.generarFactura()` | `POST /api/facturas` |
| `Factura.congelarHorasIncluidas()` | `POST /api/facturas/<id>/congelar-horas` |
| `Factura.rechazar()` | `POST /api/clientes/<id>/facturas/<idFactura>/rechazar` |
| `Cliente.aprobarFactura()` | `POST /api/clientes/<id>/facturas/<idFactura>/aprobar` |
| — (marcar pagada) | `POST /api/facturas/<id>/pagar` |
| `EstadoTiempo` (enumeración) | `GET /api/estados-tiempo` |

Endpoints de consulta: `GET /api/asignaciones`, `GET /api/facturas` y
`GET /api/clientes/<id>/facturas` (aceptan filtros por query string).

Los usuarios, trabajadores, clientes, proyectos y categorías están en la API
de Node (`http://localhost:3000`); ver su README.

## Relaciones y multiplicidades

- `Factura 1 -> 1 Asignacion`: una asignación no puede tener dos facturas
  (`POST /api/facturas` responde 409 si ya está facturada).
- `Proyecto 1 -> N Asignacion`: `asociar_asignacion()` evita duplicados activos.
- `Usuario 1 -> N Factura`: las facturas se filtran por `usuarioId`, que es el
  id del cliente en la API de Node.
- `EstadoTiempo` (PENDIENTE / APROBADO / CONGELADO) controla el ciclo de vida
  de una asignación: solo una asignación `APROBADA` o `CONGELADA` puede facturarse.

## Ejemplo de flujo

Los pasos 1 y 2 son de la API de Node (personas y proyectos); a partir del 3,
esta API.

```bash
# 1. Registro (API de Node, :3000)
curl -X POST http://localhost:3000/api/clientes/registrarse -H "Content-Type: application/json" \
  -d '{"nombre":"Empresa X","email":"empresa@x.com","telefono":"3000000001","password":"clave123","razonSocial":"Empresa X S.A.","direccionFacturacion":"Carrera 1 # 2-3"}'

curl -X POST http://localhost:3000/api/trabajadores/registrarse -H "Content-Type: application/json" \
  -d '{"nombre":"Dev Uno","email":"dev@uno.com","telefono":"3000000002","password":"clave123","especialidad":"Python"}'

# 2. El cliente crea un proyecto (API de Node, :3000)
curl -X POST http://localhost:3000/api/clientes/1/proyectos -H "Content-Type: application/json" \
  -d '{"nombreProyecto":"App móvil","presupuestoEstimado":1500,"tipoCategoria":"TECNOLOGIA_Y_PROGRAMACION","categoria":{"lenguajePrincipal":"Python"}}'

# 3. El trabajador se postula (API de Node) y es asociado (esta API)
curl -X POST http://localhost:3000/api/trabajadores/2/postular -H "Content-Type: application/json" -d '{"proyectoId":1}'
curl -X POST http://localhost:5000/api/proyectos/1/asignaciones -H "Content-Type: application/json" \
  -d '{"usuarioId":2,"rolEnProyecto":"Desarrollador Full Stack","tarifaPorHora":50}'

# 4. Horas, temporizador y valor
curl -X POST http://localhost:5000/api/asignaciones/1/horas -H "Content-Type: application/json" -d '{"horas":4,"descripcion":"Modelado"}'
curl -X POST http://localhost:5000/api/asignaciones/1/temporizador/iniciar
curl -X POST http://localhost:5000/api/asignaciones/1/temporizador/detener
curl http://localhost:5000/api/asignaciones/1/valor

# 5. Facturar, congelar horas, aprobar y pagar
curl -X PUT http://localhost:5000/api/asignaciones/1/aprobar
curl -X POST http://localhost:5000/api/facturas -H "Content-Type: application/json" -d '{"idAsignacion":1,"idCliente":1}'
curl -X POST http://localhost:5000/api/facturas/1/congelar-horas
curl -X POST http://localhost:5000/api/clientes/1/facturas/1/aprobar
curl -X POST http://localhost:5000/api/facturas/1/pagar
```

## Formato de respuesta

Éxito:

```json
{ "ok": true, "mensaje": "Factura generada", "data": { "idFactura": 1, "...": "..." } }
```

Error:

```json
{ "ok": false, "error": { "mensaje": "...", "detalles": null } }
```

Códigos usados: `400` validación, `404` no existe, `409` conflicto de estado o
duplicado, `500` error del servidor.

## Datos

La API arranca **vacía**: no hay datos de ejemplo. Todo lo que muestre el
frontend vendrá de la base de datos MySQL (phpMyAdmin), que se conectará aquí
más adelante.

Mientras tanto `database.py` es un almacén en memoria con la misma interfaz
que tendrá la capa SQL, de forma que al migrar solo cambia ese archivo y las
rutas no se tocan.
