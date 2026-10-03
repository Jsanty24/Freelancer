# API Python de Proyectos — Plataforma Freelancer

API REST en FastAPI que administra los proyectos de la plataforma Freelancer.
Lee y escribe en la base de datos MySQL/MariaDB de XAMPP llamada `plataforma_freelance`.

---

## 1. que hace?

Expone el CRUD de `proyectos` más los métodos de negocio del diagrama UML:

| Método   | Ruta                                  | Qué hace                                     |
|----------|---------------------------------------|----------------------------------------------|
| `GET`    | `/proyectos`                          | Lista proyectos. Acepta filtro `?estado=`    |
| `GET`    | `/proyectos/{id}`                     | Obtiene un proyecto                          |
| `POST`   | `/proyectos`                          | Crea un proyecto con su especialidad         |
| `PUT`    | `/proyectos/{id}`                     | Actualiza nombre, descripción o estado       |
| `DELETE` | `/proyectos/{id}`                     | Elimina proyecto (cascada a su especialidad) |
| `POST`   | `/proyectos/{id}/asociar-asignacion`  | Vincula un usuario al proyecto               |
| `GET`    | `/proyectos/{id}/consultar-progreso`  | Días activos + datos de especialidad         |

Cada proyecto pertenece a **una** de las 5 especialidades, según la tabla daughter que tenga:

- `TecnologiaYProgramacion` → `proyectos_tecnologia`
- `DisenoYMultimedia` → `proyectos_diseno`
- `RedaccionYContenido` → `proyectos_redaccion`
- `MarketingDigitalYRedesSociales` → `proyectos_marketing`
- `AsistenciaVirtualYAdministracion` → `proyectos_asistencia`

Las 5 se devuelven normalizadas en la respuesta, bajo `tipo_proyecto` y `especificaciones`.

---

## 2. que se utilizo?

**Lenguaje y framework**
- Python 3.12
- FastAPI 0.142 — framework web
- Uvicorn 0.28 — servidor ASGI

**Base de datos**
- MariaDB 10.4.32 (viene con XAMPP) — puerto 3306
- SQLAlchemy 2.1 — ORM
- PyMySQL 1.1 — driver de conexión

**Validación y config**
- Pydantic 2.6 — validación de request/response
- python-dotenv 1.0 — carga el `.env`

**Arquitectura**

```
api's/Python/
├── main.py              # Punto de entrada, instancia FastAPI y registra routers
├── requirements.txt     # Dependencias
├── .env                 # Credenciales (NO se sube al repo, está en .gitignore)
├── venv/                # Entorno virtual
└── app/
    ├── __init__.py
    ├── database.py      # Engine, SessionLocal, Base, get_db()
    ├── models.py        # Modelos SQLAlchemy (ORM ↔ tablas)
    ├── schemas.py       # Schemas Pydantic (entrada/salida)
    └── routers/
        ├── __init__.py
        └── proyectos.py # Endpoints + lógica de serialización
```

El patrón es el estándar de FastAPI: los **routers** manejan las rutas, los **schemas**
validan y los **models** reflejan las tablas. LaBD no se toca con SQL crudo salvo en
`asociar-asignacion`, que usa un `INSERT` parametrizado.

---

## 3. requisitos

- XAMPP instalado, **Corriendo MySQL y Apache**
- Python 3.10 o superior

---

## 4. configuracion

El archivo `.env` ya existe. Debe quedar así:

```env
DATABASE_URL=mysql+pymysql://root:@localhost:3306/plataforma_freelance
PORT=5000
```

> **Ojo:** en XAMPP el usuario `root` **no tiene contraseña**, por eso va vacío después de
> los dos puntos (`root:@`). Si le pones algo, MySQL responde
> `ERROR 1045 Access denied for user 'root'@'localhost'`.
>
> Si tu root sí tiene contraseña, cámbiala y ajusta `DATABASE_URL`.

> **Ojo:** `PORT=5000` **no se lee en ningun lado**. El código no la consulta, asi que
> tienes que pasar el puerto a mano en el comando (ver sección 5).

Si algún día hay que regenerar las credenciales, `git` ignore `.env` a propósito —
está listado en el `.gitignore` de la raíz para no subir contraseñas.

---

## 5. como se levanta

Abre PowerShell **en esta carpeta** (`api's\Python`).

**Opción A — activar el entorno virtual (se lo recomiendo)**
```powershell
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 5000
```

**Opción B — sin activar el venv**
```powershell
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 5000
```

| Flag          | Significado                         |
|---------------|-------------------------------------|
| `main:app`    | Archivo `main.py`, variable `app`   |
| `--reload`    | Reinicia solo al guardar cambios    |
| `--port 5000` | Puerto explícito (ignora el `.env`) |

