@echo off
title Claude Code - Local AI (Ollama)
echo ==========================================
echo   LANZANDO CLAUDE CODE CON OLLAMA LOCAL
echo ==========================================
echo.

set ANTHROPIC_BASE_URL=http://localhost:11434
set ANTHROPIC_API_KEY=ollama
set ANTHROPIC_AUTH_TOKEN=ollama

echo [1/1] Iniciando Claude Code...
echo Usando modelo: llama3.2:latest
echo.

"C:\Users\usuario\.local\bin\claude.exe" --model llama3.2:latest

echo.
echo Presiona una tecla para salir...
pause >nul
