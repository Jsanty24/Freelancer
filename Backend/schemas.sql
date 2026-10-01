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
    fecha_inicio DATE NOT NULL,
    estado VARCHAR(50) NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
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