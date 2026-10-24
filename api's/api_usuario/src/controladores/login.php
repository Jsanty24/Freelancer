<?php

require_once __DIR__ . '/../../config/conexion.php';

class LoginController {
    private ?PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function create(): void {
        if (!$this->db) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Sin conexión a la BD"]);
            return;
        }

        $data = json_decode(file_get_contents("php://input"), true) ?? [];
        $email = isset($data['email']) ? trim((string) $data['email']) : '';
        $password = isset($data['password']) ? (string) $data['password'] : '';

        if ($email === '' || $password === '') {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Los campos 'email' y 'password' son obligatorios"
            ]);
            return;
        }

        $stmt = $this->db->prepare(
            "SELECT id, nombre, email, telefono, password_hash, rol, fecha_registro
             FROM usuarios
             WHERE email = :email
             LIMIT 1"
        );
        $stmt->bindParam(':email', $email, PDO::PARAM_STR);
        $stmt->execute();
        $usuario = $stmt->fetch();

        if (!$usuario) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Credenciales inválidas"]);
            return;
        }

        $hashGuardado = (string) $usuario['password_hash'];
        $passwordValido = password_verify($password, $hashGuardado) || hash_equals($hashGuardado, $password);

        if (!$passwordValido) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Credenciales inválidas"]);
            return;
        }

        unset($usuario['password_hash']);
        $usuario['id'] = (int) $usuario['id'];

        $perfil = null;
        if ($usuario['rol'] === 'CLIENTE') {
            $stmtPerfil = $this->db->prepare(
                "SELECT razon_social, direccion_facturacion FROM clientes WHERE usuario_id = :id"
            );
            $stmtPerfil->bindParam(':id', $usuario['id'], PDO::PARAM_INT);
            $stmtPerfil->execute();
            $perfil = $stmtPerfil->fetch() ?: null;
        } elseif ($usuario['rol'] === 'TRABAJADOR') {
            $stmtPerfil = $this->db->prepare(
                "SELECT especialidad, disponibilidad FROM trabajadores WHERE usuario_id = :id"
            );
            $stmtPerfil->bindParam(':id', $usuario['id'], PDO::PARAM_INT);
            $stmtPerfil->execute();
            $perfil = $stmtPerfil->fetch() ?: null;
        }

        $usuario['perfil'] = $perfil;

        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "message" => "Inicio de sesión exitoso",
            "data" => $usuario
        ]);
    }

    public function get(?int $id = null): void {
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Usa POST /login para iniciar sesión"]);
    }
}
