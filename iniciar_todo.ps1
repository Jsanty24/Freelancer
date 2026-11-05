#   1. API 1 — PHP (Usuarios, Clientes, Trabajadores, Login) -> 127.0.0.1:8000
#   2. API 2 — Python FastAPI (Proyectos y Postulaciones)    -> 127.0.0.1:5000
#   3. API 3 — Node.js Express (Asignaciones, Horas, Facturas) -> 127.0.0.1:3000
#   4. API 4 — Node.js API Gateway + Frontend Stitch         -> http://localhost:4000

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$GatewayDir = Join-Path $Root "api's\Gateway"
$GatewayEnv = Join-Path $GatewayDir ".env"

if (-not (Test-Path $GatewayEnv)) {
    throw "No se encontró $GatewayEnv. Copia .env.example a .env y configura los secretos compartidos."
}

$GatewaySettings = @{}
Get-Content $GatewayEnv | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $GatewaySettings[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

if ($GatewaySettings['INTERNAL_API_KEY'].Length -lt 32) {
    throw "Configura INTERNAL_API_KEY con al menos 32 caracteres en $GatewayEnv."
}
if ($GatewaySettings['JWT_SECRET'].Length -lt 32) {
    throw "Configura JWT_SECRET con al menos 32 caracteres en $GatewayEnv."
}

$Env:INTERNAL_API_KEY = $GatewaySettings['INTERNAL_API_KEY']
$Env:JWT_SECRET = $GatewaySettings['JWT_SECRET']

function Test-LocalPort([int]$Port) {
    $Client = New-Object Net.Sockets.TcpClient
    try {
        $Connect = $Client.ConnectAsync('127.0.0.1', $Port)
        return $Connect.Wait(500) -and $Client.Connected
    } catch {
        return $false
    } finally {
        $Client.Dispose()
    }
}

$XamppDir = "C:\xampp"
$MysqlExe = Join-Path $XamppDir "mysql\bin\mysqld.exe"
$MysqlConfig = Join-Path $XamppDir "mysql\bin\my.ini"
if (-not (Test-LocalPort 3306)) {
    if (-not (Test-Path $MysqlExe) -or -not (Test-Path $MysqlConfig)) {
        throw "MySQL no está activo y no se encontró XAMPP en $XamppDir."
    }
    Write-Host "[BD] Iniciando MySQL de XAMPP en 127.0.0.1:3306..." -ForegroundColor Green
    Start-Process -FilePath $MysqlExe -ArgumentList "--defaults-file=$MysqlConfig", "--console" -WindowStyle Minimized
    $MysqlReady = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        if (Test-LocalPort 3306) {
            $MysqlReady = $true
            break
        }
    }
    if (-not $MysqlReady) {
        throw "MySQL no respondió en 127.0.0.1:3306. Revisa los logs de XAMPP."
    }
}

# 1. API PHP (127.0.0.1:8000)
$PhpCommand = Get-Command php -ErrorAction SilentlyContinue
$PhpExe = if ($PhpCommand) { $PhpCommand.Source } else { Join-Path $XamppDir "php\php.exe" }
if (-not (Test-Path $PhpExe)) {
    throw "No se encontró PHP CLI. Instala PHP o revisa $PhpExe."
}
$PhpDir = Join-Path $Root "api's\api_usuario"
if (-not (Test-LocalPort 8000)) {
    Write-Host "[1/4] Iniciando API PHP en 127.0.0.1:8000..." -ForegroundColor Green
    Start-Process -FilePath $PhpExe -ArgumentList @("-S", "127.0.0.1:8000", "index.php") -WorkingDirectory $PhpDir -WindowStyle Minimized
}

# 2. API Python FastAPI (127.0.0.1:5000)
$PythonCandidates = @(
    (Join-Path $Root ".venv\Scripts\python.exe"),
    (Join-Path (Join-Path $Root "api's\Python") "venv\Scripts\python.exe")
)
$PythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($PythonCommand) {
    $PythonCandidates += $PythonCommand.Source
}
$PythonExe = $null
foreach ($Candidate in $PythonCandidates) {
    if (Test-Path $Candidate) {
        & $Candidate -c "import fastapi, sqlalchemy, pymysql, jwt, dotenv, uvicorn" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $PythonExe = $Candidate
            break
        }
    }
}
if (-not $PythonExe) {
    throw "No se encontró un Python con las dependencias de la API. Ejecuta: C:\Python314\python.exe -m pip install -r `"$(Join-Path $Root "api's\Python\requirements.txt")`""
}
$PythonDir = Join-Path $Root "api's\Python"
if (-not (Test-LocalPort 5000)) {
    Write-Host "[2/4] Iniciando API FastAPI en 127.0.0.1:5000..." -ForegroundColor Green
    Start-Process -FilePath $PythonExe -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "5000") -WorkingDirectory $PythonDir -WindowStyle Minimized
}

# 3. API Express (127.0.0.1:3000)
$ExpressDir = Join-Path $Root "api's\Express"
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
    throw "No se encontró Node.js en PATH."
}
if (-not (Test-LocalPort 3000)) {
    Write-Host "[3/4] Iniciando API Express en 127.0.0.1:3000..." -ForegroundColor Green
    Start-Process -FilePath $NodeCommand.Source -ArgumentList "index.js" -WorkingDirectory $ExpressDir -WindowStyle Minimized
}

# 4. API Gateway (localhost:4000)
if (-not (Test-LocalPort 4000)) {
    Write-Host "[4/4] Iniciando API Gateway + Frontend en http://localhost:4000..." -ForegroundColor Green
    Start-Process -FilePath $NodeCommand.Source -ArgumentList "index.js" -WorkingDirectory $GatewayDir -WindowStyle Minimized
}

$Puertos = @(8000, 5000, 3000, 4000)
$PuertosActivos = @{}
foreach ($Puerto in $Puertos) {
    $PuertosActivos[$Puerto] = $false
}

for ($Intento = 0; $Intento -lt 15; $Intento++) {
    foreach ($Puerto in $Puertos) {
        if (-not $PuertosActivos[$Puerto] -and (Test-LocalPort $Puerto)) {
            $PuertosActivos[$Puerto] = $true
        }
    }
    if (@($Puertos | Where-Object { -not $PuertosActivos[$_] }).Count -eq 0) {
        break
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
foreach ($Puerto in $Puertos) {
    if ($PuertosActivos[$Puerto]) {
        Write-Host "Puerto ${Puerto}: activo" -ForegroundColor Green
    } else {
        Write-Host "Puerto ${Puerto}: no disponible" -ForegroundColor Red
    }
}

if (Test-LocalPort 4000) {
    try {
        $Health = Invoke-RestMethod -Uri "http://127.0.0.1:4000/health" -TimeoutSec 5
        if ($Health.status -eq "ok") {
            Write-Host "Servicios: saludables" -ForegroundColor Green
        } else {
            Write-Host "Gateway activo, pero algunos servicios no están saludables. Revisa http://localhost:4000/health." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Gateway activo, pero falló la comprobación de salud. Revisa http://localhost:4000/health." -ForegroundColor Yellow
    }
    Write-Host " -> Aplicación Freelancer : http://localhost:4000/" -ForegroundColor White
    Write-Host " -> Salud del Gateway     : http://localhost:4000/health" -ForegroundColor White
    Start-Process "http://localhost:4000/"
}
