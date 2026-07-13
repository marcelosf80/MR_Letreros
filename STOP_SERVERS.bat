@echo off
echo 🛑 Deteniendo servidores de MR Letreros...

:: Detener proceso en puerto 3000 (Servidor Principal)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Matando proceso en puerto 3000 (PID: %%a)...
    taskkill /f /pid %%a
)

:: Detener proceso en puerto 3001 (Bot WhatsApp)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    echo Matando proceso en puerto 3001 (PID: %%a)...
    taskkill /f /pid %%a
)

echo ✅ Todos los servidores han sido cerrados.
pause