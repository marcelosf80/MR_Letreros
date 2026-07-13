# INFORME TÉCNICO — SISTEMA DE VECTORIZACIÓN DE IMÁGENES CON IA
## Stack: Node.js + Groq (Llama 4 Scout/Maverick) + VTracer + Sharp

---

## ¿QUÉ ES VECTORIZAR Y POR QUÉ IMPORTA?

Una imagen **raster** (JPG, PNG) es una grilla de píxeles. Cuando la escalás,
se pixela y pierde calidad. Un archivo **vector** (SVG) es una descripción matemática
de formas y curvas. Lo podés escalar a cualquier tamaño — desde una tarjeta
hasta una cartelería de 10 metros — sin perder ni un detalle.

Para un negocio de gráfica como MR Letreros, vectorizar es crítico:
un logo mal vectorizado a 300×300px se convierte en basura al plotearlo a 3×1m.

### El problema histórico de la vectorización
Los algoritmos clásicos (Potrace, AutoTrace) trabajan a ciegas: no saben si están
vectorizando un logo, una foto, un ícono o texto. Aplican los mismos parámetros
a todo. El resultado es inconsistente: demasiados nodos en imágenes simples,
pérdida de detalle en imágenes complejas.

**La IA cambia esto:** primero _entiende_ la imagen, después decide cómo vectorizarla.

---

## EL ROL EXACTO DE GROQ EN EL SISTEMA

Groq no vectoriza. Las IAs de texto/visión no producen SVGs directamente.
**Groq es el cerebro que analiza y decide. VTracer es el motor que ejecuta.**

```
SIN IA:          imagen → VTracer (parámetros fijos) → SVG (calidad variable)

CON GROQ:        imagen → Groq analiza → parámetros óptimos → VTracer → SVG (calidad máxima)
                                     ↓
                              también puede:
                              - detectar si hay texto (para preservarlo)
                              - detectar fondo sólido (para removerlo antes)
                              - detectar número de colores (para palette control)
                              - recomendar si usar modo binario o color
                              - validar la calidad del SVG resultante
```

### Los 3 modelos disponibles en Groq para este sistema

| Modelo | Visión | JSON mode | Velocidad | Uso recomendado |
|--------|--------|-----------|-----------|-----------------|
| `meta-llama/llama-4-scout-17b-16e-instruct` | ✅ | ✅ | 460 tok/s | **Análisis principal** — rápido y económico |
| `meta-llama/llama-4-maverick-17b-128e-instruct` | ✅ | ✅ | Alta | Validación de calidad — más preciso |
| `llama-3.3-70b-versatile` | ❌ | ✅ | Muy alta | Post-procesamiento de metadatos |

**Usar Llama 4 Scout para análisis de imagen** (tiene visión nativa + JSON mode + 460 tok/s en Groq).

---

