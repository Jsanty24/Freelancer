#   1. API 1 — PHP (Usuarios, Clientes, Trabajadores, Login) -> 127.0.0.1:8000
#   2. API 2 — Python FastAPI (Proyectos y Postulaciones)    -> 127.0.0.1:5000
#   3. API 3 — Node.js Express (Asignaciones, Horas, Facturas) -> 127.0.0.1:3000
#   4. API 4 — Node.js API Gateway + Frontend Stitch         -> http://localhost:4000

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Env:INTERNAL_API_KEY = "clave-interna-gateway-freelancer-2026"

Write-Host -ForegroundColor Cyan
Write-Host -ForegroundColor Cyan
Write-Host -ForegroundColor Cyan

# 1. API PHP (127.0.0.1:8000)
$PhpExe = if (Test-Path "C:\xampp\php\php.exe") { "C:\xampp\php\php.exe" } else { "php" }
$PhpDir = Join-Path $Root "api's\api_usuario"
Write-Host "[1/4] Iniciando API 1 (PHP) en 127.0.0.1:8000..." -ForegroundColor Green
Start-Process -FilePath $PhpExe -ArgumentList "-S 127.0.0.1:8000 index.php" -WorkingDirectory $PhpDir -WindowStyle Minimized

# 2. API Python FastAPI (127.0.0.1:5000)
$PythonExe = Join-Path $Root ".venv\Scripts\python.exe"
$PythonDir = Join-Path $Root "api's\Python"
Write-Host "[2/4] Iniciando API 2 (Python FastAPI) en 127.0.0.1:5000..." -ForegroundColor Green
Start-Process -FilePath $PythonExe -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 5000" -WorkingDirectory $PythonDir -WindowStyle Minimized

# 3. API Express (127.0.0.1:3000)
$ExpressDir = Join-Path $Root "api's\Express"
Write-Host "[3/4] Iniciando API 3 (Express) en 127.0.0.1:3000..." -ForegroundColor Green
Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory $ExpressDir -WindowStyle Minimized

# 4. API Gateway (localhost:4000)
$GatewayDir = Join-Path $Root "api's\Gateway"
Write-Host "[4/4] Iniciando API 4 (API Gateway + Frontend) en http://localhost:4000..." -ForegroundColor Green
Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory $GatewayDir -WindowStyle Minimized

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "Todos los servicios están activos:" -ForegroundColor Yellow
Write-Host " -> Frontend Hub & Stitch : http://localhost:4000/app/index.html" -ForegroundColor White
Write-Host " -> Salud del Gateway     : http://localhost:4000/health" -ForegroundColor White
Start-Process "http://localhost:4000/app/index.html"
