<?php

require_once __DIR__ . '/../../config/conexion.php';

class TrabajadorController {
    private ?PDO $db;

    private const SELECT = "SELECT t.usuario_id, u.nombre, u.email, t.especialidad, t.disponibilidad
                            FROM trabajadores t
                            INNER JOIN usuarios u ON u.id = t.usuario_id";

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
            $stmt = $this->db->prepare(self::SELECT . " WHERE t.usuario_id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $trabajador = $stmt->fetch();

            if ($trabajador) {
                $this->responder(200, ["status" => "success", "data" => $trabajador]);
            } else {
                $this->responder(404, ["status" => "error", "message" => "Trabajador no encontrado"]);
            }
        } else {
            $stmt = $this->db->prepare(self::SELECT . " ORDER BY t.usuario_id ASC");
            $stmt->execute();
            $this->responder(200, ["status" => "success", "data" => $stmt->fetchAll()]);
        }
    }

    public function create(): void {
        $data = json_decode(file_get_contents("php://input"), true);

        if (
            !isset($data['usuario_id']) || !ctype_digit((string) $data['usuario_id']) ||
            empty($data['especialidad'])
        ) {
            $this->responder(400, [
                "status" => "error",
                "message" => "Los campos 'usuario_id' y 'especialidad' son obligatorios"
            ]);
            return;
        }

        $disponibilidad = 1;
        if (array_key_exists('disponibilidad', $data)) {
            $disponibilidad = $this->aBooleano($data['disponibilidad']);
            if ($disponibilidad === null) {
                $this->responder(400, ["status" => "error", "message" => "'disponibilidad' debe ser 0, 1, true o false"]);
                return;
            }
        }

        $usuarioId = (int) $data['usuario_id'];

        if (!$this->usuarioExiste($usuarioId)) {
            $this->responder(404, ["status" => "error", "message" => "El usuario indicado no existe"]);
            return;
        }

        if ($this->existe($usuarioId)) {
            $this->responder(409, ["status" => "error", "message" => "Ese usuario ya está registrado como trabajador"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO trabajadores (usuario_id, especialidad, disponibilidad)
                 VALUES (:usuario_id, :especialidad, :disponibilidad)"
            );
            $stmt->bindValue(':usuario_id', $usuarioId, PDO::PARAM_INT);
            $stmt->bindValue(':especialidad', $data['especialidad'], PDO::PARAM_STR);
            $stmt->bindValue(':disponibilidad', $disponibilidad, PDO::PARAM_INT);
            $stmt->execute();

            $this->responder(201, [
                "status" => "success",
                "message" => "Trabajador registrado correctamente",
                "id_creado" => $usuarioId
            ]);
        } catch (PDOException $e) {
            $this->responder(500, ["status" => "error", "message" => "Error al guardar el trabajador"]);
        }
    }

    public function updateFull(int $id): void {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['especialidad']) || !array_key_exists('disponibilidad', $data)) {
            $this->responder(400, [
                "status" => "error",
                "message" => "PUT requiere 'especialidad' y 'disponibilidad'"
            ]);
            return;
        }

        $disponibilidad = $this->aBooleano($data['disponibilidad']);
        if ($disponibilidad === null) {
            $this->responder(400, ["status" => "error", "message" => "'disponibilidad' debe ser 0, 1, true o false"]);
            return;
        }

        if (!$this->existe($id)) {
            $this->responder(404, ["status" => "error", "message" => "Trabajador no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare(
                "UPDATE trabajadores SET especialidad = :especialidad, disponibilidad = :disponibilidad
                 WHERE usuario_id = :id"
            );
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->bindValue(':especialidad', $data['especialidad'], PDO::PARAM_STR);
            $stmt->bindValue(':disponibilidad', $disponibilidad, PDO::PARAM_INT);
            $stmt->execute();

            $this->responder(200, ["status" => "success", "message" => "Trabajador actualizado (PUT)"]);
        } catch (PDOException $e) {
            $this->responder(500, ["status" => "error", "message" => "Error al actualizar el trabajador"]);
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

        if (array_key_exists('disponibilidad', $data ?? [])) {
            $disponibilidad = $this->aBooleano($data['disponibilidad']);
            if ($disponibilidad === null) {
                $this->responder(400, ["status" => "error", "message" => "'disponibilidad' debe ser 0, 1, true o false"]);
                return;
            }
            $sets[] = "disponibilidad = :disponibilidad";
            $valores[':disponibilidad'] = [$disponibilidad, PDO::PARAM_INT];
        }

        if (empty($sets)) {
            $this->responder(400, [
                "status" => "error",
                "message" => "Envía al menos un campo: especialidad o disponibilidad"
            ]);
            return;
        }

        if (!$this->existe($id)) {
            $this->responder(404, ["status" => "error", "message" => "Trabajador no encontrado"]);
            return;
        }

        try {
            $stmt = $this->db->prepare("UPDATE trabajadores SET " . implode(', ', $sets) . " WHERE usuario_id = :id");

            foreach ($valores as $parametro => [$valor, $tipo]) {
                $stmt->bindValue($parametro, $valor, $tipo);
            }
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            $this->responder(200, ["status" => "success", "message" => "Trabajador modificado (PATCH)"]);
        } catch (PDOException $e) {
            $this->responder(500, ["status" => "error", "message" => "Error al modificar el trabajador"]);
        }
    }

    public function delete(int $id): void {
        try {
            $stmt = $this->db->prepare("DELETE FROM trabajadores WHERE usuario_id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                $this->responder(200, ["status" => "success", "message" => "Trabajador eliminado correctamente"]);
            } else {
                $this->responder(404, ["status" => "error", "message" => "Trabajador no encontrado o ya fue eliminado"]);
            }
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $this->responder(409, [
                    "status" => "error",
                    "message" => "No se puede eliminar: el trabajador tiene asignaciones asociadas"
                ]);
            } else {
                $this->responder(500, ["status" => "error", "message" => "Error al eliminar el trabajador"]);
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