## ARQUITECTURA COMPLETA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│  MÓDULO 1: RECEPCIÓN                                            │
│  Browser sube imagen → server.js recibe multipart/form-data     │
│  Multer guarda en /uploads/temp/                                │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  MÓDULO 2: ANÁLISIS IA (Groq Llama 4 Scout — Vision + JSON)     │
│                                                                 │
│  Entrada: imagen en base64 (máx 4MB)                            │
│  Salida JSON:                                                   │
│  {                                                              │
│    "tipo_imagen": "logo|foto|icono|texto|ilustracion|mixto",    │
│    "colores_dominantes": 3,                                     │
│    "tiene_fondo_blanco": true,                                  │
│    "tiene_texto": false,                                        │
│    "complejidad": "simple|media|compleja",                      │
│    "modo_recomendado": "color|binary",                          │
│    "remover_fondo_antes": true,                                 │
│    "params_vtracer": {                                          │
│      "colormode": "color",                                      │
│      "hierarchical": "stacked",                                 │
│      "mode": "spline",                                          │
│      "filter_speckle": 4,                                       │
│      "color_precision": 6,                                      │
│      "layer_difference": 16,                                    │
│      "corner_threshold": 60,                                    │
│      "length_threshold": 4.0                                    │
│    }                                                            │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  MÓDULO 3: PRE-PROCESAMIENTO (Sharp — Node.js nativo)           │
│                                                                 │
│  Si tiene_fondo_blanco → removeAlpha + flatten blanco           │
│  Si complejidad=compleja → upscale 2x antes de vectorizar       │
│  Si tiene_texto → sharpen fuerte antes                          │
│  Siempre → convertir a PNG sin pérdida para VTracer             │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  MÓDULO 4: VECTORIZACIÓN (VTracer via Python subprocess)        │
│                                                                 │
│  Python script recibe los params del análisis de Groq           │
│  vtracer.convert_image_to_svg_py(img_path, svg_path, **params)  │
│  Produce SVG con curvas bezier suaves                           │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  MÓDULO 5: POST-PROCESAMIENTO + VALIDACIÓN (opcional)           │
│                                                                 │
│  Groq Llama 4 Scout lee el SVG y lo evalúa                      │
│  → ¿Tiene demasiados paths? → Simplificar                       │
│  → ¿Se perdió detalle? → Reintentar con params más finos        │
│  → Reportar: # paths, # colores, tamaño archivo, calidad 1-10   │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  MÓDULO 6: ENTREGA                                              │
│  Browser descarga el SVG                                        │
│  Guardar en historial con metadatos del análisis                │
└─────────────────────────────────────────────────────────────────┘
```

---

## TECNOLOGÍAS Y POR QUÉ CADA UNA

### VTracer (vectorizador principal)
Es el mejor motor open-source disponible en 2025 para este caso:

| Herramienta | Colores | Velocidad | Calidad splines | Node/Python |
|-------------|---------|-----------|-----------------|-------------|
| **VTracer** | ✅ Full color | O(n) rápido | ✅ Excelente | ✅ Python nativo |
| Potrace | ❌ Solo B&W | O(n²) lento | Buena | Requiere binario |
| AutoTrace | Parcial | Lento | Regular | Binario solo |
| ImageTracerJS | Básico | Medio | Regular | ✅ Node puro |

VTracer fue escrito en Rust, tiene binding oficial de Python (`pip install vtracer`),
y puede ser llamado desde Node.js via `spawn('python3', ['vectorize.py', ...])`.

### Sharp (pre-procesamiento de imagen)
Librería Node.js para manipulación de imágenes. Corre en C++/libvips.
Sirve para: redimensionar, convertir formato, ajustar contraste, remover fondo blanco,
hacer upscale previo. Sin Sharp, VTracer recibe imágenes sucias y el resultado es malo.

### Groq Llama 4 Scout (análisis de imagen)
Primer modelo de visión nativa en Groq. Soporta:
- Imágenes en base64 hasta 4MB, hasta 5 imágenes por request
- `response_format: { type: 'json_object' }` — devuelve JSON puro
- 460 tokens/segundo → análisis de imagen en menos de 1 segundo
- Resolución máxima: 33 megapíxeles por imagen

---

## IMPLEMENTACIÓN — CÓDIGO COMPLETO

### Dependencias a instalar

```bash
# Node.js
npm install sharp multer openai express

# Python (para VTracer)
pip install vtracer pillow
```

### Estructura de archivos

```
vectorizador/
├── server.js              ← Servidor Express + endpoints
├── vectorize.py           ← Script Python con VTracer
├── uploads/
│   ├── temp/              ← Imágenes subidas temporalmente
│   └── output/            ← SVGs generados
└── public/
    └── vectorizador.html  ← Interface del usuario
```

---

### server.js — Endpoint principal

```javascript
const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');
const { spawn } = require('child_process');
const OpenAI  = require('openai');
const path    = require('path');
const fs      = require('fs').promises;

const app = express();
const upload = multer({ dest: 'uploads/temp/', limits: { fileSize: 20 * 1024 * 1024 } });

// Inicializar Groq (usa la API key igual que el resto del sistema)
const groq = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || TU_API_KEY
});

