# API Python de Proyectos — Plataforma Freelancer

API REST en FastAPI que administra los proyectos, sus categorías, asignaciones (lectura) y
postulaciones de la plataforma Freelancer. Opera sobre la base de datos MySQL/MariaDB
de XAMPP y recibe peticiones autenticadas desde el API Gateway (`X-Internal-Key`).

---

## 1. ¿Qué hace?

CRUD de `proyectos` más progreso y `postulaciones`:

| Método   | Ruta                                     | Rol en Gateway | Qué hace                                             |
|----------|------------------------------------------|----------------|------------------------------------------------------|
| `GET`    | `/`                                      | público        | Estado del servicio                                  |
| `GET`    | `/health`                                | público        | Verifica conexión y columnas requeridas en la BD     |
| `POST`   | `/proyectos`                             | CLIENTE        | Crea un proyecto con su categoría única              |
| `GET`    | `/proyectos`                             | público        | Lista con `?estado=&cliente=&tipo=&limit=&offset=`   |
| `GET`    | `/proyectos/{id}`                        | público        | Detalle de un proyecto                               |
| `PUT`    | `/proyectos/{id}`                        | ADMIN          | Reemplazo completo (nombre, descripción y estado)    |
| `PATCH`  | `/proyectos/{id}`                        | ADMIN          | Cambio parcial de campos                             |
| `DELETE` | `/proyectos/{id}`                        | ADMIN          | Elimina el proyecto (`204`; `409` si tiene asignaciones) |
| `GET`    | `/proyectos/{id}/asignaciones`           | autenticado    | Asignaciones del proyecto (solo lectura)             |
| `GET`    | `/proyectos/{id}/progreso`               | autenticado    | Días activos, horas, asignaciones y costo acumulado  |
| `POST`   | `/proyectos/{id}/postulaciones`          | TRABAJADOR     | El trabajador se postula con `tarifa_propuesta`      |
| `GET`    | `/postulaciones`                         | autenticado    | Lista las postulaciones registradas                  |
| `GET`    | `/proyectos/{id}/postulaciones`          | autenticado    | Postulaciones recibidas por el proyecto              |
| `PATCH`  | `/postulaciones/{postulacion_id}`        | CLIENTE dueño / ADMIN | Acepta o rechaza una postulación pendiente    |

Cada proyecto pertenece a **una sola** de las 5 categorías (`tipo`):

| Tipo (`tipo`) | Bloque en el body | Tabla hija             |
|---------------|-------------------|------------------------|
| `TECNOLOGIA`  | `tecnologia`      | `proyectos_tecnologia` |
| `DISENO`      | `diseno`          | `proyectos_diseno`     |
| `REDACCION`   | `redaccion`       | `proyectos_redaccion`  |
| `MARKETING`   | `marketing`       | `proyectos_marketing`  |
| `ASISTENCIA`  | `asistencia`      | `proyectos_asistencia` |

**Transiciones de estado permitidas** (si no, responde `409`):

```
BORRADOR   -> ABIERTO | CANCELADO
ABIERTO    -> EN_CURSO | PAUSADO | CANCELADO
EN_CURSO   -> PAUSADO | FINALIZADO | CANCELADO
PAUSADO    -> EN_CURSO | CANCELADO
FINALIZADO -> (terminal)
CANCELADO  -> ABIERTO
```

---

## 2. Arquitectura

```
api's/Python/
├── main.py               # Punto de entrada: CORS, X-Internal-Key, /, /health, manejadores de error
├── requirements.txt      # Dependencias con versiones exactas
├── .env.example          # Plantilla del .env sin secretos
├── tests/
│   └── test_api.py       # 29 pruebas de integración (pytest + TestClient)
├── evidencias/
│   ├── pruebas.txt       # Salida de pytest
│   └── servidor.txt      # Salida del servidor y comprobación de endpoints
└── app/
    ├── database.py       # Engine, SessionLocal, Base, get_db()
    ├── errors.py         # ErrorAPI + manejadores (formato {"status": "error", "message": "..."})
    ├── auth.py           # Verificación JWT y roles
    ├── models.py         # Modelos SQLAlchemy, enums y transiciones de estado
    ├── schemas.py        # Schemas Pydantic (entrada/salida y validaciones)
    ├── services/
    │   ├── proyectos.py  # Lógica de negocio de proyectos y progreso
    │   └── postulaciones.py
    └── routers/
        ├── proyectos.py      # Endpoints de proyectos
        └── postulaciones.py  # Endpoints de postulaciones
```

---

## 3. Pruebas

```powershell
..\..\.venv\Scripts\python.exe -m pytest tests -v
```
