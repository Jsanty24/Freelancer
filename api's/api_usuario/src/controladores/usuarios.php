<?php

require_once __DIR__ . '/../../config/conexion.php';

class UsuarioController {
    private ?PDO $db;
    private const ROLES_VALIDOS = ['CLIENTE', 'TRABAJADOR'];

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function get(?int $id = null): void {
        if (!$this->db) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Sin conexión a la BD"]);
            return;
        }

        if ($id !== null) {
            $stmt = $this->db->prepare(
                "SELECT id, nombre, email, telefono, rol, fecha_registro FROM usuarios WHERE id = :id"
            );
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $usuario = $stmt->fetch();

            if ($usuario) {
                http_response_code(200);
                echo json_encode(["status" => "success", "data" => $usuario]);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Usuario no encontrado"]);
            }
        } else {
            $stmt = $this->db->prepare(
                "SELECT id, nombre, email, telefono, rol, fecha_registro FROM usuarios ORDER BY id ASC"
            );
            $stmt->execute();
            $usuarios = $stmt->fetchAll();

            http_response_code(200);
            echo json_encode(["status" => "success", "data" => $usuarios]);
        }
    }

    public function create(): void {
        $data = json_decode(file_get_contents("php://input"), true) ?? [];

        $passwordRaw = $data['password'] ?? $data['password_hash'] ?? '';
        $rol = isset($data['rol']) ? strtoupper(trim((string) $data['rol'])) : '';

        if (empty($data['nombre']) || empty($data['email']) || empty($passwordRaw) || empty($rol)) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Los campos 'nombre', 'email', 'password' (o 'password_hash') y 'rol' son obligatorios"
            ]);
            return;
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El email no es válido"]);
            return;
        }

        if (!in_array($rol, self::ROLES_VALIDOS, true)) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "El campo 'rol' debe ser 'CLIENTE' o 'TRABAJADOR'"
            ]);
            return;
        }

        $telefono = $data['telefono'] ?? null;
        $passwordHash = !empty($data['password'])
            ? password_hash((string) $data['password'], PASSWORD_BCRYPT)
            : (string) $data['password_hash'];

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO usuarios (nombre, email, telefono, password_hash, rol)
                 VALUES (:nombre, :email, :telefono, :password_hash, :rol)"
            );
            $stmt->bindParam(':nombre', $data['nombre'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':telefono', $telefono, PDO::PARAM_STR);
            $stmt->bindParam(':password_hash', $passwordHash, PDO::PARAM_STR);
            $stmt->bindParam(':rol', $rol, PDO::PARAM_STR);
            $stmt->execute();

            http_response_code(201);
            echo json_encode([
                "status" => "success",
                "message" => "Usuario registrado correctamente",
                "id_creado" => (int) $this->db->lastInsertId()
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "Ya existe un usuario con ese email"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al guardar el usuario"]);
            }
        }
    }

    public function updateFull(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true) ?? [];

        $rol = isset($data['rol']) ? strtoupper(trim((string) $data['rol'])) : '';

        if (empty($data['nombre']) || empty($data['email']) || empty($rol)) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "PUT requiere 'nombre', 'email' y 'rol'"
            ]);
            return;
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El email no es válido"]);
            return;
        }

        if (!in_array($rol, self::ROLES_VALIDOS, true)) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "El campo 'rol' debe ser 'CLIENTE' o 'TRABAJADOR'"
            ]);
            return;
        }

        if (!$this->existe($id)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Usuario no encontrado"]);
            return;
        }

        $telefono = $data['telefono'] ?? null;

        try {
            if (!empty($data['password']) || !empty($data['password_hash'])) {
                $passwordHash = !empty($data['password'])
                    ? password_hash((string) $data['password'], PASSWORD_BCRYPT)
                    : (string) $data['password_hash'];

                $stmt = $this->db->prepare(
                    "UPDATE usuarios
                     SET nombre = :nombre, email = :email, telefono = :telefono, rol = :rol, password_hash = :password_hash
                     WHERE id = :id"
                );
                $stmt->bindParam(':password_hash', $passwordHash, PDO::PARAM_STR);
            } else {
                $stmt = $this->db->prepare(
                    "UPDATE usuarios
                     SET nombre = :nombre, email = :email, telefono = :telefono, rol = :rol
                     WHERE id = :id"
                );
            }

            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':nombre', $data['nombre'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':telefono', $telefono, PDO::PARAM_STR);
            $stmt->bindParam(':rol', $rol, PDO::PARAM_STR);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Usuario actualizado (PUT)"]);
        } catch (PDOException $e) {
            if ($e->getCode() === '45000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "No se puede cambiar el rol de un usuario con perfil creado"]);
            } elseif ($e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "Ya existe un usuario con ese email"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al actualizar el usuario"]);
            }
        }
    }

    public function updatePartial(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true) ?? [];

        $sets = [];
        $valores = [];

        foreach (['nombre', 'email', 'telefono'] as $campo) {
            if (array_key_exists($campo, $data)) {
                $sets[] = "$campo = :$campo";
                $valores[":$campo"] = $data[$campo];
            }
        }

        if (isset($data['rol'])) {
            $rol = strtoupper(trim((string) $data['rol']));
            if (!in_array($rol, self::ROLES_VALIDOS, true)) {
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "message" => "El campo 'rol' debe ser 'CLIENTE' o 'TRABAJADOR'"
                ]);
                return;
            }
            $sets[] = "rol = :rol";
            $valores[':rol'] = $rol;
        }

        if (!empty($data['password']) || !empty($data['password_hash'])) {
            $passwordHash = !empty($data['password'])
                ? password_hash((string) $data['password'], PASSWORD_BCRYPT)
                : (string) $data['password_hash'];
            $sets[] = "password_hash = :password_hash";
            $valores[':password_hash'] = $passwordHash;
        }

        if (empty($sets)) {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Envía al menos un campo: nombre, email, telefono, rol o password"
            ]);
            return;
        }

        if (isset($valores[':email']) && !filter_var($valores[':email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El email no es válido"]);
            return;
        }

        if (!$this->existe($id)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Usuario no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare("UPDATE usuarios SET " . implode(', ', $sets) . " WHERE id = :id");

            foreach ($valores as $parametro => $valor) {
                $stmt->bindValue($parametro, $valor, PDO::PARAM_STR);
            }
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Usuario modificado (PATCH)"]);
        } catch (PDOException $e) {
            if ($e->getCode() === '45000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "No se puede cambiar el rol de un usuario con perfil creado"]);
            } elseif ($e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "Ya existe un usuario con ese email"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al modificar el usuario"]);
            }
        }
    }

    public function delete(int $id): void {
        try {
            $stmt = $this->db->prepare("DELETE FROM usuarios WHERE id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode(["status" => "success", "message" => "Usuario eliminado correctamente"]);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Usuario no encontrado o ya fue eliminado"]);
            }
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "No se puede eliminar: el usuario tiene proyectos, asignaciones o facturas asociadas"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al eliminar el usuario"]);
            }
        }
    }

    private function existe(int $id): bool {
        $stmt = $this->db->prepare("SELECT id FROM usuarios WHERE id = :id");
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return (bool) $stmt->fetch();
    }
}
