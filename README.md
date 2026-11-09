# 🏢 Sistema de Gestión Freelancer

Bienvenido al proyecto Sistema de Gestión Freelancer. Esta plataforma es un sistema integral diseñado para gestionar las relaciones entre clientes, freelancers (trabajadores) y proyectos, facilitando todo, desde la iniciación del proyecto y las postulaciones hasta el seguimiento horario, aprobación por parte del cliente y la facturación.

## 🚀 Descripción General del Proyecto
La arquitectura es modular, utilizando cuatro microservicios distintos conectados a través de una Pasarela API (API Gateway). Esta separación permite un desarrollo, escalado y pilas tecnológicas independientes para diferentes dominios de negocio:

### Módulos Clave:
*   **API 1 — Gestión de Usuarios y Perfiles (`api's/api_usuario`, PHP `:8000`):** Maneja perfiles de usuario centrales, cuentas de clientes, registro de trabajadores y verificación de contraseñas con `password_verify` (bcrypt).
*   **API 2 — Proyectos y Postulaciones (`api's/Python`, FastAPI `:5000`):** Administra el ciclo de vida de los proyectos, sus cinco categorías excluyentes y las postulaciones enviadas por freelancers.
*   **API 3 — Tiempo y Facturación (`api's/Express`, Node.js Express `:3000`):** Gestiona asignaciones, temporizador con control de solapamiento (`409`), registros de tiempo, tarifa histórica (`tarifa_aplicada`), congelamiento de horas al facturar y estados de factura. No procesa pagos ni custodia fondos.
*   **API 4 — Pasarela API / Hub Frontend (`api's/Gateway`, Node.js Express `:4000`):** El punto de entrada central que firma y valida JWT, aplica autorización por rol y propiedad de recursos, orquesta la comunicación interna (`X-Internal-Key`) y sirve la interfaz SPA.

---

## 🔗 Rutas RESTful Principales (vía API Gateway `:4000`)

Todas las respuestas de error en las 4 APIs utilizan el formato unificado `{"status": "error", "message": "..."}`.

### Autenticación y Perfiles (Gateway → API 1 PHP)
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/registro` | Público | Crea el usuario en `usuarios` y su perfil en `clientes` o `trabajadores`, y emite JWT. |
| `POST` | `/auth/login` | Público | Valida credenciales con `password_verify` en PHP y devuelve JWT firmado. |
| `POST` | `/auth/admin-login` | Público | Inicia sesión de administrador (según variables del `.env` del Gateway). |
| `GET` | `/auth/me` | Autenticado | Devuelve el usuario autenticado junto con su perfil. |
| `GET` | `/trabajadores` | Público | Directorio público de talento (sin exponer datos sensibles de contacto). |
| `GET` | `/trabajadores/:id` | Dueño / ADMIN | Consulta perfil completo de un trabajador. |
| `GET/POST/PUT/PATCH/DELETE` | `/usuarios`, `/clientes` | ADMIN | Administración de usuarios y clientes. |

### Proyectos y Postulaciones (Gateway → API 2 Python FastAPI)
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/proyectos` | Público | Lista paginada con filtros `?estado=&cliente=&tipo=&limit=&offset=`. |
| `POST` | `/proyectos` | CLIENTE | Crea un proyecto asociado al cliente autenticado con una única categoría. |
| `GET` | `/proyectos/:id` | Público / Autenticado | Detalle de un proyecto y sus especificaciones de categoría. |
| `GET` | `/proyectos/:id/progreso` | Autenticado | Días activos, horas pendientes/aprobadas/congeladas y costo acumulado. |
| `POST` | `/proyectos/:id/postulaciones` | TRABAJADOR | Envía una propuesta económica a un proyecto en estado `ABIERTO`. |
| `GET` | `/postulaciones` | TRABAJADOR / CLIENTE / ADMIN | Lista las postulaciones propias (trabajador), de sus proyectos (cliente) o todas (admin). |
| `PATCH` | `/postulaciones/:id` | CLIENTE dueño / ADMIN | Acepta o rechaza una postulación; al aceptar crea automáticamente la asignación en Express. |

