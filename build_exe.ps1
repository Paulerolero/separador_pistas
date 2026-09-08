$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "[1/4] Compilando frontend..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend")
npm run build
Pop-Location

Write-Host "[2/4] Instalando PyInstaller si falta..." -ForegroundColor Cyan
python -m pip install pyinstaller

Write-Host "[3/4] Construyendo ejecutable..." -ForegroundColor Cyan
python -m PyInstaller `
  --noconfirm `
  --clean `
  --onedir `
  --windowed `
  --name "SeparadorDePistas" `
  --paths "backend" `
  --add-data "frontend\dist;frontend_dist" `
  --add-data "backend;backend" `
  --hidden-import "uvicorn.logging" `
  --hidden-import "uvicorn.loops.auto" `
  --hidden-import "uvicorn.protocols.http.auto" `
  --hidden-import "uvicorn.protocols.websockets.auto" `
  --hidden-import "uvicorn.lifespan.on" `
  desktop_launcher.py

Write-Host "[4/4] Preparando carpeta de datos..." -ForegroundColor Cyan
$DataPath = Join-Path $Root "dist\SeparadorDePistas\data"
New-Item -ItemType Directory -Force $DataPath | Out-Null
Copy-Item -Path (Join-Path $Root "backend\storage\stems") -Destination $DataPath -Recurse -Force

Write-Host ""
Write-Host "Listo: dist\SeparadorDePistas\SeparadorDePistas.exe" -ForegroundColor Green
