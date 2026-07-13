@echo off
title MR Letreros - Bot WhatsApp Gemini
echo ==========================================
echo   INICIANDO BOT DE WHATSAPP CON OLLAMA/GEMINI
echo ==========================================
echo.

echo [1/2] Verificando Ollama (IA Local)...
netstat -ano | findstr :11434 >nul
if %errorlevel% neq 0 (
    echo    - Ollama no est corriendo. Iniciando...
    start "Ollama Serve" /min cmd /k "ollama serve"
    timeout /t 5 >nul
) else (
    echo    - Ollama ya est activo.
)

echo.
echo [2/2] Iniciando Node.js...
cd /d "%~dp0"
node whatsapp-bot-gemini.js
echo.
echo ==========================================
echo   EL BOT SE HA CERRADO INESPERADAMENTE
echo ==========================================
echo.
echo Revisa el error arriba antes de cerrar esta ventana.
pause