Luego entra a **http://127.0.0.1:5000/docs** — Swagger UI, donde se puede probar todos los
endpoints con botones y ver el JSON de respuesta.

Para detener: `Ctrl + C` en la terminal.

### Si PowerShell no deja activar el venv
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## 6. Verificar que todo conecto

```powershell
.\venv\Scripts\python.exe -c "from app.database import engine; from sqlalchemy import text; c=engine.connect(); print(c.execute(text('SELECT VERSION()')).scalar())"
```

Si imprime la versión de MariaDB, la conexión funciona. Si sale
`Access denied` → el `.env` está mal. Si sale `Can't connect` → MySQL de XAMPP no está
corriendo.

---

## 7. Ejemplo rápido

Como `proyectos.usuario_id` tiene llave foránea a `usuarios.id`, **primero debe existir un
usuario**:

```sql
INSERT INTO usuarios (nombre, email, telefono)
VALUES ('Juan Perez', 'juan@correo.com', '3001234567');
```

Luego crear un proyecto de tecnología:

```json
POST /proyectos
{
  "usuario_id": 1,
  "nombre_proyecto": "App de pedidos",
  "descripcion": "Aplicacion movil",
  "fecha_inicio": "2026-01-15",
  "estado": "En Curso",
  "tecnologia": {
    "lenguaje_principal": "Python",
    "repositorio_url": null
  }
}
```

Respuesta:
```json
{
  "id": 1,
  "usuario_id": 1,
  "nombre_proyecto": "App de pedidos",
  "descripcion": "Aplicacion movil",
  "fecha_inicio": "2026-01-15",
  "estado": "En Curso",
  "tipo_proyecto": "TecnologiaYProgramacion",
  "especificaciones": {
    "lenguaje_principal": "Python",
    "repositorio_url": null
  }
}
```

---

## 8. Esquema de la base de datos

10 tablas InnoDB, `utf8mb4`. Las que usa esta API están marcadas:

**Usadas por esta API**
- `proyectos` — `id`, `usuario_id` (FK), `nombre_proyecto`, `descripcion`, `fecha_inicio`, `estado`
- `proyectos_tecnologia` — `proyecto_id` (PK/FK), `lenguaje_principal`, `repositorio_url`
- `proyectos_diseno` — `proyecto_id` (PK/FK), `software_utilizado`, `formato_entrega`
- `proyectos_redaccion` — `proyecto_id` (PK/FK), `cantidad_palabras`, `idioma`
- `proyectos_marketing` — `proyecto_id` (PK/FK), `plataforma_objetivo`, `tipo_campana`
- `proyectos_asistencia` — `proyecto_id` (PK/FK), `herramientas_manejo`, `horas_semanales_requeridas`
- `asignaciones` — `id`, `usuario_id` (FK), `proyecto_id` (FK), `factura_id` (FK, UNIQUE), `rol_en_proyecto`, `tarifa_por_hora`, `temporizador_activo`, `estado_tiempo`

Las 5 tablas de especialidad tienen `proyecto_id` como clave primaria **y** foránea con
`ON DELETE CASCADE`, por eso al borrar un proyecto se borra su especialidad sola.

**Definidas pero pendientes de endpoint**
- `usuarios` — `id`, `nombre`, `email` (UNIQUE), `telefono`
- `clientes` — `usuario_id` (PK/FK), `razon_social`, `direccion_facturacion`
- `trabajadores` — `usuario_id` (PK/FK), `especialidad`, `disponibilidad`
- `facturas` — `id`, `usuario_id` (FK), `fecha_emision`, `valor_total`, `estado_factura`

---

## 9. Problemas que ya se corrigieron

Documentados para que no se repitan:

1. **Contraseña de MySQL.** El `.env` traía `root:password`, pero el root de XAMPP no tiene
   password. Daba `ERROR 1045 (28000): Access denied`. Corregido a `root:@`.

2. **`proyectos_diseño` vs `proyectos_diseno`.** El modelo SQLAlchemy declaraba la tabla
   con eñe (`__tablename__ = "proyectos_diseño"`), pero la tabla real en MySQL se llama
   `proyectos_diseno`. Cualquier consulta de proyectos de diseño fallaba. Corregido en
   `app/models.py`.

3. **`PORT` del `.env` sin usar.** La variable existe pero ningún módulo la lee, así que
   el puerto hay que pasarlo en el comando.

---

## 10. Estado actual

- La API **conecta y opera** contra la base de datos (verificado con lectura, escritura,
  JOIN y borrado).
- La base de datos está **vacía**: 0 filas en todas las tablas.
- Solo existe el router de `proyectos`. Faltan endpoints para `usuarios`, `clientes`,
  `trabajadores` y `facturas`.
- Según el historial del repo, la versión anterior de la API **PHP** se eliminó por
  errores de sintaxis y está pendiente reimplementarse.