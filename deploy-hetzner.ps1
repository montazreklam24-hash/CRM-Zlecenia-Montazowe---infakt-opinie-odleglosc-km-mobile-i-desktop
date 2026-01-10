# ==============================================================================
# SKRYPT DEPLOYMENT - Wgrywa pliki na serwer Hetzner
# ==============================================================================

$SERVER_IP = "46.224.89.131"
$SERVER_USER = "root"
$SERVER_PATH = "/opt/crm-app"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  CRM - Deployment na Hetzner VPS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Sprawdź czy jesteśmy w poprawnym katalogu
$currentPath = Get-Location
if (-not (Test-Path "package.json")) {
    Write-Host "[ERROR] Nie znaleziono package.json!" -ForegroundColor Red
    Write-Host "Uruchom skrypt z głównego katalogu projektu." -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] Sprawdzanie połączenia z serwerem..." -ForegroundColor Yellow
$pingTest = Test-Connection -ComputerName $SERVER_IP -Count 1 -Quiet
if (-not $pingTest) {
    Write-Host "[ERROR] Nie można połączyć się z serwerem $SERVER_IP" -ForegroundColor Red
    exit 1
}
Write-Host "      Połączenie OK" -ForegroundColor Green

# Build frontend
Write-Host ""
Write-Host "[2/5] Budowanie frontendu (npm run build)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build się nie powiódł!" -ForegroundColor Red
    exit 1
}
Write-Host "      Build zakończony" -ForegroundColor Green

# Wgrywanie dist/
Write-Host ""
Write-Host "[3/5] Wgrywanie frontendu (dist/)..." -ForegroundColor Yellow
scp -r dist/* "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/dist/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Nie udało się wgrać frontendu!" -ForegroundColor Red
    exit 1
}
Write-Host "      Frontend wgrany" -ForegroundColor Green

# Wgrywanie API
Write-Host ""
Write-Host "[4/5] Wgrywanie API (api/)..." -ForegroundColor Yellow
scp -r api/* "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/api/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Nie udało się wgrać API!" -ForegroundColor Red
    exit 1
}
Write-Host "      API wgrane" -ForegroundColor Green

# Restart aplikacji
Write-Host ""
Write-Host "[5/5] Restartowanie aplikacji na serwerze..." -ForegroundColor Yellow
ssh "${SERVER_USER}@${SERVER_IP}" "cd ${SERVER_PATH} && docker-compose -f docker-compose.production.yml restart app"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Restart może wymagać ręcznej interwencji" -ForegroundColor Yellow
} else {
    Write-Host "      Aplikacja zrestartowana" -ForegroundColor Green
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT ZAKOŃCZONY!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Aplikacja dostępna pod: http://${SERVER_IP}" -ForegroundColor Cyan
Write-Host ""

# Pytanie o wgranie uploads/
Write-Host ""
$uploadChoice = Read-Host "Czy wgrać też folder uploads/ (zdjęcia)? [T/n]"
if ($uploadChoice -eq "" -or $uploadChoice -eq "T" -or $uploadChoice -eq "t") {
    Write-Host ""
    Write-Host "[BONUS] Wgrywanie zdjęć (uploads/)..." -ForegroundColor Yellow
    Write-Host "UWAGA: To może zająć kilka minut (911 plików, ~250MB)" -ForegroundColor Yellow
    scp -r uploads/* "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/uploads/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Nie udało się wgrać uploads!" -ForegroundColor Red
    } else {
        Write-Host "      Uploads wgrane" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Gotowe! Miłego użytkowania :)" -ForegroundColor Green
