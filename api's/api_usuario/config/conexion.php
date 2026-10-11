<?php

require_once __DIR__ . '/../baseDatos/bd.php';

class Database {
    private ?PDO $conn = null;

    public function getConnection(): ?PDO {
        $this->conn = null;

        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ];

            $this->conn = new PDO($dsn, DB_USER, DB_PASS, $options);

        } catch (PDOException $exception) {
            error_log("Error de conexión en Base de Datos: " . $exception->getMessage());
        }

        return $this->conn;
    }
}