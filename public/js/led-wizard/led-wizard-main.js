// public/js/led-wizard/led-wizard-main.js  — v2.2
// ─────────────────────────────────────────────────────────────────────────
//  FIX CRÍTICO v2.2:
//
//  Antes:  scalePxPerCm = viewBoxWidth / cmReales
//          → escala 1025 px/cm → módulos de 3280px → no entran en ninguna letra
//
//  Ahora:  scalePxPerCm se calcula DESPUÉS de que Fabric carga el SVG:
//          scalePxPerCm = group.getBoundingRect().width / cmReales
//          → escala real de los píxeles en el canvas → módulos del tamaño correcto
//
//  CorelDRAW exporta con width="360mm", Fabric renderiza eso como ~800px.
//  360mm = 36cm → scalePxPerCm = 800/36 = 22 px/cm ✅
// ─────────────────────────────────────────────────────────────────────────
(function () {
    'use strict';

    if (!localStorage.getItem('mr_token')) {
        window.location.href = 'login.html';
        return;
    }

    // ═══════════════════════════════════════════════════════════
    //  CATÁLOGO DE MÓDULOS (Actualizado 2026 - Datos Técnicos)
    // ═══════════════════════════════════════════════════════════
    const CATALOG = {
        'SMD-2835 Estándar': {
            modW: 6.6, modH: 1.2, stepX: 8.5, stepY: 6.0, margin: 1.2,
            watt: 0.72, voltage: 12, color: '#FDE68A', stroke: '#B45309',
            label: 'Módulo inyección estándar 12V — Publicidad general',
            image: 'images/led_module_smd2835.png',
        },
        'Lupa 6012 Alta Potencia': {
            modW: 6.1, modH: 1.2, stepX: 12.1, stepY: 10.0, margin: 1.5,
            watt: 1.20, voltage: 12, color: '#FDE68A', stroke: '#EA580C',
            label: 'Módulo LED Lupa 6012 Alta Potencia 12V — Lubox',
            image: 'images/led_module_lupa_6012.png',
        },
        'SMD-2835 Mini': {
            modW: 1.2, modH: 1.2, stepX: 2.5, stepY: 2.0, margin: 0.5,
            watt: 0.48, voltage: 12, color: '#FEF9C3', stroke: '#92400E',
            label: 'Mini módulo 12V — Letras corpóreas pequeñas',
            image: 'images/led_module_smd2835.png',
        },
        'SMD-5050 High Power': {
            modW: 7.5, modH: 1.5, stepX: 10.0, stepY: 8.0, margin: 1.5,
            watt: 1.20, voltage: 12, color: '#E0F2FE', stroke: '#0369A1',
            label: 'Alta potencia 12V — Cajas de luz grandes',
            image: 'images/led_module_smd2835.png',
        },
        'COB Alta Densidad': {
            modW: 7.0, modH: 2.0, stepX: 12.0, stepY: 10.0, margin: 2.0,
            watt: 1.50, voltage: 24, color: '#A7F3D0', stroke: '#065F46',
            label: 'Tecnología COB 24V — Luz uniforme sin puntos',
            image: 'images/led_module_smd2835.png',
        },
        'GOB IP68 (Sumergible)': {
            modW: 7.2, modH: 1.8, stepX: 9.0, stepY: 7.0, margin: 1.5,
            watt: 1.20, voltage: 12, color: '#BFDBFE', stroke: '#1E40AF',
            label: 'Protección GOB — Uso en exteriores extremos o agua',
            image: 'images/led_module_smd2835.png',
        },
        'Neon Flex Mini (6x12)': {
            modW: 0.6, modH: 1.2, stepX: 1.0, stepY: 1.0, margin: 0.3,
            watt_m: 10.0, // ✅ CONSUMO POR METRO LINEAL
            voltage: 12, color: '#F472B6', stroke: '#DB2777',
            label: 'Neon Flex 10W/m — Contornos luminosos',
        },
        'Tira LED 5050 (Candela)': {
            modW: 1.0, modH: 0.2, stepX: 1.67, stepY: 8.0, margin: 0.1,
            watt_m: 4.8, // ✅ 24W en 5 metros = 4.8W/metro
            watt: 0.08, // ✅ 4.8W por metro / 60 leds por metro = 0.08W/led
            voltage: 12, color: '#FEF08A', stroke: '#CA8A04',
            label: 'Tira LED SMD 5050 Candela 12V — 4.8W/m IP65',
            image: 'images/led_strip_5050.png',
        }
    };
    const SUPPLY_W = [30, 60, 100, 150, 200, 350];
    const DERATING = 0.8;

    let scalePxPerCm = 10;
    let cfg = {};
    let isBulk = false;
    let undoStack = [];
    let redoStack = [];
    let loadingState = false;
    let drawMode = null;
    let drawStart = null;

    const canvas = new fabric.Canvas('led-canvas', {
        backgroundColor: '#f3f4f6',
        selection: true,
        preserveObjectStacking: true,
        renderOnAddRemove: false,
    });

    // ═══════════════════════════════════════════════════════════
    //  PRE-PROCESAR SVG — Fix fill:none de CorelDRAW
    // ═══════════════════════════════════════════════════════════
    function _prepareSVG(svgText) {
        // FIX: CorelDRAW exporta <!DOCTYPE ... "http://...dtd">
        // El browser intenta DESCARGAR esa URL → spinner infinito.
        // Tambien limpiamos namespaces innecesarios de CorelDRAW.
        svgText = svgText
            .replace(/<!DOCTYPE[^\[>]*(?:\[[^\]]*\])?\s*>/gi, '')
            .replace(/xml:space="preserve"/g, '')
            .replace(/xmlns:xodm="[^"]*"/g, '');

        const parser = new DOMParser();
        let doc;
        try {
            doc = parser.parseFromString(svgText, 'image/svg+xml');
            if (doc.querySelector('parseerror,parsererror')) return svgText;
        } catch (_) { return svgText; }

        doc.querySelectorAll('*').forEach(el => {
            if (el.getAttribute('fill') === 'none') el.setAttribute('fill', 'black');
            const s = el.getAttribute('style') || '';
            if (/fill\s*:\s*none/i.test(s))
                el.setAttribute('style', s.replace(/fill\s*:\s*none/gi, 'fill:black'));
        });
        doc.querySelectorAll('path, rect, ellipse, circle, polygon').forEach(el => {
            if (!el.getAttribute('fill')) el.setAttribute('fill', 'black');
            el.setAttribute('fill-rule', 'evenodd'); // forzar siempre (CorelDRAW usa nonzero)
            el.removeAttribute('stroke');
            el.removeAttribute('stroke-width');
            const s = el.getAttribute('style') || '';
            if (s) el.setAttribute('style',
                s.replace(/stroke\s*:[^;]+;?/gi, '').replace(/stroke-width\s*:[^;]+;?/gi, ''));
        });
        return new XMLSerializer().serializeToString(doc);
    }

    // ═══════════════════════════════════════════════════════════
    //  OBJETO PRINCIPAL
    // ═══════════════════════════════════════════════════════════
    const lw = {

        init() {
            window.lw = this;
            window.ledWizard = this;
            window.calculadoraLed = this;
            window.canvas = canvas;

            // Precargar imagen para emulación realista de módulos
            this.ledImage = new Image();
            this.ledImage.src = 'images/led_module_smd2835.png';
            this.ledImage.onload = () => {
                console.log('✅ Imagen de emulador LED realista cargada correctamente.');
                // Forzar redibujado de la instalación si ya hay leds
                if (canvas.getObjects().some(o => o.customType === 'led-module')) {
                    canvas.renderAll();
                }
            };

            this.resizeCanvas();
            this.setupGrid();
            this.buildConfigPanel();
            this.buildDrawingPanel();
            this.updateLayersPanel();
            this.hookToolbar();
            this.hookCanvasEvents();
            this.hookKeyboard();
            this.loadPreset(Object.keys(CATALOG)[0]);
            this.saveState();
            this._checkBackend();
            console.log('✅ LED Wizard v4.0 — Todo el cálculo en Python backend');
        },

        async _checkBackend() {
            try {
                const backendHost = window.location.hostname || 'localhost';
                const r = await fetch(`http://${backendHost}:8000/health`, { signal: AbortSignal.timeout(3000) });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const { version } = await r.json();
                console.log(`✅ Backend OK v${version}`);
            } catch (_) {
                this._showBackendError(
                    'El servidor Python no está activo.<br>Ejecutá: <code>uvicorn main:app --reload</code>'
                );
            }
        },

        resizeCanvas() {
            const wrap = document.querySelector('.canvas-holder');
            if (!wrap) return;
            const fit = () => {
                canvas.setWidth(wrap.clientWidth);
                canvas.setHeight(wrap.clientHeight);
                canvas.renderAll();
            };
            fit();
            window.addEventListener('resize', fit);
        },

        setupGrid() {
            const wrap = document.querySelector('.canvas-holder');
            if (wrap) {
                wrap.style.backgroundImage =
                    'linear-gradient(rgba(203, 213, 225, 0.5) 1px,transparent 1px),' +
                    'linear-gradient(90deg,rgba(203, 213, 225, 0.5) 1px,transparent 1px)';
                wrap.style.backgroundSize = '20px 20px';
            }
        },

        // ─── Panel derecho ───────────────────────────────────
        buildConfigPanel() {
            const p = document.getElementById('config-panel');
            if (!p) return;
            const opts = Object.keys(CATALOG).map(k =>
                `<option value="${k}">${k}</option>`).join('');

            p.innerHTML = `
            <div class="form-group">
                <label class="form-label">Módulo LED</label>
                <select id="c-preset" class="form-select">${opts}</select>
                <small id="c-label" style="color:#4f46e5;font-size:.77em;display:block;margin-top:3px"></small>
            </div>
            <div id="c-mode-section" class="form-group">
                <label class="form-label">Modo de distribución</label>
                <select id="c-mode" class="form-select" onchange="lw._onModeChange(this.value)">
                    <option value="centerline">⭐ Eje central (Corpóreas)</option>
                    <option value="fill">Relleno (Grid)</option>
                    <option value="contour">Contorno (Trayectoria)</option>
                </select>
                <small id="c-mode-label" style="color:#4f46e5;font-size:.75em;display:block;margin-top:3px">
                    Módulos centrados en el trazo, rotados automáticamente con la curva.
                </small>
            </div>
            <div id="c-rotation-section" class="form-group">
                <label class="form-label">Rotación de módulos</label>
                <select id="c-rotation" class="form-select">
                    <option value="none">Horizontal (0°)</option>
                    <option value="stroke">Seguir trazo del diseño ✦</option>
                </select>
                <small style="color:#4f46e5;font-size:.75em;display:block;margin-top:3px">
                    "Seguir trazo" rota cada módulo según la dirección local del trazo de la letra.
                </small>
            </div>
            <div id="c-dims-section" class="config-box">
                <div class="config-box-title">DIMENSIONES DEL MÓDULO (cm)</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                    <div>
                        <label class="form-label" style="font-size:.73em">Largo</label>
                        <input id="c-modw"   type="number" class="form-input" step="0.1" min="0.5">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:.73em">Alto</label>
                        <input id="c-modh"   type="number" class="form-input" step="0.1" min="0.2">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:.73em">Paso ↔ (c/c)</label>
                        <input id="c-stepx"  type="number" class="form-input" step="0.1" min="0.5">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:.73em">Sep. filas ↕ (c/c)</label>
                        <input id="c-stepy"  type="number" class="form-input" step="0.1" min="0.5">
                    </div>
                    <div style="grid-column:1/-1">
                        <label class="form-label" style="font-size:.73em">Margen al borde (cm)</label>
                        <input id="c-margin" type="number" class="form-input" step="0.1" min="0">
                    </div>
                </div>
            </div>
            <div id="c-watt-section" class="form-group">
                <label class="form-label">Watts / módulo</label>
                <input id="c-watt" type="number" class="form-input" step="0.01" min="0.01">
            </div>
            <div id="c-supply-section" class="form-group">
                <label class="form-label">Fuente (W)</label>
                <div style="display:flex;gap:6px">
                    <select id="c-supply" class="form-select" style="flex:1">
                        ${SUPPLY_W.map(w => `<option value="${w}"${w === 100 ? ' selected' : ''}>${w}W</option>`).join('')}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="lw.agregarFuenteCanvasInteractive()" style="padding:6px 12px;white-space:nowrap" title="Colocar fuente en canvas">
                        <i class="fas fa-plus"></i> Colocar
                    </button>
                </div>
            </div>
            <div id="c-neon-info" style="display:none;background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:12px;margin-bottom:10px">
                <div style="font-size:.78em;color:#be185d;font-weight:700;margin-bottom:6px">🌟 MODO NEON FLEX</div>
                <p style="font-size:.75em;color:#db2777;margin:0">El neon se dibuja sobre el contorno de cada forma.</p>
                <p style="font-size:.75em;color:#4b5563;margin:4px 0 0">Metros y consumo se calculan automáticamente.</p>
                <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
                    <label class="form-label" style="font-size:.75em;color:#be185d;margin:0">Color:</label>
                    <input id="c-neon-color" type="color" style="border:none;width:40px;height:24px;cursor:pointer;background:none;padding:0" value="#F472B6">
                    <button class="btn btn-secondary btn-sm" style="margin-left:auto;padding:2px 8px;font-size:0.75em;background:#fff;border:1px solid #fbcfe8;color:#be185d" onclick="lw.animateNeon()">
                        <i class="fas fa-play"></i> Animar
                    </button>
                </div>
            </div>
            <div class="config-box">
                <div class="config-box-title">ESCALA</div>
                <label class="form-label" style="font-size:.73em">Alto real del diseño (cm)</label>
                <div style="display:flex;gap:6px">
                    <input id="c-realh" type="number" class="form-input" placeholder="Ej: 45" min="1" style="flex:1">
                    <button class="btn btn-secondary" style="padding:6px 10px" onclick="lw.applyScale()">✓</button>
                </div>
                <small style="color:#64748b;font-size:.68em">Escala: <span id="c-scale-val">${scalePxPerCm.toFixed(2)}</span> px/cm</small>
            </div>
            <div class="config-box" style="margin-top:10px">
                <div class="config-box-title">ESPECTRO DE COBERTURA</div>
                <label class="form-check-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.83rem;margin-top:4px">
                    <input id="c-show-auras" type="checkbox" checked style="width:16px;height:16px;cursor:pointer">
                    <span>Mostrar espectro de luz</span>
                </label>
            </div>
            <div style="display:flex;gap:5px;margin-bottom:6px">
                <button class="btn btn-secondary" style="flex:1" onclick="lw.undo()" title="Ctrl+Z"><i class="fas fa-undo"></i></button>
                <button class="btn btn-secondary" style="flex:1" onclick="lw.redo()" title="Ctrl+Y"><i class="fas fa-redo"></i></button>
                <button class="btn btn-secondary" style="flex:1" onclick="lw.fitScreen()" title="F"><i class="fas fa-compress-alt"></i></button>
            </div>
            <button id="btn-ia" class="btn" style="width:100%;margin-bottom:6px;background:linear-gradient(135deg,#7c3aed,#a21caf);color:#fff;border:none" onclick="lw.analizarConIA()">
                <i class="fas fa-magic"></i> ✨ Analizar con IA
            </button>
            <button id="btn-populate-all" class="btn btn-primary" style="width:100%;margin-bottom:6px" onclick="lw.generarInstalacion(true)">
                <i class="fas fa-bolt"></i> ⚡ Poblar TODO el diseño
            </button>
            <button id="btn-populate-sel" class="btn btn-secondary" style="width:100%;margin-bottom:6px;display:none" onclick="lw.generarInstalacion(false)">
                <i class="fas fa-magic"></i> Poblar seleccionado
            </button>`;

            document.getElementById('c-preset').addEventListener('change', e => this.loadPreset(e.target.value));
            ['c-modw', 'c-modh', 'c-stepx', 'c-stepy', 'c-margin', 'c-watt', 'c-supply', 'c-mode', 'c-rotation']
                .forEach(id => document.getElementById(id)?.addEventListener('change', () => this.readConfig()));
            document.getElementById('c-neon-color')?.addEventListener('input', e => this.updateNeonColor(e.target.value));
            document.getElementById('c-show-auras')?.addEventListener('change', e => {
                const visible = e.target.checked;
                canvas.getObjects().filter(o => o.customType === 'led-aura').forEach(o => {
                    o.set({ visible });
                });
                canvas.renderAll();
            });
            // Aplicar visibilidad inicial según preset por defecto
            setTimeout(() => this._applyNeonPanelVisibility(document.getElementById('c-preset')?.value || ''), 0);
        },

        loadPreset(name) {
            const m = CATALOG[name] || CATALOG['SMD-2835 Estándar'];
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            set('c-preset', name);
            set('c-modw', m.modW);
            set('c-modh', m.modH);
            set('c-stepx', m.stepX);
            set('c-stepy', m.stepY);
            set('c-margin', m.margin);
            set('c-watt', m.watt);
            const lbl = document.getElementById('c-label');
            if (lbl) lbl.textContent = m.label;

            const cp = document.getElementById('c-neon-color');
            if (cp && m.color) cp.value = m.color;

            set('c-watt', m.watt || 0);
            // Solo cambiar el modo si el preset lo implica (neon → contour)
            // Si ya está en 'centerline', respetar la selección del usuario
            const currentMode = document.getElementById('c-mode')?.value;
            if (name.match(/Neon|Tira|Strip/i)) {
                set('c-mode', 'contour');
            } else if (!currentMode || currentMode === 'contour') {
                // Si venía de neon o no está definido, default a centerline
                set('c-mode', 'centerline');
            }
            // Si ya es 'fill' o 'centerline', no tocar
            this._applyNeonPanelVisibility(name);

            // Cargar imagen específica del emulador del preset
            if (this.ledImage) {
                this.ledImage.src = m.image || 'images/led_module_smd2835.png';
            }

            this.readConfig();
        },

        _onModeChange(mode) {
            const labels = {
                centerline: 'Módulos centrados en el trazo, rotados con la curva. ✅ Ideal para corpóreas.',
                fill: 'Relleno en cuadrícula dentro del área de la letra.',
                contour: 'Módulos siguiendo el perímetro exterior de la forma.',
            };
            const el = document.getElementById('c-mode-label');
            if (el) el.textContent = labels[mode] || '';
            const rotSec = document.getElementById('c-rotation-section');
            if (rotSec) rotSec.style.display = mode === 'centerline' ? 'none' : 'block';
            this.readConfig();
        },

        _applyNeonPanelVisibility(presetName) {
            const isNeon = /neon/i.test(presetName || '');
            ['c-mode-section', 'c-rotation-section', 'c-dims-section', 'c-watt-section', 'c-supply-section']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = isNeon ? 'none' : 'block';
                });
            const ni = document.getElementById('c-neon-info');
            if (ni) ni.style.display = isNeon ? 'block' : 'none';
            const btn = document.getElementById('btn-populate-sel');
            if (btn) btn.innerHTML = isNeon
                ? '<i class="fas fa-star"></i> Aplicar Neon Flex'
                : '<i class="fas fa-bolt"></i> Generar Instalación';
        },

        updateNeonColor(color) {
            cfg.color = color;
            cfg.stroke = color;
            const neonPaths = canvas.getObjects().filter(o => o.customType === 'neon-path');
            neonPaths.forEach(obj => {
                if (!obj.isNeonInner) {
                    obj.set({ stroke: color });
                    if (obj.shadow) obj.shadow.color = color;
                }
            });
            canvas.renderAll();
        },

        animateNeon() {
            const neonPaths = canvas.getObjects().filter(o => o.customType === 'neon-path');
            if (!neonPaths.length) return;

            // Preparar animación: configurar dash array igual al largo del path
            neonPaths.forEach(obj => {
                const len = this._pathML(obj).px; // Necesitamos largo en px
                obj.set({
                    strokeDashArray: [len, len],
                    strokeDashOffset: len, // Empieza invisible
                    opacity: 1
                });
            });
            canvas.renderAll();

            const duration = 1500; // 1.5 segundos
            let start = null;

            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3); // Ease Out Cubic

                neonPaths.forEach(obj => {
                    const len = obj.strokeDashArray[0];
                    obj.set('strokeDashOffset', len * (1 - ease));
                });
                canvas.renderAll();

                if (progress < 1) requestAnimationFrame(step);
                else neonPaths.forEach(o => o.set({ strokeDashArray: null })); // Finalizar sólido
            };
            requestAnimationFrame(step);
        },

        readConfig() {
            const g = id => parseFloat(document.getElementById(id)?.value) || 0;
            const preset = document.getElementById('c-preset')?.value || '';
            const m = CATALOG[preset] || CATALOG['SMD-2835 Estándar'];
            cfg = {
                preset,
                voltage: m.voltage,
                mode: document.getElementById('c-mode')?.value || 'fill',
                rotationMode: document.getElementById('c-rotation')?.value || 'none',
                modW: g('c-modw') || m.modW,
                modH: g('c-modh') || m.modH,
                watt_m: m.watt_m, // ✅ Leer consumo por metro
                stepX: g('c-stepx') || (m.modW + 5.0), // ✅ StepX = ModW + 5.0 (borde a borde)
                stepY: g('c-stepy') || m.stepY,
                margin: g('c-margin') || m.margin,
                watt: g('c-watt') || m.watt,
                supplyW: parseInt(document.getElementById('c-supply')?.value) || 100,
                color: m.color,
                stroke: m.stroke,
            };
        },

        applyScale() {
            const h = parseFloat(document.getElementById('c-realh')?.value);
            if (!h || h <= 0) { alert('Ingresá un alto válido en cm'); return; }
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            if (!letters.length) { alert('Importá un SVG primero.'); return; }
            const bbox = this._bbox(letters);
            if (bbox.height > 0) {
                scalePxPerCm = bbox.height / h;
                const el = document.getElementById('c-scale-val');
                if (el) el.textContent = scalePxPerCm.toFixed(2);
                this.recalcAll();
            }
        },

        // ─── Panel izquierdo ─────────────────────────────────
        buildDrawingPanel() {
            const p = document.getElementById('drawing-tools');
            if (!p) return;
            const tools = [
                { key: 'select', icon: 'fa-mouse-pointer', label: 'Seleccionar (V)', fn: () => this.setTool('select') },
                { key: 'edit-leds', icon: 'fa-lightbulb', label: 'Editar LEDs (L)', fn: () => this.setTool('edit-leds') },
                { key: 'pencil', icon: 'fa-pencil-alt', label: 'Dibujar libre', fn: () => this.setTool('pencil') },
                { key: 'rect', icon: 'fa-square', label: 'Rectángulo (R)', fn: () => this.setTool('rect') },
                { key: 'ellipse', icon: 'fa-circle', label: 'Elipse (E)', fn: () => this.setTool('ellipse') },
                { key: 'text', icon: 'fa-font', label: 'Texto (T)', fn: () => this.setTool('text') },
                { key: 'delete', icon: 'fa-trash', label: 'Eliminar (Del)', fn: () => this.deleteSelected() },
            ];
            p.innerHTML = '';
            tools.forEach(t => {
                const btn = document.createElement('button');
                btn.id = 'tool-' + t.key;
                btn.className = 'btn btn-secondary btn-sm';
                btn.title = t.label;
                btn.innerHTML = `<i class="fas ${t.icon}"></i>`;
                btn.style.cssText = 'min-width:36px;padding:7px 9px;margin:2px';
                btn.onclick = () => {
                    if (t.key !== 'delete') {
                        this._activateTool(t.key);
                    }
                    t.fn();
                };
                p.appendChild(btn);
            });
            this._activateTool('select');
        },

        _activateTool(key) {
            document.querySelectorAll('[id^="tool-"]').forEach(b => { b.style.borderColor = ''; b.classList.remove('active'); });
            const btn = document.getElementById('tool-' + key);
            if (btn) { btn.style.borderColor = '#6366f1'; btn.classList.add('active'); }
        },

        setTool(tool) {
            this.currentTool = tool;
            drawMode = null; drawStart = null;
            canvas.isDrawingMode = false;
            canvas.selection = true;
            canvas.defaultCursor = 'default';

            const modules = canvas.getObjects().filter(o => o.customType === 'led-module');
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');

            if (tool === 'edit-leds') {
                modules.forEach(m => {
                    m.set({
                        selectable: true,
                        evented: true,
                        hasControls: true,
                        hasBorders: true,
                        borderColor: '#3b82f6',
                        cornerColor: '#2563eb',
                        cornerSize: 6,
                    });
                });
                letters.forEach(l => l.set({ selectable: false }));
                canvas.defaultCursor = 'pointer';
            } else {
                modules.forEach(m => {
                    m.set({
                        selectable: false,
                        evented: false,
                        hasControls: false,
                        hasBorders: false,
                    });
                });
                letters.forEach(l => l.set({ selectable: true }));

                if (tool === 'pencil') {
                    canvas.isDrawingMode = true;
                    const b = new fabric.PencilBrush(canvas);
                    b.width = 2; b.color = 'rgba(255,255,255,0.2)';
                    canvas.freeDrawingBrush = b;
                } else if (tool === 'rect' || tool === 'ellipse') {
                    drawMode = tool;
                    canvas.selection = false;
                    canvas.defaultCursor = 'crosshair';
                } else if (tool === 'text') {
                    const t = new fabric.IText('Texto', {
                        left: 100, top: 100, fill: '#fff', fontSize: 20,
                        customType: 'letter', id: 'txt_' + Date.now(),
                    });
                    canvas.add(t); canvas.setActiveObject(t); t.enterEditing(); canvas.renderAll();
                }
            }
            canvas.discardActiveObject();
            canvas.renderAll();
        },

        deleteSelected() {
            const sel = canvas.getActiveObjects();
            if (!sel.length) return;
            sel.forEach(obj => {
                if (obj.customType === 'letter') {
                    canvas.getObjects()
                        .filter(o => o.customType === 'led-module' && o.parentId === obj.id)
                        .forEach(m => canvas.remove(m));
                }
                canvas.remove(obj);
            });
            canvas.discardActiveObject(); canvas.renderAll(); this.saveState();
        },

        hookToolbar() {
            const impBtn = document.getElementById('btn-import');
            const impMenu = document.getElementById('import-menu');
            if (impBtn && impMenu) {
                impBtn.addEventListener('click', e => { e.stopPropagation(); impMenu.classList.toggle('show'); });
                document.addEventListener('click', () => impMenu.classList.remove('show'));
                document.getElementById('import-from-upload')?.addEventListener('click', e => { e.preventDefault(); this.importFile(); });
                document.getElementById('import-from-vectorizer')?.addEventListener('click', e => { e.preventDefault(); this.importVectorizer(); });
            }
            document.getElementById('btn-scale')?.addEventListener('click', () => this.showScaleModal());
            document.getElementById('btn-library')?.addEventListener('click', () => this.showLibrary());
            document.getElementById('btn-export')?.addEventListener('click', () => this.showExportMenu());
            const tg = document.querySelector('.toolbar .tool-group');
            if (tg) {
                const fb = document.createElement('button');
                fb.innerHTML = '<i class="fas fa-compress-alt"></i> Ajustar';
                fb.title = 'F'; fb.onclick = () => this.fitScreen();
                tg.appendChild(fb);
            }

            // Logout Logic
            document.body.addEventListener('click', e => {
                if (e.target.closest('#btn-logout, .btn-logout-sidebar')) {
                    e.preventDefault();
                    if (confirm('¿Cerrar sesión de forma segura?')) {
                        localStorage.removeItem('mr_token');
                        window.location.href = 'login.html';
                    }
                }
            });
        },

        // ═══════════════════════════════════════════════════════
        //  IMPORTAR SVG
        // ═══════════════════════════════════════════════════════
        importFile() {
            const inp = document.getElementById('svg-upload');
            inp.value = '';
            inp.onchange = e => {
                const f = e.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = ev => this._loadSVG(ev.target.result);
                r.readAsText(f);
            };
            inp.click();
        },

        importVectorizer() {
            try {
                const list = JSON.parse(localStorage.getItem('vectorizer_last_svgs') || '[]');
                if (!list.length) { alert('Sin SVGs recientes del vectorizador.'); return; }
                fetch(list[0].url).then(r => r.text()).then(s => this._loadSVG(s));
            } catch { alert('Error accediendo al vectorizador.'); }
        },

        // ─────────────────────────────────────────────────────
        //  _loadSVG — FLUJO COMPLETO
        // ─────────────────────────────────────────────────────
        _loadSVG(rawSvgText) {
            const fixedSvg = _prepareSVG(rawSvgText);

            // Paso 1: leer las dimensiones reales del SVG (sin modificar scalePxPerCm)
            const realDims = this._readSVGDimensions(rawSvgText);

            fabric.loadSVGFromString(fixedSvg, (objects, options) => {
                if (!objects?.length) {
                    alert('SVG sin objetos válidos.\nCorelDRAW: Archivo → Exportar → SVG plano.');
                    return;
                }

                const group = fabric.util.groupSVGElements(objects, options);
                group.set({ left: 60, top: 60 });
                this._stripStroke(group);
                canvas.add(group);

                // ✅ PASO 2: calcular escala con los PÍXELES REALES del canvas
                const svgDims = { detected: false, widthCm: 0, heightCm: 0 };
                if (realDims.widthCm > 0) {
                    const bb = group.getBoundingRect(true, true);
                    scalePxPerCm = bb.width / realDims.widthCm;
                    svgDims.detected = true;
                    svgDims.widthCm = realDims.widthCm;
                    svgDims.heightCm = realDims.heightCm > 0
                        ? realDims.heightCm
                        : parseFloat((bb.height / scalePxPerCm).toFixed(1));
                    const scEl = document.getElementById('c-scale-val');
                    if (scEl) scEl.textContent = scalePxPerCm.toFixed(2);
                }

                // Aplanar el grupo de SVG recursivamente
                const flatItems = this.flattenGroup(group);

                // Marcar cada objeto aplanado como letra
                flatItems.forEach(obj => {
                    obj.set({
                        customType: 'letter',
                        stroke: 'rgba(99,102,241,0.4)',
                        strokeWidth: 1,
                        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    });
                    obj.setCoords();
                });

                canvas.renderAll();
                this.updateLayersPanel();
                this.fitScreen();
                this._importModal(flatItems, svgDims);
            });
        },

        flattenGroup(group) {
            if (group.type !== 'group') return [group];

            canvas.setActiveObject(group);
            group.toActiveSelection();
            const activeSel = canvas.getActiveObject();
            if (!activeSel) return [];

            const objects = activeSel.getObjects().slice();
            canvas.discardActiveObject();

            const flatObjects = [];
            objects.forEach(obj => {
                if (obj.type === 'group') {
                    flatObjects.push(...this.flattenGroup(obj));
                } else {
                    flatObjects.push(obj);
                }
            });
            return flatObjects;
        },

        // Lee dimensiones reales del SVG sin tocar ninguna variable global
        _readSVGDimensions(svgText) {
            try {
                const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
                const root = doc.documentElement;
                const parseUnit = (str) => {
                    const m = (str || '').trim().match(/^([\d.]+)\s*(mm|cm|px|pt|in)?$/i);
                    if (!m) return 0;
                    const toCm = { mm: 0.1, cm: 1, px: 2.54 / 96, pt: 2.54 / 72, in: 2.54 };
                    return parseFloat(m[1]) * (toCm[(m[2] || 'px').toLowerCase()] || 1);
                };
                return {
                    widthCm: parseUnit(root.getAttribute('width') || ''),
                    heightCm: parseUnit(root.getAttribute('height') || ''),
                };
            } catch (_) { return { widthCm: 0, heightCm: 0 }; }
        },

        _stripStroke(obj) {
            if (obj.set) obj.set({ stroke: 'rgba(99,102,241,0.4)', strokeWidth: 1 });
            const ch = obj._objects || (obj.getObjects ? obj.getObjects() : []);
            ch.forEach(c => this._stripStroke(c));
        },

        // ─────────────────────────────────────────────────────
        //  MODAL DE IMPORTACIÓN
        // ─────────────────────────────────────────────────────
        _importModal(flatItems, svgDims) {
            document.getElementById('imp-modal')?.remove();
            const opts = Object.keys(CATALOG).map(k =>
                `<option value="${k}">${k}</option>`).join('');

            const autoDetected = svgDims && svgDims.detected;

            const dimInfo = autoDetected
                ? `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px;margin-bottom:12px">
                       <div style="color:#15803d;font-weight:700;font-size:.85em;margin-bottom:4px">
                           ✅ Dimensiones detectadas automáticamente
                       </div>
                       <div style="color:#14532d;font-size:1.2em;font-weight:700;margin:4px 0">
                           ${Number(svgDims.widthCm).toFixed(2)} × ${Number(svgDims.heightCm).toFixed(2)} cm
                       </div>
                       <div style="color:#15803d;font-size:.78em">
                           Escala: ${scalePxPerCm.toFixed(2)} px/cm — no necesitás ingresar nada
                       </div>
                   </div>`
                : `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin-bottom:12px">
                       <div style="color:#92400e;font-weight:700;font-size:.85em;margin-bottom:8px">
                           ⚠️ No se detectaron las dimensiones del SVG
                       </div>
                       <label class="form-label" style="font-size:.82em;color:#92400e;">Ingresá el alto real del diseño (cm):</label>
                       <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                           <input id="imp-h" type="number" class="form-input" placeholder="Ej: 45" min="1" style="flex:1" autofocus>
                           <span style="color:#92400e;font-size:.82em">cm</span>
                       </div>
                       <small style="color:#b45309;font-size:.75em;display:block;margin-top:6px">
                           💡 CorelDRAW: Exportar → SVG → activar "Preservar tamaño del documento" o "Usar unidades del documento"
                       </small>
                   </div>`;

            document.body.insertAdjacentHTML('beforeend', `
                <div id="imp-modal" class="modal active" style="display:flex;align-items:center;justify-content:center">
                    <div class="modal-content" style="max-width:460px">
                        <div class="modal-header">
                            <h2 class="modal-title">📐 Importar diseño</h2>
                            <button class="btn-close" onclick="document.getElementById('imp-modal').remove()">×</button>
                        </div>
                        <div class="modal-body">
                            ${dimInfo}
                            <div class="form-group">
                                <label class="form-label">Módulo LED</label>
                                <select id="imp-preset" class="form-select">${opts}</select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="document.getElementById('imp-modal').remove()">Solo importar</button>
                            <button class="btn btn-primary" id="imp-ok">
                                <i class="fas fa-magic"></i> Poblar LEDs automáticamente
                            </button>
                        </div>
                    </div>
                </div>
            `);

            document.getElementById('imp-ok').onclick = () => {
                // Si no hay auto-detección, usar alto manual
                if (!autoDetected) {
                    const hManual = parseFloat(document.getElementById('imp-h')?.value);
                    if (!(hManual > 0)) {
                        alert('Por favor ingresá el alto real del diseño en cm.');
                        return;
                    }
                    const bb = this._bbox(flatItems);
                    if (bb.height > 0) {
                        scalePxPerCm = bb.height / hManual;
                        const scEl = document.getElementById('c-scale-val');
                        if (scEl) scEl.textContent = scalePxPerCm.toFixed(2);
                    }
                }

                const preset = document.getElementById('imp-preset').value;
                document.getElementById('c-preset').value = preset;
                this.loadPreset(preset);
                document.getElementById('imp-modal').remove();

                // Indicador de carga
                const loadDiv = document.createElement('div');
                loadDiv.id = 'led-loading';
                loadDiv.style.cssText =
                    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
                    'background:rgba(24,24,27,0.9);border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 40px rgba(0,0,0,0.5);border-radius:12px;' +
                    'padding:24px 36px;color:#a5b4fc;font-size:1rem;z-index:9999;text-align:center;backdrop-filter:blur(10px);';
                loadDiv.innerHTML = '<i class="fas fa-sync fa-spin" style="font-size:1.5rem;display:block;margin-bottom:10px;color:#6366f1"></i>Calculando módulos LED...';
                document.body.appendChild(loadDiv);

                const pathItems = flatItems.filter(o =>
                    ['path', 'rect', 'ellipse', 'polygon', 'circle', 'triangle'].includes(o.type));

                let idx = 0;
                const next = async () => {
                    if (idx >= pathItems.length) {
                        document.getElementById('led-loading')?.remove();
                        this.fitScreen(); this.saveState(); this.recalcAll(); canvas.renderAll();
                        return;
                    }
                    loadDiv.innerHTML =
                        `<i class="fas fa-sync fa-spin" style="font-size:1.5rem;display:block;margin-bottom:10px"></i>` +
                        `Calculando módulos LED...<br><small style="color:#6366f1">${idx + 1} / ${pathItems.length} formas</small>`;
                    try {
                        await this.populatePath(pathItems[idx]);
                    } catch (e) {
                        console.error(`[LED] ❌ Error en import path ${idx + 1}/${pathItems.length}:`, e.message);
                        // NO abortar — continuar con el siguiente
                    }
                    idx++;
                    setTimeout(next, 20);
                };
                setTimeout(next, 80);
            };
        },


        zoomIn() {
            let z = canvas.getZoom() * 1.15;
            z = Math.min(20, Math.max(0.02, z));
            canvas.zoomToPoint({ x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 }, z);
            const el = document.getElementById('status-zoom');
            if (el) el.textContent = `Zoom: ${Math.round(z * 100)}%`;
            canvas.renderAll();
        },

        zoomOut() {
            let z = canvas.getZoom() * 0.85;
            z = Math.min(20, Math.max(0.02, z));
            canvas.zoomToPoint({ x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 }, z);
            const el = document.getElementById('status-zoom');
            if (el) el.textContent = `Zoom: ${Math.round(z * 100)}%`;
            canvas.renderAll();
        },

        fitScreen(includeModules = false) {
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            const mods = canvas.getObjects().filter(o => o.customType === 'led-module');

            // Con módulos generados: zoom sobre todo el conjunto
            // Sin módulos o explicitamente solo letras: zoom sobre letras
            let objs;
            if (includeModules && mods.length > 0) {
                objs = [...letters, ...mods];
            } else if (letters.length) {
                objs = letters;
            } else {
                objs = canvas.getObjects().filter(o => !o.excludeFromExport && o.customType !== 'title-block');
            }
            if (!objs.length) { canvas.setZoom(1); canvas.absolutePan(new fabric.Point(0, 0)); return; }
            const b = this._bbox(objs);
            const cW = canvas.getWidth(), cH = canvas.getHeight(), pad = 60;
            if (b.width < 1 || b.height < 1) return;
            const z = Math.min((cW - pad * 2) / b.width, (cH - pad * 2) / b.height, 5);
            canvas.setZoom(z);
            canvas.absolutePan(new fabric.Point(
                b.left * z - (cW - b.width * z) / 2,
                b.top * z - (cH - b.height * z) / 2,
            ));
            const el = document.getElementById('status-zoom');
            if (el) el.textContent = `Zoom: ${Math.round(z * 100)}%`;
            canvas.renderAll();
        },

        showScaleModal() {
            document.getElementById('sc-modal')?.remove();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="sc-modal" class="modal active" style="display:flex;align-items:center;justify-content:center">
                    <div class="modal-content" style="max-width:380px">
                        <div class="modal-header">
                            <h2 class="modal-title">⟺ Escalar diseño</h2>
                            <button class="btn-close" onclick="document.getElementById('sc-modal').remove()">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label">Nuevo alto (cm)</label>
                                <input id="sc-h" type="number" class="form-input" placeholder="Ej: 60" min="1" autofocus>
                            </div>
                            <small style="color:#888">Escala todo el diseño y recalcula los módulos.</small>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="document.getElementById('sc-modal').remove()">Cancelar</button>
                            <button class="btn btn-primary" id="sc-ok">Aplicar</button>
                        </div>
                    </div>
                </div>
            `);
            const apply = () => {
                const v = parseFloat(document.getElementById('sc-h').value);
                if (v > 0) { this._scaleAll(v); document.getElementById('sc-modal').remove(); }
                else alert('Ingresá un valor válido');
            };
            document.getElementById('sc-ok').onclick = apply;
            document.getElementById('sc-h').addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
        },

        _scaleAll(targetCm) {
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            if (!letters.length) return;
            const bbox = this._bbox(letters);
            const curCm = bbox.height / scalePxPerCm;
            if (curCm < 0.01) return;
            const f = targetCm / curCm;
            letters.forEach(obj => {
                obj.scaleX = (obj.scaleX ?? 1) * f;
                obj.scaleY = (obj.scaleY ?? 1) * f;
                obj.left = bbox.left + (obj.left - bbox.left) * f;
                obj.top = bbox.top + (obj.top - bbox.top) * f;
                obj.setCoords();
            });
            scalePxPerCm *= f;
            const el = document.getElementById('c-scale-val');
            if (el) el.textContent = scalePxPerCm.toFixed(2);
            setTimeout(async () => {
                for (const obj of letters) { try { await this.populatePath(obj); } catch (_) { break; } }
                this.fitScreen(); this.saveState();
            }, 30);
        },

        // ═══════════════════════════════════════════════════════
        //  NUEVA LÓGICA DE INSTALACIÓN (v2.3)
        // ═══════════════════════════════════════════════════════
        crearLed(x, y, angle = 0, parentId, dontAdd = false) {
            // x, y llegan en coordenadas lógicas del canvas (zoom-independent)
            const modWpx = cfg.modW * scalePxPerCm;
            const modHpx = cfg.modH * scalePxPerCm;
            const isEditMode = (this.currentTool === 'edit-leds');
            let led;
            if (this.ledImage && this.ledImage.complete && this.ledImage.naturalWidth > 0) {
                led = new fabric.Image(this.ledImage, {
                    left: x,
                    top: y,
                    width: this.ledImage.naturalWidth,
                    height: this.ledImage.naturalHeight,
                    scaleX: modWpx / this.ledImage.naturalWidth,
                    scaleY: modHpx / this.ledImage.naturalHeight,
                    angle: angle,
                    originX: 'center',
                    originY: 'center',
                    selectable: isEditMode,
                    evented: isEditMode,
                    hasControls: isEditMode,
                    hasBorders: isEditMode,
                    borderColor: '#3b82f6',
                    cornerColor: '#2563eb',
                    cornerSize: 6,
                    customType: 'led-module',
                    parentId: parentId,
                });
            } else {
                led = new fabric.Rect({
                    left: x,
                    top: y,
                    width: modWpx,
                    height: modHpx,
                    angle: angle,
                    fill: cfg.color,
                    stroke: cfg.stroke,
                    strokeWidth: Math.max(0.4, modHpx * 0.07),
                    rx: modHpx * 0.45,
                    ry: modHpx * 0.45,
                    originX: 'center',
                    originY: 'center',
                    selectable: isEditMode,
                    evented: isEditMode,
                    hasControls: isEditMode,
                    hasBorders: isEditMode,
                    borderColor: '#3b82f6',
                    cornerColor: '#2563eb',
                    cornerSize: 6,
                    customType: 'led-module',
                    parentId: parentId,
                });
            }
            if (!dontAdd) {
                canvas.add(led);
            }
            return led;
        },

        crearAura(x, y, parentId) {
            const showAuras = document.getElementById('c-show-auras')?.checked !== false;
            const auraRadius = (cfg.stepY || 8.0) * 0.5 * scalePxPerCm;

            return new fabric.Circle({
                left: x,
                top: y,
                radius: auraRadius,
                fill: cfg.color || '#FEF08A',
                opacity: 0.15,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                visible: showAuras,
                excludeFromExport: true,
                customType: 'led-aura',
                parentId: parentId,
            });
        },

        // ═══════════════════════════════════════════════════════════
        //  populatePath / _calculateOnBackend — v4.0
        //
        //  SOLUCIÓN AL BUG DE COORDENADAS:
        //  El path 'd' de Fabric usa coords LOCALES del objeto SVG.
        //  Para CorelDRAW pueden ser 0-36000 unidades, mientras que
        //  los módulos están en px del canvas (~22px/cm).
        //  Enviar ambas cosas en unidades distintas → grid de 400K pts → cuelgue.
        //
        //  Fix: enviamos la transform matrix (calcTransformMatrix) al backend.
        //  Python aplica affine_transform() al polígono → todo en px del canvas.
        //  Los módulos también van en px del canvas (cfg.modW * scalePxPerCm).
        //  Python devuelve posiciones en px del canvas → JS coloca directamente.
        // ═══════════════════════════════════════════════════════════

        async populatePath(fabricObj) {
            if (!fabricObj) return;
            if (!fabricObj.id) {
                fabricObj.set('id', 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
            }
            await this._calculateOnBackend(fabricObj);
        },

        repopulateAll() {
            canvas.discardActiveObject();
            this.generarInstalacion(true);
        },

        /**
         * Serializa el objeto Fabric → string SVG path 'd' en coords LOCALES.
         * Fabric almacena los paths centrados en (0,0) antes del transform.
         */
        _getPathD(obj) {
            if (obj.type === 'path' && obj.path) {
                return fabric.util.joinPath(obj.path);
            }
            if (obj.type === 'rect') {
                const w = obj.width || 0, h = obj.height || 0;
                return `M${-w / 2} ${-h / 2} H${w / 2} V${h / 2} H${-w / 2} Z`;
            }
            if (obj.type === 'ellipse' || obj.type === 'circle') {
                const rx = obj.rx || obj.radius || 1, ry = obj.ry || obj.radius || 1;
                return `M${-rx} 0 A${rx} ${ry} 0 1 0 ${rx} 0 A${rx} ${ry} 0 1 0 ${-rx} 0 Z`;
            }
            if ((obj.type === 'polygon' || obj.type === 'polyline') && obj.points) {
                return `M ${obj.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
            }
            const m = obj.toSVG?.().match(/\bd="([^"]+)"/);
            return m ? m[1] : '';
        },

        _getCenterTransformMatrix(obj) {
            const mtx = obj.calcTransformMatrix();
            let tx = 0;
            let ty = 0;

            if (obj.originX === 'left') {
                tx = (obj.width || 0) / 2;
            } else if (obj.originX === 'right') {
                tx = -(obj.width || 0) / 2;
            }

            if (obj.originY === 'top') {
                ty = (obj.height || 0) / 2;
            } else if (obj.originY === 'bottom') {
                ty = -(obj.height || 0) / 2;
            }

            if (tx !== 0 || ty !== 0) {
                const a = mtx[0], b = mtx[1], c = mtx[2], d = mtx[3], e = mtx[4], f = mtx[5];
                return [
                    a,
                    b,
                    c,
                    d,
                    e + a * tx + c * ty,
                    f + b * tx + d * ty
                ];
            }
            return mtx;
        },

        /**
         * Envía el path + transform matrix al backend Python.
         *
         * Sistema de coordenadas unificado:
         *  1. svg_path      → coords locales de Fabric (antes del transform)
         *  2. transform_matrix → calcTransformMatrix() [a,b,c,d,e,f]
         *     Python aplica affine_transform() → polígono en px del canvas
         *  3. module_width/height/spacing → en px del canvas = cfg.X * scalePxPerCm
         *  4. Respuesta del backend → ya en px del canvas, se colocan directo
         *     SIN ningún transformPoint adicional en el browser.
         */
        async _calculateOnBackend(fabricObj) {
            const d = this._getPathD(fabricObj);
            if (!d) {
                console.warn('[LED] ❌ No se pudo extraer path de:', fabricObj.type, fabricObj.id);
                return;
            }

            // La transform matrix convierte coords locales → px del canvas (lógicos).
            // Python la aplica al polígono antes de calcular el grid.
            const mtx = this._getCenterTransformMatrix(fabricObj); // [a, b, c, d, e, f]

            // IMPORTANTE: Usar scalePxPerCm DIRECTO (sin dividir por zoom).
            // El backend trabaja en coords lógicas del canvas, zoom-independent.
            const scale = scalePxPerCm;

            console.group(`[LED] 📐 Path ${fabricObj.id} (${fabricObj.type})`);
            console.log('  Transform:', mtx.map(v => v.toFixed(2)).join(', '));
            console.log('  Scale:', scale.toFixed(2), 'px/cm (zoom-independent)');

            const payload = {
                svg_path: d,
                transform_matrix: Array.from(mtx),
                module_width: cfg.modW * scale,
                module_height: cfg.modH * scale,
                spacing_x: cfg.stepX * scale,
                spacing_y: cfg.stepY * scale,
                margin: cfg.margin * scale,
                mode: cfg.mode,
                contour_spacing: cfg.stepX * scale,
                rotation_mode: cfg.mode === 'centerline' ? 'stroke' : (cfg.rotationMode || 'none'),
            };

            console.log('  Módulo:', `${payload.module_width.toFixed(1)}×${payload.module_height.toFixed(1)}px`,
                `| Paso: ${payload.spacing_x.toFixed(1)},${payload.spacing_y.toFixed(1)}px`,
                `| Margen: ${payload.margin.toFixed(1)}px`);

            let positions;
            try {
                const backendHost = window.location.hostname || 'localhost';
                const res = await fetch(`http://${backendHost}:8000/api/calculate-leds`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
                    throw new Error(err.detail || `HTTP ${res.status}`);
                }
                const responseData = await res.json();
                positions = Array.isArray(responseData)
                    ? responseData
                    : (responseData.leds ?? []);
            } catch (e) {
                console.error('  ❌ Backend error:', e.message);
                console.groupEnd();
                this._showBackendError(e.message);
                throw e;
            }

            console.log(`  ✅ Backend devolvió: ${positions?.length || 0} posiciones`);

            // Bounding box en coordenadas LÓGICAS del canvas para filtrado
            // calcTransformMatrix() ya da las coords absolutas en espacio lógico
            const bounds = fabricObj.getBoundingRect(true);  // absolute=true → logical coords
            const zoom = canvas.getZoom() || 1;
            // getBoundingRect(true) con un solo arg devuelve coords lógicas en Fabric 4.x+
            // Normalizar: dividir por zoom si getBoundingRect incluye viewport
            const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
            const invVpt = fabric.util.invertTransform(vpt);
            const tl = fabric.util.transformPoint({ x: bounds.left, y: bounds.top }, invVpt);
            const br = fabric.util.transformPoint({ x: bounds.left + bounds.width, y: bounds.top + bounds.height }, invVpt);
            const canvasBB = { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
            const tol = Math.max(canvasBB.width, canvasBB.height) * 0.60;

            let placed = 0, rejected = 0;
            const ledsToAdd = [];

            positions?.forEach(({ x, y, angle }) => {
                // x, y del backend están en coordenadas lógicas del canvas
                if (x < canvasBB.left - tol || x > canvasBB.left + canvasBB.width + tol ||
                    y < canvasBB.top - tol || y > canvasBB.top + canvasBB.height + tol) {
                    rejected++;
                    return;
                }

                const isNeon = cfg.preset && /neon/i.test(cfg.preset);
                if (!isNeon) {
                    const aura = this.crearAura(x, y, fabricObj.id);
                    if (aura) ledsToAdd.push(aura);
                }

                const led = this.crearLed(x, y, angle, fabricObj.id, true);
                if (led) {
                    ledsToAdd.push(led);
                    placed++;
                } else {
                    rejected++;
                }
            });

            if (ledsToAdd.length > 0) {
                canvas.add(...ledsToAdd);
            }

            if (rejected > 0) {
                console.warn(`  ⚠️ ${rejected} módulos RECHAZADOS (fuera del bbox del padre)`);
            }
            console.log(`  📊 Resultado: ${placed} colocados, ${rejected} rechazados`);
            console.groupEnd();
        },

        _showBackendError(detail) {
            document.getElementById('backend-error-toast')?.remove();
            const toast = document.createElement('div');
            toast.id = 'backend-error-toast';
            toast.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:10000;background:#1e1030;border:1.5px solid #ef4444;border-radius:12px;padding:18px 22px;max-width:380px;color:#fca5a5;font-size:.9rem;box-shadow:0 8px 32px rgba(239,68,68,0.25)';
            toast.innerHTML = `
                <div style="font-weight:700;color:#f87171;margin-bottom:6px">⚠️ Error del servidor LED</div>
                <div style="font-size:.82em;margin-bottom:10px">${detail}</div>
                <button onclick="this.closest('#backend-error-toast').remove()"
                    style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:.8em">Cerrar</button>`;
            document.body.appendChild(toast);
            setTimeout(() => document.getElementById('backend-error-toast')?.remove(), 10000);
        },

        async generarInstalacion(forceAll = false) {
            this.readConfig();
            const modo = cfg.mode;

            // forceAll=true  → procesar TODAS las letras/formas del canvas (ignorar selección)
            // forceAll=false → procesar solo lo seleccionado (o todo si no hay selección)
            const activeObject = forceAll ? null : canvas.getActiveObject();
            let objectsToProcess;

            // Deseleccionar para evitar confusión visual cuando se pobla todo
            if (forceAll) canvas.discardActiveObject();

            // ── NEON FLEX ──────────────────────────────────────────────────────────
            if (cfg.preset && /neon/i.test(cfg.preset)) {
                let targets;
                if (activeObject && !forceAll) {
                    const raw = (activeObject.type === 'activeSelection' || activeObject.type === 'group')
                        ? activeObject.getObjects() : [activeObject];
                    targets = raw.filter(o => o.customType !== 'neon-path' && o.customType !== 'led-module');
                } else {
                    targets = canvas.getObjects().filter(o =>
                        o.customType === 'letter' || (
                            ['path', 'rect', 'ellipse', 'polygon', 'circle'].includes(o.type) &&
                            o.customType !== 'led-module' && o.customType !== 'neon-path'
                        )
                    );
                }
                if (!targets.length) { alert('No hay formas en el canvas. Importá un SVG primero.'); return; }
                // Asignar IDs y limpiar neon previo de canvas completo
                targets.forEach(obj => {
                    if (!obj.id) obj.set('id', 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
                });
                isBulk = true;
                canvas.getObjects().filter(o => o.customType === 'neon-path').forEach(o => canvas.remove(o));
                isBulk = false;
                targets.forEach(obj => this.calcularNeon(obj));
                setTimeout(() => { this.recalcAll(); canvas.renderAll(); this.saveState(); }, 200);
                return;
            }

            if (activeObject) {
                const isMulti = activeObject.type === 'group' || activeObject.type === 'activeSelection';
                objectsToProcess = isMulti ? activeObject.getObjects() : [activeObject];
            } else {
                // Sin selección (o forceAll) → TODAS las formas tipo letter
                objectsToProcess = canvas.getObjects().filter(o =>
                    (o.customType === 'letter' || ['path', 'rect', 'ellipse', 'polygon', 'circle'].includes(o.type)) &&
                    o.customType !== 'led-module'
                );
                if (!objectsToProcess.length) {
                    alert('No hay formas en el canvas.\nImportá un SVG primero.');
                    return;
                }
            }

            const items = objectsToProcess.filter(o =>
                ['path', 'rect', 'ellipse', 'polygon', 'circle', 'triangle'].includes(o.type));

            // Asegurarse de que todos los objetos tengan un ID para la limpieza
            items.forEach(item => {
                if (!item.id) item.set('id', 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
            });

            console.log(`[LED] 🚀 Procesando ${items.length} formas (forceAll=${forceAll})`);

            // Limpiar módulos anteriores y preparar bulk mode
            const ids = items.map(o => o.id);
            isBulk = true;

            // Limpiar TODOS los módulos y auras si forceAll, si no solo los de los items seleccionados
            if (forceAll) {
                canvas.getObjects()
                    .filter(o => o.customType === 'led-module' || o.customType === 'led-aura')
                    .forEach(o => canvas.remove(o));
            } else {
                canvas.getObjects()
                    .filter(o => (o.customType === 'led-module' || o.customType === 'led-aura') && ids.includes(o.parentId))
                    .forEach(o => canvas.remove(o));
            }

            // Indicador de progreso
            const loadDiv = document.createElement('div');
            loadDiv.id = 'led-loading';
            loadDiv.style.cssText =
                'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
                'background:rgba(24,24,27,0.9);border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.5);backdrop-filter:blur(10px);' +
                'padding:20px 32px;color:#a5b4fc;font-size:1rem;z-index:9999;text-align:center';
            loadDiv.innerHTML = '<i class="fas fa-sync fa-spin" style="font-size:1.5rem;display:block;margin-bottom:8px;color:#6366f1"></i>Calculando módulos...';
            document.body.appendChild(loadDiv);

            // Bucle asíncrono — CADA path en su propio try/catch para no abortar el resto
            const results = [];
            for (let i = 0; i < items.length; i++) {
                loadDiv.innerHTML =
                    '<i class="fas fa-sync fa-spin" style="font-size:1.5rem;display:block;margin-bottom:8px"></i>' +
                    'Calculando en servidor...<br><small style="color:#6366f1">' + (i + 1) + ' / ' + items.length + '</small>';

                const modsAntes = canvas.getObjects().filter(o => o.customType === 'led-module').length;
                try {
                    await this.populatePath(items[i]);
                } catch (e) {
                    console.error(`[LED] ❌ Error en path ${i + 1}/${items.length} (${items[i].id}):`, e.message);
                    // NO abortar — seguir con el siguiente path
                }
                const modsAhora = canvas.getObjects().filter(o => o.customType === 'led-module').length;
                results.push({ id: items[i].id, count: modsAhora - modsAntes });
            }

            isBulk = false;
            document.getElementById('led-loading')?.remove();

            // Resumen en consola
            const totalMods = results.reduce((s, r) => s + r.count, 0);
            const sinMods = results.filter(r => r.count === 0);
            console.log(`[LED] ═══════════════════════════════════════════`);
            console.log(`[LED] 📊 RESUMEN: ${totalMods} módulos en ${items.length} formas`);
            results.forEach((r, i) => {
                console.log(`[LED]   ${r.count > 0 ? '✅' : '❌'} Forma ${i + 1} (${r.id}): ${r.count} módulos`);
            });
            if (sinMods.length > 0) {
                console.warn(`[LED] ⚠️ ${sinMods.length} formas SIN módulos`);
            }
            console.log(`[LED] ═══════════════════════════════════════════`);

            this.fitScreen(true);
            this.recalcAll();
            canvas.renderAll();
            this.saveState();
        },


        // ─── Neon Flex: dibuja contorno brillante ────────────────────────────────
        /**
         * FIX POSICIONAMIENTO:
         * clone() copia left/top del objeto pero esos son coords en el sistema
         * local del padre (grupo). Para la posición ABSOLUTA en el canvas usamos
         * qrDecompose(calcTransformMatrix()) que descompone la matriz acumulada.
         *
         * Luego creamos un fabric.Path con el string 'd' en coords locales del
         * objeto original + las propiedades de transform absolutas.
         */
        calcularNeon(fabricObj) {
            if (!fabricObj || !fabricObj.id) return;

            // Aumentamos el grosor visual (x1.6) para un efecto más robusto
            const neonW = Math.max(4, (cfg.modH || 1.2) * scalePxPerCm * 1.6);
            const neonColor = cfg.color || '#F472B6';
            const glowColor = cfg.stroke || '#EC4899';

            // Descomponer la transform matrix acumulada del objeto
            // Esto da la posición ABSOLUTA en el canvas, sin importar grupos/zoom
            const mtx = this._getCenterTransformMatrix(fabricObj);
            const dec = fabric.util.qrDecompose(mtx);
            // dec = { scaleX, scaleY, skewX, skewY, angle, translateX, translateY }

            fabricObj.clone(outer => {
                outer.set({
                    left: dec.translateX,
                    top: dec.translateY,
                    scaleX: dec.scaleX,
                    scaleY: dec.scaleY,
                    angle: dec.angle,
                    skewX: dec.skewX,
                    skewY: dec.skewY,
                    originX: 'center',
                    originY: 'center',
                    selectable: false,
                    evented: false,
                    customType: 'neon-path',
                    parentId: fabricObj.id,
                    stroke: neonColor,
                    strokeWidth: neonW,
                    fill: 'transparent',
                    strokeLineCap: 'round',
                    strokeLineJoin: 'round',
                    shadow: new fabric.Shadow({ color: glowColor, blur: neonW * 3, offsetX: 0, offsetY: 0 }),
                    isNeonInner: false,
                });
                canvas.add(outer);

                // Capa 2: núcleo blanco brillante (stroke fino encima)
                outer.clone(inner => {
                    inner.set({
                        stroke: 'rgba(255,255,255,0.95)',
                        strokeWidth: neonW * 0.35,
                        shadow: new fabric.Shadow({ color: '#ffffff', blur: neonW * 0.8, offsetX: 0, offsetY: 0 }),
                        isNeonInner: true,
                    });
                    canvas.add(inner);
                    canvas.renderAll();
                });
            });
        },

        // ─── Gemini AI — Análisis visual del diseño ──────────────────────────────
        async analizarConIA() {
            // Ya no se necesita manejar API keys en el frontend.
            // El servidor se encarga de la conexión con Groq.

            const btn = document.getElementById('btn-ia');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...'; }

            try {
                // 1. Capturar canvas como imagen
                const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.80, multiplier: 0.5 });
                const base64 = dataUrl.split(',')[1];

                // 2. Contexto del diseño para el prompt
                const letters = canvas.getObjects().filter(o => o.customType === 'letter');
                const bb = letters.length ? this._bbox(letters) : { width: 0, height: 0 };
                const anchoCm = scalePxPerCm > 0 ? (bb.width / scalePxPerCm).toFixed(0) : '?';
                const altoCm = scalePxPerCm > 0 ? (bb.height / scalePxPerCm).toFixed(0) : '?';
                const nLetras = letters.length;

                const promptText = `Sos un ingeniero especialista en instalaciones de letreros LED luminosos corpóreos.
Analizá este diseño. Dimensiones: ${anchoCm}cm × ${altoCm}cm. Formas detectadas: ${nLetras}.

MODOS DE DISTRIBUCIÓN DISPONIBLES:
- "centerline" → eje central del trazo (IDEAL para letras corpóreas con trazos definidos)
- "fill"       → relleno en grid (para letras muy anchas/bloque sin trazos finos)
- "contour"    → sigue el perímetro exterior (para marcos o contornos)

PRESETS:
- "SMD-2835 Estándar"     → 6.6×1.2cm, 12V, 0.72W — corpóreas medianas (alto 20-60cm)
- "SMD-2835 Mini"         → 1.2×1.2cm, 12V, 0.48W — letras pequeñas (alto < 15cm)
- "SMD-5050 High Power"   → 7.5×1.5cm, 12V, 1.20W — cajas de luz grandes (alto > 60cm)
- "COB Alta Densidad"     → 7.0×2.0cm, 24V, 1.50W — luz uniforme premium
- "GOB IP68 (Sumergible)" → 7.2×1.8cm, 12V, 1.20W — exterior severo
- "Neon Flex Mini (6x12)" → 10W/m, 12V — solo contornos iluminados

REGLAS PARA CALCULAR PARÁMETROS:
- stepX = modW + gap (gap ideal 1.5-2.5cm para corpóreas)
- stepY = modH + separación filas (separación ideal 2.0-4.0cm)
- margin >= modH × 0.5 para que no sobresalgan del borde
- rotacion "stroke" si hay trazos diagonales o curvos
- Para "centerline": modH debe ser menor que el ancho estimado del trazo de la letra

Respondé ÚNICAMENTE con JSON válido sin texto extra ni backticks:
{
  "preset_base": "nombre exacto del preset",
  "tipo": "modulos_led" o "neon_flex",
  "modo_distribucion": "centerline" o "fill" o "contour",
  "rotacion_modulos": "none" o "stroke",
  "modW": número en cm,
  "modH": número en cm,
  "stepX": número en cm,
  "stepY": número en cm,
  "margin": número en cm,
  "watt_por_modulo": número,
  "voltage": 12 o 24,
  "justificacion": "explicación técnica breve",
  "advertencias": []
}`;

                // 3. Obtener API Key de Gemini
                let apiKey = window.GEMINI_API_KEY;
                if (!apiKey) {
                    try {
                        const resKey = await AUTH.fetch('/api/config/gemini-key');
                        if (resKey.ok) {
                            const dataKey = await resKey.json();
                            apiKey = dataKey.key;
                        }
                    } catch (e) {
                        console.error('Error fetching Gemini key:', e);
                    }
                }
                if (!apiKey) {
                    apiKey = 'AIzaSyCa0cYZYK3KE6tDsF0omv4Qo2fEyJvK3MI'; // Fallback
                }

                // 4. Llamar directamente a la API de Gemini 2.0 Flash (Vision)
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                const body = {
                    contents: [{
                        parts: [
                            { text: promptText },
                            { inline_data: { mime_type: 'image/jpeg', data: base64 } }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1024,
                        responseMimeType: "application/json"
                    }
                };

                const res = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || `Error de Gemini: HTTP ${res.status}`);
                }

                const responseData = await res.json();
                const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
                const ai = JSON.parse(text.replace(/```json|```/g, '').trim());

                // 4. Aplicar preset base (colores y label)
                const presetBase = ai.preset_base || ai.preset_sugerido;
                if (presetBase && document.getElementById('c-preset')) {
                    document.getElementById('c-preset').value = presetBase;
                    this.loadPreset(presetBase);
                }

                // 5. Sobrescribir con parámetros exactos de la IA
                const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
                const tipo = ai.tipo || (ai.tipo_recomendado === 'neon_flex' ? 'neon_flex' : 'modulos_led');
                if (tipo !== 'neon_flex') {
                    set('c-mode', ai.modo_distribucion || 'centerline');
                    set('c-rotation', ai.rotacion_modulos || 'none');
                    if (ai.modW) set('c-modw', ai.modW);
                    if (ai.modH) set('c-modh', ai.modH);
                    if (ai.stepX) set('c-stepx', ai.stepX);
                    if (ai.stepY) set('c-stepy', ai.stepY);
                    if (ai.margin != null) set('c-margin', ai.margin);
                    if (ai.watt_por_modulo) set('c-watt', ai.watt_por_modulo);
                }
                this.readConfig();

                // 6. Panel de resultado con parámetros aplicados
                const modoLabel = { centerline: '⭐ Eje central', fill: '▦ Relleno Grid', contour: '◌ Contorno' };
                const sp = document.getElementById('stats-panel');
                if (sp) sp.innerHTML = `
                    <div class="stats-card" style="border-left-color:#f97316;">
                        <h3 style="color:#ea580c;margin-top:0;font-size:1rem">⚡ Parámetros calculados por IA</h3>
                        <p style="margin:4px 0"><b>Tipo:</b> ${tipo === 'neon_flex' ? '🌟 Neon Flex' : '💡 Módulos LED'}</p>
                        <p style="margin:4px 0"><b>Modo:</b> ${modoLabel[ai.modo_distribucion] || ai.modo_distribucion || '—'}</p>
                        <p style="margin:4px 0"><b>Preset:</b> ${presetBase || '—'}</p>
                        ${tipo !== 'neon_flex' && ai.modW ? `
                        <div class="config-box" style="background:#f8fafc;padding:8px;margin:8px 0;font-size:.82rem">
                            <div class="config-box-title" style="font-size:.72rem;margin-bottom:4px">PARÁMETROS APLICADOS</div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
                                <span>Módulo:</span><span style="color:#2563eb"><b>${ai.modW}×${ai.modH} cm</b></span>
                                <span>Paso X/Y:</span><span style="color:#2563eb"><b>${ai.stepX}/${ai.stepY} cm</b></span>
                                <span>Margen:</span><span style="color:#2563eb"><b>${ai.margin} cm</b></span>
                                <span>Voltaje:</span><span style="color:#2563eb"><b>${ai.voltage || 12}V — ${ai.watt_por_modulo}W/mod</b></span>
                            </div>
                        </div>` : ''}
                        <p style="color:#475569;font-size:.8rem;margin:6px 0">${ai.justificacion || ''}</p>
                        ${ai.advertencias?.length ? `<p style="color:#d97706;font-size:.78rem">⚠️ ${ai.advertencias.join('<br>')}</p>` : ''}
                        <div style="display:flex;gap:6px;margin-top:10px">
                            <button onclick="lw.generarInstalacion(true)" style="flex:1;background:#22c55e;color:#fff;border:none;border-radius:6px;padding:7px;cursor:pointer;font-weight:700;font-size:.85rem">
                                ⚡ Generar ahora
                            </button>
                            <button onclick="this.closest('.stats-card').remove()" class="btn btn-secondary" style="padding:7px 12px;font-size:.8rem">
                                Cerrar
                            </button>
                        </div>
                    </div>`;

            } catch (e) {
                alert(`Error al analizar con IA:\n${e.message}`);
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> ✨ Analizar con IA'; }
            }
        },

        // ─── Estadísticas ─────────────────────────────────────
        recalcAll() {
            // Actualizar cableado y ruteo de fuentes
            this.actualizarCableadoInterno();
            this.actualizarRutasDeAlimentacion();

            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            const mods = canvas.getObjects().filter(o => o.customType === 'led-module').length;
            const neonPaths = canvas.getObjects().filter(o => o.customType === 'neon-path' && !o.isNeonInner);
            const isNeon = cfg.preset && /neon/i.test(cfg.preset);
            const ge = id => document.getElementById(id);

            const supplies = canvas.getObjects().filter(o => o.customType === 'power-supply');

            if (isNeon && neonPaths.length > 0) {
                // ── Modo Neon Flex: metros lineales + W/m ──────────────────
                let totalM = 0;
                neonPaths.forEach(np => { totalM += this._pathML(np).m; });
                totalM = +totalM.toFixed(2);
                const wattM = cfg.watt_m || 10;
                const consumoW = +(totalM * wattM).toFixed(1);
                const fuenteW = +(consumoW * 1.20).toFixed(0);
                const amp = cfg.voltage > 0 ? +(fuenteW / cfg.voltage).toFixed(1) : 0;
                const totalM10 = +(totalM * 1.10).toFixed(2);

                if (ge('status-modules')) ge('status-modules').textContent = `Neon: ${totalM} m`;
                if (ge('status-watts')) ge('status-watts').textContent = `Watts: ${consumoW}W`;

                let suppliesHtml = '';
                if (supplies.length > 0) {
                    suppliesHtml = `
                        <hr>
                        <p style="margin-bottom:6px"><b>Fuentes en Canvas:</b></p>
                        <ul style="padding-left:16px;margin:0;font-size:0.85rem">
                            ${supplies.map((s, i) => {
                        const cap = s.powerCapacity || 100;
                        const load = s.powerLoad || 0;
                        const pct = cap > 0 ? (load / cap) * 100 : 0;
                        const isOver = pct > 80;
                        const color = isOver ? '#ef4444' : '#10b981';
                        const warning = isOver ? '⚠️ ' : '';
                        return `<li style="margin-bottom:4px;color:${color}">
                                    <b>Fuente #${i + 1} (${cap}W):</b> ${warning}${load.toFixed(0)}W (${pct.toFixed(0)}%)
                                </li>`;
                    }).join('')}
                        </ul>`;
                } else {
                    suppliesHtml = `
                        <p style="color:#db2777;font-size:1.05rem;margin-top:10px">
                            <b>Fuente necesaria:</b><br>
                            Mínimo <strong>${fuenteW} W</strong> (${amp} A)
                        </p>`;
                }

                const techLabel = cfg.preset && /neon/i.test(cfg.preset) ? 'Neon Flex' : 'Tira LED';
                const sp = ge('stats-panel');
                if (sp) sp.innerHTML = `
                    <div class="stats-card" style="border-left-color:#db2777;">
                        <h3 style="margin-top:0;color:#db2777">🌟 ${techLabel} — Lista de Compra</h3>
                        <p><b>${techLabel}:</b> <span style="color:#db2777;font-size:1.2rem;font-weight:700">${totalM} m</span></p>
                        <p><b>+10% margen de seguridad:</b> ${totalM10} m</p>
                        <p><b>Voltaje:</b> ${cfg.voltage || 12}V &nbsp;|&nbsp; <b>${wattM} W/m</b></p>
                        <hr>
                        <p><b>Consumo Total:</b> ${consumoW} W</p>
                        ${suppliesHtml}
                    </div>`;

                const mlp = ge('ml-curvas-panel');
                if (mlp) mlp.innerHTML = `
                    <p>Perímetro total: <b>${totalM} m</b></p>
                    <p>+10% margen: <b>${totalM10} m</b></p>
                    <hr>
                    <p>💡 ${techLabel}: <b>${totalM} m</b></p>
                    <p>🔩 Trim cap: <b>${totalM} m</b></p>
                    <div style="margin-top:6px;font-size:.78em;color:#64748b">
                        Retorno (alto cm):
                        <input id="ret-h" type="number" value="5" min="1"
                            class="form-input" style="width:42px;padding:2px 4px;margin:0 4px;display:inline-block;">
                        = <span id="ret-area">${(totalM * 100 * 5).toFixed(0)} cm²</span>
                    </div>`;
                ge('ret-h')?.addEventListener('input', e => {
                    const a = parseFloat(e.target.value) || 5;
                    const el = ge('ret-area'); if (el) el.textContent = (totalM * 100 * a).toFixed(0) + ' cm²';
                });
                return;
            }

            // ── Módulos LED normales y Tiras LED ───────────────────────────
            const isTira = cfg.preset && /tira|cinta|strip/i.test(cfg.preset);
            const totalMTira = isTira ? +(mods * (cfg.stepX || 1.67) / 100).toFixed(2) : 0;
            const techName = isTira ? 'Tira LED' : 'Módulos LED';
            const techUnit = isTira ? `${totalMTira} m (${mods} leds)` : `${mods} módulos`;

            const consumoReal = mods * (cfg.watt || 0);
            const fuenteRecomendada = consumoReal * 1.20;
            const amperaje = cfg.voltage > 0 ? fuenteRecomendada / cfg.voltage : 0;
            const fuentesCant = consumoReal > 0 ? Math.ceil(consumoReal / (cfg.supplyW || 100)) : 0;

            if (ge('status-modules')) {
                ge('status-modules').textContent = isTira
                    ? `Tira: ${totalMTira} m`
                    : `Módulos: ${mods}`;
            }
            if (ge('status-watts')) ge('status-watts').textContent = `Watts: ${consumoReal.toFixed(1)}W`;

            let suppliesHtml = '';
            if (supplies.length > 0) {
                suppliesHtml = `
                    <hr>
                    <p style="margin-bottom:6px"><b>Fuentes en Canvas:</b></p>
                    <ul style="padding-left:16px;margin:0;font-size:0.85rem">
                        ${supplies.map((s, i) => {
                    const cap = s.powerCapacity || 100;
                    const load = s.powerLoad || 0;
                    const pct = cap > 0 ? (load / cap) * 100 : 0;
                    const isOver = pct > 80;
                    const color = isOver ? '#ef4444' : '#10b981';
                    const warning = isOver ? '⚠️ ' : '';
                    return `<li style="margin-bottom:4px;color:${color}">
                                <b>Fuente #${i + 1} (${cap}W):</b> ${warning}${load.toFixed(0)}W (${pct.toFixed(0)}%)
                            </li>`;
                }).join('')}
                    </ul>`;
            } else {
                suppliesHtml = `
                    <p style="color:#2563eb;font-size:1.05rem;margin-top:10px">
                        <b>Fuente necesaria:</b><br>
                        Mínimo <strong>${fuenteRecomendada.toFixed(0)} W</strong>
                        (${amperaje.toFixed(1)} A)<br>
                        <small style="color:#64748b">≈ ${fuentesCant} fuente(s) de ${cfg.supplyW || 100}W</small>
                    </p>`;
            }

            const sp = ge('stats-panel');
            if (sp) {
                const borderCol = isTira ? '#ca8a04' : '#2563eb';
                const totalM10 = +(totalMTira * 1.10).toFixed(2);
                sp.innerHTML = `
                    <div class="stats-card" style="border-left-color:${borderCol};">
                        <h3 style="margin-top:0;color:${borderCol}">📋 Lista de Compra — ${techName}</h3>
                        ${isTira ? `
                            <p><b>Tira LED necesaria:</b> <span style="color:${borderCol};font-size:1.2rem;font-weight:700">${totalMTira} m</span></p>
                            <p><b>Margen +10%:</b> ${totalM10} m</p>
                            <p><b>Cantidad de LEDs:</b> ${mods} unidades</p>
                        ` : `
                            <p><b>Cantidad:</b> <span style="color:${borderCol};font-size:1.1rem;font-weight:700">${techUnit}</span></p>
                        `}
                        <p><b>Voltaje:</b> ${cfg.voltage || 'N/A'}V &nbsp;|&nbsp; <b>${isTira ? `${cfg.watt_m} W/m` : `${(cfg.watt || 0).toFixed(2)} W/módulo`}</b></p>
                        <hr>
                        <p><b>Consumo Total:</b> ${consumoReal.toFixed(1)} W</p>
                        ${suppliesHtml}
                    </div>`;
            }

            const mlp = ge('ml-curvas-panel');
            if (mlp) {
                if (letters.length) {
                    const mlVal = letters.reduce((s, p) => s + this._pathML(p).m, 0);
                    const m = +mlVal.toFixed(2);
                    mlp.innerHTML = `
                        <p>Perímetro: <b>${m} m</b></p>
                        <p>+10% margen: ${+(m * 1.1).toFixed(2)} m</p>
                        <hr>
                        <p>💡 Neon flex: ${m} m</p>
                        <p>🔩 Trim cap: ${m} m</p>
                        <div style="margin-top:6px;font-size:.78em;color:#64748b">
                            Retorno (alto cm):
                            <input id="ret-h" type="number" value="5" min="1"
                                class="form-input" style="width:42px;padding:2px 4px;margin:0 4px;display:inline-block;">
                            = <span id="ret-area">${(m * 100 * 5).toFixed(0)} cm²</span>
                        </div>`;
                    ge('ret-h')?.addEventListener('input', e => {
                        const a = parseFloat(e.target.value) || 5;
                        const el = ge('ret-area'); if (el) el.textContent = (m * 100 * a).toFixed(0) + ' cm²';
                    });
                } else {
                    mlp.innerHTML = '<p style="color:#64748b;font-size:.85em">Importá una forma para medir.</p>';
                }
            }
        },

        _pathML(obj) {
            if (!scalePxPerCm) return { cm: 0, m: 0, px: 0 };
            let d = '';
            if (obj.type === 'path' && obj.path) d = obj.path.map(c => c.join(' ')).join(' ');
            else { const m = obj.toSVG?.().match(/d="([^"]+)"/); if (m) d = m[1]; }
            if (!d || !/^[Mm]/.test(d.trim())) return { cm: 0, m: 0, px: 0 };
            const NS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(NS, 'svg');
            const el = document.createElementNS(NS, 'path');
            el.setAttribute('d', d);
            el.setAttribute('transform', `scale(${obj.scaleX ?? 1},${obj.scaleY ?? 1})`);
            svg.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none';
            svg.appendChild(el); document.body.appendChild(svg);
            let lpx = 0; try { lpx = el.getTotalLength(); } catch (_) { }
            document.body.removeChild(svg);
            const lcm = lpx / scalePxPerCm;
            return { cm: +lcm.toFixed(1), m: +(lcm / 100).toFixed(2), px: lpx };
        },

        // ─── Canvas Events ────────────────────────────────────
        hookCanvasEvents() {
            canvas.on('path:created', e => {
                if (!canvas.isDrawingMode) return;
                e.path.set({ customType: 'letter', fill: 'rgba(200,200,200,0.05)', stroke: 'rgba(99,102,241,0.4)', strokeWidth: 1.5, id: 'p_' + Date.now() });
                this.saveState(); this.recalcAll(); this.updateLayersPanel();
                if (confirm('Forma dibujada. ¿Poblar con LEDs?')) this.populatePath(e.path);
            });

            canvas.on('object:modified', () => { this.recalcAll(); this.saveState(); this.updateLayersPanel(); });
            canvas.on('object:added', e => { if (!isBulk && !e.target?.excludeFromExport) { this.recalcAll(); if (!isBulk) this.saveState(); this.updateLayersPanel(); } });
            canvas.on('object:removed', () => { if (!isBulk) { this.recalcAll(); this.saveState(); this.updateLayersPanel(); } });
            canvas.on('object:moving', e => {
                const target = e.target;
                if (target && (target.customType === 'power-supply' || target.customType === 'led-module')) {
                    this.actualizarRutasDeAlimentacion();
                    if (target.customType === 'led-module') {
                        this.actualizarCableadoInterno();
                    }
                    canvas.renderAll();
                }
            });

            canvas.on('selection:created', e => {
                this.updateLayersPanel();
                const o = e.selected?.[0], btn = document.getElementById('btn-populate-sel');
                if (btn) {
                    const isL = o?.customType === 'letter';
                    btn.style.display = isL ? 'block' : 'none';
                }
            });
            canvas.on('selection:cleared', () => {
                this.updateLayersPanel();
                const btn = document.getElementById('btn-populate-sel');
                if (btn) { btn.style.display = 'none'; }
            });

            canvas.on('mouse:down', o => {
                if (this.currentTool === 'edit-leds' && !o.target) {
                    const pointer = canvas.getPointer(o.e);
                    let parentId = null;
                    const letters = canvas.getObjects().filter(ob => ob.customType === 'letter');
                    for (let letter of letters) {
                        if (letter.containsPoint(pointer)) {
                            parentId = letter.id;
                            break;
                        }
                    }
                    this.crearLed(pointer.x, pointer.y, 0, parentId);
                    this.recalcAll();
                    this.saveState();
                    return;
                }

                if (!drawMode) return;
                drawStart = canvas.getPointer(o.e);
                const com = { fill: 'rgba(200,200,200,0.05)', stroke: 'rgba(99,102,241,0.4)', strokeWidth: 1.5, customType: 'letter', id: 's_' + Date.now() };
                if (drawMode === 'rect') {
                    canvas.add(new fabric.Rect({ ...com, left: drawStart.x, top: drawStart.y, width: 1, height: 1 }));
                } else {
                    canvas.add(new fabric.Ellipse({ ...com, left: drawStart.x, top: drawStart.y, rx: 1, ry: 1, originX: 'center', originY: 'center' }));
                }
                canvas.setActiveObject(canvas.getObjects()[canvas.getObjects().length - 1]);
            });
            canvas.on('mouse:move', o => {
                const p = canvas.getPointer(o.e);
                const el = document.getElementById('status-cursor');
                if (el && scalePxPerCm > 0) {
                    const zoom = canvas.getZoom() || 1;
                    const scale = scalePxPerCm / zoom;
                    el.textContent = `${(p.x / scale).toFixed(1)}cm, ${(p.y / scale).toFixed(1)}cm`;
                }

                if (!drawMode || !drawStart) return;
                const pt = p, obj = canvas.getActiveObject();
                if (!obj) return;
                if (drawMode === 'rect') {
                    if (pt.x < drawStart.x) obj.set({ left: pt.x });
                    if (pt.y < drawStart.y) obj.set({ top: pt.y });
                    obj.set({ width: Math.abs(pt.x - drawStart.x), height: Math.abs(pt.y - drawStart.y) });
                } else {
                    obj.set({ rx: Math.abs(pt.x - drawStart.x), ry: Math.abs(pt.y - drawStart.y) });
                }
                canvas.renderAll();
            });
            canvas.on('mouse:up', () => {
                if (drawMode && drawStart) {
                    drawMode = null; drawStart = null; canvas.defaultCursor = 'default'; canvas.selection = true;
                    this._activateTool('select'); this.saveState(); this.recalcAll();
                    if (confirm('Forma creada. ¿Poblar con LEDs?')) { const obj = canvas.getActiveObject(); if (obj) this.populatePath(obj); }
                }
            });

            canvas.on('mouse:wheel', opt => {
                let z = canvas.getZoom() * (0.999 ** opt.e.deltaY);
                z = Math.min(20, Math.max(0.02, z));
                canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
                opt.e.preventDefault(); opt.e.stopPropagation();
                const el = document.getElementById('status-zoom');
                if (el) el.textContent = `Zoom: ${Math.round(z * 100)}%`;
            });

            let pan = false, lpt = null;
            canvas.on('mouse:down', o => { if (o.e.altKey || o.e.button === 1) { pan = true; lpt = { x: o.e.clientX, y: o.e.clientY }; canvas.defaultCursor = 'grabbing'; } });
            canvas.on('mouse:move', o => { if (pan && lpt) { canvas.relativePan({ x: o.e.clientX - lpt.x, y: o.e.clientY - lpt.y }); lpt = { x: o.e.clientX, y: o.e.clientY }; } });
            canvas.on('mouse:up', () => { pan = false; lpt = null; if (!drawMode) canvas.defaultCursor = 'default'; });
        },

        hookKeyboard() {
            document.addEventListener('keydown', e => {
                if (e.target.matches('input,textarea,select')) return;
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); this.undo(); }
                if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) { e.preventDefault(); this.redo(); }
                if (e.key === 'f' || e.key === 'F') this.fitScreen();
                if (e.key === 'v' || e.key === 'V') { this._activateTool('select'); this.setTool('select'); }
                if (e.key === 'l' || e.key === 'L') { this._activateTool('edit-leds'); this.setTool('edit-leds'); }
                if (e.key === 'r' || e.key === 'R') { this._activateTool('rect'); this.setTool('rect'); }
                if (e.key === 'e' || e.key === 'E') { this._activateTool('ellipse'); this.setTool('ellipse'); }
                if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
            });
        },

        saveState() {
            if (loadingState) return;
            const j = JSON.stringify(canvas.toJSON(['customType', 'letterLabel', 'parentId', 'id', 'excludeFromExport', 'powerCapacity', 'powerLoad', 'name']));
            if (undoStack.length && undoStack[undoStack.length - 1] === j) return;
            undoStack.push(j);
            if (undoStack.length > 20) undoStack.shift();
            redoStack = [];
        },
        undo() {
            if (undoStack.length <= 1) return;
            loadingState = true;
            redoStack.push(undoStack.pop());
            canvas.loadFromJSON(undoStack[undoStack.length - 1], () => { canvas.renderAll(); this.recalcAll(); this.updateLayersPanel(); loadingState = false; });
        },
        redo() {
            if (!redoStack.length) return;
            loadingState = true;
            const n = redoStack.pop(); undoStack.push(n);
            canvas.loadFromJSON(n, () => { canvas.renderAll(); this.recalcAll(); this.updateLayersPanel(); loadingState = false; });
        },

        // ─── Library ──────────────────────────────────────────
        async saveToLibrary(nombre, tags = []) {
            const thumb = canvas.toDataURL({ format: 'png', quality: 0.3, multiplier: 0.4 });
            const json = canvas.toJSON(['customType', 'letterLabel', 'parentId', 'id', 'excludeFromExport', 'powerCapacity', 'powerLoad', 'name']);
            const mods = canvas.getObjects().filter(o => o.customType === 'led-module').length;
            try {
                const r = await fetch('/api/led-library', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('mr_token') },
                    body: JSON.stringify({ nombre, tags, thumbnail: thumb, canvasJSON: json, stats: { modules: mods, config: cfg } })
                });
                if (!r.ok) throw 0;
                alert('✅ Guardado!');
            } catch { alert('❌ Error al guardar.'); }
        },
        async loadFromLibrary(id) {
            try {
                const r = await fetch(`/api/led-library/${id}`, { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('mr_token') } });
                const e = await r.json();
                canvas.loadFromJSON(e.canvasJSON, () => { this.recalcAll(); this.updateLayersPanel(); this.fitScreen(); canvas.renderAll(); });
            } catch { alert('❌ Error al cargar.'); }
        },
        loadAndClose(id) { document.getElementById('lib-modal')?.remove(); this.loadFromLibrary(id); },
        promptSave() { const n = prompt('Nombre:'); if (n?.trim()) this.saveToLibrary(n.trim()); },
        async showLibrary() {
            try {
                const r = await fetch('/api/led-library', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('mr_token') } });
                const items = await r.json();
                document.getElementById('lib-modal')?.remove();
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="lib-modal" class="modal active" style="display:flex;align-items:center;justify-content:center">
                        <div class="modal-content" style="max-width:780px;width:90%">
                            <div class="modal-header">
                                <h2 class="modal-title">📚 Librería LED</h2>
                                <button class="btn-close" onclick="document.getElementById('lib-modal').remove()">×</button>
                            </div>
                            <div class="modal-body">
                                <div style="display:flex;gap:10px;margin-bottom:12px">
                                    <input id="lib-q" class="form-input" placeholder="Buscar...">
                                    <button class="btn btn-primary" onclick="lw.promptSave()">💾 Guardar actual</button>
                                </div>
                                <div id="lib-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;max-height:400px;overflow-y:auto">
                                    ${items.length ? items.map(i => `
                                        <div class="lib-item" onclick="lw.loadAndClose('${i.id}')"
                                            style="cursor:pointer;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,0.05)"
                                            onmouseover="this.style.borderColor='#4f46e5'" onmouseout="this.style.borderColor='#e2e8f0'">
                                            <img src="${i.thumbnail}" style="width:100%;height:85px;object-fit:contain;background:#f1f5f9">
                                            <div style="padding:7px">
                                                <div style="font-weight:600;font-size:.82em;color:#1e293b;">${i.nombre}</div>
                                                <div style="color:#64748b;font-size:.72em">${i.stats?.modules ?? '?'} módulos</div>
                                            </div>
                                        </div>`).join('')
                        : '<p style="color:#64748b;text-align:center;grid-column:1/-1">Sin diseños guardados.</p>'}
                                </div>
                            </div>
                        </div>
                    </div>`);
                document.getElementById('lib-q')?.addEventListener('input', e => {
                    const q = e.target.value.toLowerCase();
                    document.querySelectorAll('.lib-item').forEach(el => { el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none'; });
                });
            } catch { alert('❌ Error cargando librería.'); }
        },

        // ─── Export ───────────────────────────────────────────
        showExportMenu() {
            document.getElementById('exp-modal')?.remove();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="exp-modal" class="modal active" style="display:flex;align-items:center;justify-content:center">
                    <div class="modal-content" style="max-width:300px">
                        <div class="modal-header">
                            <h2 class="modal-title">📤 Exportar</h2>
                            <button class="btn-close" onclick="document.getElementById('exp-modal').remove()">×</button>
                        </div>
                        <div class="modal-body" style="display:flex;flex-direction:column;gap:8px">
                            <button class="btn btn-primary"   onclick="lw.exportPNG();document.getElementById('exp-modal').remove()"><i class="fas fa-image"></i> PNG alta resolución</button>
                            <button class="btn btn-secondary" onclick="lw.exportSVG();document.getElementById('exp-modal').remove()"><i class="fas fa-vector-square"></i> SVG vectorial</button>
                            <button class="btn btn-secondary" onclick="lw.exportReport();document.getElementById('exp-modal').remove()"><i class="fas fa-file-alt"></i> Reporte técnico</button>
                        </div>
                    </div>
                </div>`);
        },

        _bbox(objs) {
            if (!objs?.length) return { left: 0, top: 0, width: 0, height: 0 };
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            objs.forEach(o => { const b = o.getBoundingRect(true, true); x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.left + b.width); y1 = Math.max(y1, b.top + b.height); });
            return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
        },

        _titleBlock() {
            const mods = canvas.getObjects().filter(o => o.customType === 'led-module').length;
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            const objs = canvas.getObjects().filter(o => !o.excludeFromExport && o.customType !== 'title-block');
            if (!objs.length) return null;
            const b = this._bbox(objs), tw = Math.max(b.width, 480);
            const wCm = +(b.width / scalePxPerCm).toFixed(1), hCm = +(b.height / scalePxPerCm).toFixed(1);
            const ml = letters.reduce((s, p) => s + this._pathML(p).m, 0).toFixed(2);
            const tw2 = (mods * (cfg.watt || 0)).toFixed(1);
            const bg = new fabric.Rect({ width: tw, height: 110, fill: '#fff', stroke: '#333', strokeWidth: 1.5, left: 0, top: 0 });
            const t1 = new fabric.Text('MR LETREROS — PLANO TÉCNICO LED', { fontSize: 15, left: 10, top: 8, fontFamily: 'Arial', fontWeight: 'bold', fill: '#111' });
            const t2 = new fabric.Text(`Fecha: ${new Date().toLocaleDateString('es-AR')}\nCliente: _____________\nTrabajo: _____________`, { fontSize: 11, left: 10, top: 32, fontFamily: 'Arial', fill: '#333', lineHeight: 1.5 });
            const t3 = new fabric.Text(`Módulo: ${cfg.preset || '—'} ${cfg.modW}×${cfg.modH}cm\nMódulos: ${mods}  Potencia: ${tw2}W\n${wCm}×${hCm}cm  ML: ${ml}m`, { fontSize: 11, left: Math.round(tw * 0.53), top: 10, fontFamily: 'Arial', fill: '#333', lineHeight: 1.6 });
            const g = new fabric.Group([bg, t1, t2, t3], { left: b.left, top: b.top + b.height + 28, selectable: false, customType: 'title-block' });
            canvas.add(g); return g;
        },
        _expBounds() {
            const o = canvas.getObjects().filter(o => !o.excludeFromExport);
            if (!o.length) return { left: 0, top: 0, width: canvas.getWidth(), height: canvas.getHeight() };
            const b = this._bbox(o); return { left: b.left - 28, top: b.top - 28, width: b.width + 56, height: b.height + 56 };
        },
        exportPNG() {
            const tb = this._titleBlock(); canvas.renderAll();
            const url = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2, ...this._expBounds() });
            if (tb) canvas.remove(tb);
            const a = document.createElement('a'); a.download = `led-${Date.now()}.png`; a.href = url; a.click();
        },
        exportSVG() {
            const tb = this._titleBlock(); canvas.renderAll();
            const bd = this._expBounds();
            const sv = canvas.toSVG({ viewBox: { x: bd.left, y: bd.top, width: bd.width, height: bd.height } });
            if (tb) canvas.remove(tb);
            const a = document.createElement('a'); a.download = `led-${Date.now()}.svg`;
            a.href = URL.createObjectURL(new Blob([sv], { type: 'image/svg+xml' })); a.click();
        },
        exportReport() {
            const mods = canvas.getObjects().filter(o => o.customType === 'led-module').length;
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            const neonPaths = canvas.getObjects().filter(o => o.customType === 'neon-path' && !o.isNeonInner);
            const isNeon = cfg.preset && /neon/i.test(cfg.preset);
            const bbox = this._bbox(letters);
            const wCm = +(bbox.width / scalePxPerCm).toFixed(1), hCm = +(bbox.height / scalePxPerCm).toFixed(1);
            const ml = letters.reduce((s, p) => s + this._pathML(p).m, 0).toFixed(2);

            let totalM = 0;
            if (isNeon && neonPaths.length > 0) {
                neonPaths.forEach(np => { totalM += this._pathML(np).m; });
            }
            totalM = +totalM.toFixed(2);

            const consumoW = isNeon ? +(totalM * (cfg.watt_m || 10)).toFixed(1) : +(mods * (cfg.watt || 0)).toFixed(1);

            const supplies = canvas.getObjects().filter(o => o.customType === 'power-supply');
            let suppliesRow = '';
            if (supplies.length > 0) {
                const listStr = supplies.map((s, i) => {
                    const cap = s.powerCapacity || 100;
                    const load = s.powerLoad || 0;
                    const pct = cap > 0 ? (load / cap) * 100 : 0;
                    const status = pct > 80 ? '⚠️ SOBRECARGADA (Excede 80%)' : 'OK';
                    return `Fuente #${i + 1} (${cap}W): Carga ${load.toFixed(0)}W (${pct.toFixed(0)}%) - ${status}`;
                }).join('<br>');
                suppliesRow = `<tr><td>Fuentes Colocadas</td><td>${listStr}</td></tr>`;
            } else {
                const genericW = consumoW * 1.20;
                const sup = Math.ceil(genericW / (cfg.supplyW || 100));
                suppliesRow = `<tr><td>Fuentes (Estimado)</td><td>${sup} × ${cfg.supplyW || 100}W</td></tr>`;
            }

            const w = window.open('', '_blank');
            if (!w) return;
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte LED - MR Letreros</title>
<style>body{font-family:Arial,sans-serif;padding:28px;max-width:720px;margin:0 auto}h1{color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:6px}
table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#1d4ed8;color:#fff;padding:9px 12px;text-align:left}
td{padding:8px 12px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f8fafc}.big{font-size:1.3rem;font-weight:700;color:#1d4ed8}</style></head><body>
<h1>💡 Plano Técnico LED — MR Letreros</h1>
<p><b>Fecha:</b> ${new Date().toLocaleDateString('es-AR')} &nbsp;|&nbsp; <b>Tecnología:</b> ${isNeon ? 'Neon Flex' : 'Módulos LED'}</p>
<table>
<tr><th colspan=2>Dimensiones del Diseño</th></tr>
<tr><td>Ancho</td><td>${wCm} cm</td></tr><tr><td>Alto</td><td>${hCm} cm</td></tr>
${isNeon ? `
<tr><th colspan=2>Especificaciones Neon Flex</th></tr>
<tr><td>Preset</td><td>${cfg.preset || '—'}</td></tr>
<tr><td>Metros Lineales</td><td class=big>${totalM} m</td></tr>
<tr><td>Consumo Estimado</td><td class=big>${consumoW} W</td></tr>
` : `
<tr><th colspan=2>Módulos LED</th></tr>
<tr><td>Tipo</td><td>${cfg.preset || '—'}</td></tr>
<tr><td>Dimensión</td><td>${cfg.modW}×${cfg.modH} cm</td></tr>
<tr><td>Paso</td><td>${cfg.stepX} cm c/c</td></tr>
<tr><td>Sep. filas</td><td>${cfg.stepY} cm</td></tr>
<tr><td>Cantidad</td><td class=big>${mods}</td></tr>
<tr><td>Potencia Total</td><td class=big>${consumoW} W</td></tr>
`}
${suppliesRow}
<tr><th colspan=2>Perímetros y Contornos</th></tr>
<tr><td>Perímetro</td><td class=big>${ml} m</td></tr>
<tr><td>+10% margen</td><td>${(parseFloat(ml) * 1.1).toFixed(2)} m</td></tr>
</table>
<p style="color:#9ca3af;font-size:.8em">MR Letreros — Calculadora LED</p></body></html>`);
            w.document.close(); setTimeout(() => w.print(), 350);
        },

        // ─── Métodos del Panel de Capas ──────────────────────
        updateLayersPanel() {
            const panel = document.getElementById('layers-panel');
            if (!panel) return;
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            if (!letters.length) {
                panel.innerHTML = '<p style="color:#64748b;font-size:.8rem;margin:0">Sin capas detectadas</p>';
                return;
            }
            panel.innerHTML = letters.map((obj, idx) => {
                const id = obj.id || `layer_${idx}`;
                const name = obj.type === 'text' || obj.type === 'i-text'
                    ? `Texto: "${obj.text.substring(0, 10)}..."`
                    : `${obj.type.toUpperCase()} #${idx + 1}`;
                const visible = obj.visible;
                const active = canvas.getActiveObject() === obj;

                return `
                <div class="layer-item ${active ? 'active' : ''}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;margin-bottom:4px;background:${active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)'};border:1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.05)'};border-radius:6px;font-size:.8rem;color:${active ? '#ffffff' : '#d1d5db'}">
                    <span onclick="lw.selectLayer('${id}')" style="cursor:pointer;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;" title="Seleccionar">${name}</span>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <button onclick="lw.toggleLayerVisibility('${id}')" style="background:none;border:none;color:${visible ? '#3b82f6' : '#64748b'};cursor:pointer;padding:2px 4px;display:flex;align-items:center;justify-content:center;" title="Mostrar/Ocultar">
                            <i class="fas ${visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                        </button>
                        <button onclick="lw.deleteLayer('${id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px 4px;display:flex;align-items:center;justify-content:center;" title="Eliminar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>`;
            }).join('');
        },
        selectLayer(id) {
            const obj = canvas.getObjects().find(o => o.id === id);
            if (obj) {
                canvas.setActiveObject(obj);
                canvas.renderAll();
                this.updateLayersPanel();
            }
        },
        toggleLayerVisibility(id) {
            const obj = canvas.getObjects().find(o => o.id === id);
            if (obj) {
                const visible = !obj.visible;
                obj.set({ visible });

                // Ocultar/mostrar hijos
                canvas.getObjects().forEach(o => {
                    if (o.parentId === id) {
                        o.set({ visible });
                    }
                });

                canvas.renderAll();
                this.updateLayersPanel();
                this.recalcAll();
            }
        },
        deleteLayer(id) {
            const obj = canvas.getObjects().find(o => o.id === id);
            if (obj) {
                // Eliminar hijos
                canvas.getObjects().filter(o => o.parentId === id).forEach(o => canvas.remove(o));
                canvas.remove(obj);
                canvas.discardActiveObject();
                canvas.renderAll();
                this.updateLayersPanel();
                this.recalcAll();
                this.saveState();
            }
        },

        _rebuildFuenteReferences(group) {
            if (!group || !group._objects) return;
            group.bgBox = group._objects.find(o => o.name === 'bgBox');
            group.labelPot = group._objects.find(o => o.name === 'labelPot');
            group.labelLoad = group._objects.find(o => o.name === 'labelLoad');
        },

        crearFuente(pot, x, y, id = null) {
            const fid = id || 'ps_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

            // Background metal box - dark slate & premium green border
            const bgBox = new fabric.Rect({
                left: -70,
                top: -35,
                width: 140,
                height: 70,
                rx: 8,
                ry: 8,
                fill: '#1e293b',
                stroke: '#10b981',
                strokeWidth: 3,
                name: 'bgBox',
                shadow: new fabric.Shadow({ color: '#10b981', blur: 6, offsetX: 0, offsetY: 0 })
            });

            // Fan circle
            const fanCircle = new fabric.Circle({
                radius: 18,
                fill: '#0f172a',
                stroke: '#334155',
                strokeWidth: 1.5,
                left: -60,
                top: -18,
                name: 'fanCircle'
            });

            // Fan blades
            const fanLine1 = new fabric.Line([-42, -18, -42, 18], { stroke: '#334155', strokeWidth: 1, name: 'fanLine1' });
            const fanLine2 = new fabric.Line([-60, 0, -24, 0], { stroke: '#334155', strokeWidth: 1, name: 'fanLine2' });

            // Labels
            const labelTitle = new fabric.Text('PWR SUPPLY', {
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                fill: '#94a3b8',
                left: -10,
                top: -22,
                name: 'labelTitle'
            });

            const labelPot = new fabric.Text(`${pot}W`, {
                fontSize: 14,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                fill: '#f8fafc',
                left: -10,
                top: -10,
                name: 'labelPot'
            });

            const labelLoad = new fabric.Text('Carg: 0W (0%)', {
                fontSize: 10,
                fontFamily: 'monospace',
                fill: '#34d399',
                left: -10,
                top: 10,
                name: 'labelLoad'
            });

            const group = new fabric.Group([bgBox, fanCircle, fanLine1, fanLine2, labelTitle, labelPot, labelLoad], {
                left: x,
                top: y,
                originX: 'center',
                originY: 'center',
                selectable: true,
                hasControls: false,
                customType: 'power-supply',
                powerCapacity: pot,
                powerLoad: 0,
                id: fid
            });

            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.renderAll();
            return group;
        },

        agregarFuenteCanvasInteractive() {
            const pot = parseInt(document.getElementById('c-supply')?.value) || 100;
            const v = canvas.getViewportTransform();
            const x = (canvas.getWidth() / 2 - v[4]) / v[0];
            const y = (canvas.getHeight() / 2 - v[5]) / v[3];
            this.crearFuente(pot, x, y);
            this.recalcAll();
            this.saveState();
        },

        updateFuenteStats(group, currentWatts) {
            this._rebuildFuenteReferences(group);
            const capacity = group.powerCapacity || 100;
            group.powerLoad = currentWatts;
            const pct = capacity > 0 ? (currentWatts / capacity) * 100 : 0;

            if (group.labelLoad) {
                if (pct > 80) {
                    group.labelLoad.set({
                        text: `⚠️ Carg: ${currentWatts.toFixed(0)}W (${pct.toFixed(0)}%)`,
                        fill: '#ef4444'
                    });
                } else {
                    group.labelLoad.set({
                        text: `Carg: ${currentWatts.toFixed(0)}W (${pct.toFixed(0)}%)`,
                        fill: '#34d399'
                    });
                }
            }

            if (group.bgBox) {
                if (pct > 80) {
                    group.bgBox.set({
                        stroke: '#ef4444',
                        shadow: new fabric.Shadow({ color: '#ef4444', blur: 10, offsetX: 0, offsetY: 0 })
                    });
                } else {
                    group.bgBox.set({
                        stroke: '#10b981',
                        shadow: new fabric.Shadow({ color: '#10b981', blur: 6, offsetX: 0, offsetY: 0 })
                    });
                }
            }
            group.dirty = true;
        },

        actualizarCableadoInterno() {
            if (isBulk) return;
            isBulk = true;
            try {
                const prevWires = canvas.getObjects().filter(o => o.customType === 'wire-line');
                prevWires.forEach(w => canvas.remove(w));

                const mods = canvas.getObjects().filter(o => o.customType === 'led-module');
                if (!mods.length) return;

                const modsByParent = {};
                mods.forEach(m => {
                    if (!m.parentId) return;
                    if (!modsByParent[m.parentId]) modsByParent[m.parentId] = [];
                    modsByParent[m.parentId].push(m);
                });

                Object.keys(modsByParent).forEach(parentId => {
                    const letterMods = modsByParent[parentId];
                    if (letterMods.length < 2) return;

                    const unvisited = [...letterMods];
                    const chain = [];
                    let current = unvisited.shift();
                    chain.push(current);

                    while (unvisited.length > 0) {
                        let nearestIdx = -1;
                        let minDist = Infinity;
                        const curCenter = current.getCenterPoint();

                        for (let i = 0; i < unvisited.length; i++) {
                            const candCenter = unvisited[i].getCenterPoint();
                            const dx = candCenter.x - curCenter.x;
                            const dy = candCenter.y - curCenter.y;
                            const dist = dx * dx + dy * dy;
                            if (dist < minDist) {
                                minDist = dist;
                                nearestIdx = i;
                            }
                        }

                        if (nearestIdx !== -1) {
                            current = unvisited.splice(nearestIdx, 1)[0];
                            chain.push(current);
                        } else {
                            break;
                        }
                    }

                    for (let i = 0; i < chain.length - 1; i++) {
                        const p1 = chain[i].getCenterPoint();
                        const p2 = chain[i + 1].getCenterPoint();

                        const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
                            stroke: '#3b82f6', // Color azul visible
                            strokeWidth: 2,
                            selectable: false,
                            evented: false,
                            customType: 'wire-line',
                            parentId: parentId,
                            excludeFromExport: true
                        });
                        canvas.add(line);
                    }
                });
            } finally {
                isBulk = false;
            }
            this.ordenarCapasCanvas();
        },

        actualizarRutasDeAlimentacion() {
            if (isBulk) return;
            isBulk = true;
            try {
                const prevPowers = canvas.getObjects().filter(o => o.customType === 'power-line');
                prevPowers.forEach(p => canvas.remove(p));

                const supplies = canvas.getObjects().filter(o => o.customType === 'power-supply');
                const mods = canvas.getObjects().filter(o => o.customType === 'led-module');
                const neonPaths = canvas.getObjects().filter(o => o.customType === 'neon-path' && !o.isNeonInner);
                const isNeon = cfg.preset && /neon/i.test(cfg.preset);

                supplies.forEach(s => {
                    s.powerLoad = 0;
                });

                if (isNeon && neonPaths.length > 0) {
                    neonPaths.forEach(np => {
                        const parentId = np.parentId;
                        const npCenter = np.getCenterPoint();
                        const m = this._pathML(np).m;
                        const wattM = cfg.watt_m || 10;
                        const pathWatts = m * wattM;

                        if (!supplies.length) return;

                        let nearestSupply = null;
                        let minDist = Infinity;

                        supplies.forEach(s => {
                            const supplyCenter = s.getCenterPoint();
                            const dx = supplyCenter.x - npCenter.x;
                            const dy = supplyCenter.y - npCenter.y;
                            const dist = dx * dx + dy * dy;
                            if (dist < minDist) {
                                minDist = dist;
                                nearestSupply = s;
                            }
                        });

                        if (nearestSupply) {
                            nearestSupply.powerLoad = (nearestSupply.powerLoad || 0) + pathWatts;
                            const sc = nearestSupply.getCenterPoint();

                            const powerLine = new fabric.Line([sc.x, sc.y, npCenter.x, npCenter.y], {
                                stroke: '#ef4444',
                                strokeWidth: 2,
                                strokeDashArray: [6, 4],
                                selectable: false,
                                evented: false,
                                customType: 'power-line',
                                parentId: parentId,
                                excludeFromExport: true
                            });
                            canvas.add(powerLine);
                        }
                    });
                } else if (mods.length > 0) {
                    const modsByParent = {};
                    mods.forEach(m => {
                        if (!m.parentId) return;
                        if (!modsByParent[m.parentId]) modsByParent[m.parentId] = [];
                        modsByParent[m.parentId].push(m);
                    });

                    Object.keys(modsByParent).forEach(parentId => {
                        const letterMods = modsByParent[parentId];
                        if (!letterMods.length) return;

                        const letterWatts = letterMods.length * (cfg.watt || 0);
                        if (!supplies.length) return;

                        const startMod = letterMods[0];
                        const modCenter = startMod.getCenterPoint();

                        let nearestSupply = null;
                        let minDist = Infinity;

                        supplies.forEach(s => {
                            const supplyCenter = s.getCenterPoint();
                            const dx = supplyCenter.x - modCenter.x;
                            const dy = supplyCenter.y - modCenter.y;
                            const dist = dx * dx + dy * dy;
                            if (dist < minDist) {
                                minDist = dist;
                                nearestSupply = s;
                            }
                        });

                        if (nearestSupply) {
                            nearestSupply.powerLoad = (nearestSupply.powerLoad || 0) + letterWatts;
                            const sc = nearestSupply.getCenterPoint();
                            const mc = startMod.getCenterPoint();

                            const powerLine = new fabric.Line([sc.x, sc.y, mc.x, mc.y], {
                                stroke: '#ef4444',
                                strokeWidth: 2,
                                strokeDashArray: [6, 4],
                                selectable: false,
                                evented: false,
                                customType: 'power-line',
                                parentId: parentId,
                                excludeFromExport: true
                            });
                            canvas.add(powerLine);
                        }
                    });
                }

                supplies.forEach(s => {
                    this.updateFuenteStats(s, s.powerLoad || 0);
                });
            } finally {
                isBulk = false;
            }
            this.ordenarCapasCanvas();
        },

        ordenarCapasCanvas() {
            const objs = canvas.getObjects();
            const letters = [];
            const neons = [];
            const auras = [];
            const wires = [];
            const powers = [];
            const modules = [];
            const supplies = [];
            const others = [];

            objs.forEach(o => {
                if (o.customType === 'letter') letters.push(o);
                else if (o.customType === 'neon-path') neons.push(o);
                else if (o.customType === 'led-aura') auras.push(o);
                else if (o.customType === 'wire-line') wires.push(o);
                else if (o.customType === 'power-line') powers.push(o);
                else if (o.customType === 'led-module') modules.push(o);
                else if (o.customType === 'power-supply') supplies.push(o);
                else others.push(o);
            });

            isBulk = true;
            canvas._objects = [...letters, ...neons, ...auras, ...wires, ...powers, ...modules, ...others, ...supplies];
            isBulk = false;
        }
    };

    document.addEventListener('DOMContentLoaded', () => lw.init());
    window.lw = lw;
    window.ledWizard = lw;
    window.calculadoraLed = lw;
    window.canvas = canvas;

})();
