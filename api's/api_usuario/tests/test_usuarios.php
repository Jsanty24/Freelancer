<?php
/**
 * Suite de pruebas de integración para API 1 — PHP (Usuarios, Clientes, Trabajadores y Login).
 *
 * Ejecutar:
 *   C:\xampp\php\php.exe "api's\api_usuario\tests\test_usuarios.php"
 */

$apiDir = realpath(__DIR__ . '/..');
$internalKey = getenv('INTERNAL_API_KEY') ?: 'clave_interna_pruebas_php_1234567890123456';
$dbName = getenv('DB_NAME') ?: 'plataforma_freelance';
putenv("INTERNAL_API_KEY=$internalKey");
putenv("DB_NAME=$dbName");

$port = 18080;
$baseUrl = "http://127.0.0.1:$port";
$phpBin = PHP_BINARY;

$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
];

$serverProc = proc_open(
    [$phpBin, '-S', "127.0.0.1:$port", 'index.php'],
    $descriptors,
    $pipes,
    $apiDir,
    null
);

if (!is_resource($serverProc)) {
    fwrite(STDERR, "No se pudo iniciar el servidor PHP de pruebas.\n");
    exit(1);
}

// Esperar a que el servidor escuche
$ready = false;
for ($i = 0; $i < 25; $i++) {
    usleep(150000);
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
    if ($fp) {
        fclose($fp);
        $ready = true;
        break;
    }
}

function request(string $method, string $path, ?array $body = null, bool $withKey = true): array {
    global $baseUrl, $internalKey;

    $headers = ["Accept: application/json"];
    if ($withKey) {
        $headers[] = "X-Internal-Key: $internalKey";
    }
    if ($body !== null) {
        $headers[] = "Content-Type: application/json";
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body !== null ? json_encode($body) : null,
            'ignore_errors' => true,
            'timeout' => 5
        ]
    ]);

    $raw = file_get_contents($baseUrl . $path, false, $context);
    $statusLine = $http_response_header[0] ?? 'HTTP/1.1 500';
    preg_match('{HTTP/\S*\s(\d{3})}', $statusLine, $match);
    $status = isset($match[1]) ? (int) $match[1] : 500;
    $json = $raw ? json_decode($raw, true) : null;

    return ['status' => $status, 'data' => $json];
}

$pasadas = 0;
$fallidas = 0;

function verificar(string $nombre, callable $fn): void {
    global $pasadas, $fallidas;
    try {
        $fn();
        echo "[PASS] $nombre\n";
        $pasadas++;
    } catch (Throwable $e) {
        echo "[FAIL] $nombre -> " . $e->getMessage() . "\n";
        $fallidas++;
    }
}

function asegurar(bool $condicion, string $mensaje): void {
    if (!$condicion) {
        throw new RuntimeException($mensaje);
    }
}

$sufijo = bin2hex(random_bytes(4));
$emailCliente = "cliente_php_{$sufijo}@pruebas.test";
$emailTrabajador = "trab_php_{$sufijo}@pruebas.test";
$passwordPlana = "ClaveSegura123!";
$clienteId = null;
$trabajadorId = null;

