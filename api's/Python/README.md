# API Python de Proyectos — Plataforma Freelancer

API REST en FastAPI que administra los proyectos, sus categorías, asignaciones y
postulaciones de la plataforma Freelancer. Opera sobre la base de datos MySQL/MariaDB
de XAMPP llamada `plataforma_freelance`.

---

## 1. ¿Qué hace?

CRUD de `proyectos` más los métodos de negocio del diagrama UML, con autenticación JWT:

| Método   | Ruta                                     | Rol requerido  | Qué hace                                             |
|----------|------------------------------------------|----------------|------------------------------------------------------|
| `GET`    | `/`                                      | público        | Estado del servicio                                  |
| `GET`    | `/health`                                | público        | `SELECT 1` contra la base de datos                   |
| `POST`   | `/proyectos`                             | CLIENTE        | Crea un proyecto con su categoría                    |
| `GET`    | `/proyectos`                             | autenticado    | Lista con `?estado=&cliente=&categoria=&limit=&offset=` |
| `GET`    | `/proyectos/{id}`                        | autenticado    | Detalle de un proyecto                               |
| `PUT`    | `/proyectos/{id}`                        | CLIENTE dueño  | Reemplazo completo (nombre, descripción y estado)    |
| `PATCH`  | `/proyectos/{id}`                        | CLIENTE dueño  | Cambio parcial de campos                             |
| `DELETE` | `/proyectos/{id}`                        | CLIENTE dueño  | Elimina el proyecto (`204`; `409` si tiene asignaciones) |
| `GET`    | `/proyectos/{id}/asignaciones`           | autenticado    | Asignaciones del proyecto (solo lectura)             |
| `GET`    | `/proyectos/{id}/progreso`               | autenticado    | Días activos, horas, asignaciones y costo acumulado  |
| `POST`   | `/proyectos/{id}/postulaciones`          | TRABAJADOR     | El trabajador se postula con una tarifa              |
| `GET`    | `/proyectos/{id}/postulaciones`          | CLIENTE dueño  | Postulaciones recibidas por el proyecto              |
| `PATCH`  | `/postulaciones/{postulacion_id}`        | CLIENTE dueño  | Acepta o rechaza una postulación pendiente           |

Cada proyecto pertenece a **una sola** de las 5 categorías, según la tabla hija que tenga:

| Categoría (`categoria`)                     | Tabla hija                    |
|---------------------------------------------|-------------------------------|
| `TecnologiaYProgramacion`                   | `proyectos_tecnologia`        |
| `DisenoYMultimedia`                         | `proyectos_diseno`            |
| `RedaccionYContenido`                       | `proyectos_redaccion`         |
| `MarketingDigitalYRedesSociales`            | `proyectos_marketing`         |
| `AsistenciaVirtualYAdministracion`          | `proyectos_asistencia`        |

Al crear hay que enviar **exactamente una** de las claves `tecnologia`, `diseno`,
`redaccion`, `marketing` o `asistencia`. Las respuestas devuelven el proyecto
normalizado con `tipo_proyecto` y `especificaciones`.

**Transiciones de estado permitidas** (si no, responde `409`):

```
ABIERTO   -> EN_CURSO | PAUSADO | CANCELADO
EN_CURSO  -> PAUSADO | COMPLETADO | CANCELADO
PAUSADO   -> EN_CURSO | CANCELADO
COMPLETADO -> (terminal)
CANCELADO -> ABIERTO
```

---

## 2. ¿Qué se utilizó?

**Lenguaje y framework**
- Python 3.12
- FastAPI 0.142 — framework web
- Uvicorn 0.54 — servidor ASGI

**Base de datos**
- MariaDB 10.4.32 (viene con XAMPP) — puerto 3306
- SQLAlchemy 2.1 — ORM
- PyMySQL 1.2 — driver de conexión

**Validación, seguridad y config**
- Pydantic 2.13 — validación de request/response
- PyJWT 2.15 — verificación de tokens JWT (HS256)
- python-dotenv 1.2 — carga del `.env`

**Pruebas**
- pytest 9.1 + TestClient de FastAPI (httpx)

