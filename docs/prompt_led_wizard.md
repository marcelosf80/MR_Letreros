# PROMPT TÉCNICO — LED Wizard: Fix Posicionamiento + Integración Gemini AI

## CONTEXTO DEL PROYECTO

**LED Wizard** es una herramienta web para calcular instalaciones LED en letreros.
Stack: Fabric.js (canvas), Python/FastAPI (backend cálculos), SVGs de CorelDRAW.

**Estado actual con bugs:**
1. Módulos LED se renderizan DEBAJO del diseño (no sobre las letras)
2. Líneas de Neon Flex se dibujan fuera del contorno de las letras

---

## ARQUITECTURA RELEVANTE

### Sistema de coordenadas (el problema central)

```
┌─────────────────────────────────────────────────────┐
│  FABRIC CANVAS (viewport)                           │
│  ┌─────────────────────────────────────────┐        │
│  │  Object local coords (0,0 = center)     │        │
│  │  path "d" tiene M 0 0 L 100 200...      │        │
│  │                    ↓                    │        │
│  │  calcTransformMatrix() → [a,b,c,d,tx,ty]│        │
│  │  convierte local → canvas px            │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
│  ZOOM activo: canvas.getZoom() puede ser 0.07-5     │
│  PAN activo: viewportTransform[4], [5]              │
│                                                     │
│  PROBLEMA: backend devuelve coords en "canvas px"   │
│  pero fabric.add() coloca en "viewport px" cuando   │
│  hay zoom/pan activo → aparecen en lugar incorrecto │
└─────────────────────────────────────────────────────┘
```

### Código actual — `_calculateOnBackend` (JS)

```javascript
async _calculateOnBackend(fabricObj) {
    const mtx = fabricObj.calcTransformMatrix(); // [a,b,c,d,tx,ty]
    // tx,ty están en coords canvas SIN zoom/pan
    
    const payload = {
        svg_path:         d,              // path "d" en coords locales
        transform_matrix: Array.from(mtx), // convierte local→canvas
        module_width:     cfg.modW * scalePxPerCm,
        module_height:    cfg.modH * scalePxPerCm,
        spacing_x:        cfg.stepX * scalePxPerCm,
        // ...
    };
    
    const responseData = await res.json();
    positions = Array.isArray(responseData) ? responseData : responseData.leds;
    
    // BUG AQUÍ: posiciones vienen en canvas px pero fabric necesita
    // "object coords" sin el viewport transform
    positions?.forEach(({ x, y, angle }) => {
        this.crearLed(x, y, angle, fabricObj.id);
    });
}
```

### Código actual — `crearLed` (JS)

```javascript
crearLed(x, y, angle = 0, parentId) {
    // x, y deberían ser coords absolutas del canvas (sin zoom)
    const led = new fabric.Rect({
        left: x,    // Fabric usa estas como coords del canvas
        top:  y,    // SIN aplicar viewportTransform
        originX: 'center',
        originY: 'center',
        // ...
    });
    canvas.add(led);
}
```

### Código actual — `calcularNeon` (JS)

```javascript
calcularNeon(fabricObj) {
    fabricObj.clone(outer => {
        // clone() copia left/top/scaleX del objeto
        // PERO si el objeto fue transformado por zoom/pan después de importar,
        // left/top NO son sus coords absolutas en el canvas
        outer.set({ stroke: neonColor, fill: 'transparent', ... });
        canvas.add(outer);
    });
}
```

### Backend Python — respuesta esperada

```python
# main.py devuelve:
class LedPosition(BaseModel):
    x: float  # coords en px del canvas (después de aplicar transform_matrix)
    y: float
    angle: float

class LedsResponse(BaseModel):
    leds: List[LedPosition]
    metrics: Optional[ContourMetrics]
```

---

## BUGS A RESOLVER

### BUG 1 — Módulos LED aparecen debajo del diseño

