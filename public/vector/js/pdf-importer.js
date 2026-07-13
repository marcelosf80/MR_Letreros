/*
   pdf-importer.js - Lógica para importar y convertir PDF a SVG
   NOTA: Esta es una implementación básica. Solo convierte trazados (líneas, curvas).
   No soporta colores complejos, gradientes, texto o imágenes incrustadas en el PDF.
   Los trazados se exportarán con un relleno y borde negro por defecto.
*/

// Asegurarse de que pdf.js está cargado.
// Se recomienda incluirlo en el HTML.

async function processPdf(file) {
    if (typeof pdfjsLib === 'undefined') {
        const msg = 'La librería PDF.js no está cargada. Agrega los scripts a tu HTML.';
        alert(msg);
        throw new Error("pdf.js is not loaded");
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;

    // Procesamos solo la primera página
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });

    const opList = await page.getOperatorList();
    const svg_paths = [];
    let current_path = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];

        switch (fn) {
            case pdfjsLib.OPS.moveTo:
                current_path.push(`M ${args[0].toFixed(3)} ${ (viewport.height - args[1]).toFixed(3) }`);
                break;
            case pdfjsLib.OPS.lineTo:
                current_path.push(`L ${args[0].toFixed(3)} ${ (viewport.height - args[1]).toFixed(3) }`);
                break;
            case pdfjsLib.OPS.curveTo:
                current_path.push(`C ${args[0].toFixed(3)} ${(viewport.height - args[1]).toFixed(3)} ${args[2].toFixed(3)} ${(viewport.height - args[3]).toFixed(3)} ${args[4].toFixed(3)} ${(viewport.height - args[5]).toFixed(3)}`);
                break;
            case pdfjsLib.OPS.closePath:
                current_path.push('Z');
                break;
            case pdfjsLib.OPS.stroke:
            case pdfjsLib.OPS.fill:
            case pdfjsLib.OPS.fillAndStroke:
                if (current_path.length > 0) {
                    const fill = (fn === pdfjsLib.OPS.stroke) ? 'none' : '#000000';
                    const stroke = (fn === pdfjsLib.OPS.fill) ? 'none' : '#000000';
                    svg_paths.push(`<path d="${current_path.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
                    current_path = [];
                }
                break;
        }
    }

    const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}">`;
    const svgFooter = `</svg>`;
    return `${svgHeader}\n${svg_paths.join('\n')}\n${svgFooter}`;
}