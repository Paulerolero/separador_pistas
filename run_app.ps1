# PowerShell Launcher for Music Practice & Stem Lab
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     MUSIC PRACTICE & STEM LAB (Moises-like Studio)     " -ForegroundColor Cyan
Write-Host "      Demucs v4 + MIR Harmonic & String Transcriber     " -ForegroundColor DarkCyan
Write-Host "========================================================" -ForegroundColor Cyan

$WorkspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonExe = Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Write-Host "`n[1/2] Iniciando Backend FastAPI en http://127.0.0.1:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WorkspaceRoot'; & '$PythonExe' backend/run_backend.py"

Start-Sleep -Seconds 3

Write-Host "[2/2] Iniciando Frontend React en http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WorkspaceRoot/frontend'; & 'npm.cmd' run dev -- --host 0.0.0.0"

Start-Sleep -Seconds 3
Write-Host "`nAbriendo navegador web..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"
