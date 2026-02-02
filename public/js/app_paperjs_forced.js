window.addEventListener('load', () => {
  const canvas = document.getElementById('canvas');
  paper.setup(canvas);

  let originalPaths = []; 
  let clonesGroup = new paper.Group();
  let nodesGroup = new paper.Group();
  let sheetsGroup = new paper.Group();
  let importedItems = [];
  let rootSVGGroup = null;

  document.getElementById('fileInput').addEventListener('change', loadSVG);
  document.getElementById('processBtn').addEventListener('click', processPaths);
  document.getElementById('nestBtn').addEventListener('click', organizeItems);
  
  const showNodesBtn = document.getElementById('showNodesBtn');
  if (showNodesBtn) {
    showNodesBtn.addEventListener('change', (e) => {
      nodesGroup.visible = e.target.checked;
      if (e.target.checked && nodesGroup.children.length === 0) {
        drawNodes();
      }
    });
  }

  function loadSVG(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      paper.project.clear();
      originalPaths = [];
      clonesGroup = new paper.Group();
      nodesGroup = new paper.Group();
      sheetsGroup = new paper.Group();
      
      console.log("📂 Cargando SVG...");

      paper.project.importSVG(reader.result, {
        expandShapes: true,
        insert: true,
        applyMatrix: true, // CRÍTICO: aplicar transformaciones
        onLoad: (item) => {
          console.log("✅ SVG Importado");
          console.log(`📏 Dimensiones: ${item.bounds.width} x ${item.bounds.height}`);
          
          rootSVGGroup = item;
          
          // Extraer items ANTES de cualquier modificación
          importedItems = [];
          if (item.children && item.children.length > 0) {
            item.children.forEach(child => {
              importedItems.push(child);
            });
          } else {
            importedItems = [item];
          }

          console.log(`🔢 Items detectados: ${importedItems.length}`);

          extractPaths(item);
          console.log(`🎯 Paths encontrados: ${originalPaths.length}`);
          
          if (originalPaths.length === 0) {
            alert("⚠️ El SVG no contiene paths válidos.\nAsegúrate de exportar con 'Texto convertido a curvas'.");
          }

          paper.view.center = item.bounds.center;
          paper.view.draw();
          
          calculateLength();
          
          if (showNodesBtn && showNodesBtn.checked) drawNodes();
        },
        onError: (error) => {
          console.error("❌ Error al cargar SVG:", error);
          alert("Error al cargar el archivo SVG.");
        }
      });
    };
    reader.readAsText(file);
  }

  function extractPaths(item) {
    if (item.children) {
      for (let i = 0; i < item.children.length; i++) {
        extractPaths(item.children[i]);
      }
    } 
    else if (item instanceof paper.Path || item instanceof paper.CompoundPath) {
      originalPaths.push(item);
    }
  }

  function drawNodes() {
    nodesGroup.removeChildren();
    originalPaths.forEach(path => {
      if (path.segments) {
        path.segments.forEach(segment => {
          const circle = new paper.Path.Circle(segment.point, 3);
          circle.fillColor = '#FFC107';
          circle.strokeColor = 'black';
          nodesGroup.addChild(circle);
        });
      }
    });
    nodesGroup.bringToFront();
  }

  function calculateLength() {
    let totalLengthPoints = 0;
    originalPaths.forEach(path => {
      totalLengthPoints += path.length;
    });
    const totalMetros = totalLengthPoints / 1000;
    const resultDiv = document.getElementById('result');
    if(resultDiv) resultDiv.innerText = `Perímetro Total: ${totalMetros.toFixed(2)} m`;
  }

  function processPaths() {
    console.log("Botón Procesar clicado");
    
    if (originalPaths.length === 0) {
      alert("No hay curvas cargadas para procesar.");
      return;
    }

    clonesGroup.removeChildren();

    const passes = parseInt(document.getElementById('passes').value) || 1;
    const spacing = parseFloat(document.getElementById('spacing').value) || 0;

    let totalLengthPoints = 0;

    originalPaths.forEach((path, index) => {
      totalLengthPoints += path.length;

      for (let i = 1; i < passes; i++) {
        const clone = path.clone();
        clone.translate(new paper.Point(0, i * spacing));
        clone.strokeColor = '#ff3366';
        clone.strokeWidth = 1;
        clonesGroup.addChild(clone);
        totalLengthPoints += path.length;
      }
    });

    console.log("Proceso terminado. Longitud total:", totalLengthPoints);

    const totalMetros = totalLengthPoints / 1000;
    document.getElementById('result').innerText = `Metros: ${totalMetros.toFixed(2)} m`;
    
    paper.view.draw(); 
  }

  /**
   * FIX AGRESIVO: Forzar estilos en TODOS los niveles del árbol
   */
  function forceBlackStyle(item) {
    if (item.children) {
      item.children.forEach(child => forceBlackStyle(child));
    }
    
    if (item instanceof paper.Path || item instanceof paper.CompoundPath) {
      // Forzar fill negro + stroke como respaldo
      item.fillColor = new paper.Color(0, 0, 0); // Negro sólido
      item.strokeColor = new paper.Color(0, 0, 0);
      item.strokeWidth = 0.5;
      item.visible = true;
      item.opacity = 1;
    }
  }

  function organizeItems() {
    if (importedItems.length === 0) {
      alert("No hay objetos para organizar. Carga un SVG primero.");
      return;
    }

    console.log("🧩 Iniciando organización...");

    const scaleFactor = 10;
    
    const inputW = parseFloat(document.getElementById('sheetWidth').value);
    const inputH = parseFloat(document.getElementById('sheetHeight').value);
    
    if (isNaN(inputW) || isNaN(inputH) || inputW <= 0 || inputH <= 0) {
      alert("Por favor ingresa medidas válidas para la placa.");
      return;
    }

    const sheetW = inputW * scaleFactor;
    const sheetH = inputH * scaleFactor;
    const margin = parseFloat(document.getElementById('nestingMargin').value);
    const sheetGap = 100;
    const allowRotation = document.getElementById('autoRotateBtn').checked;

    console.log(`📐 Placa: ${sheetW}x${sheetH} (${inputW}x${inputH}cm)`);

    // Ocultar original
    if (rootSVGGroup) {
      rootSVGGroup.visible = false;
    }

    // Limpiar placas anteriores
    if (!sheetsGroup) sheetsGroup = new paper.Group();
    sheetsGroup.removeChildren();

    // Crear copias de trabajo
    const itemsToPlace = importedItems.map((item, idx) => {
      const clone = item.clone({ insert: false, deep: true });
      clone.data = { originalIndex: idx };
      
      // FIX AGRESIVO: Forzar negro en TODO
      forceBlackStyle(clone);
      
      // Insertar en la capa activa
      paper.project.activeLayer.addChild(clone);
      
      console.log(`Item ${idx}: ${clone.bounds.width.toFixed(1)}x${clone.bounds.height.toFixed(1)}, fillColor=${clone.fillColor ? 'YES' : 'NO'}`);
      
      return clone;
    });

    // Ordenar por área
    itemsToPlace.sort((a, b) => b.bounds.area - a.bounds.area);

    const sheets = [];
    let currentSheet = createNewSheet(0, sheetW, sheetH);
    sheets.push(currentSheet);

    itemsToPlace.forEach((item, idx) => {
      let placed = false;

      // Intentar en placas existentes
      for (let sheet of sheets) {
        if (tryPlaceInSheet(item, sheet, sheetW, sheetH, margin, sheetGap)) {
          placed = true;
          console.log(`✓ Item ${idx} colocado en placa ${sheet.id + 1}`);
          break;
        }

        // Intentar rotado
        if (!placed && allowRotation) {
          item.rotate(90);
          if (tryPlaceInSheet(item, sheet, sheetW, sheetH, margin, sheetGap)) {
            placed = true;
            console.log(`✓ Item ${idx} colocado ROTADO en placa ${sheet.id + 1}`);
            break;
          } else {
            item.rotate(-90);
          }
        }
      }

      // Crear nueva placa si no cabe
      if (!placed) {
        let newSheet = createNewSheet(sheets.length, sheetW, sheetH);
        sheets.push(newSheet);

        if (!tryPlaceInSheet(item, newSheet, sheetW, sheetH, margin, sheetGap)) {
          // Intentar rotado en nueva placa
          let placedRotated = false;
          if (allowRotation) {
            item.rotate(90);
            if (tryPlaceInSheet(item, newSheet, sheetW, sheetH, margin, sheetGap)) {
              placedRotated = true;
              console.log(`✓ Item ${idx} colocado ROTADO en placa NUEVA ${newSheet.id + 1}`);
            } else {
              item.rotate(-90);
            }
          }

          if (!placedRotated) {
            console.warn(`⚠️ Item ${idx} NO CABE, forzando colocación`);
            // Forzar colocación
            let xPos = (newSheet.id * (sheetW + sheetGap));
            let yPos = newSheet.currentY;
            item.bounds.topLeft = new paper.Point(xPos, yPos);
            newSheet.currentY += item.bounds.height + margin;
            newSheet.usedArea = (newSheet.usedArea || 0) + item.bounds.area;
            item.data.sheetId = newSheet.id;
          }
        }
      }
    });

    console.log(`📦 Total de placas generadas: ${sheets.length}`);

    // Dibujar placas visualmente
    sheets.forEach((sheet, index) => {
      let rect = new paper.Path.Rectangle(
        new paper.Point(index * (sheetW + sheetGap), 0),
        new paper.Size(sheetW, sheetH)
      );
      rect.strokeColor = '#51CF66';
      rect.strokeWidth = 4;
      rect.dashArray = [10, 5];
      rect.fillColor = new paper.Color(0.31, 0.81, 0.4, 0.15);
      sheetsGroup.addChild(rect);
      
      let text = new paper.PointText(new paper.Point(index * (sheetW + sheetGap) + 10, -10));
      text.content = `Placa ${index + 1} (${(sheetW/10)}x${(sheetH/10)}cm)`;
      text.fillColor = 'black';
      text.fontSize = 20;
      sheetsGroup.addChild(text);

      const usedArea = sheet.usedArea || 0;
      const totalArea = sheetW * sheetH;
      const percentage = ((usedArea / totalArea) * 100).toFixed(1);

      let percentText = new paper.PointText({
        point: rect.bounds.center,
        content: `${percentage}% Ocupado`,
        justification: 'center',
        fillColor: 'black',
        fontSize: 30,
        fontWeight: 'bold',
        visible: false
      });
      sheetsGroup.addChild(percentText);

      rect.onMouseEnter = function() {
        this.fillColor = new paper.Color(0.31, 0.81, 0.4, 0.2);
        percentText.visible = true;
        percentText.bringToFront();
      };
      rect.onMouseLeave = function() {
        this.fillColor = new paper.Color(0.31, 0.81, 0.4, 0.05);
        percentText.visible = false;
      };
    });
    
    sheetsGroup.sendToBack();
    
    // Ajustar vista
    const finalBounds = sheetsGroup.bounds;
    if (finalBounds && finalBounds.width > 0) {
      paper.view.center = finalBounds.center;
      paper.view.zoom = Math.min(
        paper.view.viewSize.width / finalBounds.width,
        paper.view.viewSize.height / finalBounds.height
      ) * 0.9;
    }
    paper.view.draw();

    console.log("🎨 Dibujando canvas...");

    // Generar previsualizaciones
    generateSheetPreviews(sheets, itemsToPlace, sheetW, sheetH, sheetGap);
  }

  function createNewSheet(index, w, h) {
    return { id: index, shelves: [], currentY: 0, usedArea: 0 };
  }

  function tryPlaceInSheet(item, sheet, sheetW, sheetH, margin, sheetGap) {
    // Intentar en estantes existentes
    for (let shelf of sheet.shelves) {
      if (shelf.remainingWidth >= item.bounds.width && item.bounds.height <= shelf.height) {
        let xPos = (sheet.id * (sheetW + sheetGap)) + (sheetW - shelf.remainingWidth);
        let yPos = shelf.y;
        
        item.bounds.topLeft = new paper.Point(xPos, yPos);
        
        shelf.remainingWidth -= (item.bounds.width + margin);
        sheet.usedArea = (sheet.usedArea || 0) + item.bounds.area;
        item.data.sheetId = sheet.id;
        return true;
      }
    }

    // Crear nuevo estante si cabe verticalmente
    if (sheet.currentY + item.bounds.height <= sheetH) {
      let newShelf = {
        y: sheet.currentY,
        height: item.bounds.height,
        remainingWidth: sheetW - item.bounds.width - margin
      };
      
      let xPos = (sheet.id * (sheetW + sheetGap));
      let yPos = sheet.currentY;
      
      item.bounds.topLeft = new paper.Point(xPos, yPos);
      
      sheet.shelves.push(newShelf);
      sheet.currentY += item.bounds.height + margin;
      sheet.usedArea = (sheet.usedArea || 0) + item.bounds.area;
      item.data.sheetId = sheet.id;
      return true;
    }

    return false;
  }

  function generateSheetPreviews(sheets, itemsToPlace, sheetW, sheetH, sheetGap) {
    const container = document.getElementById('sheetsContainer');
    const title = document.getElementById('resultsTitle');
    if (!container) return;
    
    container.innerHTML = '';
    if (title) title.style.display = 'block';

    sheets.forEach(sheet => {
      const exportGroup = new paper.Group();
      
      const bg = new paper.Path.Rectangle({
        point: [0, 0],
        size: [sheetW, sheetH],
        strokeColor: '#51CF66',
        strokeWidth: 4,
        fillColor: null
      });
      exportGroup.addChild(bg);

      const itemsInSheet = itemsToPlace.filter(item => 
        item.data && item.data.sheetId === sheet.id
      );
      
      console.log(`📄 Placa ${sheet.id + 1}: ${itemsInSheet.length} items`);
      
      itemsInSheet.forEach(item => {
        const clone = item.clone({ deep: true });
        
        // FIX AGRESIVO: Re-forzar negro
        forceBlackStyle(clone);
        
        clone.translate(new paper.Point(-(sheet.id * (sheetGap + sheetW)), 0));
        exportGroup.addChild(clone);
      });

      const svg = exportGroup.exportSVG({ asString: false, bounds: 'content' });
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', 'auto');
      svg.setAttribute('viewBox', `0 0 ${sheetW} ${sheetH}`);
      svg.style.backgroundColor = 'white';
      svg.style.borderRadius = '4px';

      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);';
      
      const header = `<div style="display:flex; justify-content:space-between; margin-bottom:10px; color:white;"><strong>Placa ${sheet.id + 1}</strong> <span style="color:#51CF66">${((sheet.usedArea/(sheetW*sheetH))*100).toFixed(1)}% Uso</span></div>`;
      card.innerHTML = header;
      card.appendChild(svg);
      
      container.appendChild(card);
      exportGroup.remove();
    });
  }
});
