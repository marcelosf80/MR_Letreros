@echo off
echo 🚀 Reiniciando servicios de MR Letreros en ventanas separadas...
taskkill /f /im node.exe
timeout /t 2 > nul
cd /d C:\MR_Letreros
:: Iniciar Servidor API en nueva ventana
start "API MR Letreros" node server.js
timeout /t 5 > nul
:: Iniciar Bot WhatsApp en nueva ventana
start "BOT WhatsApp" node whatsapp-bot-gemini.js
echo ✅ Servicios iniciados en ventanas independientes.
pause
