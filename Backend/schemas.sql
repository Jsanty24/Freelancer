DROP DATABASE IF EXISTS plataforma_freelance;
CREATE DATABASE plataforma_freelance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE plataforma_freelance;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('CLIENTE','TRABAJADOR') NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clientes (
    usuario_id INT PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    direccion_facturacion VARCHAR(255) NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE trabajadores (
    usuario_id INT PRIMARY KEY,
    especialidad VARCHAR(100) NOT NULL,
    disponibilidad BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE proyectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    nombre_proyecto VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE NOT NULL,
    tipo ENUM('TECNOLOGIA','DISENO','REDACCION','MARKETING','ASISTENCIA') NOT NULL,
    estado ENUM('BORRADOR','ABIERTO','EN_CURSO','PAUSADO','FINALIZADO','CANCELADO')
        NOT NULL DEFAULT 'ABIERTO',
    UNIQUE KEY uq_proyecto_tipo (id, tipo),
    FOREIGN KEY (cliente_id) REFERENCES clientes(usuario_id)
);

CREATE TABLE proyectos_tecnologia (
    proyecto_id INT NOT NULL PRIMARY KEY,
    tipo ENUM('TECNOLOGIA','DISENO','REDACCION','MARKETING','ASISTENCIA')
        NOT NULL DEFAULT 'TECNOLOGIA',
    lenguaje_principal VARCHAR(100) NOT NULL,
    repositorio_url VARCHAR(255),
    CONSTRAINT chk_tec_tipo CHECK (tipo = 'TECNOLOGIA'),
    FOREIGN KEY (proyecto_id, tipo) REFERENCES proyectos(id, tipo) ON DELETE CASCADE
);

CREATE TABLE proyectos_diseno (
    proyecto_id INT NOT NULL PRIMARY KEY,
    tipo ENUM('TECNOLOGIA','DISENO','REDACCION','MARKETING','ASISTENCIA')
        NOT NULL DEFAULT 'DISENO',
    software_utilizado VARCHAR(100) NOT NULL,
    formato_entrega VARCHAR(50) NOT NULL,
    CONSTRAINT chk_dis_tipo CHECK (tipo = 'DISENO'),
    FOREIGN KEY (proyecto_id, tipo) REFERENCES proyectos(id, tipo) ON DELETE CASCADE
);

CREATE TABLE proyectos_redaccion (
    proyecto_id INT NOT NULL PRIMARY KEY,
    tipo ENUM('TECNOLOGIA','DISENO','REDACCION','MARKETING','ASISTENCIA')
        NOT NULL DEFAULT 'REDACCION',
    cantidad_palabras INT NOT NULL,
    idioma VARCHAR(50) NOT NULL,
    CONSTRAINT chk_red_tipo CHECK (tipo = 'REDACCION'),
    CONSTRAINT chk_palabras CHECK (cantidad_palabras > 0),
    FOREIGN KEY (proyecto_id, tipo) REFERENCES proyectos(id, tipo) ON DELETE CASCADE
);

CREATE TABLE proyectos_marketing (
    proyecto_id INT NOT NULL PRIMARY KEY,
    tipo ENUM('TECNOLOGIA','DISENO','REDACCION','MARKETING','ASISTENCIA')
        NOT NULL DEFAULT 'MARKETING',
    plataforma_objetivo VARCHAR(100) NOT NULL,
    tipo_campana VARCHAR(100) NOT NULL,
    CONSTRAINT chk_mkt_tipo CHECK (tipo = 'MARKETING'),
    FOREIGN KEY (proyecto_id, tipo) REFERENCES proyectos(id, tipo) ON DELETE CASCADE
);

CREATE TABLE proyectos_asistencia (
    proyecto_id INT NOT NULL PRIMARY KEY,
    tipo ENUM('TECNOLOGIA','DISENO','REDACCION','MARKETING','ASISTENCIA')
        NOT NULL DEFAULT 'ASISTENCIA',
    herramientas_manejo VARCHAR(255) NOT NULL,
    horas_semanales_requeridas INT NOT NULL,
    CONSTRAINT chk_asi_tipo CHECK (tipo = 'ASISTENCIA'),
    CONSTRAINT chk_horas_sem CHECK (horas_semanales_requeridas BETWEEN 1 AND 168),
    FOREIGN KEY (proyecto_id, tipo) REFERENCES proyectos(id, tipo) ON DELETE CASCADE
);

CREATE TABLE postulaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trabajador_id INT NOT NULL,
    proyecto_id INT NOT NULL,
    mensaje TEXT,
    tarifa_propuesta DECIMAL(10,2) NOT NULL,
    estado ENUM('PENDIENTE','ACEPTADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
    fecha_postulacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_tarifa_propuesta CHECK (tarifa_propuesta > 0),
    UNIQUE KEY uq_postulacion (trabajador_id, proyecto_id),
    FOREIGN KEY (trabajador_id) REFERENCES trabajadores(usuario_id) ON DELETE CASCADE,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);

CREATE TABLE facturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    trabajador_id INT NOT NULL,
    fecha_emision DATE NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    estado_factura ENUM('PENDIENTE','APROBADA','RECHAZADA','PAGADA')
        NOT NULL DEFAULT 'PENDIENTE',
    CONSTRAINT chk_valor_total CHECK (valor_total >= 0),
    FOREIGN KEY (cliente_id) REFERENCES clientes(usuario_id),
    FOREIGN KEY (trabajador_id) REFERENCES trabajadores(usuario_id)
);

