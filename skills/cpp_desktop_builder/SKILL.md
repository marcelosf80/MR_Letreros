---
name: cpp-desktop-builder
description: Compila, construye y gestiona proyectos de escritorio C++ con Qt 6 y CMake en entornos Windows/Linux.
---

# Habilidad: cpp-desktop-builder

Esta habilidad proporciona instrucciones y guías paso a paso para compilar, probar y verificar la aplicación de escritorio nativa en C++ para **MR Letreros** utilizando **CMake** y **Qt 6**.

## Requisitos Previos
Para ejecutar y probar esta habilidad, el sistema del usuario debe contar con:
1. **CMake** (Versión 3.16 o superior).
2. **Qt 6 SDK** (Instalado y disponible en el PATH o definido mediante la variable de entorno `Qt6_DIR` / `CMAKE_PREFIX_PATH`).
3. Un compilador compatible con C++17 o superior:
   - **MSVC** (Visual Studio 2019 o superior en Windows).
   - **GCC / MinGW** (Versión 9 o superior en Windows/Linux).
   - **Clang** (Versión 10 o superior).

---

## Flujo de Trabajo de Compilación (Build Workflow)

### 1. Configurar el Directorio de Compilación
Se recomienda realizar compilaciones fuera de la carpeta origen (out-of-source builds). Ejecuta los siguientes comandos desde la carpeta raíz del proyecto de C++ (`mr_letreros_cpp`):

```bash
mkdir build
cd build
```

### 2. Generar Archivos de Construcción (Makefile / Visual Studio Solution)
Configura CMake especificando el generador adecuado:

**Usando MinGW/Makefiles:**
```bash
cmake -G "MinGW Makefiles" -DCMAKE_PREFIX_PATH="C:/Qt/6.x.x/mingw_64" ..
```

**Usando MSVC (Visual Studio):**
```bash
cmake -G "Visual Studio 17 2022" -A x64 -DCMAKE_PREFIX_PATH="C:/Qt/6.x.x/msvc2022_64" ..
```

*Nota: Reemplaza `6.x.x` por la versión exacta de Qt instalada.*

### 3. Compilar la Aplicación
Para compilar en modo Release o Debug:

```bash
cmake --build . --config Release
```

### 4. Empaquetar Dependencias en Windows
En Windows, para que el ejecutable funcione de manera independiente fuera del compilador, debes desplegar las librerías dinámicas de Qt (.dll) en la misma carpeta del ejecutable usando `windeployqt`:

```bash
windeployqt --release MR_Letreros_Desktop.exe
```

---

## Solución de Problemas Comunes

### Error: "Could not find a package configuration file provided by \"Qt6\""
**Causa**: CMake no sabe dónde está instalado Qt 6.
**Solución**: Define `-DCMAKE_PREFIX_PATH` en la llamada a CMake apuntando a la carpeta de compilador específica de Qt (ej. `C:/Qt/6.5.0/msvc2022_64`).

### Error: "Clipper library not found"
**Solución**: Asegúrate de compilar la librería Clipper provista en la carpeta `external/` o agrégala al archivo `CMakeLists.txt` como un subdirectorio del proyecto (`add_subdirectory`).