### Asignaciones, Temporizador, Horas y Facturas (Gateway → API 3 Express)
| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/asignaciones` | TRABAJADOR / CLIENTE / ADMIN | Lista las asignaciones del trabajador, de los proyectos del cliente o todas. |
| `POST` | `/asignaciones` | CLIENTE dueño / ADMIN | Crea una asignación validando tarifa mayor a cero y evitando duplicados (`409`). |
| `GET` | `/asignaciones/:id/valor` | TRABAJADOR / CLIENTE / ADMIN | Resumen de horas pendientes, aprobadas, congeladas y valor total acumulado. |
| `POST` | `/asignaciones/:id/temporizador` | TRABAJADOR dueño / ADMIN | Inicia el temporizador de la asignación. Responde `409` si ya está activo o hay solapamiento. |
| `DELETE` | `/asignaciones/:id/temporizador` | TRABAJADOR dueño / ADMIN | Detiene el temporizador activo y crea el registro en `registros_tiempo`. |
| `POST` | `/asignaciones/:id/registros-tiempo` | TRABAJADOR dueño / ADMIN | Registra horas manuales en estado `PENDIENTE` (también disponible en `POST /registros-tiempo`). |
| `GET` | `/registros-tiempo` | TRABAJADOR / CLIENTE / ADMIN | Lista los registros de tiempo correspondientes al usuario autenticado. |
| `PATCH` | `/registros-tiempo/:id` | CLIENTE dueño / ADMIN | Aprueba un registro de tiempo (`estado: 'APROBADO'`) fijando su `tarifa_aplicada` histórica. |
| `DELETE` | `/registros-tiempo/:id` | TRABAJADOR dueño / ADMIN | Elimina un registro de tiempo no congelado (`409` si está `CONGELADO`). |
| `GET` | `/facturas` | TRABAJADOR / CLIENTE / ADMIN | Lista las facturas del trabajador, del cliente o todas. |
| `GET` | `/facturas/:id` | TRABAJADOR / CLIENTE / ADMIN | Detalle de la factura junto con sus `registros_tiempo` asociados. |
| `POST` | `/facturas` | TRABAJADOR / ADMIN | Agrupa las horas `APROBADAS` (de una o varias asignaciones del mismo cliente), crea la factura (`201`) y congela los registros. |
| `PATCH` | `/facturas/:id` | CLIENTE dueño / ADMIN | Cambia `estado_factura` a `APROBADA`, `RECHAZADA` (libera las horas a `APROBADO`) o `PAGADA`. |
| `DELETE` | `/facturas/:id` | CLIENTE dueño / ADMIN | Elimina una factura si no tiene registros congelados (`409` en caso contrario). |

---

## 🛠️ Prerrequisitos
1.  **Node.js & npm:** Para ejecutar la API 3 (Express) y la API 4 (Gateway).
2.  **PHP (XAMPP):** Para ejecutar la API 1.
3.  **Python 3.x & pip/venv:** Para ejecutar la API 2 (FastAPI).
4.  **MySQL / MariaDB (XAMPP):** Base de datos relacional con triggers e integridad referencial.

## ⚙️ Instrucciones de Configuración

### Paso 1: Variables de Entorno (`.env`)
Copia cada plantilla `.env.example` como `.env`:
```bash
cp "api's/Gateway/.env.example" "api's/Gateway/.env"
cp "api's/Python/.env.example" "api's/Python/.env"
cp "api's/Express/.env.example" "api's/Express/.env"
```
Configura el mismo `INTERNAL_API_KEY` (mínimo 32 caracteres) en los tres servicios y el mismo `JWT_SECRET` (mínimo 32 caracteres) en Gateway y Python. Para habilitar el acceso de administrador, define `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 16 caracteres) en `api's/Gateway/.env`.

> **Importante antes de comprimir/entregar:** No incluyas archivos `.env`, entornos virtuales (`.venv`, `api's/Python/venv`) ni carpetas de compilación local en el archivo comprimido de entrega.

### Paso 2: Inicializar Entorno Virtual Python (API 2)
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r "api's\Python\requirements.txt"
```

### Paso 3: Instalar Dependencias Node (API 3 y Gateway)
```powershell
cd "api's/Express"
npm install
cd "../Gateway"
npm install
```

## ▶️ Ejecución de la Aplicación

Ejecuta el script de inicio desde la raíz:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\iniciar_todo.ps1
```
El script inicia MySQL de XAMPP (si aún no está activo) y levanta:
1.  **API 1 (PHP)** en `127.0.0.1:8000`
2.  **API 2 (Python FastAPI)** en `127.0.0.1:5000`
3.  **API 3 (Node.js Express)** en `127.0.0.1:3000`
4.  **API 4 (Gateway + Frontend)** en `http://localhost:4000`

---

## 🧪 Pruebas Automatizadas y Colección de Postman

El repositorio incluye suites de pruebas automatizadas para las tres APIs de datos y una colección completa de Postman:

1. **Pruebas de API 1 — PHP (`api's/api_usuario/tests/test_usuarios.php`):**
   ```powershell
   C:\xampp\php\php.exe "api's\api_usuario\tests\test_usuarios.php"
   ```
   Verifica salud, clave interna (`403`), usuario inexistente (`404`), creación de clientes/trabajadores (`201`), duplicados (`409`), login con `password_verify` (rechazando hashes enviados como contraseña) e inmutabilidad de rol (`409`).
2. **Pruebas de API 2 — Python FastAPI (`api's/Python/tests/test_api.py`):**
   ```powershell
   .\.venv\Scripts\python.exe -m pytest "api's\Python\tests" -v
   ```
   29 pruebas de integración que verifican categorías únicas, transiciones de estado, bloqueo de borrado con asignaciones (`409`), postulaciones en proyectos `ABIERTOS`, progreso y formato de error unificado.
3. **Pruebas de API 3 — Node.js Express (`api's/Express/tests/test_express.js`):**
   ```powershell
   cd "api's\Express"
   npm test
   ```
   Verifica clave interna (`403`), temporizador duplicado y solapamiento (`409`), registro y aprobación de horas, **tarifa histórica**, **factura con múltiples asignaciones**, **bloqueo de registros congelados** (`409`) y liberación de horas al rechazar una factura.
4. **Colección de Postman:**
   Importa el archivo [`Postman_Freelancer_Collection.json`](./Postman_Freelancer_Collection.json) en Postman para probar todas las rutas del flujo completo.

---

## 🗄️ Base de Datos y Esquema

El esquema completo actualizado con sus 11 triggers se encuentra en `Backend/schemas.sql` (pensado para crear una base limpia; **no** lo ejecutes sobre una base con datos que desees conservar porque incluye `DROP DATABASE`). El antiguo script `api's/Python/migracion_bd.sql` fue eliminado del repositorio por ser obsoleto. Consulta [MIGRACION_PLAN.md](./MIGRACION_PLAN.md) para más detalles.

### Pagos
La plataforma no tiene pasarela de pago ni custodia Escrow conectada. Las facturas son registros informativos.

## Presentación del Momento 3
Consulta [PRESENTACION_MOMENTO_3.md](./PRESENTACION_MOMENTO_3.md) para la sustentación tecnológica, capturas, presupuesto y cronograma, y la carpeta `AndroidApp/` para el contenedor híbrido Capacitor.