CREATE TABLE asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trabajador_id INT NOT NULL,
    proyecto_id INT NOT NULL,
    rol_en_proyecto VARCHAR(100) NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    temporizador_inicio DATETIME NULL,
    CONSTRAINT chk_tarifa CHECK (tarifa_por_hora > 0),
    UNIQUE KEY uq_asignacion (trabajador_id, proyecto_id),
    FOREIGN KEY (trabajador_id) REFERENCES trabajadores(usuario_id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id)
);

CREATE TABLE registros_tiempo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asignacion_id INT NOT NULL,
    inicio DATETIME NOT NULL,
    fin DATETIME NULL,
    horas DECIMAL(5,2) NOT NULL,
    tarifa_aplicada DECIMAL(10,2) NULL,
    origen ENUM('TEMPORIZADOR','MANUAL') NOT NULL,
    estado ENUM('PENDIENTE','APROBADO','CONGELADO') NOT NULL DEFAULT 'PENDIENTE',
    factura_id INT NULL,
    CONSTRAINT chk_horas CHECK (horas > 0),
    CONSTRAINT chk_fin CHECK (fin IS NULL OR fin > inicio),
    CONSTRAINT chk_tarifa_aplicada CHECK (tarifa_aplicada IS NULL OR tarifa_aplicada > 0),
    CONSTRAINT chk_tarifa_obligatoria CHECK (estado = 'PENDIENTE' OR tarifa_aplicada IS NOT NULL),
    FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id),
    FOREIGN KEY (factura_id) REFERENCES facturas(id)
);

DELIMITER //

CREATE TRIGGER trg_registros_congelados_update
BEFORE UPDATE ON registros_tiempo
FOR EACH ROW
BEGIN
    IF OLD.estado = 'CONGELADO' THEN
        IF NOT (
            NEW.estado = 'APROBADO'
            AND NEW.factura_id IS NULL
            AND OLD.factura_id IS NOT NULL
            AND (SELECT estado_factura FROM facturas WHERE id = OLD.factura_id) = 'RECHAZADA'
            AND NEW.asignacion_id <=> OLD.asignacion_id
            AND NEW.inicio <=> OLD.inicio
            AND NEW.fin <=> OLD.fin
            AND NEW.horas <=> OLD.horas
            AND NEW.tarifa_aplicada <=> OLD.tarifa_aplicada
            AND NEW.origen <=> OLD.origen
        ) THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede modificar un registro de tiempo congelado';
        END IF;
    END IF;
END//

CREATE TRIGGER trg_registros_congelados_delete
BEFORE DELETE ON registros_tiempo
FOR EACH ROW
BEGIN
    IF OLD.estado = 'CONGELADO' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede eliminar un registro de tiempo congelado';
    END IF;
END//

CREATE TRIGGER trg_asignacion_bloquea_borrado
BEFORE DELETE ON asignaciones
FOR EACH ROW
BEGIN
    IF EXISTS (SELECT 1 FROM registros_tiempo
               WHERE asignacion_id = OLD.id AND estado = 'CONGELADO') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede borrar una asignacion con registros congelados';
    END IF;
END//

CREATE TRIGGER trg_factura_bloquea_borrado
BEFORE DELETE ON facturas
FOR EACH ROW
BEGIN
    IF EXISTS (SELECT 1 FROM registros_tiempo
               WHERE factura_id = OLD.id AND estado = 'CONGELADO') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede borrar una factura con registros congelados';
    END IF;
END//

CREATE TRIGGER trg_factura_transicion
BEFORE UPDATE ON facturas
FOR EACH ROW
BEGIN
    IF NEW.estado_factura = 'RECHAZADA' AND OLD.estado_factura <> 'PENDIENTE' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Solo se puede rechazar una factura pendiente';
    END IF;
END//

CREATE TRIGGER trg_factura_rechazada_libera
AFTER UPDATE ON facturas
FOR EACH ROW
BEGIN
    IF NEW.estado_factura = 'RECHAZADA'
       AND OLD.estado_factura = 'PENDIENTE' THEN
        UPDATE registros_tiempo
        SET estado = 'APROBADO', factura_id = NULL
        WHERE factura_id = NEW.id;
    END IF;
END//

CREATE TRIGGER trg_postulacion_solo_abierto
BEFORE INSERT ON postulaciones
FOR EACH ROW
BEGIN
    IF (SELECT estado FROM proyectos WHERE id = NEW.proyecto_id) <> 'ABIERTO' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Solo se puede postular a proyectos en estado ABIERTO';
    END IF;
END//

CREATE TRIGGER trg_cliente_rol
BEFORE INSERT ON clientes
FOR EACH ROW
BEGIN
    IF (SELECT rol FROM usuarios WHERE id = NEW.usuario_id) <> 'CLIENTE' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El usuario no tiene rol CLIENTE';
    END IF;
END//

CREATE TRIGGER trg_trabajador_rol
BEFORE INSERT ON trabajadores
FOR EACH ROW
BEGIN
    IF (SELECT rol FROM usuarios WHERE id = NEW.usuario_id) <> 'TRABAJADOR' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El usuario no tiene rol TRABAJADOR';
    END IF;
END//

CREATE TRIGGER trg_usuario_rol_inmutable
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF NEW.rol <> OLD.rol
       AND (EXISTS (SELECT 1 FROM clientes WHERE usuario_id = OLD.id)
            OR EXISTS (SELECT 1 FROM trabajadores WHERE usuario_id = OLD.id)) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede cambiar el rol de un usuario con perfil creado';
    END IF;
END//

DELIMITER ;