<?php

require_once __DIR__ . '/../../config/conexion.php';

class TrabajadorController {
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
                "SELECT t.usuario_id, u.nombre, u.email, t.especialidad, t.disponibilidad
                 FROM trabajadores t
                 INNER JOIN usuarios u ON u.id = t.usuario_id
                 WHERE t.usuario_id = :id"
            );
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $trabajador = $stmt->fetch();

            if ($trabajador) {
                http_response_code(200);
                echo json_encode(["status" => "success", "data" => $trabajador]);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Trabajador no encontrado"]);
            }
        } else {
            $stmt = $this->db->prepare(
                "SELECT t.usuario_id, u.nombre, u.email, t.especialidad, t.disponibilidad
                 FROM trabajadores t
                 INNER JOIN usuarios u ON u.id = t.usuario_id
                 ORDER BY t.usuario_id ASC"
            );
            $stmt->execute();
            $trabajadores = $stmt->fetchAll();

            http_response_code(200);
            echo json_encode(["status" => "success", "data" => $trabajadores]);
        }
    }

    public function create(): void {
        $data = json_decode(file_get_contents("php://input"), true);

        if (
            !isset($data['usuario_id']) || !ctype_digit((string) $data['usuario_id']) ||
            empty($data['especialidad'])
        ) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Los campos 'usuario_id' y 'especialidad' son obligatorios"]);
            return;
        }

        $disponibilidad = 1;
        if (array_key_exists('disponibilidad', $data)) {
            $disponibilidad = $this->aBooleano($data['disponibilidad']);
            if ($disponibilidad === null) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "'disponibilidad' debe ser 0, 1, true o false"]);
                return;
            }
        }

        $usuarioId = (int) $data['usuario_id'];

        if (!$this->usuarioExiste($usuarioId)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "El usuario indicado no existe"]);
            return;
        }

        if ($this->existe($usuarioId)) {
            http_response_code(409);
            echo json_encode(["status" => "error", "message" => "Ese usuario ya está registrado como trabajador"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO trabajadores (usuario_id, especialidad, disponibilidad)
                 VALUES (:usuario_id, :especialidad, :disponibilidad)"
            );
            $stmt->bindParam(':usuario_id', $usuarioId, PDO::PARAM_INT);
            $stmt->bindParam(':especialidad', $data['especialidad'], PDO::PARAM_STR);
            $stmt->bindParam(':disponibilidad', $disponibilidad, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(201);
            echo json_encode([
                "status" => "success",
                "message" => "Trabajador registrado correctamente",
                "id_creado" => $usuarioId
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al guardar el trabajador"]);
        }
    }

    public function updateFull(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['especialidad']) || !array_key_exists('disponibilidad', $data)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "PUT requiere 'especialidad' y 'disponibilidad'"]);
            return;
        }

        $disponibilidad = $this->aBooleano($data['disponibilidad']);
        if ($disponibilidad === null) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "'disponibilidad' debe ser 0, 1, true o false"]);
            return;
        }

        if (!$this->existe($id)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Trabajador no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "UPDATE trabajadores SET especialidad = :especialidad, disponibilidad = :disponibilidad
                 WHERE usuario_id = :id"
            );
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':especialidad', $data['especialidad'], PDO::PARAM_STR);
            $stmt->bindParam(':disponibilidad', $disponibilidad, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Trabajador actualizado (PUT)"]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al actualizar el trabajador"]);
        }
    }

    public function updatePartial(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true);

        $sets = [];
        $valores = [];

        if (isset($data['especialidad'])) {
            $sets[] = "especialidad = :especialidad";
            $valores[':especialidad'] = [$data['especialidad'], PDO::PARAM_STR];
        }

        if (is_array($data) && array_key_exists('disponibilidad', $data)) {
            $disponibilidad = $this->aBooleano($data['disponibilidad']);
            if ($disponibilidad === null) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "'disponibilidad' debe ser 0, 1, true o false"]);
                return;
            }
            $sets[] = "disponibilidad = :disponibilidad";
            $valores[':disponibilidad'] = [$disponibilidad, PDO::PARAM_INT];
        }

        if (empty($sets)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Envía al menos un campo: especialidad o disponibilidad"]);
            return;
        }

        if (!$this->existe($id)) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Trabajador no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare("UPDATE trabajadores SET " . implode(', ', $sets) . " WHERE usuario_id = :id");

            foreach ($valores as $parametro => [$valor, $tipo]) {
                $stmt->bindValue($parametro, $valor, $tipo);
            }
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Trabajador modificado (PATCH)"]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al modificar el trabajador"]);
        }
    }

    public function delete(int $id): void {
        try {
            $stmt = $this->db->prepare("DELETE FROM trabajadores WHERE usuario_id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode(["status" => "success", "message" => "Trabajador eliminado correctamente"]);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Trabajador no encontrado o ya fue eliminado"]);
            }
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "No se puede eliminar: el trabajador tiene asignaciones asociadas"]);
            } else {
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Error al eliminar el trabajador"]);
            }
        }
    }

    private function aBooleano($valor): ?int {
        $resultado = filter_var($valor, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $resultado === null ? null : (int) $resultado;
    }

    private function existe(int $id): bool {
        $stmt = $this->db->prepare("SELECT usuario_id FROM trabajadores WHERE usuario_id = :id");
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