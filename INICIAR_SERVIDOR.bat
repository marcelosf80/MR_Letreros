@echo off
cd /d "%~dp0"
title Launcher MR Letreros

echo ==========================================
echo   INICIANDO SISTEMA MR LETREROS
echo ==========================================
echo.

:: 1. Iniciar Servidor Principal (Web + API)
echo [1/2] Lanzando Servidor Web...
start "MR Letreros - SERVIDOR WEB" node server.js

:: 2. Iniciar Bot de WhatsApp
echo [2/2] Lanzando Bot de WhatsApp...
echo       (Revisa la nueva ventana para el codigo QR)
start "MR Letreros - WHATSAPP BOT" node server-whatsapp.js

echo.
echo ==========================================
echo ✅ Sistemas iniciados en ventanas separadas.
echo ⚠️  NO CIERRES las ventanas nuevas.
pause