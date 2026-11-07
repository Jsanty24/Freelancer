# Plan de migracion de MariaDB

**Estado: base original conservada sin cambios; migracion de sus datos no aplicada.** Para la demostracion se creo una base separada vacia, `plataforma_freelance_demo`, a partir del modelo actual. Los servicios locales PHP, Python y Express apuntan a esa base de demostracion. No se copiaron ni se modificaron filas de la base original.

## Respaldo verificado

Se creo fuera del repositorio un volcado completo de `plataforma_freelance` con `mysqldump --single-transaction`, rutinas, triggers, eventos y datos binarios codificados. Se verifico el marcador de finalizacion y se calculo su SHA-256. El archivo y el hash se entregan por separado; no contiene credenciales de conexion en el repositorio.

## Inventario sin datos personales

Servidor MariaDB 10.4.32. Conteos exactos:

| Tabla | Filas |
|---|---:|
| usuarios | 2 |
| clientes | 0 |
| trabajadores | 0 |
| proyectos | 3 |
| proyectos_tecnologia | 1 |
| proyectos_diseno | 0 |
| proyectos_redaccion | 0 |
| proyectos_marketing | 0 |
| proyectos_asistencia | 0 |
| asignaciones | 5 |
| facturas | 3 |

Las referencias foraneas actuales no tienen filas huerfanas. Esto no resuelve los mapeos semanticos que faltan.

## Bloqueos de mapeo

- `usuarios` no tiene `rol` ni `password_hash`; tampoco hay perfiles de cliente o trabajador. No se puede determinar la identidad de rol ni trasladar credenciales de forma segura.
- Dos proyectos no tienen detalle que permita identificar su categoria. Los estados existentes son `ACTIVO` (2) y `FINALIZADO` (1); `ACTIVO` no distingue entre abierto y en curso en el modelo nuevo.
- Las cinco asignaciones tienen horas acumuladas, pero no existe historial detallado de tiempo. Tres estan vinculadas a facturas y una tiene el temporizador marcado como activo. No se deben inventar fechas ni registros de horas para llenar `registros_tiempo`.
- Las tres facturas tienen estado legado `GENERADA`, que no es un estado del modelo actual. Ese valor no acredita que se haya realizado un pago.
- No existen las tablas `postulaciones` ni `registros_tiempo`.

Antes de importar hacen falta decisiones para cada cuenta (rol, perfil y restablecimiento de contrasena), para la categoria y estado de los proyectos, y para el tratamiento de horas, temporizador y facturas heredadas.

## Migracion propuesta

1. No escribir en la base original. Antes del corte, tomar y verificar un respaldo reciente y restaurar el respaldo actual en una instancia o base aislada para probar el proceso.
2. Obtener las decisiones de mapeo pendientes. No asignar roles, datos de perfil, categoria, horas ni estados de pago por inferencia.
3. Crear una base de destino nueva con el esquema que actualmente requieren `api's/Python/app/models.py`, Express y PHP. Preparar un DDL versionado sin `DROP DATABASE`; no reutilizar sin cambios los scripts heredados.
4. Copiar desde el respaldo al destino con transformaciones explicitamente aprobadas. Mantener la base original intacta y conservar una copia de las filas heredadas que no se puedan mapear.
5. Validar conteos, claves foraneas, unicidad, totales de horas y asignaciones factura-proyecto; ejecutar pruebas de integracion en el destino. No marcar facturas como pagadas sin evidencia de pago.
6. Cambiar la configuracion de los servicios al destino solo despues de aprobar esas verificaciones. Conservar la base original y el respaldo para poder volver a la configuracion anterior.

## Scripts heredados que no se deben ejecutar

- `Backend/schemas.sql` empieza con `DROP DATABASE IF EXISTS plataforma_freelance`.
- `api's/Python/migracion_bd.sql` inserta perfiles de cliente con datos de relleno, convierte estados desconocidos a `EN_CURSO`, usa categorias y columnas antiguas, y no coincide con el esquema actual de postulaciones ni de registros de tiempo.

Ninguno de esos scripts se ejecuto. Los health checks locales de PHP, Python, Express y Gateway verifican la base de demostracion y responden saludablemente. La base original sigue pendiente de las decisiones de mapeo indicadas arriba; si se vuelve a configurar como destino de los servicios, sus health checks solicitaran migracion.
