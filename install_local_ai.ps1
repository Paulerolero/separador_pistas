$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "Instalando PyTorch y Demucs para separación IA local..." -ForegroundColor Cyan
python -m pip install -r backend\requirements.txt

Write-Host ""
Write-Host "Instalación terminada. El modelo Demucs se descargará una sola vez" -ForegroundColor Green
Write-Host "en backend\storage\models durante la primera separación." -ForegroundColor Green
