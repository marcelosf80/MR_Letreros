@echo off
set "PATH=C:\msys64\ucrt64\bin;%PATH%"
cd /d "%~dp0mr_letreros_cpp\build"
cmd /k "MR_Letreros_Desktop.exe"
