// public/js/led-wizard/led-wizard-main.js  — v2.0
// ─────────────────────────────────────────────────────────────
//  CAMBIOS vs versión anterior:
//  ✅ Módulos como CÁPSULAS reales (rect redondeado horizontal)
//  ✅ Dimensiones físicas reales por preset (cm → px con escala)
//  ✅ Seleccionás un path → botón "Poblar seleccionado"
//  ✅ Catálogo de módulos con todas sus medidas
//  ✅ Panel izquierdo muestra herramientas de dibujo siempre
//  ✅ Auto-zoom (F o botón) centrado en el contenido
//  ✅ Pan con Alt+arrastrar
//  ✅ Re-poblar todo al cambiar preset
// ─────────────────────────────────────────────────────────────
(function () {
    'use strict';

    if (!localStorage.getItem('mr_token')) {
        window.location.href = 'login.html';
        return;
    }

    // ══════════════════════════════════════════════════════════
    //  CATÁLOGO DE MÓDULOS
    //  Todas las medidas en centímetros reales
    // ══════════════════════════════════════════════════════════
    const CATALOG = {
        'WMO-008 (estándar)': {
            modW: 3.2,   // largo del módulo
            modH: 1.0,   // alto del módulo
            stepX: 3.9,  // paso horizontal centro a centro
            stepY: 2.6,  // paso vertical entre filas
            margin: 1.1, // margen mínimo al borde de la letra
            watt: 0.72,
            color: '#FDE68A',   // amarillo cálido
            stroke: '#B45309',
            label: 'Estándar 12V — letras 20-60cm',
        },
        'WMO-006 Mini': {
            modW: 2.4, modH: 0.75, stepX: 2.9, stepY: 1.9, margin: 0.8,
            watt: 0.36, color: '#FEF9C3', stroke: '#92400E',
            label: 'Mini 12V — letras <25cm',
        },
        'WMO-012 High Power': {
            modW: 4.8, modH: 1.4, stepX: 5.6, stepY: 3.6, margin: 1.8,
            watt: 1.44, color: '#E0F2FE', stroke: '#0369A1',
            label: 'High Power 24V — letras >60cm',
        },
        'Flex Tira 5050': {
            modW: 1.4, modH: 0.7, stepX: 1.67, stepY: 1.2, margin: 0.5,
            watt: 0.24, color: '#DDD6FE', stroke: '#7C3AED',
            label: 'Tira 5050 60led/m — gabinetes',
        },
        'RGB Multicolor': {
            modW: 3.0, modH: 1.0, stepX: 3.7, stepY: 2.5, margin: 1.1,
            watt: 0.72, color: '#A7F3D0', stroke: '#065F46',
            label: 'RGB 12V — efectos de color',
        },
        'Custom': {
            modW: 3.2, modH: 1.0, stepX: 3.9, stepY: 2.6, margin: 1.1,
            watt: 0.72, color: '#93C5FD', stroke: '#1D4ED8',
            label: 'Personalizado',
        },
    };

    const SUPPLY_W   = [30, 60, 100, 150, 200, 350];
    const DERATING   = 0.8;
    let scalePxPerCm = 10;       // px por cm — se actualiza al importar
    let cfg          = {};       // configuración actual del módulo
    let isBulk       = false;
    let undoStack    = [];
    let redoStack    = [];
    let loadingState = false;
    let drawMode     = null;     // 'rect' | 'ellipse' | null
    let drawStart    = null;

    // ── Canvas Fabric ────────────────────────────────────────
    const canvas = new fabric.Canvas('led-canvas', {
        backgroundColor:        '#141624',
        selection:              true,
        preserveObjectStacking: true,
        renderOnAddRemove:      false,
    });

    // ════════════════════════════════════════════════════════
    //  INIT
    // ════════════════════════════════════════════════════════
    const lw = {

        init() {
            this.resizeCanvas();
            this.drawGrid();
            this.buildConfigPanel();
            this.buildDrawingPanel();
            this.hookToolbar();
            this.hookCanvasEvents();
            this.hookKeyboard();
            this.loadPreset(Object.keys(CATALOG)[0]);
            this.recalcAll();
            this.saveState();
            console.log('✅ LED Wizard v2.0 — módulos reales');
        },

        resizeCanvas() {
            const wrap = document.querySelector('.canvas-container');
            if (!wrap) return;
            const fit = () => { canvas.setWidth(wrap.clientWidth); canvas.setHeight(wrap.clientHeight); canvas.renderAll(); };
            fit();
            window.addEventListener('resize', fit);
        },

        drawGrid() {
            const wrap = document.querySelector('.canvas-container');
            if (wrap) {
                wrap.style.backgroundImage =
                    'linear-gradient(rgba(99,102,241,0.07) 1px,transparent 1px),' +
                    'linear-gradient(90deg,rgba(99,102,241,0.07) 1px,transparent 1px)';
                wrap.style.backgroundSize = '20px 20px';
            }
        },

        // ══════════════════════════════════════════════════
        //  PANEL DERECHO — Configuración
        // ══════════════════════════════════════════════════
        buildConfigPanel() {
            const p = document.getElementById('config-panel');
            if (!p) return;

            const opts = Object.entries(CATALOG)
                .map(([k, v]) => `<option value="${k}">${k}</option>`).join('');

            p.innerHTML = `
            <!-- Preset -->
            <div class="form-group">
                <label class="form-label">Módulo LED</label>
                <select id="c-preset" class="form-select">${opts}</select>
                <small id="c-label" style="color:#6366f1;font-size:.77em;display:block;margin-top:3px"></small>
            </div>

            <!-- Dimensiones -->
            <div style="background:#1e2236;border-radius:8px;padding:10px;margin-bottom:10px;">
                <div style="font-size:.72em;color:#6366f1;font-weight:700;letter-spacing:.05em;margin-bottom:8px">
                    DIMENSIONES DEL MÓDULO (cm)
                </div>
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
                        <label class="form-label" style="font-size:.73em">Paso ↔</label>
                        <input id="c-stepx"  type="number" class="form-input" step="0.1" min="0.5">
                        <small style="color:#444;font-size:.68em">centro a centro horiz.</small>
                    </div>
                    <div>
                        <label class="form-label" style="font-size:.73em">Sep. filas ↕</label>
                        <input id="c-stepy"  type="number" class="form-input" step="0.1" min="0.5">
                        <small style="color:#444;font-size:.68em">centro a centro vert.</small>
                    </div>
                    <div style="grid-column:1/-1">
                        <label class="form-label" style="font-size:.73em">Margen al borde (cm)</label>
                        <input id="c-margin" type="number" class="form-input" step="0.1" min="0">
                    </div>
                </div>
            </div>

            <!-- Watts y fuente -->
            <div class="form-group">
                <label class="form-label">Watts por módulo</label>
                <input id="c-watt" type="number" class="form-input" step="0.01" min="0.01">
            </div>
            <div class="form-group">
                <label class="form-label">Fuente (W)</label>
                <select id="c-supply" class="form-select">
                    ${SUPPLY_W.map(w => `<option value="${w}"${w===100?' selected':''}>${w}W</option>`).join('')}
                </select>
            </div>

            <!-- Escala real -->
            <div style="background:#1e2236;border-radius:8px;padding:10px;margin-bottom:10px;">
                <div style="font-size:.72em;color:#6366f1;font-weight:700;letter-spacing:.05em;margin-bottom:6px">
                    ESCALA
                </div>
                <label class="form-label" style="font-size:.73em">Alto real del diseño (cm)</label>
                <div style="display:flex;gap:6px;align-items:center">
                    <input id="c-realh" type="number" class="form-input" placeholder="Ej: 45" min="1" style="flex:1">
                    <button class="btn btn-secondary" style="padding:6px 10px;font-size:.8em" onclick="lw.applyScale()">✓</button>
                </div>
                <small style="color:#444;font-size:.68em">Escala actual: <span id="c-scale-val">${scalePxPerCm.toFixed(1)}</span> px/cm</small>
            </div>

            <!-- Acciones -->
            <div style="display:flex;gap:5px;margin-bottom:6px">
                <button class="btn btn-secondary" style="flex:1" onclick="lw.undo()" title="Ctrl+Z"><i class="fas fa-undo"></i></button>
                <button class="btn btn-secondary" style="flex:1" onclick="lw.redo()" title="Ctrl+Y"><i class="fas fa-redo"></i></button>
                <button class="btn btn-secondary" style="flex:1" onclick="lw.fitScreen()" title="F"><i class="fas fa-compress-alt"></i></button>
            </div>
            <button id="btn-populate-sel" class="btn btn-primary" style="width:100%;margin-bottom:6px" onclick="lw.populateSelected()">
                <i class="fas fa-bolt"></i> Poblar seleccionado
            </button>
            <button class="btn btn-secondary" style="width:100%" onclick="lw.repopulateAll()">
                <i class="fas fa-sync"></i> Re-poblar todo
            </button>
            `;

            // Cambio de preset → cargar valores
            document.getElementById('c-preset').addEventListener('change', e => this.loadPreset(e.target.value));

            // Cambio manual de cualquier input → actualizar cfg (no re-pobla sólo)
            ['c-modw','c-modh','c-stepx','c-stepy','c-margin','c-watt','c-supply']
                .forEach(id => document.getElementById(id)?.addEventListener('change', () => this.readConfig()));
        },

        loadPreset(name) {
            const m = CATALOG[name] || CATALOG['WMO-008 (estándar)'];
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            set('c-preset', name);
            set('c-modw',   m.modW);
            set('c-modh',   m.modH);
            set('c-stepx',  m.stepX);
            set('c-stepy',  m.stepY);
            set('c-margin', m.margin);
            set('c-watt',   m.watt);
            const lbl = document.getElementById('c-label');
            if (lbl) lbl.textContent = m.label;
            this.readConfig();
        },

        readConfig() {
            const g = id => parseFloat(document.getElementById(id)?.value) || 0;
            const preset = document.getElementById('c-preset')?.value || '';
            const m = CATALOG[preset] || CATALOG['WMO-008 (estándar)'];
            cfg = {
                preset,
                modW:        g('c-modw')   || m.modW,
                modH:        g('c-modh')   || m.modH,
                stepX:       g('c-stepx')  || m.stepX,
                stepY:       g('c-stepy')  || m.stepY,
                margin:      g('c-margin') || m.margin,
                watt:        g('c-watt')   || m.watt,
                supplyW:     parseInt(document.getElementById('c-supply')?.value) || 100,
                color:       m.color,
                stroke:      m.stroke,
            };
            this.recalcAll();
        },

        applyScale() {
            const h = parseFloat(document.getElementById('c-realh')?.value);
            if (!h || h <= 0) { alert('Ingresá un alto válido en cm'); return; }
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            if (!letters.length) { alert('No hay formas en el canvas. Importá un SVG primero.'); return; }
            const bbox = this._bbox(letters);
            if (bbox.height > 0) {
                scalePxPerCm = bbox.height / h;
                const el = document.getElementById('c-scale-val');
                if (el) el.textContent = scalePxPerCm.toFixed(1);
                this.recalcAll();
            }
        },

        // ══════════════════════════════════════════════════
        //  PANEL IZQUIERDO — Herramientas de dibujo
        // ══════════════════════════════════════════════════
        buildDrawingPanel() {
            const p = document.getElementById('drawing-tools');
            if (!p) return;

            const tools = [
                { key: 'select',  icon: 'fa-mouse-pointer', title: 'Seleccionar (V)',    fn: () => this.setTool('select') },
                { key: 'pencil',  icon: 'fa-pencil-alt',    title: 'Dibujar libre (P)',  fn: () => this.setTool('pencil') },
                { key: 'rect',    icon: 'fa-square',        title: 'Rectángulo (R)',      fn: () => this.setTool('rect') },
                { key: 'ellipse', icon: 'fa-circle',        title: 'Elipse (E)',          fn: () => this.setTool('ellipse') },
                { key: 'text',    icon: 'fa-font',          title: 'Texto (T)',           fn: () => this.setTool('text') },
                { key: 'delete',  icon: 'fa-trash',         title: 'Eliminar (Del)',      fn: () => this.deleteSelected() },
            ];

            p.innerHTML = '';
            tools.forEach(t => {
                const btn = document.createElement('button');
                btn.id        = 'tool-' + t.key;
                btn.className = 'btn btn-secondary btn-sm';
                btn.title     = t.title;
                btn.innerHTML = `<i class="fas ${t.icon}"></i>`;
                btn.style.cssText = 'min-width:36px;padding:7px 9px;margin:2px';
                btn.onclick = () => { this._activateTool(t.key); t.fn(); };
                p.appendChild(btn);
            });

            this._activateTool('select');
        },

        _activateTool(key) {
            document.querySelectorAll('[id^="tool-"]').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById('tool-' + key);
            if (btn) {
                btn.classList.add('active');
                btn.style.borderColor = '#6366f1';
            }
            document.querySelectorAll('[id^="tool-"]').forEach(b => {
                if (b.id !== 'tool-' + key) b.style.borderColor = '';
            });
        },

        setTool(tool) {
            drawMode   = null;
            drawStart  = null;
            canvas.isDrawingMode = false;
            canvas.selection     = false;
            canvas.defaultCursor = 'default';

            if (tool === 'select') {
                canvas.selection     = true;
                canvas.defaultCursor = 'default';
            } else if (tool === 'pencil') {
                canvas.isDrawingMode = true;
                const b = new fabric.PencilBrush(canvas);
                b.width = 2;
                b.color = 'rgba(255,255,255,0.2)';
                canvas.freeDrawingBrush = b;
            } else if (tool === 'rect' || tool === 'ellipse') {
                drawMode             = tool;
                canvas.defaultCursor = 'crosshair';
            } else if (tool === 'text') {
                const t = new fabric.IText('Texto', {
                    left: 150, top: 150, fill: '#fff', fontSize: 20,
                    customType: 'letter', id: 'txt_' + Date.now(),
                });
                canvas.add(t);
                canvas.setActiveObject(t);
                t.enterEditing();
                canvas.renderAll();
            }
        },

        deleteSelected() {
            const sel = canvas.getActiveObjects();
            if (!sel.length) return;
            // Si elimina una letra, también eliminar sus módulos
            sel.forEach(obj => {
                if (obj.customType === 'letter') {
                    canvas.getObjects()
                        .filter(o => o.customType === 'led-module' && o.parentId === obj.id)
                        .forEach(m => canvas.remove(m));
                }
                canvas.remove(obj);
            });
            canvas.discardActiveObject();
            canvas.renderAll();
            this.saveState();
        },

        // ══════════════════════════════════════════════════
        //  TOOLBAR SUPERIOR
        // ══════════════════════════════════════════════════
        hookToolbar() {
            const impBtn  = document.getElementById('btn-import');
            const impMenu = document.getElementById('import-menu');
            if (impBtn && impMenu) {
                impBtn.addEventListener('click', e => { e.stopPropagation(); impMenu.classList.toggle('show'); });
                document.addEventListener('click', () => impMenu.classList.remove('show'));
                document.getElementById('import-from-upload')?.addEventListener('click', e => { e.preventDefault(); this.importFile(); });
                document.getElementById('import-from-vectorizer')?.addEventListener('click', e => { e.preventDefault(); this.importVectorizer(); });
            }
            document.getElementById('btn-draw')?.addEventListener('click',    () => document.getElementById('drawing-tools')?.scrollIntoView({ behavior: 'smooth' }));
            document.getElementById('btn-scale')?.addEventListener('click',   () => this.showScaleModal());
            document.getElementById('btn-library')?.addEventListener('click', () => this.showLibrary());
            document.getElementById('btn-export')?.addEventListener('click',  () => this.showExportMenu());

            // Botón ajustar vista
            const tg = document.querySelector('.toolbar .tool-group');
            if (tg) {
                const fb = document.createElement('button');
                fb.innerHTML = '<i class="fas fa-compress-alt"></i> Ajustar';
                fb.title     = 'Ajustar zoom — tecla F';
                fb.onclick   = () => this.fitScreen();
                tg.appendChild(fb);
            }
        },

        // ══════════════════════════════════════════════════
        //  POPULATION — NÚCLEO DEL SISTEMA
        //
        //  Cómo funciona:
        //  1. Se calculan filas horizontales dentro del bbox
        //  2. Cada posición se verifica con containsPoint()
        //     usando 3 puntos del módulo (izq, centro, der)
        //  3. Se renderiza una CÁPSULA (Rect con rx/ry grande)
        //     del tamaño real del módulo en px
        // ══════════════════════════════════════════════════
        populatePath(fabricPath) {
            if (!fabricPath) return;

            // Asegurar id único
            if (!fabricPath.id) {
                fabricPath.set({ id: 'path_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) });
            }
            const pid = fabricPath.id;

            // Eliminar módulos anteriores de este path
            isBulk = true;
            canvas.getObjects()
                .filter(o => o.customType === 'led-module' && o.parentId === pid)
                .forEach(o => canvas.remove(o));
            isBulk = false;

            // ── Convertir dimensiones cm → px ─────────────────────
            const spx   = scalePxPerCm;
            const modW  = cfg.modW  * spx;    // largo del módulo en px
            const modH  = cfg.modH  * spx;    // alto del módulo en px
            const stepX = cfg.stepX * spx;    // paso horizontal px
            const stepY = cfg.stepY * spx;    // paso vertical px
            const mar   = cfg.margin * spx;   // margen al borde px

            if (stepX < 1 || stepY < 1 || modW < 1 || modH < 1 || spx < 0.1) {
                console.warn('Configuración inválida:', { cfg, spx });
                return;
            }

            // ── Bounding box del path en coordenadas absolutas ────
            const bbox = fabricPath.getBoundingRect(true, true);
            if (!bbox || bbox.width < modW || bbox.height < modH) {
                console.warn('Path demasiado pequeño para este módulo');
                return;
            }

            // ── Scaneo de filas de arriba a abajo ─────────────────
            //  cy y cx = coordenadas del CENTRO del módulo
            const toAdd = [];
            const yStart = bbox.top  + mar + modH / 2;
            const yEnd   = bbox.top  + bbox.height - mar - modH / 2;
            const xStart = bbox.left + mar + modW / 2;
            const xEnd   = bbox.left + bbox.width  - mar - modW / 2;

            for (let cy = yStart; cy <= yEnd; cy += stepY) {
                for (let cx = xStart; cx <= xEnd; cx += stepX) {
                    // Verificar centro y los dos extremos laterales del módulo
                    try {
                        const okC = fabricPath.containsPoint(new fabric.Point(cx,           cy));
                        const okL = fabricPath.containsPoint(new fabric.Point(cx - modW * 0.38, cy));
                        const okR = fabricPath.containsPoint(new fabric.Point(cx + modW * 0.38, cy));
                        if (okC && okL && okR) toAdd.push({ cx, cy });
                    } catch (_) { /* skip */ }
                }
            }

            if (toAdd.length === 0) {
                this._warnEmpty(cfg, spx);
                canvas.renderAll();
                return;
            }

            // ── Renderizar cápsulas ───────────────────────────────
            //  rx = modH*0.5 hace que los extremos sean semicírculo
            //  → aspecto de módulo LED real (pastilla / cápsula)
            isBulk = true;
            toAdd.forEach(({ cx, cy }) => {
                canvas.add(new fabric.Rect({
                    left:         cx - modW / 2,
                    top:          cy - modH / 2,
                    width:        modW,
                    height:       modH,
                    rx:           modH * 0.50,   // semicírculo en los extremos
                    ry:           modH * 0.50,
                    fill:         cfg.color,
                    stroke:       cfg.stroke,
                    strokeWidth:  Math.max(0.4, modH * 0.07),
                    opacity:      0.88,
                    shadow: new fabric.Shadow({
                        color:   cfg.color + '70',
                        blur:    Math.max(2, modH * 0.6),
                        offsetX: 0, offsetY: 0,
                    }),
                    customType: 'led-module',
                    parentId:   pid,
                    selectable: false,
                    evented:    false,
                }));
            });
            isBulk = false;

            canvas.renderAll();
            this.saveState();
            this.recalcAll();
            console.log(`✅ ${toAdd.length} módulos "${cfg.preset}" → path ${pid}`);
        },

        // Poblar el path seleccionado actualmente
        populateSelected() {
            const sel = canvas.getActiveObject();
            if (!sel) { alert('Seleccioná una forma en el canvas primero.'); return; }
            if (sel.customType === 'led-module') { alert('Eso es un módulo LED, no una forma de letra.'); return; }

            // Si no tiene customType letter, asignarlo
            if (!sel.customType || sel.customType === 'letter-group') {
                sel.set({ customType: 'letter' });
            }
            this.populatePath(sel);
        },

        repopulateAll() {
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            if (!letters.length) { alert('No hay formas para poblar.'); return; }
            letters.forEach(obj => this.populatePath(obj));
            this.fitScreen();
        },

        _warnEmpty(c, spx) {
            const ml = document.getElementById('ml-curvas-panel');
            if (ml) ml.insertAdjacentHTML('beforeend', `
                <p style="color:#f59e0b;font-size:.8em;margin-top:8px">
                    ⚠️ 0 módulos. Verificá:<br>
                    • Escala: ${spx.toFixed(1)} px/cm<br>
                    • Paso: ${c.stepX}cm = ${(c.stepX*spx).toFixed(0)}px<br>
                    • Ingresá el alto real (cm) y presioná ✓
                </p>`);
        },

        // ══════════════════════════════════════════════════
        //  FIT TO SCREEN
        // ══════════════════════════════════════════════════
        fitScreen() {
            const objs = canvas.getObjects().filter(o => !o.excludeFromExport && o.customType !== 'title-block');
            if (!objs.length) { canvas.setZoom(1); canvas.absolutePan(new fabric.Point(0, 0)); return; }

            const b  = this._bbox(objs);
            const cW = canvas.getWidth(), cH = canvas.getHeight(), pad = 60;
            if (b.width < 1 || b.height < 1) return;

            const z = Math.min((cW - pad * 2) / b.width, (cH - pad * 2) / b.height, 5);
            canvas.setZoom(z);
            canvas.absolutePan(new fabric.Point(
                b.left * z - (cW - b.width  * z) / 2,
                b.top  * z - (cH - b.height * z) / 2
            ));
            const el = document.getElementById('status-zoom');
            if (el) el.textContent = `Zoom: ${Math.round(z * 100)}%`;
            canvas.renderAll();
        },

        // ══════════════════════════════════════════════════
        //  IMPORT SVG
        // ══════════════════════════════════════════════════
        importFile() {
            const inp = document.getElementById('svg-upload');
            inp.value = '';
            inp.onchange = e => {
                const f = e.target.files[0];
                if (!f) return;
                new FileReader().onload = ev => this._loadSVG(ev.target.result);
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

        _loadSVG(svgText) {
            fabric.loadSVGFromString(svgText, (objects, options) => {
                if (!objects?.length) { alert('SVG sin objetos válidos.'); return; }

                // ── Intentar detectar escala desde el SVG ───────────
                try {
                    const doc  = new DOMParser().parseFromString(svgText, 'image/svg+xml');
                    const root = doc.documentElement;
                    const wAttr = root.getAttribute('width') || '';
                    const vbAttr = root.getAttribute('viewBox') || '';
                    if (wAttr && vbAttr) {
                        const mmMatch = wAttr.match(/^([\d.]+)\s*(mm|cm|in)/i);
                        const vbParts = vbAttr.split(/[\s,]+/);
                        if (mmMatch && vbParts.length >= 4) {
                            const realCm = mmMatch[2].toLowerCase() === 'mm'
                                ? parseFloat(mmMatch[1]) / 10
                                : parseFloat(mmMatch[1]);
                            const vbH = parseFloat(vbParts[3]);
                            if (realCm > 0 && vbH > 0) {
                                const groupH = options.height || vbH;
                                scalePxPerCm = groupH / realCm;
                                const el = document.getElementById('c-scale-val');
                                if (el) el.textContent = scalePxPerCm.toFixed(1);
                            }
                        }
                    }
                } catch (_) {}

                const group = fabric.util.groupSVGElements(objects, options);
                group.set({
                    left:        60,
                    top:         60,
                    customType:  'letter-group',
                    id:          'g_' + Date.now(),
                    stroke:      '#6366f1',
                    strokeWidth: 1.5,
                });
                canvas.add(group).setActiveObject(group);
                canvas.renderAll();
                this.fitScreen();
                this._importModal(group);
            });
        },

        _importModal(group) {
            document.getElementById('imp-modal')?.remove();
            const opts = Object.keys(CATALOG).map(k => `<option value="${k}">${k}</option>`).join('');

            document.body.insertAdjacentHTML('beforeend', `
                <div id="imp-modal" class="modal active" style="display:flex;align-items:center;justify-content:center">
                    <div class="modal-content" style="max-width:460px">
                        <div class="modal-header">
                            <h2 class="modal-title">📐 Configurar importación</h2>
                            <button class="btn-close" onclick="document.getElementById('imp-modal').remove()">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label">Alto real del diseño (cm)</label>
                                <input id="imp-h" type="number" class="form-input" placeholder="Ej: 45" min="1" autofocus>
                                <small style="color:#888">Necesario para calcular módulos correctamente. Dejá vacío para mantener escala actual.</small>
                            </div>
                            <div class="form-group" style="margin-top:10px">
                                <label class="form-label">Módulo a usar</label>
                                <select id="imp-preset" class="form-select">${opts}</select>
                            </div>
                            <div style="background:#1e2236;border-radius:6px;padding:8px;margin-top:10px;font-size:.82em;color:#888">
                                💡 Después de importar, podés seleccionar cualquier forma y hacer clic en <strong>"Poblar seleccionado"</strong> para distribuir los módulos LED.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="document.getElementById('imp-modal').remove()">Solo importar</button>
                            <button class="btn btn-primary" id="imp-ok">
                                <i class="fas fa-magic"></i> Importar y poblar
                            </button>
                        </div>
                    </div>
                </div>
            `);

            document.getElementById('imp-ok').onclick = () => {
                const h      = parseFloat(document.getElementById('imp-h').value);
                const preset = document.getElementById('imp-preset').value;

                if (h > 0) {
                    const bbox = group.getBoundingRect(true, true);
                    if (bbox.height > 0) {
                        scalePxPerCm = bbox.height / h;
                        const el = document.getElementById('c-scale-val');
                        if (el) el.textContent = scalePxPerCm.toFixed(1);
                    }
                }

                // Cargar preset
                document.getElementById('c-preset').value = preset;
                this.loadPreset(preset);

                document.getElementById('imp-modal').remove();

                // Desagrupar
                let items = [];
                if (group.type === 'group') {
                    group.toActiveSelection();
                    items = canvas.getActiveObjects().slice();
                    canvas.discardActiveObject();
                } else {
                    items = [group];
                }

                items.forEach(obj => {
                    obj.set({
                        fill:        'rgba(255,255,255,0.05)',
                        stroke:      '#6366f1',
                        strokeWidth: 1.5,
                        customType:  'letter',
                        id:          obj.id || ('path_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
                    });
                });

                canvas.renderAll();

                setTimeout(() => {
                    items.forEach(obj => {
                        if (['path','rect','ellipse','polygon','circle','triangle'].includes(obj.type)) {
                            this.populatePath(obj);
                        }
                    });
                    this.fitScreen();
                    this.saveState();
                }, 100);
            };
        },

        // ══════════════════════════════════════════════════
        //  SCALE MODAL
        // ══════════════════════════════════════════════════
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
            const bbox  = this._bbox(letters);
            const curCm = bbox.height / scalePxPerCm;
            if (curCm < 0.01) return;
            const f = targetCm / curCm;

            letters.forEach(obj => {
                obj.scaleX = (obj.scaleX ?? 1) * f;
                obj.scaleY = (obj.scaleY ?? 1) * f;
                obj.left   = bbox.left + (obj.left - bbox.left) * f;
                obj.top    = bbox.top  + (obj.top  - bbox.top)  * f;
                obj.setCoords();
            });
            scalePxPerCm *= f;
            const el = document.getElementById('c-scale-val');
            if (el) el.textContent = scalePxPerCm.toFixed(1);

            setTimeout(() => {
                letters.forEach(obj => this.populatePath(obj));
                this.fitScreen();
                this.saveState();
            }, 30);
        },

        // ══════════════════════════════════════════════════
        //  STATS / ML DE CURVAS
        // ══════════════════════════════════════════════════
        recalcAll() {
            const letters = canvas.getObjects().filter(o => o.customType === 'letter');
            const modules = canvas.getObjects().filter(o => o.customType === 'led-module');
            const conf    = cfg.watt ? cfg : { watt: 0.72, supplyW: 100 };
            const totalW  = modules.length * conf.watt;
            const sup     = Math.ceil(totalW / ((conf.supplyW || 100) * DERATING)) || 0;
            const bbox    = this._bbox(letters);
            const wCm     = +(bbox.width  / scalePxPerCm).toFixed(1);
            const hCm     = +(bbox.height / scalePxPerCm).toFixed(1);
            const ml      = letters.reduce((s, p) => s + this._pathML(p).m, 0);

            const $  = id => document.getElementById(id);
            if ($('status-modules')) $('status-modules').textContent = `Módulos: ${modules.length}`;
            if ($('status-watts'))   $('status-watts').textContent   = `Watts: ${totalW.toFixed(1)}W`;

            const sp = $('stats-panel');
            if (sp) sp.innerHTML = `
                <p>📐 <b>${wCm} × ${hCm} cm</b></p>
                <p>📦 Área: ${Math.round(wCm * hCm)} cm²</p>
                <hr style="border-color:#333;margin:5px 0">
                <p>💡 Módulos: <b>${modules.length}</b></p>
                <p>⚡ Potencia: <b>${totalW.toFixed(1)} W</b></p>
                <p>🔌 Fuentes: ${sup} × ${conf.supplyW || 100}W</p>
                <hr style="border-color:#333;margin:5px 0">
                <p style="font-size:.78em;color:#666">
                    ${cfg.preset || '—'}<br>
                    ${cfg.modW||'—'}×${cfg.modH||'—'}cm · paso ${cfg.stepX||'—'}cm
                </p>`;

            const mlp = $('ml-curvas-panel');
            if (mlp) {
                if (letters.length) {
                    const m  = +ml.toFixed(2);
                    const m2 = +(m * 1.1).toFixed(2);
                    mlp.innerHTML = `
                        <p>Perímetro: <b>${m} m</b></p>
                        <p>+10% margen: ${m2} m</p>
                        <hr style="border-color:#333;margin:5px 0">
                        <p>💡 Neon flex: ${m} m</p>
                        <p>🔩 Trim cap: ${m} m</p>
                        <div style="margin-top:6px;font-size:.78em;color:#888">
                            Retorno (alto cm):
                            <input id="ret-h" type="number" value="5" min="1"
                                style="width:42px;padding:2px 4px;background:#1e2236;border:1px solid #333;color:#eee;border-radius:4px;margin:0 4px">
                            = <span id="ret-area">${(m*100*5).toFixed(0)} cm²</span>
                        </div>`;
                    $('ret-h')?.addEventListener('input', e => {
                        const a = parseFloat(e.target.value) || 5;
                        const el = $('ret-area');
                        if (el) el.textContent = (m * 100 * a).toFixed(0) + ' cm²';
                    });
                } else {
                    mlp.innerHTML = '<p style="color:#555;font-size:.85em">Importá una forma para medir.</p>';
                }
            }
        },

        _pathML(fabricPath) {
            if (!scalePxPerCm) return { cm: 0, m: 0 };
            let d = '';
            if (fabricPath.type === 'path' && fabricPath.path) {
                d = fabricPath.path.map(c => c.join(' ')).join(' ');
            } else {
                const m = fabricPath.toSVG().match(/d="([^"]+)"/);
                if (m) d = m[1];
            }
            if (!d) return { cm: 0, m: 0 };
            const NS  = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(NS, 'svg');
            const el  = document.createElementNS(NS, 'path');
            el.setAttribute('d', d);
            el.setAttribute('transform', `scale(${fabricPath.scaleX??1},${fabricPath.scaleY??1})`);
            svg.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none';
            svg.appendChild(el);
            document.body.appendChild(svg);
            let lpx = 0; try { lpx = el.getTotalLength(); } catch (_) {}
            document.body.removeChild(svg);
            const lcm = lpx / scalePxPerCm;
            return { cm: +lcm.toFixed(1), m: +(lcm / 100).toFixed(2) };
        },

        // ══════════════════════════════════════════════════
        //  CANVAS EVENTS
        // ══════════════════════════════════════════════════
        hookCanvasEvents() {
            // Path dibujado a mano → es una letra
            canvas.on('path:created', e => {
                if (!canvas.isDrawingMode) return;
                e.path.set({
                    customType: 'letter',
                    fill:       'rgba(255,255,255,0.05)',
                    stroke:     '#6366f1',
                    strokeWidth: 1.5,
                    id:         'p_' + Date.now(),
                });
                this.saveState(); this.recalcAll();
                if (confirm('Forma dibujada. ¿Poblar con LEDs?')) this.populatePath(e.path);
            });

            canvas.on('object:modified', () => { this.recalcAll(); this.saveState(); });
            canvas.on('object:added',    e  => { if (!isBulk && !e.target?.excludeFromExport) { this.recalcAll(); if (!isBulk) this.saveState(); } });
            canvas.on('object:removed',  () => { if (!isBulk) { this.recalcAll(); this.saveState(); } });

            // Selección → highlight del botón "Poblar seleccionado"
            canvas.on('selection:created', e => {
                const obj = e.selected?.[0];
                const btn = document.getElementById('btn-populate-sel');
                if (btn && obj?.customType === 'letter') {
                    btn.style.background = '#22c55e';
                    btn.innerHTML = '<i class="fas fa-bolt"></i> Poblar seleccionado';
                } else if (btn) {
                    btn.style.background = '';
                    btn.innerHTML = '<i class="fas fa-bolt"></i> Poblar seleccionado';
                }
            });
            canvas.on('selection:cleared', () => {
                const btn = document.getElementById('btn-populate-sel');
                if (btn) { btn.style.background = ''; }
            });

            // Dibujo interactivo rect/ellipse
            canvas.on('mouse:down', o => {
                if (!drawMode) return;
                drawStart = canvas.getPointer(o.e);
                const common = {
                    fill: 'rgba(255,255,255,0.05)', stroke: '#6366f1', strokeWidth: 1.5,
                    customType: 'letter', id: 'shape_' + Date.now(),
                };
                if (drawMode === 'rect') {
                    canvas.add(new fabric.Rect({ ...common, left: drawStart.x, top: drawStart.y, width: 1, height: 1 }));
                } else {
                    canvas.add(new fabric.Ellipse({ ...common, left: drawStart.x, top: drawStart.y, rx: 1, ry: 1, originX: 'center', originY: 'center' }));
                }
                canvas.setActiveObject(canvas.getObjects()[canvas.getObjects().length - 1]);
            });
            canvas.on('mouse:move', o => {
                if (!drawMode || !drawStart) return;
                const pt  = canvas.getPointer(o.e);
                const obj = canvas.getActiveObject();
                if (!obj) return;
                if (drawMode === 'rect') {
                    if (pt.x < drawStart.x) obj.set({ left: pt.x });
                    if (pt.y < drawStart.y) obj.set({ top:  pt.y });
                    obj.set({ width: Math.abs(pt.x - drawStart.x), height: Math.abs(pt.y - drawStart.y) });
                } else {
                    obj.set({ rx: Math.abs(pt.x - drawStart.x), ry: Math.abs(pt.y - drawStart.y) });
                }
                canvas.renderAll();
            });
            canvas.on('mouse:up', () => {
                if (drawMode && drawStart) {
                    drawMode = null; drawStart = null;
                    canvas.defaultCursor = 'default';
                    this._activateTool('select');
                    canvas.selection = true;
                    this.saveState();
                    if (confirm('Forma creada. ¿Poblar con LEDs?')) {
                        const obj = canvas.getActiveObject();
                        if (obj) this.populatePath(obj);
                    }
                }
            });

            // Cursor en cm
            canvas.on('mouse:move', opt => {
                const p  = canvas.getPointer(opt.e);
                const el = document.getElementById('status-cursor');
                if (el && scalePxPerCm > 0) {
                    el.textContent = `${(p.x/scalePxPerCm).toFixed(1)}cm, ${(p.y/scalePxPerCm).toFixed(1)}cm`;
                }
            });

            // Zoom rueda
            canvas.on('mouse:wheel', opt => {
                let z = canvas.getZoom() * (0.999 ** opt.e.deltaY);
                z = Math.min(20, Math.max(0.02, z));
                canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
                opt.e.preventDefault(); opt.e.stopPropagation();
                const el = document.getElementById('status-zoom');
                if (el) el.textContent = `Zoom: ${Math.round(z * 100)}%`;
            });

            // Pan Alt+drag
            let pan = false, lpt = null;
            canvas.on('mouse:down', o => { if (o.e.altKey || o.e.button === 1) { pan = true; lpt = { x: o.e.clientX, y: o.e.clientY }; canvas.defaultCursor = 'grabbing'; } });
            canvas.on('mouse:move', o => { if (pan && lpt) { canvas.relativePan({ x: o.e.clientX - lpt.x, y: o.e.clientY - lpt.y }); lpt = { x: o.e.clientX, y: o.e.clientY }; } });
            canvas.on('mouse:up',   () => { pan = false; lpt = null; if (!drawMode) canvas.defaultCursor = 'default'; });
        },

        // ══════════════════════════════════════════════════
        //  KEYBOARD
        // ══════════════════════════════════════════════════
        hookKeyboard() {
            document.addEventListener('keydown', e => {
                if (e.target.matches('input,textarea,select')) return;
                if ((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key==='z') { e.preventDefault(); this.undo(); }
                if ((e.ctrlKey||e.metaKey) && (e.shiftKey && e.key==='z' || e.key==='y')) { e.preventDefault(); this.redo(); }
                if (e.key==='f'||e.key==='F') this.fitScreen();
                if (e.key==='v'||e.key==='V') this.setTool('select');
                if (e.key==='p'||e.key==='P') { this._activateTool('pencil'); this.setTool('pencil'); }
                if (e.key==='r'||e.key==='R') { this._activateTool('rect'); this.setTool('rect'); }
                if (e.key==='e'||e.key==='E') { this._activateTool('ellipse'); this.setTool('ellipse'); }
                if (e.key==='Delete'||e.key==='Backspace') this.deleteSelected();
            });
        },

        // ══════════════════════════════════════════════════
        //  UNDO / REDO
        // ══════════════════════════════════════════════════
        saveState() {
            if (loadingState) return;
            const j = JSON.stringify(canvas.toJSON(['customType','letterLabel','parentId','id','excludeFromExport']));
            if (undoStack.length && undoStack[undoStack.length-1] === j) return;
            undoStack.push(j);
            if (undoStack.length > 20) undoStack.shift();
            redoStack = [];
        },
        undo() {
            if (undoStack.length <= 1) return;
            loadingState = true;
            redoStack.push(undoStack.pop());
            canvas.loadFromJSON(undoStack[undoStack.length-1], () => { canvas.renderAll(); this.recalcAll(); loadingState = false; });
        },
        redo() {
            if (!redoStack.length) return;
            loadingState = true;
            const n = redoStack.pop(); undoStack.push(n);
            canvas.loadFromJSON(n, () => { canvas.renderAll(); this.recalcAll(); loadingState = false; });
        },

        // ══════════════════════════════════════════════════
        //  LIBRARY
        // ══════════════════════════════════════════════════
        async saveToLibrary(nombre, tags=[]) {
            const thumb = canvas.toDataURL({ format:'png', quality:0.3, multiplier:0.4 });
            const json  = canvas.toJSON(['customType','letterLabel','parentId','id']);
            const mods  = canvas.getObjects().filter(o=>o.customType==='led-module').length;
            try {
                const r = await fetch('/api/led-library', {
                    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+localStorage.getItem('mr_token') },
                    body: JSON.stringify({ nombre, tags, thumbnail:thumb, canvasJSON:json, stats:{ modules:mods, config:cfg } })
                });
                if (!r.ok) throw 0;
                alert('✅ Guardado en la librería!');
            } catch { alert('❌ Error al guardar.'); }
        },
        async loadFromLibrary(id) {
            try {
                const r = await fetch(`/api/led-library/${id}`, { headers:{ 'Authorization':'Bearer '+localStorage.getItem('mr_token') } });
                const e = await r.json();
                canvas.loadFromJSON(e.canvasJSON, () => { this.recalcAll(); this.fitScreen(); canvas.renderAll(); });
            } catch { alert('❌ Error al cargar.'); }
        },
        loadAndClose(id) { document.getElementById('lib-modal')?.remove(); this.loadFromLibrary(id); },
        promptSave() { const n=prompt('Nombre:'); if(n?.trim()) this.saveToLibrary(n.trim()); },
        async showLibrary() {
            try {
                const r     = await fetch('/api/led-library',{ headers:{'Authorization':'Bearer '+localStorage.getItem('mr_token')} });
                const items = await r.json();
                document.getElementById('lib-modal')?.remove();
                document.body.insertAdjacentHTML('beforeend',`
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
                                    ${items.length ? items.map(i=>`
                                        <div class="lib-item" onclick="lw.loadAndClose('${i.id}')"
                                            style="cursor:pointer;background:#1e2236;border-radius:8px;overflow:hidden;border:1px solid #333"
                                            onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='#333'">
                                            <img src="${i.thumbnail}" style="width:100%;height:85px;object-fit:contain;background:#141624">
                                            <div style="padding:7px">
                                                <div style="font-weight:600;font-size:.82em">${i.nombre}</div>
                                                <div style="color:#555;font-size:.72em">${i.stats?.modules??'?'} módulos</div>
                                            </div>
                                        </div>`).join('')
                                    : '<p style="color:#555;text-align:center;grid-column:1/-1">Sin diseños guardados.</p>'}
                                </div>
                            </div>
                        </div>
                    </div>`);
                document.getElementById('lib-q')?.addEventListener('input', e => {
                    const q = e.target.value.toLowerCase();
                    document.querySelectorAll('.lib-item').forEach(el => { el.style.display = el.textContent.toLowerCase().includes(q)?'':'none'; });
                });
            } catch { alert('❌ Error cargando librería.'); }
        },

        // ══════════════════════════════════════════════════
        //  EXPORT
        // ══════════════════════════════════════════════════
        showExportMenu() {
            document.getElementById('exp-modal')?.remove();
            document.body.insertAdjacentHTML('beforeend',`
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
            if (!objs?.length) return { left:0, top:0, width:0, height:0 };
            let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
            objs.forEach(o => { const b=o.getBoundingRect(true,true); x0=Math.min(x0,b.left); y0=Math.min(y0,b.top); x1=Math.max(x1,b.left+b.width); y1=Math.max(y1,b.top+b.height); });
            return { left:x0, top:y0, width:x1-x0, height:y1-y0 };
        },

        _titleBlock() {
            const mods   = canvas.getObjects().filter(o=>o.customType==='led-module').length;
            const letters= canvas.getObjects().filter(o=>o.customType==='letter');
            const objs   = canvas.getObjects().filter(o=>!o.excludeFromExport&&o.customType!=='title-block');
            if (!objs.length) return null;
            const b   = this._bbox(objs);
            const tw  = Math.max(b.width, 480);
            const wCm = +(b.width/scalePxPerCm).toFixed(1);
            const hCm = +(b.height/scalePxPerCm).toFixed(1);
            const ml  = letters.reduce((s,p)=>s+this._pathML(p).m,0).toFixed(2);
            const tw2 = (mods*(cfg.watt||0)).toFixed(1);
            const bg  = new fabric.Rect({ width:tw, height:115, fill:'#fff', stroke:'#333', strokeWidth:1.5, left:0, top:0 });
            const t1  = new fabric.Text('MR LETREROS — PLANO TÉCNICO LED', { fontSize:15, left:10, top:8,  fontFamily:'Arial', fontWeight:'bold', fill:'#111' });
            const t2  = new fabric.Text(`Fecha: ${new Date().toLocaleDateString('es-AR')}\nCliente: _____________\nTrabajo: _____________`, { fontSize:11, left:10, top:32, fontFamily:'Arial', fill:'#333', lineHeight:1.5 });
            const t3  = new fabric.Text(`Módulo: ${cfg.preset||'—'} ${cfg.modW}×${cfg.modH}cm\nMódulos: ${mods}  Potencia: ${tw2}W\n${wCm}×${hCm}cm  ML: ${ml}m`, { fontSize:11, left:Math.round(tw*0.53), top:12, fontFamily:'Arial', fill:'#333', lineHeight:1.6 });
            const g   = new fabric.Group([bg,t1,t2,t3], { left:b.left, top:b.top+b.height+28, selectable:false, customType:'title-block' });
            canvas.add(g); return g;
        },
        _expBounds() {
            const o = canvas.getObjects().filter(o=>!o.excludeFromExport);
            if (!o.length) return { left:0, top:0, width:canvas.getWidth(), height:canvas.getHeight() };
            const b = this._bbox(o);
            return { left:b.left-28, top:b.top-28, width:b.width+56, height:b.height+56 };
        },
        exportPNG() {
            const tb=this._titleBlock(); canvas.renderAll();
            const url=canvas.toDataURL({ format:'png', quality:1, multiplier:2, ...this._expBounds() });
            if (tb) canvas.remove(tb);
            const a=document.createElement('a'); a.download=`led-plano-${Date.now()}.png`; a.href=url; a.click();
        },
        exportSVG() {
            const tb=this._titleBlock(); canvas.renderAll();
            const bd=this._expBounds();
            const sv=canvas.toSVG({ viewBox:{ x:bd.left, y:bd.top, width:bd.width, height:bd.height } });
            if (tb) canvas.remove(tb);
            const a=document.createElement('a'); a.download=`led-plano-${Date.now()}.svg`;
            a.href=URL.createObjectURL(new Blob([sv],{type:'image/svg+xml'})); a.click();
        },
        exportReport() {
            const mods   = canvas.getObjects().filter(o=>o.customType==='led-module').length;
            const letters= canvas.getObjects().filter(o=>o.customType==='letter');
            const bbox   = this._bbox(letters);
            const wCm    = +(bbox.width/scalePxPerCm).toFixed(1);
            const hCm    = +(bbox.height/scalePxPerCm).toFixed(1);
            const ml     = letters.reduce((s,p)=>s+this._pathML(p).m,0).toFixed(2);
            const tw     = (mods*(cfg.watt||0)).toFixed(1);
            const sup    = Math.ceil(parseFloat(tw)/((cfg.supplyW||100)*DERATING));
            const w=window.open('','_blank');
            if (!w) return;
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte LED</title>
<style>body{font-family:Arial,sans-serif;padding:28px;max-width:720px;margin:0 auto}
h1{color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:6px}
table{width:100%;border-collapse:collapse;margin:14px 0}
th{background:#1d4ed8;color:#fff;padding:9px 12px;text-align:left}
td{padding:8px 12px;border-bottom:1px solid #e5e7eb}
tr:nth-child(even) td{background:#f8fafc}
.big{font-size:1.3rem;font-weight:700;color:#1d4ed8}</style></head><body>
<h1>💡 Plano Técnico LED — MR Letreros</h1>
<p><b>Fecha:</b> ${new Date().toLocaleDateString('es-AR')} &nbsp;|&nbsp; <b>Módulo:</b> ${cfg.preset||'—'}</p>
<table>
<tr><th colspan=2>Dimensiones</th></tr>
<tr><td>Ancho</td><td>${wCm} cm</td></tr>
<tr><td>Alto</td><td>${hCm} cm</td></tr>
<tr><th colspan=2>Módulos LED</th></tr>
<tr><td>Tipo</td><td>${cfg.preset||'—'}</td></tr>
<tr><td>Dimensión</td><td>${cfg.modW}×${cfg.modH} cm</td></tr>
<tr><td>Paso horizontal</td><td>${cfg.stepX} cm c/c</td></tr>
<tr><td>Sep. filas</td><td>${cfg.stepY} cm</td></tr>
<tr><td>Cantidad total</td><td class=big>${mods}</td></tr>
<tr><td>Potencia total</td><td class=big>${tw} W</td></tr>
<tr><td>Fuentes</td><td>${sup} × ${cfg.supplyW||100}W (derating ${DERATING*100}%)</td></tr>
<tr><th colspan=2>Contorno</th></tr>
<tr><td>Perímetro (neon/trim)</td><td class=big>${ml} m</td></tr>
<tr><td>+10% margen</td><td>${(parseFloat(ml)*1.1).toFixed(2)} m</td></tr>
</table>
<p style="color:#9ca3af;font-size:.8em">MR Letreros — LED Wizard v2.0</p>
</body></html>`);
            w.document.close(); setTimeout(()=>w.print(),350);
        },
    };

    document.addEventListener('DOMContentLoaded', () => lw.init());
    window.lw        = lw;
    window.ledWizard = lw;
    window.canvas    = canvas;

})();