**Causa raíz:** `calcTransformMatrix()` devuelve la matriz acumulada del objeto en el canvas. Si el canvas tiene `viewportTransform` activo (zoom/pan), las coords `tx,ty` de la matriz son correctas para el canvas **lógico** pero Fabric al hacer `canvas.add(led)` con `left/top` absolutos, puede interpretarlos en el espacio del viewport.

**Fix requerido:**
```javascript
// En crearLed(), convertir de canvas-space a fabric-object-space
crearLed(x, y, angle, parentId) {
    // Opción A: usar transformPoint inverso del viewport
    const vpt = canvas.viewportTransform;
    // vpt = [zoom, 0, 0, zoom, panX, panY]
    // Para convertir canvas-coords → fabric-coords:
    const pt = fabric.util.transformPoint(
        { x, y },
        fabric.util.invertTransform(vpt)  // ← ESTE es el fix
    );
    
    const led = new fabric.Rect({
        left: pt.x,
        top:  pt.y,
        // ...
    });
    canvas.add(led);
}
```

**Alternativa B:** Que el backend devuelva las posiciones ya en el espacio local de Fabric (no aplicando transform al resultado sino al input), o que JS aplique `canvas.restorePointerVpt(point)`.

### BUG 2 — Neon Flex dibuja fuera del contorno

**Causa raíz:** `fabricObj.clone()` clona el objeto con sus propiedades actuales, pero cuando el objeto está dentro de un grupo o tiene transformaciones compuestas, `left/top` del clon no corresponden a la posición visual en el canvas.

**Fix requerido:**
```javascript
calcularNeon(fabricObj) {
    // En vez de clone(), calcular posición absoluta manualmente
    const mtx = fabricObj.calcTransformMatrix();
    // mtx = [scaleX, skewY, skewX, scaleY, translateX, translateY]
    
    // Extraer posición absoluta
    const decomposed = fabric.util.qrDecompose(mtx);
    
    // Obtener path string en coords LOCALES del objeto
    let pathStr = '';
    if (fabricObj.type === 'path' && fabricObj.path) {
        pathStr = fabric.util.joinPath(fabricObj.path);
    }
    
    // Crear path nuevo con transform explícita
    const neonPath = new fabric.Path(pathStr, {
        // Aplicar la misma transform del objeto padre
        left:    decomposed.translateX,
        top:     decomposed.translateY,
        scaleX:  decomposed.scaleX,
        scaleY:  decomposed.scaleY,
        angle:   decomposed.angle,
        skewX:   decomposed.skewX,
        skewY:   decomposed.skewY,
        originX: 'center',
        originY: 'center',
        stroke: neonColor,
        fill: 'transparent',
        // ...
    });
    canvas.add(neonPath);
}
```

---

## FEATURE — INTEGRACIÓN GEMINI AI

### Objetivo
Agregar un botón "✨ Analizar con IA" que use Gemini Vision para:
1. Analizar la imagen del canvas actual
2. Sugerir qué tipo de iluminación LED usar (módulos, neon flex, tira LED)
3. Estimar metros lineales de neon visualmente
4. Detectar si el SVG tiene rutas decorativas que no deberían recibir LEDs

### API a usar
```javascript
// Gemini 2.0 Flash (Vision)
const GEMINI_API_KEY = '...'; // ya disponible en el proyecto
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
```

### Implementación sugerida

```javascript
async analizarConIA() {
    // 1. Capturar screenshot del canvas como base64
    const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.85 });
    const base64  = dataUrl.split(',')[1];
    
    // 2. Construir prompt contextual
    const letters = canvas.getObjects().filter(o => o.customType === 'letter');
    const bb = this._bbox(letters);
    const altoEstimado = (bb.height / scalePxPerCm).toFixed(1);
    const anchoEstimado = (bb.width / scalePxPerCm).toFixed(1);
    
    const prompt = `
Sos un especialista en instalaciones de letreros LED luminosos.
Analizá esta imagen de un diseño para letrero.

