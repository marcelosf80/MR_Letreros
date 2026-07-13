# Documento de Requisitos del Producto (PRD) - MR Letreros

## 1. Descripción General
MR Letreros es un sistema de gestión integral con herramientas avanzadas para talleres gráficos. El módulo principal bajo optimización y corrección es el **LED Wizard**, una utilidad para calcular la cantidad, consumo, cableado y fuentes requeridas para letreros de módulos LED, tiras LED y Neon Flex utilizando Fabric.js en el frontend y un backend de procesamiento de geometría en Python.

## 2. Requisitos Específicos de LED Wizard
- **Independencia del Viewport**: Toda inserción de módulos y auras debe posicionarse de manera correcta independientemente del nivel de zoom o paneo activos en el canvas de Fabric.js.
- **Trazado Preciso de Neon Flex**: Las líneas de Neon Flex deben alinearse de forma exacta sobre los contornos de las letras del letrero, incluso cuando el objeto original esté anidado dentro de un grupo o sufra transformaciones.
- **Z-Ordering Correcto**: El apilamiento de objetos en el canvas debe seguir una jerarquía limpia (letras en la base, seguidas de Neon Flex, cableados de puenteo, líneas de alimentación y fuentes en la cima).
- **Asistente Visual con Gemini**: La integración con Gemini Vision debe permitir capturar el canvas actual, estimar especificaciones técnicas y autoconfigurar presets de manera directa a través de un panel lateral dinámico.

## 3. Requisitos Técnicos
- **Frontend**: Fabric.js v4+, Tailwind o Vanilla CSS adaptado, llamadas fetch locales al backend.
- **Backend de Cálculo**: API en FastAPI (Python 3.9+) que procesa trayectorias de curvas y grids usando Shapely 2.0 y NumPy de forma vectorizada.
- **Claves API**: Consumo dinámico y seguro de claves API desde los endpoints `/api/config/*-key` de `server.js`.
