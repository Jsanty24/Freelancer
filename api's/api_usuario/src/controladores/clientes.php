<?php

require_once __DIR__ . '/../../config/conexion.php';

class ClienteController {
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
            $stmt = $this->db->prepare(
                "SELECT c.usuario_id, u.nombre, u.email, u.telefono, u.rol, u.fecha_registro,
                        c.razon_social, c.direccion_facturacion
                 FROM clientes c
                 INNER JOIN usuarios u ON u.id = c.usuario_id
                 WHERE c.usuario_id = :id"
            );
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $cliente = $stmt->fetch();

            if ($cliente) {
                http_response_code(200);
                echo json_encode(["status" => "success", "data" => $cliente]);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Cliente no encontrado"]);
            }
        } else {
            $stmt = $this->db->prepare(
                "SELECT c.usuario_id, u.nombre, u.email, u.telefono, u.rol, u.fecha_registro,
                        c.razon_social, c.direccion_facturacion
                 FROM clientes c
                 INNER JOIN usuarios u ON u.id = c.usuario_id
                 ORDER BY c.usuario_id ASC"
            );
            $stmt->execute();
            $clientes = $stmt->fetchAll();

            http_response_code(200);
            echo json_encode(["status" => "success", "data" => $clientes]);
        }
    }

    public function create(): void {
        $data = json_decode(file_get_contents("php://input"), true) ?? [];

        if (
            !isset($data['usuario_id']) || !ctype_digit((string) $data['usuario_id']) ||
            empty($data['razon_social']) || empty($data['direccion_facturacion'])
        ) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Los campos 'usuario_id', 'razon_social' y 'direccion_facturacion' son obligatorios"]);
            return;
        }

        $usuarioId = (int) $data['usuario_id'];

        $rolUsuario = $this->obtenerRolUsuario($usuarioId);
        if ($rolUsuario === null) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "El usuario indicado no existe"]);
            return;
        }

        if ($rolUsuario !== 'CLIENTE') {
            http_response_code(409);
            echo json_encode(["status" => "error", "message" => "El usuario no tiene rol CLIENTE"]);
            return;
        }

        if ($this->existe($usuarioId)) {
            http_response_code(409);
            echo json_encode(["status" => "error", "message" => "Ese usuario ya está registrado como cliente"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO clientes (usuario_id, razon_social, direccion_facturacion)
                 VALUES (:usuario_id, :razon_social, :direccion_facturacion)"
            );
            $stmt->bindParam(':usuario_id', $usuarioId, PDO::PARAM_INT);
            $stmt->bindParam(':razon_social', $data['razon_social'], PDO::PARAM_STR);
            $stmt->bindParam(':direccion_facturacion', $data['direccion_facturacion'], PDO::PARAM_STR);
            $stmt->execute();

            http_response_code(201);
            echo json_encode([
                "status" => "success",
                "message" => "Cliente registrado correctamente",
                "id_creado" => $usuarioId
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '45000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "El usuario no tiene rol CLIENTE"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al guardar el cliente"]);
            }
        }
    }

    public function updateFull(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true) ?? [];

        if (empty($data['razon_social']) || empty($data['direccion_facturacion'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "PUT requiere 'razon_social' y 'direccion_facturacion'"]);
            return;
        }

        if (!$this->existe($id)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Cliente no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "UPDATE clientes SET razon_social = :razon_social, direccion_facturacion = :direccion_facturacion
                 WHERE usuario_id = :id"
            );
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':razon_social', $data['razon_social'], PDO::PARAM_STR);
            $stmt->bindParam(':direccion_facturacion', $data['direccion_facturacion'], PDO::PARAM_STR);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Cliente actualizado (PUT)"]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al actualizar el cliente"]);
        }
    }

    public function updatePartial(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true) ?? [];

        $sets = [];
        $valores = [];

        foreach (['razon_social', 'direccion_facturacion'] as $campo) {
            if (isset($data[$campo])) {
                $sets[] = "$campo = :$campo";
                $valores[":$campo"] = $data[$campo];
            }
        }

        if (empty($sets)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Envía al menos un campo: razon_social o direccion_facturacion"]);
            return;
        }

        if (!$this->existe($id)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Cliente no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare("UPDATE clientes SET " . implode(', ', $sets) . " WHERE usuario_id = :id");

            foreach ($valores as $parametro => $valor) {
                $stmt->bindValue($parametro, $valor, PDO::PARAM_STR);
            }
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Cliente modificado (PATCH)"]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al modificar el cliente"]);
        }
    }

    public function delete(int $id): void {
        try {
            $stmt = $this->db->prepare("DELETE FROM clientes WHERE usuario_id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode(["status" => "success", "message" => "Cliente eliminado correctamente"]);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Cliente no encontrado o ya fue eliminado"]);
            }
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "No se puede eliminar: el cliente tiene proyectos o facturas asociadas"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al eliminar el cliente"]);
            }
        }
    }

    private function existe(int $id): bool {
        $stmt = $this->db->prepare("SELECT usuario_id FROM clientes WHERE usuario_id = :id");
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return (bool) $stmt->fetch();
    }

    private function obtenerRolUsuario(int $id): ?string {
        $stmt = $this->db->prepare("SELECT rol FROM usuarios WHERE id = :id");
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $fila = $stmt->fetch();
        return $fila ? (string) $fila['rol'] : null;
    }
}