Las versiones están **fijadas** en `requirements.txt` (salida de `pip freeze`).

---

## 3. Arquitectura

```
api's/Python/
├── main.py               # Punto de entrada: CORS, /, /health, manejadores de error
├── requirements.txt      # Dependencias con versiones exactas
├── .env                  # Credenciales (NO se sube al repo; está en .gitignore)
├── .env.example          # Plantilla del .env sin secretos
├── migracion_bd.sql      # Migración de la BD (ENUMs, FK cliente, postulaciones, etc.)
├── tests/
│   └── test_api.py       # 29 pruebas de integración (pytest + TestClient)
├── evidencias/
│   ├── pruebas.txt       # Salida de pytest
│   └── servidor.txt      # Salida del servidor y comprobación de endpoints
└── app/
    ├── database.py       # Engine, SessionLocal, Base, get_db()
    ├── errors.py         # ErrorAPI + manejadores (formato de error unificado)
    ├── auth.py           # JWT Bearer, get_current_user, requiere_rol
    ├── models.py         # Modelos SQLAlchemy, enums y transiciones de estado
    ├── schemas.py        # Schemas Pydantic (entrada/salida y validaciones)
    ├── services/
    │   ├── proyectos.py  # Lógica de negocio de proyectos y progreso
    │   └── postulaciones.py
    └── routers/
        ├── proyectos.py      # Endpoints de proyectos
        └── postulaciones.py  # Endpoints de postulaciones
```

Patrón estándar de FastAPI: los **routers** definen las rutas, los **services** contienen
la lógica y el acceso a datos, los **schemas** validan y los **models** reflejan las tablas.
La BD no se toca con SQL crudo en la API.

---

## 4. Requisitos

- XAMPP instalado y **MySQL corriendo**
- Python 3.10 o superior

---

## 5. Configuración

El archivo `.env` debe existir en esta carpeta (hay una plantilla en `.env.example`):

```env
DATABASE_URL=mysql+pymysql://root:@localhost:3306/plataforma_freelance
PORT=5000
JWT_SECRET=una-clave-aleatoria-de-al-menos-32-caracteres
```

> **Ojo:** en XAMPP el usuario `root` **no tiene contraseña**, por eso va vacío después de
> los dos puntos (`root:@`). Si le pones algo, MySQL responde
> `ERROR 1045 Access denied for user 'root'@'localhost'`.

> **Ojo:** `JWT_SECRET` **debe ser idéntico** al de la API PHP, la API Node y esta. Si
> cambia, todos los tokens emitidos por las demás APIs dejan de servir (`401`).

> **Ojo:** `PORT` **sí se lee**: `python main.py` arranca en ese puerto. En cambio,
> `uvicorn main:app --port 5000` lo ignora y usa el que se le pase por línea de comandos.

Si algún día hay que regenerar las credenciales, `git` ignora `.env` a propósito —
está listado en el `.gitignore` de esta carpeta para no subir contraseñas.

---

## 6. Autenticación

Todas las rutas excepto `/` y `/health` exigen:

```
Authorization: Bearer <token JWT>
```

El token se verifica con **HS256** y el secreto `JWT_SECRET`, y debe traer:

| Claim | Contenido                                        |
|-------|--------------------------------------------------|
| `sub` | id del usuario, **como texto** (`"3"`)           |
| `rol` | `CLIENTE` o `TRABAJADOR`                         |
| `exp` | fecha de expiración en epoch (obligatorio)       |

Errores de autenticación: `401` (sin token, vencido o mal firmado) y
`403` (rol incorrecto, o recurso que no te pertenece). Las respuestas `401`
incluyen la cabecera `WWW-Authenticate: Bearer`.

Para probar en Swagger: pulsa **Authorize**, escribe el token y cierra.

Si aún no existe un login que emita tokens, se puede generar uno localmente para pruebas:

```python
# con el venv activo, desde esta carpeta
import time, jwt
token = jwt.encode(
    {"sub": "3", "rol": "CLIENTE", "exp": int(time.time()) + 3600},
    "TU_SECRETO",           # el mismo JWT_SECRET del .env
    algorithm="HS256",
)
print(token)
```

