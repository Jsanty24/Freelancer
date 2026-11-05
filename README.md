# 🏢 Sistema de Gestión Freelancer

Bienvenido al proyecto Sistema de Gestión Freelancer. Esta plataforma es un sistema integral diseñado para gestionar las relaciones entre clientes, freelancers (trabajadores) y proyectos, facilitando todo, desde la iniciación del proyecto y las postulaciones hasta el seguimiento horario y la facturación.

## 🚀 Descripción General del Proyecto
La arquitectura es modular, utilizando cuatro microservicios distintos conectados a través de una Pasarela API (API Gateway). Esta separación permite un desarrollo, escalado y pilas tecnológicas independientes para diferentes dominios de negocio (ej.: Autenticación de Usuarios vía PHP, Gestión de Proyectos vía Python FastAPI, etc.).

### Módulos Clave:
*   **Gestión de Usuarios y Clientes:** Maneja perfiles de usuario centrales, cuentas de clientes y registro de trabajadores (PHP).
*   **Seguimiento de Proyectos y Aplicaciones:** Administra el ciclo de vida de los proyectos y las postulaciones enviadas por freelancers (Python FastAPI).
*   **Tiempo y Facturación:** Registra horas aprobadas y genera facturas informativas (Node.js Express). No procesa pagos ni custodia fondos.
*   **Pasarela API/Hub Frontend:** El punto de entrada central (`localhost:4000`) que orquesta las interacciones entre todos los microservicios y sirve la interfaz de usuario principal.

## 🛠️ Prerrequisitos
Antes de ejecutar la aplicación, asegúrate de tener instaladas las siguientes herramientas en tu sistema:

1.  **Node.js & npm:** Para gestionar dependencias frontend y la API Express (API 3 y Gateway).
2.  **PHP (Se recomienda XAMPP):** Para el desarrollo y ejecución de la API 1.
3.  **Python 3.x & pip/venv:** Para configurar y ejecutar el backend FastAPI (API 2).
4.  **Acceso a Base de Datos:** Se requieren credenciales para MySQL/MariaDB, que se almacenarán típicamente en archivos `.env` (Use `.env.example` como plantilla).

## ⚙️ Instrucciones de Configuración

Sigue estos pasos para configurar todos los servicios:

### Paso 1: Variables de Entorno (`.env`)
Para la pasarela, copia `api's/Gateway/.env.example` como `api's/Gateway/.env` y completa la configuración. Copia también los ejemplos de Python y Express como sus respectivos archivos `.env`.
```bash
cp "api's/Gateway/.env.example" "api's/Gateway/.env"
cp "api's/Python/.env.example" "api's/Python/.env"
cp "api's/Express/.env.example" "api's/Express/.env"
```

Usa una `INTERNAL_API_KEY` aleatoria de al menos 32 caracteres y repite el mismo valor en los tres servicios. Configura también el mismo `JWT_SECRET` de al menos 32 caracteres en Gateway y Python.

### Acceso de administrador
Define `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 16 caracteres) en `api's/Gateway/.env`. No hay credenciales predeterminadas; el acceso se habilita únicamente cuando estas variables están configuradas. En la página, selecciona **Acceso Admin** al pie de página o desde el formulario de inicio de sesión.

### Paso 2: Inicializar Entorno Virtual Python (API 2)
Desde la raíz del proyecto, configura el entorno virtual que utiliza el script de inicio:
```bash
python -m venv .venv
# Windows:
.\.venv\Scripts\python.exe -m pip install -r "api's\Python\requirements.txt"
# Linux/macOS:
# .venv/bin/python -m pip install -r "api's/Python/requirements.txt"
```
El script detecta Python y XAMPP en Windows. Si usas otra ubicación, configura los ejecutables y servicios antes de iniciarlo.

### Paso 3: Instalar Dependencias Node (API 3 y Gateway)
Para la API Express y el gateway principal:
```bash
cd api's/Express
npm install
cd ../Gateway
npm install
```

## ▶️ Ejecución de la Aplicación

La forma recomendada de iniciar todos los servicios simultáneamente es ejecutando el script de PowerShell proporcionado, el cual gestiona el proceso, carga de entorno y orden de ejecución.

**Ejecuta el script de inicio:**
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\iniciar_todo.ps1
```
La política `Bypass` se limita a ese proceso; no cambia la política permanente del sistema.

Este script inicia MySQL de XAMPP (si está disponible y todavía no está activo) y va a:
1.  Iniciar **API 1 (PHP)** en el puerto `8000`.
2.  Iniciar **API 2 (Python FastAPI)** en el puerto `5000`.
3.  Iniciar **API 3 (Node.js Express)** en el puerto `3000`.
4.  Iniciar **API 4 (Gateway/Hub Frontend)** en el puerto `4000`.

### Verificación
Al finalizar, el script indica qué puertos respondieron y consulta el estado de salud del Gateway. Un servicio puede estar ejecutándose y, aun así, reportarse degradado si falta la base de datos o requiere migración. Puedes acceder a:

*   **Panel de Control Principal del Frontend:** `http://localhost:4000/`
*   **Verificación de Salud del Gateway:** `http://localhost:4000/health`

### Base de datos existente

La aplicación necesita que el esquema de MariaDB coincida con los servicios PHP, Python y Express. El script de inicio no ejecuta migraciones ni sobrescribe datos. **No ejecutes `Backend/schemas.sql` sobre una base existente:** contiene instrucciones que borran la base de datos. Tampoco ejecutes `api's/Python/migracion_bd.sql`: es una migración antigua que crea perfiles con datos inventados y usa columnas y estados incompatibles con el modelo actual. Consulta [MIGRACION_PLAN.md](./MIGRACION_PLAN.md) antes de migrar; primero prepara y verifica un respaldo y confirma los mapeos pendientes.

### Pagos

La plataforma no tiene una pasarela de pago, proveedor de custodia Escrow ni servicio de retiros conectado. Las facturas son registros informativos: no acreditan pagos ni fondos protegidos.

## 🔄 Referencia de Estructura de Directorios

| Carpeta | Tecnología | Propósito | Endpoint (Por defecto) |
| :--- | :--- | :--- | :--- |
| `api's/api_usuario` | PHP | Autenticación de usuarios, perfiles de clientes, gestión de trabajadores. | `http://localhost:8000` |
| `api's/Python` | Python (FastAPI) | Gestiona la creación de proyectos y las postulaciones de freelancers. | `http://localhost:5000` |
| `api's/Express` | Node.js (Express) | Rastrea horas asignadas, gestiona tareas y maneja datos de facturación. | `http://localhost:3000` |
| `api's/Gateway` | Node.js (Express) | El enrutador central que dirige las solicitudes del frontend a la API backend apropiada. | `http://localhost:4000` |
| `Frontend/` | HTML, CSS y JavaScript | Interfaz SPA servida por el Gateway. | `http://localhost:4000/` |
| `Backend/` | SQL | Esquema heredado/base de datos; revisa sus instrucciones antes de ejecutarlas. | N/A |