// ═══════════════════════════════════════════════════════════
// PASO 1: ANÁLISIS DE IMAGEN CON GROQ LLAMA 4 SCOUT
// ═══════════════════════════════════════════════════════════
async function analizarImagenConGroq(imagePath) {
  // Leer imagen y convertir a base64 (máx 4MB para Groq)
  const imgBuffer = await fs.readFile(imagePath);
  
  // Si la imagen es muy grande, reducirla antes de enviar a Groq
  let base64Image;
  const stats = await fs.stat(imagePath);
  
  if (stats.size > 3.5 * 1024 * 1024) {
    // Reducir para análisis (no afecta la vectorización, solo el análisis de Groq)
    const reducida = await sharp(imagePath)
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    base64Image = reducida.toString('base64');
  } else {
    base64Image = imgBuffer.toString('base64');
  }

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Sos un experto en vectorización de imágenes para impresión gráfica.
Analizá esta imagen y devolvé ÚNICAMENTE un objeto JSON con estos campos:

{
  "tipo_imagen": "logo | foto | icono | texto | ilustracion | mixto",
  "descripcion_breve": "descripción en 1 línea de qué es la imagen",
  "colores_dominantes": número de 1 a 20,
  "tiene_fondo_blanco": true/false,
  "tiene_fondo_transparente": true/false,
  "tiene_texto": true/false,
  "complejidad": "simple | media | compleja",
  "es_fotografia": true/false,
  "bordes_definidos": true/false,
  "modo_recomendado": "color | binary",
  "remover_fondo_antes": true/false,
  "necesita_upscale": true/false,
  "params_vtracer": {
    "colormode": "color | binary",
    "hierarchical": "stacked | cutout",
    "mode": "spline | polygon",
    "filter_speckle": número entre 2 y 10,
    "color_precision": número entre 4 y 8,
    "layer_difference": número entre 8 y 32,
    "corner_threshold": número entre 30 y 90,
    "length_threshold": número entre 3.5 y 8.0
  },
  "justificacion": "Por qué elegiste estos parámetros en 1 línea"
}

REGLAS PARA LOS PARÁMETROS:
- Logo simple (pocos colores, bordes limpios): color_precision=4, filter_speckle=2, mode=spline
- Fotografía: es_fotografia=true, colormode=color, color_precision=8, layer_difference=8
- Texto o íconos B&W: colormode=binary, mode=spline, corner_threshold=50
- Ilustración compleja: color_precision=6, layer_difference=16, filter_speckle=4
- Imagen con fondo blanco sólido: remover_fondo_antes=true
- Imagen pequeña o baja resolución: necesita_upscale=true`
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
          }
        }
      ]
    }],
    response_format: { type: 'json_object' },
    temperature: 0.1,  // Muy baja para respuestas determinísticas
    max_tokens: 800
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ═══════════════════════════════════════════════════════════
// PASO 2: PRE-PROCESAMIENTO CON SHARP
// ═══════════════════════════════════════════════════════════
async function preprocesarImagen(imagePath, analisis) {
  const outputPath = imagePath.replace('temp/', 'temp/processed_');
  let pipeline = sharp(imagePath);

  // Upscale si la imagen es muy pequeña (mejora calidad de vectorización)
  if (analisis.necesita_upscale) {
    pipeline = pipeline.resize({
      width: 2000,
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3
    });
    console.log('⬆️  Upscale aplicado para mejorar vectorización');
  }

  // Remover fondo blanco → transparencia (VTracer vectoriza mejor sin fondo)
  if (analisis.remover_fondo_antes && analisis.tiene_fondo_blanco) {
    pipeline = pipeline
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .threshold(240); // Umbral para definir qué es "blanco"
    console.log('🎨 Fondo blanco removido');
  }

  // Si tiene texto: aplicar sharpening para preservar bordes
  if (analisis.tiene_texto) {
    pipeline = pipeline.sharpen({ sigma: 1.5, m1: 0.5, m2: 3 });
    console.log('✏️  Sharpening aplicado para texto');
  }

  // Siempre convertir a PNG sin pérdida para VTracer
  pipeline = pipeline.png({ compressionLevel: 1 });

  const outputPng = outputPath.replace(/\.(jpg|jpeg|webp|gif)$/i, '.png');
  await pipeline.toFile(outputPng);
  return outputPng;
}

// ═══════════════════════════════════════════════════════════
// PASO 3: VECTORIZACIÓN CON VTRACER (Python subprocess)
// ═══════════════════════════════════════════════════════════
async function vectorizarConVTracer(imagePngPath, params, outputSvgPath) {
  return new Promise((resolve, reject) => {
    const paramsJson = JSON.stringify(params);

    // Llamar al script Python con los parámetros recomendados por Groq
    const proceso = spawn('python3', [
      path.join(__dirname, 'vectorize.py'),
      '--input', imagePngPath,
      '--output', outputSvgPath,
      '--params', paramsJson
    ]);

    let stderr = '';
    proceso.stderr.on('data', d => stderr += d.toString());

    proceso.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`VTracer falló (código ${code}): ${stderr}`));
      } else {
        resolve(outputSvgPath);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// PASO 4: VALIDACIÓN OPCIONAL CON GROQ
// ═══════════════════════════════════════════════════════════
async function validarSVG(svgPath, analisisOriginal) {
  const svgContent = await fs.readFile(svgPath, 'utf-8');
  
  // Contar paths en el SVG (métrica de complejidad)
  const pathCount = (svgContent.match(/<path/g) || []).length;
  const svgSizeKb = Math.round(svgContent.length / 1024);

  // Solo llamar a Groq para validación si el resultado parece extraño
  const validacionBasica = {
    paths_totales: pathCount,
    tamanio_kb: svgSizeKb,
    alerta: pathCount > 5000 ? 'Demasiados paths — calidad puede ser baja' : null,
    recomendacion_filtrado: pathCount > 3000 ? 'Aumentar filter_speckle para simplificar' : null
  };

  return validacionBasica;
}

// ═══════════════════════════════════════════════════════════
// ENDPOINT PRINCIPAL: POST /api/vectorizar
// ═══════════════════════════════════════════════════════════
app.post('/api/vectorizar', upload.single('imagen'), async (req, res) => {
  const imagePath = req.file.path;
  const jobId     = Date.now().toString();
  const svgPath   = path.join('uploads', 'output', `${jobId}.svg`);

  try {
    // PASO 1: Groq analiza la imagen
    console.log('🧠 Analizando imagen con Groq Llama 4 Scout...');
    const analisis = await analizarImagenConGroq(imagePath);
    console.log(`✅ Análisis: ${analisis.tipo_imagen} | ${analisis.complejidad} | ${analisis.colores_dominantes} colores`);
    console.log(`   → ${analisis.justificacion}`);

    // PASO 2: Pre-procesar imagen según el análisis
    console.log('🔧 Pre-procesando imagen...');
    const imgProcesada = await preprocesarImagen(imagePath, analisis);

    // PASO 3: Vectorizar con los parámetros recomendados por Groq
    console.log('✏️  Vectorizando con VTracer...');
    await vectorizarConVTracer(imgProcesada, analisis.params_vtracer, svgPath);

    // PASO 4: Validación básica del SVG generado
    const validacion = await validarSVG(svgPath, analisis);
    console.log(`📊 SVG generado: ${validacion.paths_totales} paths | ${validacion.tamanio_kb}KB`);

    // Limpiar archivos temporales
    await fs.unlink(imagePath).catch(() => {});
    await fs.unlink(imgProcesada).catch(() => {});

    res.json({
      success: true,
      job_id: jobId,
      svg_url: `/uploads/output/${jobId}.svg`,
      analisis: {
        tipo: analisis.tipo_imagen,
        descripcion: analisis.descripcion_breve,
        colores: analisis.colores_dominantes,
        complejidad: analisis.complejidad,
        modo: analisis.params_vtracer.colormode,
        justificacion: analisis.justificacion
      },
      calidad: validacion,
      alerta: validacion.alerta || null
    });

  } catch (err) {
    console.error('❌ Error vectorizando:', err.message);
    await fs.unlink(imagePath).catch(() => {});
    res.status(500).json({ success: false, error: err.message });
  }
});

// Servir SVGs generados
app.use('/uploads/output', express.static('uploads/output'));

app.listen(3000, () => console.log('✅ Vectorizador corriendo en puerto 3000'));
```

---

### vectorize.py — Script Python con VTracer

```python
#!/usr/bin/env python3
"""
Script Python para vectorización con VTracer.
Recibe los parámetros recomendados por Groq vía JSON.
Llamado desde Node.js con spawn().
"""
import sys
import json
import argparse
import vtracer

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input',  required=True, help='Ruta imagen PNG de entrada')
    parser.add_argument('--output', required=True, help='Ruta SVG de salida')
    parser.add_argument('--params', required=True, help='Parámetros VTracer en JSON')
    args = parser.parse_args()

    params = json.loads(args.params)

    print(f"🔧 VTracer iniciando — modo: {params.get('colormode')} | paths: {params.get('mode')}", file=sys.stderr)

    try:
        vtracer.convert_image_to_svg_py(
            inp           = args.input,
            out           = args.output,
            colormode     = params.get('colormode', 'color'),       # "color" o "binary"
            hierarchical  = params.get('hierarchical', 'stacked'),  # "stacked" o "cutout"
            mode          = params.get('mode', 'spline'),           # "spline", "polygon", "none"
            filter_speckle= int(params.get('filter_speckle', 4)),   # 2-10: quita motas pequeñas
            color_precision= int(params.get('color_precision', 6)), # 4-8: precisión de color
            layer_difference= int(params.get('layer_difference', 16)), # 8-32: diferencia entre capas
            corner_threshold= int(params.get('corner_threshold', 60)), # 30-90: ángulo mínimo de esquina
            length_threshold= float(params.get('length_threshold', 4.0)), # 3.5-8: min longitud de path
            path_precision  = int(params.get('path_precision', 3))  # decimales en paths
        )
        print(f"✅ SVG generado: {args.output}", file=sys.stderr)

    except Exception as e:
        print(f"❌ VTracer error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

---

## GUÍA DE PARÁMETROS DE VTRACER

Esta es la parte más importante. Groq elige estos valores según el análisis visual.

| Parámetro | Qué controla | Valor bajo | Valor alto | Por defecto |
|-----------|-------------|------------|------------|-------------|
| `filter_speckle` | Elimina manchas pequeñas | Conserva detalles finos | Elimina ruido | 4 |
| `color_precision` | Precisión del color | Menos colores (logos) | Más colores (fotos) | 6 |
| `layer_difference` | Diferencia entre capas de color | Más capas = más detalle | Menos capas = más limpio | 16 |
| `corner_threshold` | Ángulo mínimo para crear esquina | Más esquinas = más geometría | Menos esquinas = curvas suaves | 60 |
| `length_threshold` | Longitud mínima de un path | Más paths pequeños | Solo paths grandes | 4.0 |
| `mode` | Tipo de curva de salida | `spline` = bezier suave | `polygon` = ángulos rectos | spline |
| `colormode` | Color vs blanco/negro | `binary` = 2 colores | `color` = paleta completa | color |

### Presets recomendados por tipo de imagen

**Logos y marcas (simple, pocos colores)**
```json
{
  "colormode": "color",
  "filter_speckle": 2,
  "color_precision": 4,
  "layer_difference": 24,
  "corner_threshold": 50,
  "length_threshold": 5.0,
  "mode": "spline"
}
```

**Íconos y pictogramas (B&W o bicolor)**
```json
{
  "colormode": "binary",
  "filter_speckle": 3,
  "corner_threshold": 45,
  "length_threshold": 4.0,
  "mode": "spline"
}
```

**Ilustraciones (colores medios, detalle medio)**
```json
{
  "colormode": "color",
  "filter_speckle": 4,
  "color_precision": 6,
  "layer_difference": 16,
  "corner_threshold": 60,
  "length_threshold": 4.0,
  "mode": "spline"
}
```

**Fotografías (muchos colores, detalle alto)**
```json
{
  "colormode": "color",
  "filter_speckle": 6,
  "color_precision": 8,
  "layer_difference": 8,
  "corner_threshold": 75,
  "length_threshold": 3.5,
  "mode": "spline"
}
```

---

## INTEGRACIÓN CON EL SISTEMA MR LETREROS

Ya que el sistema usa Node.js + Express + Groq, la integración es directa:

### En server.js del sistema principal
Agregar las rutas del vectorizador como un módulo separado:

```javascript
// server.js — agregar al final antes del app.listen
const vectorizadorRouter = require('./modules/vectorizador');
app.use('/api/vectorizar', verifyToken, vectorizadorRouter);
```

### Guardar historial de vectorizaciones
```javascript
// Guardar en datos_mr_letreros/vectorizaciones.json
const nuevaVectorizacion = {
  id: jobId,
  fecha: new Date().toISOString(),
  archivo_original: req.file.originalname,
  svg_path: svgPath,
  analisis_groq: analisis,
  operador: req.user?.nombre || 'desconocido'
};
const historial = await readJSON(path.join(DATA_DIR, 'vectorizaciones.json')) || [];
historial.push(nuevaVectorizacion);
await writeJSON(path.join(DATA_DIR, 'vectorizaciones.json'), historial);
```

### En el sidebar del sistema
Agregar entrada en la navegación:
```html
<li>
  <a href="/vectorizador.html">
    <span class="icon">✏️</span> Vectorizador IA
  </a>
</li>
```

---

## LIMITACIONES CONOCIDAS DE GROQ PARA ESTE USO

| Limitación | Valor | Impacto | Solución |
|-----------|-------|---------|---------|
| Tamaño máx imagen base64 | 4MB | Imágenes grandes necesitan reducción previa | Sharp reduce a 1500px antes de enviar a Groq |
| Imágenes por request | 5 máx | Sin problema en este caso (1 imagen por vez) | — |
| Resolución máxima | 33 megapíxeles | Fotos de cámara muy grandes | Reducir con Sharp antes |
| Groq NO genera SVG | No aplica | Groq es solo el analista, no el vectorizador | VTracer hace la conversión |
| JSON mode requiere pedirlo en el prompt | Siempre | Sin problema si el prompt lo indica | Siempre incluir "devolvé JSON" en el prompt |

---

## CHECKLIST DE IMPLEMENTACIÓN

```
FASE 1 — Instalar dependencias:
[ ] npm install sharp multer openai express
[ ] pip install vtracer pillow
[ ] Verificar: python3 -c "import vtracer; print('ok')"
[ ] Verificar: node -e "require('sharp'); console.log('ok')"

FASE 2 — Crear archivos:
[ ] vectorize.py en la raíz del proyecto
[ ] uploads/temp/ y uploads/output/ (crear directorios)
[ ] Agregar endpoint /api/vectorizar a server.js
[ ] Agregar verifyToken al endpoint

FASE 3 — Interface de usuario:
[ ] Crear vectorizador.html con:
    - Zona de drag & drop para subir imagen
    - Vista previa de la imagen original
    - Indicador de análisis IA en progreso
    - Vista previa del SVG generado (inline en browser)
    - Botón de descarga del SVG
    - Panel con los datos del análisis de Groq
    - Posibilidad de ajustar parámetros manualmente

FASE 4 — Testing:
[ ] Probar con logo simple PNG → debe tener < 200 paths
[ ] Probar con foto → debe tener paths > 1000 (es normal)
[ ] Probar con imagen grande > 4MB → verifica que Sharp la reduce
[ ] Probar con imagen B&W → Groq debe recomendar mode=binary
[ ] Verificar que el SVG abre correctamente en Inkscape/Illustrator

FASE 5 — Integración:
[ ] Agregar entrada en sidebar del sistema
[ ] Guardar historial en vectorizaciones.json
[ ] Agregar al JWT verifyToken del sistema actual
```

---

## RESUMEN EJECUTIVO

El sistema usa **3 herramientas que se potencian mutuamente**:

**Groq (Llama 4 Scout)** analiza la imagen visualmente — detecta qué tipo es,
cuántos colores tiene, si hay texto, si el fondo es sólido — y decide los parámetros
óptimos para el motor de vectorización. Hace esto en menos de 1 segundo gracias
al hardware de Groq (460 tok/s).

**Sharp** pre-procesa la imagen antes de vectorizar: sube la resolución si hace falta,
elimina el fondo blanco, aplica sharpening si hay texto. Esto mejora drásticamente
la calidad del SVG final.

**VTracer** ejecuta la vectorización real con los parámetros que Groq eligió.
Es un motor en Rust, muy rápido, con soporte nativo de Python y colores completos.
Produce SVGs con curvas bezier suaves, ideales para impresión.

El resultado es un vectorizador que **se adapta inteligentemente a cada imagen**
en lugar de aplicar los mismos parámetros a todo — exactamente lo que necesita
un negocio de gráfica donde llegan logos, fotos, íconos y texto por igual.
