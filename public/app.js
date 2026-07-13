window.addEventListener('load', () => {
  const canvas = document.getElementById('canvas');
  paper.setup(canvas);

  let originalPaths = []; 
  let clonesGroup = new paper.Group();

  document.getElementById('fileInput').addEventListener('change', loadSVG);
  document.getElementById('processBtn').addEventListener('click', processPaths);

  function loadSVG(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      paper.project.clear();
      originalPaths = [];
      clonesGroup = new paper.Group();
      
      console.log("Archivo cargado, importando SVG...");

      paper.project.importSVG(reader.result, {
        expandShapes: true,
        insert: true,
        onLoad: (item) => {
          console.log("SVG Importado con éxito");
          extractPaths(item);
          console.log("Curvas encontradas:", originalPaths.length);
          
          item.fitBounds(paper.view.bounds.scale(0.8));
          paper.view.update();
        }
      });
    };
    reader.readAsText(file);
  }

  function extractPaths(item) {
    // Si es un grupo, entramos en sus hijos
    if (item.children) {
      for (let i = 0; i < item.children.length; i++) {
        extractPaths(item.children[i]);
      }
    } 
    // Si es una curva (Path) o curva compuesta (CompoundPath)
    else if (item instanceof paper.Path || item instanceof paper.CompoundPath) {
      item.strokeColor = '#00ff88'; 
      item.strokeWidth = 2;
      originalPaths.push(item);
    }
  }

  function processPaths() {
    console.log("Botón Procesar clicado");
    
    if (originalPaths.length === 0) {
      alert("No hay curvas cargadas para procesar.");
      return;
    }

    // Limpiar clones previos
    clonesGroup.removeChildren();

    const passes = parseInt(document.getElementById('passes').value) || 1;
    const spacing = parseFloat(document.getElementById('spacing').value) || 0;

    let totalLengthPoints = 0;

    originalPaths.forEach((path, index) => {
      totalLengthPoints += path.length;

      for (let i = 1; i < passes; i++) {
        const clone = path.clone();
        // Desplazamiento hacia abajo (Eje Y)
        clone.translate(new paper.Point(0, i * spacing));
        clone.strokeColor = '#ff3366';
        clone.strokeWidth = 1;
        clonesGroup.addChild(clone);
        totalLengthPoints += path.length;
      }
    });

    console.log("Proceso terminado. Longitud total:", totalLengthPoints);

    // Actualizar metros (dividir por 1000 asumiendo unidades de dibujo)
    const totalMetros = totalLengthPoints / 1000;
    document.getElementById('result').innerText = `Metros: ${totalMetros.toFixed(2)} m`;
    
    // Forzar redibujado
    paper.view.draw(); 
  }
});
