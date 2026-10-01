<?php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rutas = [
    'usuarios'     => ['usuarios.php', 'usuarioController'],
    'clientes'     => ['clientes.php', 'clienteController'],
    'trabajadores' => ['trabajadores.php', 'trabajadorController'],
];

function responder(int $codigo, array $cuerpo): void {
    http_response_code($codigo);
    echo json_encode($cuerpo);
    exit;
}

try {
    $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
    $rutaPeticion = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $url = trim(substr($rutaPeticion, strlen($base)), '/');

    $partes = $url === '' ? [] : explode('/', $url);
    $recurso = $partes[0] ?? '';
    $id = null;

    if (isset($partes[1])) {
        if (!ctype_digit($partes[1])) {
            responder(400, ["status" => "error", "message" => "El id debe ser un número entero"]);
        }
        $id = (int) $partes[1];
    }

    if ($recurso === '') {
        responder(200, ["status" => "success", "recursos" => array_keys($rutas)]);
    }

    if (!isset($rutas[$recurso])) {
        responder(404, ["status" => "error", "message" => "Recurso '$recurso' no encontrado"]);
    }

    [$archivo, $clase] = $rutas[$recurso];
    $ruta = __DIR__ . '/src/controladores/' . $archivo;

    if (!file_exists($ruta)) {
        responder(501, ["status" => "error", "message" => "El controlador de '$recurso' aún no está creado"]);
    }

    require_once $ruta;
    $controlador = new $clase();
    $metodo = $_SERVER['REQUEST_METHOD'];

    switch ($metodo) {
        case 'GET':
            $controlador->get($id);
            break;
        case 'POST':
            $controlador->create();
            break;
        case 'PUT':
        case 'PATCH':
        case 'DELETE':
            if ($id === null) {
                responder(400, ["status" => "error", "message" => "$metodo requiere un id en la URL"]);
            }
            if ($metodo === 'PUT')    $controlador->updateFull($id);
            if ($metodo === 'PATCH')  $controlador->updatePartial($id);
            if ($metodo === 'DELETE') $controlador->delete($id);
            break;
        default:
            responder(405, ["status" => "error", "message" => "Método no permitido"]);
    }

} catch (Throwable $e) {
    error_log("Error en la API: " . $e->getMessage());
    responder(500, ["status" => "error", "message" => "Error interno del servidor"]);
}