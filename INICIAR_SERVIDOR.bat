@echo off
title MR Letreros - Sistema Integral
color 0A
cls

echo ====================================================
echo    INICIANDO SISTEMA MR LETREROS v2.2
echo ====================================================
echo.

echo [0/4] Liberando puertos 3000, 8000 y 8002 de sesiones previas...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8002 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo.
echo [1/4] Verificando dependencias de Python (Calculadora LED)...
pip install -r backend/requirements.txt

echo.
echo [2/4] Iniciando Microservicio Python (Puerto 8000)...
start "MR Letreros - Backend Python" /min cmd /k "cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo [3/4] Iniciando Servidor de Escalado Real-ESRGAN (Puerto 8002)...
start "MR Letreros - AI Upscaler" /min cmd /k "cd upscaler && uv run uvicorn src.upscaler.app:app --host 0.0.0.0 --port 8002"

echo.
echo [4/4] Iniciando Servidor Principal Node.js (Puerto 3000)...
npm start

pause