---

## 7. ¿Cómo se levanta?

Abre PowerShell **en esta carpeta** (`api's\Python`).

**Opción A — con el `.env` (puerto configurado)**
```powershell
.\venv\Scripts\python.exe main.py
```

**Opción B — con uvicorn (recomendado al desarrollar, recarga automática)**
```powershell
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 5000
```

| Flag          | Significado                              |
|---------------|------------------------------------------|
| `main:app`    | Archivo `main.py`, variable `app`        |
| `--reload`    | Reinicia solo al guardar cambios         |
| `--port 5000` | Puerto explícito (no usa el `PORT` del `.env`) |

Luego entra a **http://127.0.0.1:5000/docs** — Swagger UI, donde se prueban todos los
endpoints con botones y se ve el JSON de respuesta. Para detener: `Ctrl + C`.

### Si PowerShell no deja activar el venv
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Si es la primera vez en otra máquina
```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

---

## 8. Verificar que todo conectó

Con el servidor corriendo:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/health
```

Devuelve `{"status": "ok", "service": "API Proyectos", "database": "ok"}`. Si la BD no
responde responde `503` con `{"status": "error", "message": "La base de datos no responde"}`.

También se puede probar solo la conexión:

```powershell
.\venv\Scripts\python.exe -c "from app.database import engine; from sqlalchemy import text; c=engine.connect(); print(c.execute(text('SELECT VERSION()')).scalar())"
```

Si imprime la versión de MariaDB, la conexión funciona. Si sale `Access denied` → el
`.env` está mal. Si sale `Can't connect` → MySQL de XAMPP no está corriendo.

---

## 9. Ejemplos rápidos

### 9.1 Crear un proyecto

`proyectos.usuario_id` tiene llave foránea a `clientes.usuario_id`, así que **antes debe
existir un cliente**:

```sql
INSERT INTO usuarios (nombre, email, telefono)
VALUES ('Juan Perez', 'juan@correo.com', '3001234567');

INSERT INTO clientes (usuario_id, razon_social, direccion_facturacion)
VALUES (LAST_INSERT_ID(), 'JP Servicios', 'Calle 1 # 2-3');
```

Petición (el `usuario_id` se toma del token, **no** va en el cuerpo):

```json
POST /proyectos
{
  "nombre_proyecto": "App de pedidos",
  "descripcion": "Aplicacion movil",
  "fecha_inicio": "2026-01-15",
  "estado": "ABIERTO",
  "tecnologia": {
    "lenguaje_principal": "Python",
    "repositorio_url": "https://github.com/plataforma/app"
  }
}
```

Respuesta `201`:

```json
{
  "id": 1,
  "usuario_id": 3,
  "nombre_proyecto": "App de pedidos",
  "descripcion": "Aplicacion movil",
  "fecha_inicio": "2026-01-15",
  "estado": "ABIERTO",
  "categoria": "TecnologiaYProgramacion",
  "tipo_proyecto": "TecnologiaYProgramacion",
  "especificaciones": {
    "lenguaje_principal": "Python",
    "repositorio_url": "https://github.com/plataforma/app"
  }
}
```

### 9.2 Listar con filtros y paginación

```
GET /proyectos?estado=EN_CURSO&categoria=RedaccionYContenido&limit=20&offset=0
```

```json
{ "total": 1, "limit": 20, "offset": 0, "items": [ { "...": "..." } ] }
```

### 9.3 Actualizar

- `PUT /proyectos/{id}` → reemplazo completo: `nombre_proyecto`, `descripcion` y `estado`
  son obligatorios; `fecha_inicio` no se modifica.
- `PATCH /proyectos/{id}` → solo los campos enviados; `nombre_proyecto` no admite `null`.

### 9.4 Progreso

```
GET /proyectos/1/progreso
```

