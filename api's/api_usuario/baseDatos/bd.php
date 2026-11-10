<?php

$envFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
if (file_exists($envFile)) {
    $envVars = @parse_ini_file($envFile, false, INI_SCANNER_RAW);
    if (is_array($envVars)) {
        foreach ($envVars as $key => $val) {
            if (getenv($key) === false) {
                putenv("$key=$val");
                $_ENV[$key] = $val;
            }
        }
    }
}

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'plataforma_freelance_demo');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', getenv('DB_CHARSET') ?: 'utf8mb4');
define('INTERNAL_API_KEY', getenv('INTERNAL_API_KEY') ?: '');
