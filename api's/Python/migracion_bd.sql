-- =====================================================================
-- Migracion de la base de datos para la API Python (FastAPI)
-- Base: plataforma_freelance (XAMPP / MariaDB 10.4)
-- Ejecutar UNA sola vez desde la consola:
--   C:\xampp\mysql\bin\mysql.exe -u root < migracion_bd.sql
-- Los cambios aplicados:
--   1) proyectos.usuario_id pasa a apuntar a clientes
--   2) proyectos.categoria  ENUM (5 categorias)
--   3) proyectos.estado     ENUM (valores del codigo Python)
--   4) tabla postulaciones
--   5) tabla registros_tiempo (horas del proyecto)
-- =====================================================================

USE plataforma_freelance;

-- ---------------------------------------------------------------------
-- 1) Los duenos de proyectos deben existir como clientes (requerido por
--    la nueva FK) y el script Backend/schemas.sql crea clientes vacios..
-- ---------------------------------------------------------------------
INSERT IGNORE INTO clientes (usuario_id, razon_social, direccion_facturacion)
SELECT DISTINCT p.usuario_id,
       COALESCE(u.nombre, CONCAT('Cliente ', p.usuario_id)),
       'Alta automatica por migracion de la API Python'
FROM proyectos p
LEFT JOIN usuarios u ON u.id = p.usuario_id
LEFT JOIN clientes c ON c.usuario_id = p.usuario_id
WHERE c.usuario_id IS NULL;

-- Se reemplaza la FK proyectos.usuario_id -> usuarios por -> clientes
SET @fk = (
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'proyectos'
      AND COLUMN_NAME = 'usuario_id'
      AND REFERENCED_TABLE_NAME = 'usuarios'
    LIMIT 1
);
SET @sql = IF(@fk IS NOT NULL,
              CONCAT('ALTER TABLE proyectos DROP FOREIGN KEY `', @fk, '`'),
              'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @existe_fk = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'proyectos'
      AND COLUMN_NAME = 'usuario_id'
      AND REFERENCED_TABLE_NAME = 'clientes'
);
SET @sql = IF(@existe_fk = 0,
              'ALTER TABLE proyectos ADD CONSTRAINT fk_proyectos_cliente FOREIGN KEY (usuario_id) REFERENCES clientes(usuario_id)',
              'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 2) Columna categoria (5 especialidades). NULL = proyecto general.
-- ---------------------------------------------------------------------
ALTER TABLE proyectos
    ADD COLUMN IF NOT EXISTS categoria
    ENUM('TecnologiaYProgramacion',
         'DisenoYMultimedia',
         'RedaccionYContenido',
         'MarketingDigitalYRedesSociales',
         'AsistenciaVirtualYAdministracion')
    NULL DEFAULT NULL
    AFTER descripcion;

UPDATE proyectos p
SET p.categoria = COALESCE(
    (SELECT 'TecnologiaYProgramacion' FROM proyectos_tecnologia t WHERE t.proyecto_id = p.id LIMIT 1),
    (SELECT 'DisenoYMultimedia'       FROM proyectos_diseno     d WHERE d.proyecto_id = p.id LIMIT 1),
    (SELECT 'RedaccionYContenido'     FROM proyectos_redaccion  r WHERE r.proyecto_id = p.id LIMIT 1),
    (SELECT 'MarketingDigitalYRedesSociales' FROM proyectos_marketing m WHERE m.proyecto_id = p.id LIMIT 1),
    (SELECT 'AsistenciaVirtualYAdministracion' FROM proyectos_asistencia a WHERE a.proyecto_id = p.id LIMIT 1)
)
WHERE p.categoria IS NULL;

-- ---------------------------------------------------------------------
-- 3) estado pasa a ENUM con los valores que usa el codigo (D04).
--    Primero se normalizan los valores viejos, luego se cambia el tipo.
-- ---------------------------------------------------------------------
UPDATE proyectos SET estado = 'ABIERTO'     WHERE estado IN ('Abierto', 'Nuevo', 'Publicado');
UPDATE proyectos SET estado = 'EN_CURSO'    WHERE estado IN ('En Curso', 'En curso', 'en curso', 'En CURSO');
UPDATE proyectos SET estado = 'PAUSADO'     WHERE estado IN ('Pausado', 'En pausa', 'Pausa');
UPDATE proyectos SET estado = 'COMPLETADO'  WHERE estado IN ('Completado', 'Terminado', 'Finalizado');
UPDATE proyectos SET estado = 'CANCELADO'   WHERE estado IN ('Cancelado', 'Descartado');
UPDATE proyectos SET estado = 'EN_CURSO'
WHERE estado NOT IN ('ABIERTO', 'EN_CURSO', 'PAUSADO', 'COMPLETADO', 'CANCELADO');

ALTER TABLE proyectos
    MODIFY estado ENUM('ABIERTO', 'EN_CURSO', 'PAUSADO', 'COMPLETADO', 'CANCELADO')
    NOT NULL DEFAULT 'ABIERTO';

-- ---------------------------------------------------------------------
-- 4) Postulaciones de trabajadores a proyectos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS postulaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    mensaje TEXT NULL,
    estado ENUM('PENDIENTE', 'ACEPTADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
    fecha_postulacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_postulaciones_proyecto_usuario (proyecto_id, usuario_id),
    KEY idx_postulaciones_usuario (usuario_id),
    CONSTRAINT fk_postulaciones_proyecto
        FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    CONSTRAINT fk_postulaciones_trabajador
        FOREIGN KEY (usuario_id) REFERENCES trabajadores(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5) Registros de tiempo: fuente de horas aprobadas/pendientes y del
--    costo acumulado que devuelve GET /proyectos/{id}/progreso.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registros_tiempo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asignacion_id INT NOT NULL,
    fecha DATE NOT NULL,
    inicio DATETIME NULL,
    fin DATETIME NULL,
    horas DECIMAL(6,2) NOT NULL DEFAULT 0,
    origen ENUM('TEMPORIZADOR', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    estado ENUM('PENDIENTE', 'APROBADO', 'CONGELADO') NOT NULL DEFAULT 'PENDIENTE',
    KEY idx_registros_tiempo_asignacion (asignacion_id),
    CONSTRAINT fk_registros_tiempo_asignacion
        FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
