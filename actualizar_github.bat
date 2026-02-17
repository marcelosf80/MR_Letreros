@echo off
echo ---------------------------------------------------
echo  SUBIR CAMBIOS A GITHUB - MR LETREROS
echo ---------------------------------------------------
echo.

echo [1/3] Agregando archivos...
git add .

echo [2/3] Guardando cambios locales...
set /p msg="Escribe un mensaje para el commit (Enter para 'Actualizacion automatica'): "
if "%msg%"=="" set msg="Actualizacion automatica"
git commit -m "%msg%"

echo [3/3] Subiendo a GitHub...
git push

if %errorlevel% == 0 (
    echo.
    echo [EXITO] Los cambios se han subido correctamente.
) else (
    echo.
    echo [ERROR] Verifica que hayas configurado el repositorio remoto (git remote add origin URL).
)
pause