```json
{
  "proyecto_id": 1,
  "nombre_proyecto": "App de pedidos",
  "estado": "EN_CURSO",
  "fecha_inicio": "2026-01-15",
  "dias_activo": 12,
  "horas_aprobadas": "4.00",
  "horas_pendientes": "2.00",
  "numero_asignaciones": 1,
  "costo_acumulado": "200000.00",
  "tipo_proyecto": "TecnologiaYProgramacion",
  "detalles_especialidad": { "...": "..." }
}
```

### 9.5 Postulaciones

```json
POST /proyectos/1/postulaciones          (rol TRABAJADOR)
{ "tarifa_por_hora": 30000, "mensaje": "Tengo 5 anos de experiencia" }

GET  /proyectos/1/postulaciones          (rol CLIENTE, dueño)
PATCH /postulaciones/1                   (rol CLIENTE, dueño)
{ "estado": "ACEPTADA" }
```

---

## 10. Formato de error

Todas las respuestas de error usan el mismo formato que la API de usuarios:

```json
{ "status": "error", "message": "Falta el token de autenticacion. Envia Authorization: Bearer <token>" }
```

| Código | Cuándo                                                                |
|--------|-----------------------------------------------------------------------|
| `401`  | Sin token, token vencido o token mal firmado                          |
| `403`  | Rol incorrecto o recurso que no te pertenece                          |
| `404`  | Proyecto/postulación inexistente o usuario sin registrar              |
| `409`  | Transición de estado no permitida, postulación repetida, proyecto con asignaciones |
| `422`  | Validación de Pydantic (además traea `errors`)                        |
| `503`  | `/health` cuando la base de datos no responde                         |

El `422` además lista el detalle campo por campo (`message` resume el primer error):

```json
{
  "status": "error",
  "message": "Error de validacion: Field required",
  "errors": [
    { "campo": "nombre_proyecto", "mensaje": "Field required", "tipo": "missing" },
    { "campo": "estado", "mensaje": "Input should be 'ABIERTO', 'EN_CURSO', ...", "tipo": "enum" }
  ]
}
```

---

## 11. Esquema de la base de datos

Tablas InnoDB, `utf8mb4`. Las que usa esta API están marcadas:

**Usadas por esta API**
- `proyectos` — `id`, `usuario_id` (FK → `clientes.usuario_id`), `nombre_proyecto`,
  `descripcion`, `fecha_inicio`, `estado` (ENUM), `categoria` (ENUM)
- `proyectos_tecnologia` — `proyecto_id` (PK/FK), `lenguaje_principal`, `repositorio_url`
- `proyectos_diseno` — `proyecto_id` (PK/FK), `software_utilizado`, `formato_entrega`
- `proyectos_redaccion` — `proyecto_id` (PK/FK), `cantidad_palabras`, `idioma`
- `proyectos_marketing` — `proyecto_id` (PK/FK), `plataforma_objetivo`, `tipo_campana`
- `proyectos_asistencia` — `proyecto_id` (PK/FK), `herramientas_manejo`, `horas_semanales_requeridas`
- `postulaciones` — `id`, `proyecto_id` (FK), `usuario_id` (FK), `tarifa_por_hora`,
  `mensaje`, `estado` (ENUM), `fecha_postulacion`; única por (proyecto, usuario)
- `registros_tiempo` — `id`, `proyecto_id` (FK), `usuario_id` (FK), horas, costo y estado
- `asignaciones` — `id`, `usuario_id` (FK), `proyecto_id` (FK), `factura_id` (FK, UNIQUE),
  `rol_en_proyecto`, `tarifa_por_hora`, `temporizador_activo`, `estado_tiempo`
- `usuarios`, `clientes`, `trabajadores` — solo lectura (las crea la API de usuarios)

Las 5 tablas de categoría tienen `proyecto_id` como clave primaria **y** foránea con
`ON DELETE CASCADE`; lo mismo `postulaciones` y `registros_tiempo`, por eso al borrar un
proyecto se borran sus hijos solos.

**Gestionadas por las otras APIs** (aquí solo se leen): `facturas`.

### Migración

