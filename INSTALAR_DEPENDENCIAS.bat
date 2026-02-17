@echo off
echo ==========================================
echo   INSTALANDO DEPENDENCIAS DE PYTHON
echo ==========================================
echo.

set PYTHON_CMD=python

:: Verificar si existe el lanzador 'py' (común en Windows)
py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Detectado lanzador 'py'. Usando entorno global...
    set PYTHON_CMD=py
) else (
    echo Lanzador 'py' no detectado. Usando comando 'python' estandar...
)

echo Verificando Python activo (%PYTHON_CMD%)...
%PYTHON_CMD% --version
echo.
echo Instalando libreria svg.path...
%PYTHON_CMD% -m pip install svg.path

if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Tu computadora esta usando el Python de Inkscape (sin pip).
    echo SOLUCION: Instala Python desde python.org y marca "Add to PATH".
    pause
    exit /b
)

echo.
echo Verificando instalacion...
%PYTHON_CMD% -c "import svg.path; print('✅ svg.path instalado correctamente')" || echo "❌ ERROR: No se pudo importar svg.path"
echo.
echo ==========================================
echo   INSTALACION COMPLETA
echo ==========================================
pause