Dimensiones aproximadas del diseño: ${anchoEstimado} cm × ${altoEstimado} cm

Respondé SOLO en JSON válido con este formato exacto:
{
  "tipo_recomendado": "modulos_led" | "neon_flex" | "tira_led",
  "justificacion": "texto breve",
  "metros_neon_estimados": número o null,
  "modulos_estimados": número o null,
  "rutas_decorativas_detectadas": true | false,
  "advertencias": ["lista de advertencias si hay"]
}
    `.trim();
    
    // 3. Llamar Gemini
    const body = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/jpeg', data: base64 } }
            ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    };
    
    const res  = await fetch(GEMINI_URL, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // 4. Parsear y mostrar resultado
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
    this._mostrarResultadoIA(json);
},

_mostrarResultadoIA(result) {
    // Auto-seleccionar preset según recomendación
    if (result.tipo_recomendado === 'neon_flex') {
        document.getElementById('c-preset').value = 'Neon Flex Mini (6x12)';
        this.loadPreset('Neon Flex Mini (6x12)');
    }
    
    // Mostrar panel con resultado
    const panel = document.getElementById('stats-panel');
    if (panel) panel.innerHTML = `
        <div style="background:#1e293b;padding:15px;border-radius:8px;border-left:5px solid #a78bfa">
            <h3 style="color:#c4b5fd;margin-top:0">✨ Análisis IA</h3>
            <p><b>Recomendación:</b> ${result.tipo_recomendado.replace(/_/g,' ')}</p>
            <p style="color:#94a3b8;font-size:.85em">${result.justificacion}</p>
            ${result.metros_neon_estimados ? `<p><b>Neon estimado:</b> ${result.metros_neon_estimados} m</p>` : ''}
            ${result.modulos_estimados ? `<p><b>Módulos estimados:</b> ${result.modulos_estimados}</p>` : ''}
            ${result.advertencias?.length ? `<p style="color:#fbbf24">⚠️ ${result.advertencias.join(', ')}</p>` : ''}
        </div>`;
}
```

### Botón en la UI
Agregar en `buildConfigPanel()` antes del botón "Generar Instalación":
```html
<button id="btn-ia" class="btn" style="width:100%;margin-bottom:6px;background:linear-gradient(135deg,#7c3aed,#a21caf)" onclick="lw.analizarConIA()">
    <i class="fas fa-magic"></i> ✨ Analizar con IA
</button>
```

---

## CHECKLIST PARA EL AI QUE RESUELVA ESTO

- [ ] Fix `crearLed`: aplicar `fabric.util.invertTransform(canvas.viewportTransform)` a las coords x,y antes de crear el Rect
- [ ] Fix `calcularNeon`: usar `fabric.util.qrDecompose(calcTransformMatrix())` para posición absoluta en vez de `clone()`
- [ ] Agregar `analizarConIA()` con Gemini Vision API
- [ ] Agregar botón "✨ Analizar con IA" en `buildConfigPanel()`
- [ ] La API Key de Gemini debe leerse de `window.GEMINI_API_KEY` o una variable de entorno expuesta

---

## ARCHIVOS DEL PROYECTO

- `led-wizard-main.js` — Frontend completo (Fabric.js + lógica UI)
- `main.py` — Backend FastAPI (cálculos de grids con Shapely/NumPy)
- `led-wizard.html` — HTML shell (solo estructura básica)

## NOTAS IMPORTANTES

1. Fabric.js versión usada: compatible con `fabric.util.qrDecompose`, `fabric.util.invertTransform`, `fabric.util.transformPoint`
2. El canvas usa `preserveObjectStacking: true` — el orden de z-index importa
3. `scalePxPerCm` es la variable global que contiene la escala actual
4. Los objetos importados tienen `customType: 'letter'` — los LEDs tienen `customType: 'led-module'` — los neon paths tienen `customType: 'neon-path'`
5. El backend en `http://localhost:8000` — la API key de Gemini ya existe en el proyecto del vectorizador