Si la base de datos existe de una versión anterior, aplicar una sola vez:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root plataforma_freelance < migracion_bd.sql
```

Lo que hace: crea los clientes faltantes, agrega la FK `proyectos.usuario_id →
clientes.usuario_id`, convierte `estado` a ENUM con valores en mayúsculas, agrega la
columna `categoria` y crea las tablas `postulaciones` y `registros_tiempo`.

Para una instalación nueva, el DDL completo está en `Backend/schemas.sql`.

---

## 12. Pruebas

```powershell
.\venv\Scripts\python.exe -m pytest tests -v
```

Son 29 pruebas de integración (pytest + TestClient) que cubren:

- `401` sin token, con token vencido y con secreto incorrecto
- `403` de rol (trabajador creando proyectos) y de propiedad (cliente ajeno)
- `404` de usuario inexistente y de recurso inexistente
- `422` por categoría ausente, dos categorías, URL inválida, cuerpo incompleto,
  `nombre_proyecto` en `null` y fechas fuera de rango
- `PUT` completo, `PATCH` parcial y `409` por transición de estado no permitida
- `204` al eliminar y `409` si el proyecto tiene asignaciones
- Filtros y paginación de `GET /proyectos`
- Cálculo de progreso (horas aprobadas/pendientes, costo acumulado)
- Flujo completo de postulaciones (crear, listar, aceptar, repetirse, proyecto no ABIERTO)
- Formato de error unificado

Las salidas quedaron guardadas en `evidencias/pruebas.txt` y `evidencias/servidor.txt`.

---

## 13. Problemas que ya se corrigieron

Documentados para que no se repitan:

1. **Contraseña de MySQL.** El `.env` traía `root:password`, pero el root de XAMPP no tiene
   password. Daba `ERROR 1045 (28000): Access denied`. Corregido a `root:@`.

2. **`proyectos_diseño` vs `proyectos_diseno`.** El modelo SQLAlchemy declaraba la tabla
   con eñe (`__tablename__ = "proyectos_diseño"`), pero la tabla real en MySQL se llama
   `proyectos_diseno`. Cualquier consulta de proyectos de diseño fallaba.

3. **`PORT` del `.env` sin usar.** La variable existía pero ningún módulo la leía. Hoy
   `main.py` la lee y valida al arrancar con `python main.py`.

4. **`estado` en minúsculas y distintas formas.** Se guardaba como texto libre
   (`"En Curso"`) y el ENUM de la BD usaba valores distintos a los del UML. Ahora es
   `ENUM('ABIERTO','EN_CURSO','PAUSADO','COMPLETADO','CANCELADO')` y el mismo enum de
   Python (`EstadoProyecto`) se usa en el modelo y en los schemas.

5. **`usuario_id` apuntaba a `usuarios`.** La FK real debe ser a `clientes.usuario_id`;
   el modelo SQLAlchemy fue corregido y la migración agrega la constraint.

6. **Rutas con barra final.** `GET /proyectos/` redirigía a `/proyectos`. Ahora todas las
   rutas se declaran sin barra final.

7. **`requirements.txt` con BOM UTF-8** (los tres primeros bytes eran `EF BB BF`), lo que
   rompe `pip install -r` en algunos entornos. Reescrito sin BOM y con versiones fijadas.

8. **FK a `facturas` sin mapear.** `asignaciones.factura_id` apuntaba a una tabla que no
   existía en el ORM y hacía fallar cualquier `INSERT` en `asignaciones`. Se agregó el
   modelo mínimo `Factura`.

---

## 14. Estado actual

- La API **conecta y opera** contra `plataforma_freelance` (verificado con lectura,
  escritura, JOIN y borrado).
- La migración `migracion_bd.sql` **ya fue aplicada** en esta máquina.
- **29/29 pruebas pasan** (`evidencias/pruebas.txt`); el servidor arranca y responde
  (`evidencias/servidor.txt`).
- Están implementados: CRUD de proyectos, asignaciones (lectura), progreso y
  postulaciones.
- La autenticación exige tokens firmados con el `JWT_SECRET` compartido; **la emisión de
  tokens sigue siendo responsabilidad de la API de usuarios/PHP**.
- Faltan endpoints para `usuarios`, `clientes`, `trabajadores` y `facturas` (pertenecen a
  las demás APIs).
