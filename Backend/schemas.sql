DROP DATABASE IF EXISTS plataforma_freelance;
CREATE DATABASE plataforma_freelance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE plataforma_freelance;
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(20)
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
    usuario_id INT NOT NULL,
    nombre_proyecto VARCHAR(150) NOT NULL,
    descripcion TEXT,
    categoria ENUM(
        'TecnologiaYProgramacion',
        'DisenoYMultimedia',
        'RedaccionYContenido',
        'MarketingDigitalYRedesSociales',
        'AsistenciaVirtualYAdministracion'
    ) NULL DEFAULT NULL,
    fecha_inicio DATE NOT NULL,
    estado ENUM('ABIERTO', 'EN_CURSO', 'PAUSADO', 'COMPLETADO', 'CANCELADO') NOT NULL DEFAULT 'ABIERTO',
    FOREIGN KEY (usuario_id) REFERENCES clientes(usuario_id)
);
CREATE TABLE proyectos_tecnologia (
    proyecto_id INT PRIMARY KEY,
    lenguaje_principal VARCHAR(100) NOT NULL,
    repositorio_url VARCHAR(255),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);
CREATE TABLE proyectos_diseno (
    proyecto_id INT PRIMARY KEY,
    software_utilizado VARCHAR(100) NOT NULL,
    formato_entrega VARCHAR(50) NOT NULL,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);
CREATE TABLE proyectos_redaccion (
    proyecto_id INT PRIMARY KEY,
    cantidad_palabras INT NOT NULL,
    idioma VARCHAR(50) NOT NULL,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);
CREATE TABLE proyectos_marketing (
    proyecto_id INT PRIMARY KEY,
    plataforma_objetivo VARCHAR(100) NOT NULL,
    tipo_campana VARCHAR(100) NOT NULL,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);
CREATE TABLE proyectos_asistencia (
    proyecto_id INT PRIMARY KEY,
    herramientas_manejo VARCHAR(255) NOT NULL,
    horas_semanales_requeridas INT NOT NULL,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);
CREATE TABLE facturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fecha_emision DATE NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    estado_factura VARCHAR(50) NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE TABLE asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    proyecto_id INT NOT NULL,
    factura_id INT UNIQUE NULL,
    rol_en_proyecto VARCHAR(100) NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    temporizador_activo BOOLEAN NOT NULL DEFAULT FALSE,
    estado_tiempo ENUM('PENDIENTE', 'APROBADO', 'CONGELADO') NOT NULL DEFAULT 'PENDIENTE',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE SET NULL
);
CREATE TABLE registros_tiempo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asignacion_id INT NOT NULL,
    fecha DATE NOT NULL,
    inicio DATETIME NULL,
    fin DATETIME NULL,
    horas DECIMAL(6,2) NOT NULL DEFAULT 0,
    origen ENUM('TEMPORIZADOR', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    estado ENUM('PENDIENTE', 'APROBADO', 'CONGELADO') NOT NULL DEFAULT 'PENDIENTE',
    FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE
);
CREATE TABLE postulaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tarifa_por_hora DECIMAL(10,2) NOT NULL,
    mensaje TEXT NULL,
    estado ENUM('PENDIENTE', 'ACEPTADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
    fecha_postulacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_postulaciones_proyecto_usuario (proyecto_id, usuario_id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES trabajadores(usuario_id) ON DELETE CASCADE
);