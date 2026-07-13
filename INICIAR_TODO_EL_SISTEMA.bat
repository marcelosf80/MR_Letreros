@echo off
title MR Letreros - Inicio Total
color 0B
cls

echo ====================================================
echo    INICIANDO TODO EL SISTEMA MR LETREROS
echo ====================================================
echo.

echo [1/2] Iniciando Servidor Principal (Node, Python)...
start "MR Letreros - Servidor" cmd /c "INICIAR_SERVIDOR.bat"

echo.
echo [2/2] Iniciando Bot de WhatsApp (Gemini)...
start "MR Letreros - Bot" cmd /c "INICIAR_BOT_WHATSAPP.bat"

echo.
echo ====================================================
echo    EL SISTEMA SE ESTA INICIANDO EN VENTANAS APARTE
echo ====================================================
echo.
echo Ya puedes minimizar esta ventana. Los servidores se abrirán en ventanas independientes.
echo.
timeout /t 10
exit
