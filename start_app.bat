@echo off
title Music Practice & Stem Lab Launcher
echo ========================================================
echo       MUSIC PRACTICE & STEM LAB (Moises-like DAW)
echo      Demucs v4 + MIR Harmonic & String Transcriber
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando Backend FastAPI (Puerto 8000)...
start "StemLab Backend" cmd /k "python backend/run_backend.py"

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Frontend React (Vite)...
cd frontend
start "StemLab Frontend" cmd /k "npm run dev"

echo.
echo Todo listo! Abriendo aplicacion en el navegador:
echo http://localhost:5173
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5173

pause
