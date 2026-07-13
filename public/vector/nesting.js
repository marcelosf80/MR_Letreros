<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CNC Nesting Pro - Optimizador de Corte</title>
    <style>
        :root {
            --primary: #51CF66;
            --bg: #1a1a1a;
            --panel: rgba(255, 255, 255, 0.05);
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg);
            color: white;
            padding: 20px;
            margin: 0;
        }
        h1 { color: var(--primary); border-bottom: 2px solid #333; padding-bottom: 10px; }
        
        .layout { display: flex; gap: 20px; flex-wrap: wrap; }
        
        /* Panel de Control */
        .controls {
            flex: 1;
            min-width: 300px;
            background: var(--panel);
            padding: 20px;
            border-radius: 8px;
            height: fit-content;
        }
        
        label { display: block; margin-top: 15px; font-weight: bold; font-size: 0.9em; color: #ccc; }
        input[type="number"], input[type="file"] {
            width: 100%;
            padding: 10px;
            margin-top: 5px;
            background: #333;
            border: 1px solid #555;
            color: white;
            border-radius: 4px;
        }
        
        button {
            background: var(--primary);
            color: black;
            border: none;
            padding: 15px;
            width: 100%;
            margin-top: 25px;
            font-weight: bold;
            font-size: 1.1em;
            cursor: pointer;
            border-radius: 4px;
            transition: 0.3s;
        }
        button:hover { background: #40c057; transform: translateY(-2px); }

        /* Área de Resultados */
        .results-area {
            flex: 2;
            min-width: 300px;
        }

        .stats {
            background: #333;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            font-family: monospace;
        }

        canvas {
            background: white;
            border-radius: 4px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            max-width: 100%;
            height: auto;
        }

        /* Utilidad oculta para procesar SVG */
        #hiddenSvgContainer {
            position: absolute;
            top: -9999px;
            visibility: hidden;
        }
    </style>
</head>
<body>

    <h1>🚀 Optimizador de Corte CNC (Nesting con Rotación)</h1>

    <div class="layout">
        <!-- Panel Izquierdo: Configuración -->
        <div class="controls">
            <h3>⚙️ Configuración</h3>
            
            <label>📂 Archivo SVG (Corel/Illustrator)</label>
            <input type="file" id="fileInput" accept=".svg">
            <p style="font-size: 0.8em; color: #888; margin-top:5px;">
                *Tip: Desagrupa las letras en Corel si quieres que se muevan individualmente.
            </p>

            <label>📏 Ancho de Placa (mm)</label>
            <input type="number" id="sheetWidth" value="1200">

            <label>📏 Alto de Placa (mm)</label>
            <input type="number" id="sheetHeight" value="600">

            <label>✂️ Separación entre piezas (mm)</label>
            <input type="number" id="gap" value="5">

            <label>
                <input type="checkbox" id="allowRotation" checked style="width:auto;"> 
                Permitir Rotación (90°)
            </label>

            <button id="btnProcess">🧩 OPTIMIZAR (NESTING)</button>
            <div id="statusMsg" style="margin-top:15px; color: var(--primary);"></div>
        </div>

        <!-- Panel Derecho: Visualización -->
        <div class="results-area">
            <h3>📦 Resultado:</h3>
            <div class="stats" id="statsBar">Esperando procesamiento...</div>
            <canvas id="resultCanvas"></canvas>
        </div>
    </div>

    <!-- Contenedor invisible para análisis -->
    <div id="hiddenSvgContainer"></div>

    <!-- Lógica separada -->
    <script src="nesting.js"></script>
</body>
</html>