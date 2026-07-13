cmake_minimum_required(VERSION 3.16)
project(MR_Letreros_Desktop VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Habilitar compilación automática de UI, Recursos y Meta-Objetos (MOC) de Qt
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

# Buscar el framework Qt 6
find_package(Qt6 REQUIRED COMPONENTS Widgets Gui Core Xml Sql)

# Directorios de inclusión
include_directories(src)

# Definir archivos fuentes
set(PROJECT_SOURCES
    src/main.cpp
    src/ui/mainwindow.cpp
    src/ui/mainwindow.h
    src/ui/vectorview.cpp
    src/ui/vectorview.h
    src/core/calculator.cpp
    src/core/calculator.h
    src/core/led_positioner.cpp
    src/core/led_positioner.h
    src/parser/svg_parser.cpp
    src/parser/svg_parser.h
    src/db/database.cpp
    src/db/database.h
)

# Definir el ejecutable
add_executable(MR_Letreros_Desktop ${PROJECT_SOURCES})

# Enlazar las dependencias de Qt 6
target_link_libraries(MR_Letreros_Desktop PRIVATE Qt6::Widgets Qt6::Gui Qt6::Core Qt6::Xml Qt6::Sql)

