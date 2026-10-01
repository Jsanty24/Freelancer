<?php

require_once __DIR__ . '/../../config/conexion.php';

class ClienteController {
    private ?PDO $db;

    private const SELECT = "SELECT c.usuario_id, u.nombre, u.email, c.razon_social, c.direccion_facturacion
                            FROM clientes c
                            INNER JOIN usuarios u ON u.id = c.usuario_id";

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    private function responder(int $codigo, array $cuerpo): void {
        http_response_code($codigo);
        echo json_encode($cuerpo);
    }

    public function get(?int $id = null): void {
        if (!$this->db) {
            $this->responder(500, ["status" => "error", "message" => "Sin conexión a la BD"]);
            return;
        }

        if ($id !== null) {
            $stmt = $this->db->prepare(self::SELECT . " WHERE c.usuario_id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $cliente = $stmt->fetch();

            if ($cliente) {
                $this->responder(200, ["status" => "success", "data" => $cliente]);
            } else {
                $this->responder(404, ["status" => "error", "message" => "Cliente no encontrado"]);
            }
        } else {
            $stmt = $this->db->prepare(self::SELECT . " ORDER BY c.usuario_id ASC");
            $stmt->execute();
            $this->responder(200, ["status" => "success", "data" => $stmt->fetchAll()]);
        }
    }

    public function create(): void {
        $data = json_decode(file_get_contents("php://input"), true);

        if (
            !isset($data['usuario_id']) || !ctype_digit((string) $data['usuario_id']) ||
            empty($data['razon_social']) || empty($data['direccion_facturacion'])
        ) {
            $this->responder(400, [
                "status" => "error",
                "message" => "Los campos 'usuario_id', 'razon_social' y 'direccion_facturacion' son obligatorios"
            ]);
            return;
        }

        $usuarioId = (int) $data['usuario_id'];

        if (!$this->usuarioExiste($usuarioId)) {
            $this->responder(404, ["status" => "error", "message" => "El usuario indicado no existe"]);
            return;
        }

        if ($this->existe($usuarioId)) {
            $this->responder(409, ["status" => "error", "message" => "Ese usuario ya está registrado como cliente"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO clientes (usuario_id, razon_social, direccion_facturacion)
                 VALUES (:usuario_id, :razon_social, :direccion_facturacion)"
            );
            $stmt->bindValue(':usuario_id', $usuarioId, PDO::PARAM_INT);
            $stmt->bindValue(':razon_social', $data['razon_social'], PDO::PARAM_STR);
            $stmt->bindValue(':direccion_facturacion', $data['direccion_facturacion'], PDO::PARAM_STR);
            $stmt->execute();

            $this->responder(201, [
                "status" => "success",
                "message" => "Cliente registrado correctamente",
                "id_creado" => $usuarioId
            ]);
        } catch (PDOException $e) {
            $this->responder(500, ["status" => "error", "message" => "Error al guardar el cliente"]);
        }
    }

    public function updateFull(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['razon_social']) || empty($data['direccion_facturacion'])) {
            $this->responder(400, [
                "status" => "error",
                "message" => "PUT requiere 'razon_social' y 'direccion_facturacion'"
            ]);
            return;
        }

        if (!$this->existe($id)) {
            $this->responder(404, ["status" => "error", "message" => "Cliente no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "UPDATE clientes SET razon_social = :razon_social, direccion_facturacion = :direccion_facturacion
                 WHERE usuario_id = :id"
            );
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->bindValue(':razon_social', $data['razon_social'], PDO::PARAM_STR);
            $stmt->bindValue(':direccion_facturacion', $data['direccion_facturacion'], PDO::PARAM_STR);
            $stmt->execute();

            $this->responder(200, ["status" => "success", "message" => "Cliente actualizado (PUT)"]);
        } catch (PDOException $e) {
            $this->responder(500, ["status" => "error", "message" => "Error al actualizar el cliente"]);
        }
    }

    public function updatePartial(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true);

        $sets = [];
        $valores = [];

        foreach (['razon_social', 'direccion_facturacion'] as $campo) {
            if (isset($data[$campo])) {
                $sets[] = "$campo = :$campo";
                $valores[":$campo"] = $data[$campo];
            }
        }

        if (empty($sets)) {
            $this->responder(400, [
                "status" => "error",
                "message" => "Envía al menos un campo: razon_social o direccion_facturacion"
            ]);
            return;
        }

        if (!$this->existe($id)) {
            $this->responder(404, ["status" => "error", "message" => "Cliente no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare("UPDATE clientes SET " . implode(', ', $sets) . " WHERE usuario_id = :id");

            foreach ($valores as $parametro => $valor) {
                $stmt->bindValue($parametro, $valor, PDO::PARAM_STR);
            }
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            $this->responder(200, ["status" => "success", "message" => "Cliente modificado (PATCH)"]);
        } catch (PDOException $e) {
            $this->responder(500, ["status" => "error", "message" => "Error al modificar el cliente"]);
        }
    }

    public function delete(int $id): void {
        try {
            $stmt = $this->db->prepare("DELETE FROM clientes WHERE usuario_id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                $this->responder(200, ["status" => "success", "message" => "Cliente eliminado correctamente"]);
            } else {
                $this->responder(404, ["status" => "error", "message" => "Cliente no encontrado o ya fue eliminado"]);
            }
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $this->responder(409, [
                    "status" => "error",
                    "message" => "No se puede eliminar: el cliente tiene proyectos o facturas asociadas"
                ]);
            } else {
                $this->responder(500, ["status" => "error", "message" => "Error al eliminar el cliente"]);
            }
        }
    }

    private function existe(int $id): bool {
        $stmt = $this->db->prepare("SELECT usuario_id FROM clientes WHERE usuario_id = :id");
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return (bool) $stmt->fetch();
    }

    private function usuarioExiste(int $id): bool {
        $stmt = $this->db->prepare("SELECT id FROM usuarios WHERE id = :id");
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return (bool) $stmt->fetch();
    }
}