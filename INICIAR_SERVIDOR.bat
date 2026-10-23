@echo off
title MR Letreros - Sistema Integral
color 0A
cls

echo ====================================================
echo    VERIFICANDO ESTADO DEL SISTEMA MR LETREROS
echo ====================================================
echo.

:: Verificar si el servidor principal ya está corriendo en el puerto 3000
netstat -aon | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [OK] El servidor ya esta activo y corriendo en el puerto 3000.
    echo Cerrando ventana...
    timeout /t 2 >nul
    exit
)

echo [1/4] Cerrando procesos huerfanos anteriores...
:: Liberar puertos 8000 y 8002 de sesiones previas si existen
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8002 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo.
echo [2/4] Verificando dependencias de Python (Calculadora LED)...
pip install -r backend/requirements.txt

echo.
echo [3/4] Iniciando Microservicio Python (Puerto 8000)...
start "MR Letreros - Backend Python" /min cmd /c "cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [4/4] Iniciando Servidor de Escalado Real-ESRGAN (Puerto 8002)...
start "MR Letreros - AI Upscaler" /min cmd /c "cd upscaler && uv run uvicorn src.upscaler.app:app --host 0.0.0.0 --port 8002"

echo.
echo ====================================================
echo    INICIANDO SERVIDOR PRINCIPAL (Puerto 3000)
echo ====================================================
echo.
npm start

pause