try {
    verificar("1. GET /health responde 200 y database ok", function () {
        $res = request('GET', '/health', null, false);
        asegurar($res['status'] === 200, "Esperado 200, recibido {$res['status']}");
        asegurar(($res['data']['database'] ?? '') === 'ok', "Base de datos no reportó ok");
    });

    verificar("2. Acceso directo sin X-Internal-Key responde 403 con formato {status, message}", function () {
        $res = request('GET', '/usuarios', null, false);
        asegurar($res['status'] === 403, "Esperado 403, recibido {$res['status']}");
        asegurar(($res['data']['status'] ?? '') === 'error', "Falta status=error");
        asegurar(isset($res['data']['message']), "Falta clave message");
    });

    verificar("3. Usuario inexistente responde 404 con formato {status, message}", function () {
        $res = request('GET', '/usuarios/9999999');
        asegurar($res['status'] === 404, "Esperado 404, recibido {$res['status']}");
        asegurar(($res['data']['status'] ?? '') === 'error', "Falta status=error");
        asegurar(isset($res['data']['message']), "Falta clave message");
    });

    verificar("4. Crear usuario CLIENTE y su perfil en /clientes (201) + rechazar email duplicado (409)", function () use (&$clienteId, $emailCliente, $passwordPlana) {
        $res = request('POST', '/usuarios', [
            'nombre' => 'Cliente Prueba PHP',
            'email' => $emailCliente,
            'telefono' => '3001112233',
            'password' => $passwordPlana,
            'rol' => 'CLIENTE'
        ]);
        asegurar($res['status'] === 201, "Esperado 201 al crear usuario, recibido {$res['status']}");
        $clienteId = (int) $res['data']['id_creado'];

        $dup = request('POST', '/usuarios', [
            'nombre' => 'Duplicado',
            'email' => $emailCliente,
            'password' => $passwordPlana,
            'rol' => 'CLIENTE'
        ]);
        asegurar($dup['status'] === 409, "Esperado 409 en email duplicado, recibido {$dup['status']}");

        $perfil = request('POST', '/clientes', [
            'usuario_id' => $clienteId,
            'razon_social' => 'Empresa PHP S.A.S.',
            'direccion_facturacion' => 'Cra 15 # 80-10'
        ]);
        asegurar($perfil['status'] === 201, "Esperado 201 al crear cliente, recibido {$perfil['status']}");
    });

    verificar("5. Crear usuario TRABAJADOR y su perfil en /trabajadores (201)", function () use (&$trabajadorId, $emailTrabajador, $passwordPlana) {
        $res = request('POST', '/usuarios', [
            'nombre' => 'Trabajador Prueba PHP',
            'email' => $emailTrabajador,
            'telefono' => '3004445566',
            'password' => $passwordPlana,
            'rol' => 'TRABAJADOR'
        ]);
        asegurar($res['status'] === 201, "Esperado 201 al crear trabajador, recibido {$res['status']}");
        $trabajadorId = (int) $res['data']['id_creado'];

        $perfil = request('POST', '/trabajadores', [
            'usuario_id' => $trabajadorId,
            'especialidad' => 'PHP & MySQL',
            'disponibilidad' => true
        ]);
        asegurar($perfil['status'] === 201, "Esperado 201 al crear perfil trabajador, recibido {$perfil['status']}");
    });

    verificar("6. Login con password_verify acepta contraseña correcta (200) y rechaza hash literal o clave errónea (401)", function () use ($emailCliente, $passwordPlana) {
        $ok = request('POST', '/login', [
            'email' => $emailCliente,
            'password' => $passwordPlana
        ]);
        asegurar($ok['status'] === 200, "Esperado 200 en login válido, recibido {$ok['status']}");
        asegurar(($ok['data']['data']['rol'] ?? '') === 'CLIENTE', "Rol incorrecto en login");

        $mal = request('POST', '/login', [
            'email' => $emailCliente,
            'password' => password_hash($passwordPlana, PASSWORD_BCRYPT)
        ]);
        asegurar($mal['status'] === 401, "Esperado 401 al enviar un hash como contraseña, recibido {$mal['status']}");
    });

    verificar("7. Trigger trg_usuario_rol_inmutable impide cambiar el rol de un usuario con perfil creado (409)", function () use (&$clienteId) {
        $res = request('PATCH', "/usuarios/$clienteId", [
            'rol' => 'TRABAJADOR'
        ]);
        asegurar($res['status'] === 409, "Esperado 409 al cambiar rol con perfil, recibido {$res['status']}");
        asegurar(($res['data']['status'] ?? '') === 'error', "Falta status=error");
    });

    verificar("8. Eliminar perfiles y usuarios de prueba (200)", function () use (&$clienteId, &$trabajadorId) {
        if ($clienteId) {
            $delCli = request('DELETE', "/clientes/$clienteId");
            asegurar($delCli['status'] === 200, "Esperado 200 al borrar cliente");
            $delUsu1 = request('DELETE', "/usuarios/$clienteId");
            asegurar($delUsu1['status'] === 200, "Esperado 200 al borrar usuario cliente");
            $clienteId = null;
        }
        if ($trabajadorId) {
            $delTrab = request('DELETE', "/trabajadores/$trabajadorId");
            asegurar($delTrab['status'] === 200, "Esperado 200 al borrar trabajador");
            $delUsu2 = request('DELETE', "/usuarios/$trabajadorId");
            asegurar($delUsu2['status'] === 200, "Esperado 200 al borrar usuario trabajador");
            $trabajadorId = null;
        }
    });
} finally {
    foreach ($pipes as $pipe) {
        @fclose($pipe);
    }
    @proc_terminate($serverProc);
    @proc_close($serverProc);
}

echo "\nResumen PHP API: $pasadas pasaron, $fallidas fallaron.\n";
exit($fallidas > 0 ? 1 : 0);
