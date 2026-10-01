<?php

require_once __DIR__ . '/../../config/conexion.php';

class UsuarioController {
    private ?PDO $db;

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
            $stmt = $this->db->prepare("SELECT id, nombre, email, telefono FROM usuarios WHERE id = :id");
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
            $stmt = $this->db->prepare("SELECT id, nombre, email, telefono FROM usuarios ORDER BY id ASC");
            $stmt->execute();
            $usuarios = $stmt->fetchAll();

            http_response_code(200);
            echo json_encode(["status" => "success", "data" => $usuarios]);
        }
    }
    public function create(): void {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['nombre']) || empty($data['email'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Los campos 'nombre' y 'email' son obligatorios"]);
            return;
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El email no es válido"]);
            return;
        }

        $telefono = $data['telefono'] ?? null;

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO usuarios (nombre, email, telefono) VALUES (:nombre, :email, :telefono)"
            );
            $stmt->bindParam(':nombre', $data['nombre'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':telefono', $telefono, PDO::PARAM_STR);
            $stmt->execute();

            http_response_code(201);
            echo json_encode([
                "status" => "success",
                "message" => "Usuario registrado correctamente",
                "id_creado" => $this->db->lastInsertId()
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
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['nombre']) || empty($data['email'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "PUT requiere 'nombre' y 'email'"]);
            return;
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "El email no es válido"]);
            return;
        }

        if (!$this->existe($id)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Usuario no encontrado"]);
            return;
        }

        $telefono = $data['telefono'] ?? null;

        try {
            $stmt = $this->db->prepare(
                "UPDATE usuarios SET nombre = :nombre, email = :email, telefono = :telefono WHERE id = :id"
            );
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':nombre', $data['nombre'], PDO::PARAM_STR);
            $stmt->bindParam(':email', $data['email'], PDO::PARAM_STR);
            $stmt->bindParam(':telefono', $telefono, PDO::PARAM_STR);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Usuario actualizado (PUT)"]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "Ya existe un usuario con ese email"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al actualizar el usuario"]);
            }
        }
    }

    public function updatePartial(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true);

        $sets = [];
        $valores = [];

        foreach (['nombre', 'email', 'telefono'] as $campo) {
            if (isset($data[$campo])) {
                $sets[] = "$campo = :$campo";
                $valores[":$campo"] = $data[$campo];
            }
        }

        if (empty($sets)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Envía al menos un campo: nombre, email o telefono"]);
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
            if ($e->getCode() === '23000') {
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