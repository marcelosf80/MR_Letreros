// =============== CONFIGURACIÓN ===============
const DRIVE_FOLDER_NAME = "MR_Letreros_Pedidos";

// ID de la planilla objetivo (opcional). Si se deja vacío usa la planilla activa
// (la que tiene el script vinculado).
const TARGET_SPREADSHEET_ID = "";
function getTargetSpreadsheet() {
  try {
    if (TARGET_SPREADSHEET_ID) {
      return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    }
  } catch(e) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Buscar hoja de cálculo sin importar mayúsculas/minúsculas o nombres de pestañas extendidos
function getSheetByNameCaseInsensitive(ss, name) {
  if (!ss) return null;
  const sheets = ss.getSheets();
  const lowerName = name.toLowerCase().trim();
  
  // Coincidencia exacta
  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName().toLowerCase().trim();
    if (sheetName === lowerName) {
      return sheets[i];
    }
  }
  
  // Coincidencia parcial
  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName().toLowerCase().trim();
    if (sheetName.indexOf(lowerName) > -1 || lowerName.indexOf(sheetName) > -1) {
      return sheets[i];
    }
  }
  return null;
}

// =============== CARGAR CATÁLOGO Y STOCK ===============
function getCatalogData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No se pudo acceder a la hoja de cálculo activa. Vinculá este script a tu planilla de Google Sheets.");
  }
  
  // 1. Cargar Stock por Tipo (Hoja STOCK opcional: si existe se lee como fallback)
  const sheetStock = getSheetByNameCaseInsensitive(ss, 'STOCK');
  const stockByType = {};
  if (sheetStock) {
    const data = sheetStock.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const ancho = parseFloat(data[i][0]);
      const estado = data[i][1] ? data[i][1].toString().toLowerCase().trim() : "";
      let tipo = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "general";
      tipo = tipo.replace(/s$/, ""); // "vinilos" -> "vinilo"
      
      if (estado === 'en stock' && !isNaN(ancho) && ancho > 0) {
        if (!stockByType[tipo]) stockByType[tipo] = [];
        stockByType[tipo].push(ancho);
      }
    }
  }

  // 2. Cargar Catálogo (Hoja PRECIOS: A=Cat, B=Prod, C=Precio, D=Unidad, E=Tipo, F=Ancho cm o múltiples anchos)
  const sheetPrecios = getSheetByNameCaseInsensitive(ss, 'PRECIOS');
  const catalogResult = [];
  if (sheetPrecios) {
    const data = sheetPrecios.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0] || !data[i][1]) continue;
      const precio = parseFloat(data[i][2]) || 0;
      let tipo = data[i][4] ? data[i][4].toString().trim().toLowerCase() : "general";
      tipo = tipo.replace(/s$/, ""); // Normalizar también aquí

      // Extraer todas las medidas de stock disponibles para este material específico
      // Soporta:
      // - Columna F con número simple: 134
      // - Columna F con texto de múltiples medidas: "104, 122, 150" o "104/122/150" o "104 122 150"
      // - Múltiples columnas consecutivas (Col F: 104, Col G: 122, Col H: 150...)
      const anchosSet = {};
      for (let col = 5; col < data[i].length; col++) {
        const val = data[i][col];
        if (val === undefined || val === null || val === '') continue;

        if (typeof val === 'number') {
          if (val > 0) anchosSet[val] = true;
        } else {
          const partes = val.toString().split(/[,;/|\s]+/);
          for (let k = 0; k < partes.length; k++) {
            const num = parseFloat(partes[k]);
            if (!isNaN(num) && num > 0) {
              anchosSet[num] = true;
            }
          }
        }
      }

      const anchosStock = Object.keys(anchosSet).map(Number).sort(function(a, b) { return a - b; });
      const anchoFijo = (anchosStock.length === 1) ? anchosStock[0] : null;

      catalogResult.push({
        id: 'p_' + i,
        categoria: data[i][0].toString().trim(),
        producto: data[i][1].toString().trim(),
        precioGremio: precio,
        unidad: (data[i][3] || 'm2').toString().trim(),
        tipo: tipo,
        anchoFijo: anchoFijo,
        anchosStock: anchosStock
      });

      // Si se quita la hoja STOCK, alimentar automáticamente el fallback stockByType por tipo
      if (anchosStock.length > 0 && tipo) {
        if (!stockByType[tipo]) stockByType[tipo] = [];
        anchosStock.forEach(function(ancho) {
          if (stockByType[tipo].indexOf(ancho) === -1) {
            stockByType[tipo].push(ancho);
          }
        });
      }
    }
  }

  // Ordenar cada lista de stock de menor a mayor
  Object.keys(stockByType).forEach(function(key) {
    stockByType[key].sort(function(a, b) { return a - b; });
  });

  return { catalog: catalogResult, stock: stockByType };
}

// =============== RECÁLCULO DE PRECIO EN SERVIDOR (ANTI-MANIPULACIÓN) ===============
// El precio NUNCA se toma del navegador (se puede manipular con el inspector/DevTools):
// se recalcula acá desde la hoja PRECIOS con la MISMA lógica que muestra Index.html.
//
// ⚠️ IMPORTANTE: si cambiás los factores de OPCIONES_POLY en Index.html, actualizá
// también OPCIONES_POLY_SERVER acá abajo.

const OPCIONES_POLY_SERVER = [
  { factor: 1.00 }, // 1.20 x 0.60 m (Placa Completa)
  { factor: 0.88 }, // 1.00 x 0.60 m
  { factor: 0.73 }, // 0.80 x 0.60 m
  { factor: 0.58 }, // 0.60 x 0.60 m (Media Placa)
  { factor: 0.40 }, // 0.40 x 0.60 m
  { factor: 0.21 }  // 0.20 x 0.60 m
];

function fmtPesosApp(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function encontrarProductoApp(catalogo, item) {
  if (!catalogo) return null;
  // 1) Por nombre + categoría (semántico): así no se cobra mal aunque la hoja PRECIOS
  //    haya cambiado de filas entre la carga de la app y el envío del pedido.
  if (item && item.producto) {
    const catBusq = String(item.categoria || '').trim().toLowerCase();
    for (let j = 0; j < catalogo.length; j++) {
      if (String(catalogo[j].producto) === String(item.producto) &&
          (!catBusq || String(catalogo[j].categoria).toLowerCase() === catBusq)) {
        return catalogo[j];
      }
    }
  }
  // 2) Fallback por id de fila (p_N)
  if (item && item.prodId) {
    for (let i = 0; i < catalogo.length; i++) {
      if (String(catalogo[i].id) === String(item.prodId)) return catalogo[i];
    }
  }
  return null;
}

// Réplica fiel de la lógica de calc() de Index.html, pero del lado del servidor.
// Devuelve { sub, error, dim, m2Text, despText } con sub redondeado como mostraba el cliente.
function calcularPrecioApp(prod, it, stockPorTipo) {
  const q = (it && it.q) ? (parseInt(it.q, 10) || 1) : 1;
  const categoria = String(prod.categoria || '').toUpperCase();
  // OJO: comparaciones idénticas a calc() de Index.html (sin normalizar mayúsculas),
  // para que el servidor cobre EXACTAMENTE lo mismo que muestra la app.
  const unidad = String(prod.unidad || '');

  // POLIFAN: precio = precioGremio * factor(opción placa) * cantidad
  if (categoria.indexOf('POLIFAN') > -1) {
    let idx = (it && it.polyIdx !== undefined && it.polyIdx !== null) ? parseInt(it.polyIdx, 10) : 0;
    if (isNaN(idx) || idx < 0 || idx >= OPCIONES_POLY_SERVER.length) idx = 0;
    return { sub: Math.round(prod.precioGremio * OPCIONES_POLY_SERVER[idx].factor * q), error: null, dim: '', m2Text: '', despText: '' };
  }

  // Unidad "m2": lógica de anchos / stock / desperdicio / mínimo 80cm
  if (unidad === 'm2') {
    const w = (it && it.w) ? parseFloat(it.w) : 0;
    const h = (it && it.h) ? parseFloat(it.h) : 0;
    const dem = !!(it && it.dem);
    const wV = dem ? (w + 10) : w;
    let wCob = wV;
    let requiresAcceptance = false;

    const lista = (prod.anchosStock && prod.anchosStock.length > 0)
      ? prod.anchosStock
      : (prod.anchoFijo ? [prod.anchoFijo] : ((stockPorTipo && stockPorTipo[prod.tipo]) || []));

    if (lista.length === 1) {
      const anchoFijo = lista[0];
      if (wV > anchoFijo) {
        return { sub: 0, error: 'El ancho (' + w + 'cm' + (dem ? ' +10cm demasía = ' + wV + 'cm' : '') + ') supera el material disponible de ' + anchoFijo + 'cm (' + prod.producto + ').' };
      }
      if (w > 0) {
        wCob = (anchoFijo - w <= 10) ? w : anchoFijo;
        wCob = Math.max(80, wCob);
      }
    } else if (lista.length > 1) {
      let rollo = null;
      for (let r = 0; r < lista.length; r++) { if (lista[r] >= wV) { rollo = lista[r]; break; } }
      if (rollo) {
        wCob = (rollo - w <= 10) ? w : rollo;
        wCob = Math.max(80, wCob);
        if (wCob > w) requiresAcceptance = true;
      } else if (w > 0) {
        return { sub: 0, error: 'El ancho (' + w + 'cm' + (dem ? ' +10cm demasía = ' + wV + 'cm' : '') + ') no tiene rollo disponible en stock (' + lista.join(', ') + 'cm) para ' + prod.producto + '.' };
      }
    } else {
      wCob = Math.max(80, wV);
    }

    const acceptVisible = requiresAcceptance && w > 0;
    const despEsperar = acceptVisible && it && it.desp === 'esperar';
    const anchoCobro = despEsperar ? wV : wCob;
    const sub = (anchoCobro / 100) * (h / 100) * prod.precioGremio * q;

    let dim = '(' + w + 'x' + h + 'cm)';
    let m2Text = '';
    if (w > 0 && h > 0) m2Text = ' [' + ((w / 100) * (h / 100) * q).toFixed(2) + ' m²]';
    let despText = '';
    if (acceptVisible) despText = despEsperar ? ' [Espera Agrupación - Sin Desperdicio]' : ' [Prioritario - Con Desperdicio]';

    return { sub: Math.round(sub), error: null, dim: dim, m2Text: m2Text, despText: despText };
  }

  // Unidad "ml" (metro lineal)
  if (unidad.indexOf('ml') > -1) {
    const ml = (it && it.ml) ? parseFloat(it.ml) : 0;
    const sub = ml * prod.precioGremio * q;
    return { sub: Math.round(sub), error: null, dim: '(' + ml + 'ml)', m2Text: '', despText: '' };
  }

  // Resto (unidad / pieza)
  return { sub: Math.round(prod.precioGremio * q), error: null, dim: '', m2Text: '', despText: '' };
}

// =============== PROCESAR PEDIDO ===============
function processOrder(jsonString) {
  const order = JSON.parse(jsonString);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- SEGURIDAD DE PRECIOS: recalcular SIEMPRE en el servidor ----
  // El navegador puede manipularse con el inspector, así que el "precio"/"total"
  // que llegue NUNCA se usa tal cual: se recalcula desde la hoja PRECIOS.
  const precioEnviado = Number(order.precio) || Number(order.precioEnviado) || 0;
  if (order.items !== undefined) {
    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new Error('El pedido no tiene ítems para calcular el precio. (Seguridad de precios)');
    }
    const catalogoData = getCatalogData();
    const catalogo = catalogoData.catalog;
    const stockPorTipo = catalogoData.stock;
    const lineas = [];
    let totalServer = 0;

    for (let j = 0; j < order.items.length; j++) {
      const it = order.items[j] || {};
      const prod = encontrarProductoApp(catalogo, it);
      if (!prod) {
        throw new Error('Producto no encontrado en la planilla PRECIOS: "' + (it.producto || it.prodId || '?') +
          '". Si se modificaron los precios hace un momento, volvé a abrir la app e intentá de nuevo. (Seguridad de precios)');
      }
      const calc = calcularPrecioApp(prod, it, stockPorTipo);
      if (calc.error) throw new Error(calc.error);
      lineas.push('ITEM ' + (j + 1) + ': ' + prod.producto + calc.dim + calc.m2Text + ' x' + (parseInt(it.q, 10) || 1) +
        calc.despText + (it.note ? ' | ' + it.note : '') + ' - $' + fmtPesosApp(calc.sub));
      totalServer += calc.sub;
    }

    order.precio = totalServer;
    order.detalles = lineas.join('\n');

    // Avisar si el navegador mandó un total distinto (posible manipulación)
    if (precioEnviado > 0 && Math.round(precioEnviado) !== Math.round(totalServer)) {
      order.detalles += '\n\n⚠️ El total enviado desde el navegador ($' + fmtPesosApp(precioEnviado) +
        ') no coincidía con el precio del sistema ($' + fmtPesosApp(totalServer) +
        '). Se guardó el precio del sistema.';
    }
  }

  var driveUrl = "";
  var subFolder;
  
  try {
    if (order.folderId) {
      subFolder = DriveApp.getFolderById(order.folderId);
      driveUrl = subFolder.getUrl();
    } else {
      var mainFolder;
      var mf = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
      mainFolder = mf.hasNext() ? mf.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
      
      var cn = order.gremio.toString().toUpperCase().replace(/[^A-Z0-9]/gi, '_');
      var cf = mainFolder.getFoldersByName(cn);
      var clientFolder = cf.hasNext() ? cf.next() : mainFolder.createFolder(cn);
      
      var timestamp = Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "yyyy-MM-dd_HH-mm");
      subFolder = clientFolder.createFolder("Pedido_" + timestamp);
      driveUrl = subFolder.getUrl();
    }
    
    if (order.archivos && order.archivos.length > 0) {
      for (var i = 0; i < order.archivos.length; i++) {
        var a = order.archivos[i];
        var d = Utilities.base64Decode(a.base64);
        subFolder.createFile(Utilities.newBlob(d, a.mimeType, a.filename));
      }
    }
    
    // Guardar archivo de texto con los detalles del pedido (recalculados por el sistema)
    if (order.detalles) {
      subFolder.createFile("Instrucciones_Pedido.txt", order.detalles);
    }

    // --- NUEVO: Guardar Layouts del Planner ---
    if (order.plannerLayouts) {
      Object.keys(order.plannerLayouts).forEach(function(key, index) {
        var svgData = order.plannerLayouts[key];
        if (svgData) {
          // Envolver el SVG en un HTML simple para que Google lo convierta a PDF limpiamente
          var htmlContent = '<html><body style="margin:0;padding:0;display:flex;justify-content:center;background:#f8fafc;">' + 
                            '<div style="padding:20px;background:white;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">' +
                            '<h2 style="font-family:sans-serif;color:#334155;margin-bottom:10px;">Distribución Optimizada - Item ' + (index + 1) + '</h2>' +
                            svgData + 
                            '</div></body></html>';
          
          var blob = Utilities.newBlob(htmlContent, 'text/html', 'Layout_' + (index + 1) + '.html');
          var pdfBlob = blob.getAs('application/pdf').setName('Distribucion_Visual_Item_' + (index + 1) + '.pdf');
          subFolder.createFile(pdfBlob);
        }
      });
    }
    
    driveUrl = subFolder.getUrl();
  } catch (err) { driveUrl = "Error Drive: " + err.message; }

  // Guardar en PEDIDOS
  var sp = ss.getSheetByName('PEDIDOS');
  if (!sp) {
    sp = ss.insertSheet('PEDIDOS');
    sp.appendRow(['Fecha','Gremio','Detalle','Precio','Estado','Drive','WhatsApp']);
  }
  var fecha = Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm");
  sp.appendRow([fecha, order.gremio, order.detalles, order.precio, 'Pendiente', driveUrl, order.whatsapp || '']);

  return { success: true, driveUrl: driveUrl, precio: order.precio };
}

// =============== HISTORIAL DE PEDIDOS POR GREMIO ===============
function getGremioHistory(gremioName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PEDIDOS');
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var orders = [];
  var searchName = gremioName.toString().trim().toUpperCase();
  
  for (var i = 1; i < data.length; i++) {
    var rowGremio = data[i][1] ? data[i][1].toString().trim().toUpperCase() : "";
    if (rowGremio !== searchName) continue;
    
    orders.push({
      row: i + 1,
      fecha: data[i][0] ? data[i][0].toString() : "",
      gremio: data[i][1] ? data[i][1].toString().trim() : "",
      detalle: data[i][2] ? data[i][2].toString() : "",
      total: parseFloat(data[i][3]) || 0,
      estado: data[i][4] ? data[i][4].toString().trim() : "",
      driveUrl: data[i][5] ? data[i][5].toString().trim() : "",
      whatsapp: data[i][6] ? data[i][6].toString() : ""
    });
  }
  // Más recientes primero
  orders.reverse();
  return orders;
}

function cancelGremioOrderByRow(row) {
  var ss = getTargetSpreadsheet();
  var sh = getSheetByNameCaseInsensitive(ss, 'PEDIDOS');
  if (!sh) throw new Error("No se encontró la hoja PEDIDOS");

  // Leer datos del pedido ANTES de eliminarlo
  var rowData = sh.getRange(row, 1, 1, 7).getValues()[0];
  var orderInfo = {
    fecha: rowData[0] ? rowData[0].toString() : '',
    gremio: rowData[1] ? rowData[1].toString().trim() : '',
    detalle: rowData[2] ? rowData[2].toString() : '',
    total: parseFloat(rowData[3]) || 0,
    estado: rowData[4] ? rowData[4].toString() : '',
    driveUrl: rowData[5] ? rowData[5].toString() : '',
    whatsapp: rowData[6] ? rowData[6].toString() : ''
  };

  // Obtener URL de Drive para borrar los archivos antes de eliminar la fila
  if (orderInfo.driveUrl) {
    var match = orderInfo.driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/i) || orderInfo.driveUrl.match(/id=([a-zA-Z0-9_-]+)/i);
    if (match) {
      try {
        DriveApp.getFolderById(match[1]).setTrashed(true);
      } catch(e) {}
    }
  }

  // Guardar en PropertiesService para que el backend pueda detectar cancelaciones
  try {
    var props = PropertiesService.getScriptProperties();
    var cancelled = JSON.parse(props.getProperty('cancelledOrders') || '[]');
    cancelled.push({
      gremio: orderInfo.gremio,
      detalle: orderInfo.detalle,
      total: orderInfo.total,
      whatsapp: orderInfo.whatsapp,
      driveUrl: orderInfo.driveUrl,
      cancelledAt: new Date().toISOString()
    });
    props.setProperty('cancelledOrders', JSON.stringify(cancelled));
  } catch(e) {}

  sh.deleteRow(row);
  return { success: true };
}

function updateGremioOrderByRow(row, newDetails) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PEDIDOS');
  if (!sh) throw new Error("No se encontró la hoja PEDIDOS");
  sh.getRange(row, 3).setValue(newDetails);
  return { success: true };
}

// =============== FUNCIÓN PARA OBTENER TRABAJOS Y PEDIDOS PENDIENTES ===============
function getPendingOrders() {
  var ss = getTargetSpreadsheet();
  var pending = [];
  var allExisting = [];

  // Leer trabajos de la pestaña 'PEDIDOS'
  var shPedidos = getSheetByNameCaseInsensitive(ss, 'PEDIDOS');
  if (shPedidos && shPedidos.getLastRow() > 1) {
    var dataP = shPedidos.getDataRange().getValues();
    for (var j = 1; j < dataP.length; j++) {
      var rowFecha = dataP[j][0] ? dataP[j][0].toString().trim() : '';
      var rowGremio = dataP[j][1] ? dataP[j][1].toString().trim() : '';
      var rowDetalle = dataP[j][2] ? dataP[j][2].toString().trim() : '';
      var rowTotal = parseFloat(dataP[j][3]) || 0;
      var estadoP = dataP[j][4] ? dataP[j][4].toString().trim() : '';
      var rowDrive = dataP[j][5] ? dataP[j][5].toString().trim() : '';
      var rowWhatsapp = dataP[j][6] ? dataP[j][6].toString().trim() : '';

      if (rowGremio || rowDetalle || rowTotal > 0) {
        var orderObj = {
          row: j + 1,
          fecha: rowFecha,
          sourceSheet: 'PEDIDOS',
          gremio: rowGremio || 'Cliente Gremio',
          detalle: rowDetalle || 'Pedido Web',
          total: rowTotal,
          estado: estadoP,
          driveUrl: rowDrive,
          whatsapp: rowWhatsapp
        };
        allExisting.push(orderObj);
        // SOLO los pedidos que están explícitamente pendientes o sin estado
        var estP = estadoP.toLowerCase().trim();
        if (estP === 'pendiente' || estP === '') {
          pending.push(orderObj);
        }
      }
    }
  }

  // Leer cancelados de PropertiesService de forma segura
  var cancelled = [];
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty('cancelledOrders');
    if (raw) {
      cancelled = JSON.parse(raw);
      props.deleteProperty('cancelledOrders');
    }
  } catch(e) {}

  return {
    pending: pending,
    allOrders: allExisting,
    cancelled: cancelled
  };
}

// Confirmar sincronización solo tras persistencia local garantizada (Two-Phase Commit)
function acknowledgeOrders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { success: true, count: 0 };
  var ss = getTargetSpreadsheet();
  var sh = getSheetByNameCaseInsensitive(ss, 'PEDIDOS');
  if (!sh) return { success: false, error: 'Hoja PEDIDOS no encontrada' };
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = parseInt(rows[i], 10);
    if (r > 1 && r <= sh.getLastRow()) {
      sh.getRange(r, 5).setValue('Sincronizado');
      count++;
    }
  }
  return { success: true, count: count };
}

// =============== FUNCIÓN PARA RECARGAR ÚNICAMENTE PEDIDOS SELECCIONADOS / NO CARGADOS ===============
function recargarPedidosNoCargados() {
  var ss = getTargetSpreadsheet();
  var sh = getSheetByNameCaseInsensitive(ss, 'PEDIDOS');
  if (!sh) throw new Error("No se encontró la hoja PEDIDOS");
  
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch(e) {}

  // 1. Detectar si el usuario tiene filas seleccionadas en la hoja PEDIDOS
  var selectedRowSet = {};
  var activeSheet = ss.getActiveSheet();
  if (activeSheet && activeSheet.getName().toUpperCase() === 'PEDIDOS') {
    var activeRangeList = activeSheet.getActiveRangeList();
    if (activeRangeList) {
      activeRangeList.getRanges().forEach(function(range) {
        var startRow = range.getRow();
        var numRows = range.getNumRows();
        for (var r = 0; r < numRows; r++) {
          var row = startRow + r;
          if (row > 1 && row <= sh.getLastRow()) {
            selectedRowSet[row] = true;
          }
        }
      });
    }
  }

  var selectedRows = Object.keys(selectedRowSet).map(Number);
  var count = 0;

  // CASO A: El usuario seleccionó filas con el mouse (ej. Mariano y Alma Luna)
  if (selectedRows.length > 0) {
    for (var k = 0; k < selectedRows.length; k++) {
      var rNum = selectedRows[k];
      var estadoActual = sh.getRange(rNum, 5).getValue().toString().trim().toLowerCase();
      if (estadoActual !== 'cancelado') {
        sh.getRange(rNum, 5).setValue('Pendiente');
        count++;
      }
    }
    ss.toast('✅ ' + count + ' pedido(s) seleccionado(s) pasados a "Pendiente".', 'MR Letreros', 5);
    if (ui) ui.alert('✅ Se marcaron ' + count + ' pedido(s) seleccionado(s) como "Pendiente". En segundos aparecerán en Trabajos.');
    return { success: true, count: count };
  }

  // CASO B: Sin selección previa -> revisar ÚNICAMENTE las últimas 25 filas (ayer y hoy) que no estén canceladas
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) {
    if (ui) ui.alert('No hay pedidos en la hoja PEDIDOS.');
    return { success: true, count: 0 };
  }

  var startCheck = Math.max(2, lastRow - 24);
  var numToCheck = lastRow - startCheck + 1;
  var recentData = sh.getRange(startCheck, 1, numToCheck, 5).getValues();

  var candidateRows = [];
  for (var i = 0; i < recentData.length; i++) {
    var rowIdx = startCheck + i;
    var gremio = recentData[i][1] ? recentData[i][1].toString().trim() : '';
    var detalle = recentData[i][2] ? recentData[i][2].toString().trim() : '';
    var total = parseFloat(recentData[i][3]) || 0;
    var estado = recentData[i][4] ? recentData[i][4].toString().trim().toLowerCase() : '';

    if ((gremio || detalle || total > 0) && estado !== 'cancelado') {
      // Solo sugerir las que no estén canceladas
      candidateRows.push(rowIdx);
    }
  }

  if (candidateRows.length === 0) {
    if (ui) ui.alert('No se encontraron pedidos recientes para recargar.');
    return { success: true, count: 0 };
  }

  if (ui) {
    var resp = ui.alert(
      '🔄 Recargar Pedidos Recientes',
      'No seleccionaste filas específicas.\n¿Deseas recargar solo los últimos ' + candidateRows.length + ' pedidos recientes (ayer/hoy) a estado "Pendiente"?\n(Recomendado: También podés seleccionar con el cursor las filas específicas antes de pulsar este botón).',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return { success: false, cancelled: true };
  }

  for (var c = 0; c < candidateRows.length; c++) {
    sh.getRange(candidateRows[c], 5).setValue('Pendiente');
    count++;
  }

  ss.toast('✅ ' + count + ' pedidos recientes pasados a "Pendiente".', 'MR Letreros', 5);
  if (ui) ui.alert('✅ Se restablecieron ' + count + ' pedidos recientes a "Pendiente". En pocos segundos se sincronizarán con Trabajos.');
  return { success: true, count: count };
}

// =============== ELIMINAR PEDIDOS SELECCIONADOS EN LA PLANILLA (ULTRA RÁPIDO) ===============
function eliminarPedidosSeleccionados() {
  var ss = getTargetSpreadsheet();
  var sh = ss.getActiveSheet();
  
  if (sh.getName().toUpperCase() !== 'PEDIDOS') {
    SpreadsheetApp.getUi().alert('⚠️ Por favor selecciona las filas dentro de la pestaña "PEDIDOS".');
    return;
  }
  
  var activeRangeList = sh.getActiveRangeList();
  if (!activeRangeList) return;
  
  var ranges = activeRangeList.getRanges();
  var rowSet = {};
  
  ranges.forEach(function(range) {
    var startRow = range.getRow();
    var numRows = range.getNumRows();
    for (var r = 0; r < numRows; r++) {
      var row = startRow + r;
      if (row > 1) rowSet[row] = true;
    }
  });
  
  var sortedRows = Object.keys(rowSet).map(function(k) { return parseInt(k, 10); }).sort(function(a, b) { return b - a; });
  if (sortedRows.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ Selecciona al menos una fila con pedido (desde la fila 2).');
    return;
  }
  
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    '🗑️ Confirmar Eliminación Rápida',
    '¿Eliminar ' + sortedRows.length + ' pedido(s) seleccionado(s)?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;
  
  ss.toast('⏳ Eliminando ' + sortedRows.length + ' pedido(s) y limpiando Drive...', 'MR Letreros', 60);

  // 1. Lectura en bloque a memoria (0 llamadas remotas por celda)
  var allData = sh.getDataRange().getValues();
  var cancelledData = [];
  var folderIds = [];
  
  sortedRows.forEach(function(row) {
    var idx = row - 1;
    if (idx < allData.length) {
      var rowData = allData[idx];
      var gremio = rowData[1] || '';
      var detalle = rowData[2] || '';
      var total = rowData[3] || 0;
      var driveUrl = rowData[5] ? rowData[5].toString() : '';
      
      if (driveUrl) {
        var match = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/i) || driveUrl.match(/id=([a-zA-Z0-9_-]+)/i);
        if (match) folderIds.push(match[1]);
      }
      
      cancelledData.push({ gremio: gremio, detalle: detalle, total: total, driveUrl: driveUrl, row: row });
    }
  });
  
  // 2. Agrupar filas contiguas para eliminarlas en bloques (deleteRows) de abajo hacia arriba
  var blocks = [];
  var currentBlock = { start: sortedRows[0], count: 1 };
  
  for (var i = 1; i < sortedRows.length; i++) {
    var prev = sortedRows[i - 1];
    var curr = sortedRows[i];
    if (curr === prev - 1) {
      currentBlock.start = curr;
      currentBlock.count++;
    } else {
      blocks.push(currentBlock);
      currentBlock = { start: curr, count: 1 };
    }
  }
  blocks.push(currentBlock);
  
  blocks.forEach(function(b) {
    try {
      sh.deleteRows(b.start, b.count);
    } catch(e) {
      for (var r = b.start + b.count - 1; r >= b.start; r--) {
        try { sh.deleteRow(r); } catch(err) {}
      }
    }
  });
  
  // 3. Mover carpetas de Drive a la papelera en lote
  var trashedCount = 0;
  folderIds.forEach(function(fId) {
    try {
      var folder = DriveApp.getFolderById(fId);
      if (folder) { folder.setTrashed(true); trashedCount++; }
    } catch(e) {}
  });
  
  // 4. Notificar a PropertiesService para que Node.js reconcilie de inmediato
  if (cancelledData.length > 0) {
    try {
      var props = PropertiesService.getScriptProperties();
      var existing = JSON.parse(props.getProperty('cancelledOrders') || '[]');
      props.setProperty('cancelledOrders', JSON.stringify(existing.concat(cancelledData)));
    } catch(e) {}
  }
  
  ss.toast('⚡ ' + sortedRows.length + ' pedido(s) eliminados correctamente.', 'MR Letreros', 5);
  ui.alert('⚡ Eliminación completada: ' + sortedRows.length + ' pedido(s) eliminados.');
}

// Menú en la barra de herramientas de la planilla de Google Sheets
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🛠️ MR Letreros')
      .addItem('🔄 Recargar pedidos seleccionados / recientes', 'recargarPedidosNoCargados')
      .addItem('🗑️ Eliminar pedidos seleccionados', 'eliminarPedidosSeleccionados')
      .addToUi();
  } catch(e) {}
}

// =============== GESTIÓN Y AUTENTICACIÓN DE GREMIOS EN GOOGLE SHEETS ===============
function loginGremioUser(usuario, password) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getSheetByNameCaseInsensitive(ss, 'GREMIO');
  if (!sh || sh.getLastRow() === 0) {
    if (!sh) sh = ss.insertSheet('GREMIO');
    sh.appendRow(['Nombre', 'Telefono', 'Fecha']);
    return { success: false, error: 'No hay gremios registrados todavía. Regístrate primero.' };
  }
  
  var data = sh.getDataRange().getValues();
  var searchUser = usuario.toString().trim().toLowerCase();
  var rawPass = password.toString().trim();
  var cleanPass = rawPass.replace(/[^0-9]/g, '');
  
  for (var i = 0; i < data.length; i++) {
    var rowNombre = data[i][0] ? data[i][0].toString().trim() : '';
    var rowTel = data[i][1] ? data[i][1].toString().trim() : '';
    
    // Ignorar encabezados si la primera fila los tiene
    if (i === 0 && (rowNombre.toLowerCase() === 'nombre' || rowNombre.toLowerCase() === 'usuario' || rowNombre.toLowerCase() === 'gremio')) {
      continue;
    }
    
    var cleanRowTel = rowTel.replace(/[^0-9]/g, '');
    
    if (rowNombre.toLowerCase() === searchUser) {
      if (rowTel === rawPass || (cleanPass.length > 0 && cleanRowTel === cleanPass)) {
        return {
          success: true,
          token: 'gas_session_' + Date.now(),
          user: {
            nombre: rowNombre,
            usuario: rowNombre,
            telefono: rowTel
          }
        };
      } else {
        return { success: false, error: 'Contraseña (teléfono) incorrecta.' };
      }
    }
  }
  
  return { success: false, error: 'El usuario / gremio no existe.' };
}

function registerGremioUser(nombre, telefono) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getSheetByNameCaseInsensitive(ss, 'GREMIO');
  if (!sh) {
    sh = ss.insertSheet('GREMIO');
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Nombre', 'Telefono', 'Fecha']);
  }
  
  var data = sh.getDataRange().getValues();
  var searchName = nombre.toString().trim().toLowerCase();
  
  for (var i = 0; i < data.length; i++) {
    var rowNombre = data[i][0] ? data[i][0].toString().trim().toLowerCase() : '';
    if (i === 0 && (rowNombre === 'nombre' || rowNombre === 'usuario' || rowNombre === 'gremio')) {
      continue;
    }
    if (rowNombre === searchName) {
      return { success: false, error: 'El gremio "' + nombre + '" ya está registrado.' };
    }
  }
  
  var fecha = Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm");
  sh.appendRow([nombre.toString().trim(), telefono.toString().trim(), fecha]);
  
  return {
    success: true,
    message: '¡Registro exitoso! Ya puedes ingresar.'
  };
}

// =============== OBTENER GREMIOS ===============
function getGremiosList() {
  var ss = getTargetSpreadsheet();
  var gremios = {};

  // 1. Leer de la hoja 'GREMIO'
  var shGremio = getSheetByNameCaseInsensitive(ss, 'GREMIO');
  if (shGremio && shGremio.getLastRow() > 0) {
    var dataG = shGremio.getDataRange().getValues();
    for (var i = 0; i < dataG.length; i++) {
      var nombre = dataG[i][0] ? dataG[i][0].toString().trim() : '';
      if (!nombre) continue;
      // Solo ignorar si es explícitamente el texto 'nombre' en la primera fila como encabezado
      if (i === 0 && (nombre.toLowerCase() === 'nombre' || nombre.toLowerCase() === 'usuario' || nombre.toLowerCase() === 'gremio')) continue;
      
      var whatsapp = dataG[i][1] ? dataG[i][1].toString().trim() : '';
      gremios[nombre] = whatsapp;
    }
  }

  // 2. Complementar con hoja 'PEDIDOS' como fallback
  var shPedidos = ss ? ss.getSheetByName('PEDIDOS') : null;
  if (shPedidos && shPedidos.getLastRow() > 1) {
    var dataP = shPedidos.getDataRange().getValues();
    for (var j = 1; j < dataP.length; j++) {
      var g = dataP[j][1] ? dataP[j][1].toString().trim() : '';
      if (g && !gremios[g]) {
        gremios[g] = dataP[j][6] ? dataP[j][6].toString().trim() : '';
      }
    }
  }

  return gremios;
}

// =============== OBTENER COSTOS ===============
function getCostosData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Costos');
  if (!sh) return [];
  
  // A: Material, B: Total/Rollo, C: PrecioM2, D: Tinta m2
  var data = sh.getDataRange().getValues();
  var costos = [];
  
  // Omitimos la primera fila (encabezados)
  for (var i = 1; i < data.length; i++) {
    var material = data[i][0];
    if (!material) continue; // Si no hay nombre, ignorar
    
    // Limpiar el signo '$' y los puntos de miles, mantener comas si existen
    function parseCurrency(val) {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString().replace(/[$\s.]/g, '').replace(',', '.'));
    }
    
    var totalRollo = parseCurrency(data[i][1]);
    var precioM2 = parseCurrency(data[i][2]);
    var tintaM2 = parseCurrency(data[i][3]);
    
    costos.push({
      material: material.toString().trim(),
      totalRollo: totalRollo,
      precioM2: precioM2,
      tintaM2: tintaM2
    });
  }
  
  return costos;
}

// =============== OBTENER PRECIOS ===============
function getPreciosData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getSheetByNameCaseInsensitive(ss, 'PRECIOS');
  if (!sh) return [];
  // A: Categoria, B: Producto, C: Precio Gremio, D: Unidad, E: Tipo/Subcategoria, F: Ancho cm / medidas stock
  var data = sh.getDataRange().getValues();
  var precios = [];
  for (var i = 1; i < data.length; i++) {
    var prod = data[i][1] ? data[i][1].toString().trim() : '';
    if (!prod || prod.toLowerCase() === 'producto' || prod.toLowerCase() === 'nombre') continue;
    
    var cat = data[i][0] ? data[i][0].toString().trim() : 'General';
    var precioGremio = parseFloat(data[i][2]) || 0;
    var unidad = (data[i][3] || 'm2').toString().trim();
    var tipo = data[i][4] ? data[i][4].toString().trim() : '';
    
    // Extraer anchos
    var anchosSet = {};
    for (var col = 5; col < data[i].length; col++) {
      var val = data[i][col];
      if (val === undefined || val === null || val === '') continue;
      if (typeof val === 'number') {
        if (val > 0) anchosSet[val] = true;
      } else {
        var partes = val.toString().split(/[,;/|\s]+/);
        for (var k = 0; k < partes.length; k++) {
          var num = parseFloat(partes[k]);
          if (!isNaN(num) && num > 0) anchosSet[num] = true;
        }
      }
    }
    var anchosStock = Object.keys(anchosSet).map(Number).sort(function(a, b) { return a - b; });

    precios.push({
      id: 'p_' + i,
      categoria: cat,
      category: cat,
      producto: prod,
      name: prod,
      precioGremio: precioGremio,
      precio: precioGremio,
      unidad: unidad,
      unit: unidad,
      tipo: tipo,
      anchoFijo: anchosStock.length === 1 ? anchosStock[0] : null,
      anchosStock: anchosStock,
      costo: anchosStock.length > 0 ? anchosStock[0] : 0
    });
  }
  return precios;
}

// =============== OBTENER GASTOS ===============
function getGastosData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('ingreso egre 2025/26');
  if (!sh) return [];
  // Asumiendo A: Fecha, B: Detalle, C: Ingreso, D: Gasto
  var data = sh.getDataRange().getValues();
  var gastos = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1] && !data[i][2] && !data[i][3]) continue;
    var fecha = data[i][0] ? new Date(data[i][0]).toISOString() : new Date().toISOString();
    var detalle = data[i][1] ? data[i][1].toString().trim() : 'Sin detalle';
    
    var ingreso = parseFloat(data[i][2]) || 0;
    var egreso = parseFloat(data[i][3]) || 0;
    
    if (ingreso > 0) {
      gastos.push({ fecha: fecha, detalle: detalle, monto: ingreso, tipo: 'ingreso' });
    }
    if (egreso > 0) {
      gastos.push({ fecha: fecha, detalle: detalle, monto: -Math.abs(egreso), tipo: 'gasto' });
    }
  }
  return gastos;
}

// =============== OBTENER TERCEROS ===============
function getTercerosData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var terceros = [];
  var hojas = ['MANUEL', 'CRISTIAN'];
  
  hojas.forEach(function(nombreHoja) {
    var sh = ss.getSheetByName(nombreHoja);
    if (sh) {
      var data = sh.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (!data[i][0] && !data[i][1]) continue;
        terceros.push({
          proveedor: nombreHoja,
          fecha: data[i][0] ? new Date(data[i][0]).toISOString() : new Date().toISOString(),
          detalle: data[i][1] ? data[i][1].toString().trim() : '',
          monto: parseFloat(data[i][2]) || 0
        });
      }
    }
  });
  return terceros;
}

// =============== ENTRADA WEB ===============
function doGet(e) {
  try {
    var action = e ? e.parameter.action : null;
    var page = e ? e.parameter.page : null;
    
    if (action === 'getPending') return ContentService.createTextOutput(JSON.stringify(getPendingOrders())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'recargarPedidos') return ContentService.createTextOutput(JSON.stringify(recargarPedidosNoCargados())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'ackOrders') {
      var rowsParam = e.parameter.rows;
      var rows = rowsParam ? JSON.parse(rowsParam) : [];
      return ContentService.createTextOutput(JSON.stringify(acknowledgeOrders(rows))).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getGremios') return ContentService.createTextOutput(JSON.stringify(getGremiosList())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getCostos') return ContentService.createTextOutput(JSON.stringify(getCostosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getPrecios') return ContentService.createTextOutput(JSON.stringify(getPreciosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getGastos') return ContentService.createTextOutput(JSON.stringify(getGastosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getTerceros') return ContentService.createTextOutput(JSON.stringify(getTercerosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getFolderImages') {
      var folderId = e.parameter.folderId;
      return ContentService.createTextOutput(JSON.stringify(getFolderImages(folderId))).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'deleteOrder' || action === 'cancelOrder') {
      var delParams = {
        folderId: e.parameter.folderId,
        folderIds: e.parameter.folderIds,
        driveUrl: e.parameter.driveUrl,
        driveUrls: e.parameter.driveUrls,
        gremio: e.parameter.gremio,
        total: e.parameter.total
      };
      return ContentService.createTextOutput(JSON.stringify(deleteOrCancelOrder(delParams))).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getCancelledOrders') {
      var props = PropertiesService.getScriptProperties();
      var cancelled = JSON.parse(props.getProperty('cancelledOrders') || '[]');
      // Limpiar después de leer
      props.deleteProperty('cancelledOrders');
      return ContentService.createTextOutput(JSON.stringify({ cancelled: cancelled })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Obtener la URL de publicación de la Web App
    var webAppUrl = ScriptApp.getService().getUrl();
    
    // Renderizar comunicado oficial (Index.html) directamente
    const template = HtmlService.createTemplateFromFile('Index');
    template.webAppUrl = webAppUrl;
    return template.evaluate().setTitle('Comunicado Oficial - MR Letreros').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch(err) { return HtmlService.createHtmlOutput("<h1>Error</h1><p>"+err.message+"</p>"); }
}

// Función ayudante para incluir archivos HTML/CSS/JS en la plantilla principal
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =============== COMPLEMENTOS PARA SUBIDA DE ARCHIVOS PESADOS ===============
function createOrderFolder(gremio) {
  var mainFolder;
  var mf = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  mainFolder = mf.hasNext() ? mf.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
  
  var cn = gremio.toString().toUpperCase().replace(/[^A-Z0-9]/gi, '_');
  var cf = mainFolder.getFoldersByName(cn);
  var clientFolder = cf.hasNext() ? cf.next() : mainFolder.createFolder(cn);
  
  var timestamp = Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "yyyy-MM-dd_HH-mm");
  var subFolder = clientFolder.createFolder("Pedido_" + timestamp);
  
  return {
    folderId: subFolder.getId(),
    folderUrl: subFolder.getUrl()
  };
}

function getResumableUploadUrl(folderId, filename, mimeType) {
  var url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
  var metadata = {
    name: filename,
    parents: [folderId]
  };
  var response = UrlFetchApp.fetch(url, {
    method: "POST",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(metadata),
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() === 200) {
    return response.getHeaders()["Location"] || response.getHeaders()["location"];
  } else {
    throw new Error("Error al obtener sesión de subida a Drive: " + response.getContentText());
  }
}

function uploadChunkToResumableUrl(uploadUrl, base64Chunk, startByte, endByte, totalSize) {
  var bytes = Utilities.base64Decode(base64Chunk);
  
  var response = UrlFetchApp.fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Range": "bytes " + startByte + "-" + endByte + "/" + totalSize
    },
    contentType: "application/octet-stream",
    payload: bytes,
    muteHttpExceptions: true
  });
  
  return {
    status: response.getResponseCode(),
    body: response.getContentText()
  };
}

// =============== OBTENER IMÁGENES DE UNA CARPETA ===============
function getFolderImages(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var images = [];
    var MAX_IMAGES = 6;
    
    while (files.hasNext() && images.length < MAX_IMAGES) {
      var file = files.next();
      var mime = file.getMimeType();
      if (mime && mime.indexOf('image/') === 0) {
        var imgData = {
          id: file.getId(),
          name: file.getName(),
          thumbData: null,
          fullUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view'
        };
        
        try {
          // Intentar obtener thumbnail nativo (pequeño y rápido)
          var thumb = file.getThumbnail();
          if (thumb) {
            var b64 = Utilities.base64Encode(thumb.getBytes());
            imgData.thumbData = 'data:image/png;base64,' + b64;
          } else {
            // Fallback: solo para archivos < 500KB
            var size = file.getSize();
            if (size < 500000) {
              var blob = file.getBlob();
              var b64 = Utilities.base64Encode(blob.getBytes());
              var blobMime = blob.getContentType() || 'image/png';
              imgData.thumbData = 'data:' + blobMime + ';base64,' + b64;
            }
          }
        } catch(imgErr) {
          // Sin thumbnail, el frontend muestra icono con link a Drive
        }
        
        images.push(imgData);
      }
    }
    return images;
  } catch (e) {
    return [];
  }
}

// =============== PROCESAR ACCIONES DE NOTIFICACIÓN DESDE EL BACKEND ===============
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === 'deleteOrder' || action === 'cancelOrder') {
      const result = deleteOrCancelOrder(postData);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Accion no valida' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =============== ELIMINAR O CANCELAR PEDIDO DE SHEETS Y DRIVE ===============
function deleteOrCancelOrder(params) {
  var results = { success: true, filesTrashed: 0, rowsDeleted: 0, errors: [] };
  if (!params) return results;

  var ss = getTargetSpreadsheet();
  var shPedidos = getSheetByNameCaseInsensitive(ss, 'PEDIDOS');
  
  var driveUrls = [];
  if (params.driveUrls && Array.isArray(params.driveUrls)) {
    driveUrls = params.driveUrls;
  } else if (params.driveUrl) {
    driveUrls = params.driveUrl.toString().split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  }
  
  var folderIds = [];
  if (params.folderIds && Array.isArray(params.folderIds)) {
    folderIds = params.folderIds;
  } else if (params.folderId) {
    folderIds = params.folderId.toString().split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  }
  
  // Extraer folder IDs de cualquier driveUrl
  driveUrls.forEach(function(url) {
    var match = url.match(/folders\/([a-zA-Z0-9_-]+)/i) || url.match(/id=([a-zA-Z0-9_-]+)/i);
    if (match && folderIds.indexOf(match[1]) === -1) {
      folderIds.push(match[1]);
    }
  });

  // 1. Borrar carpetas/archivos de Google Drive (mover a papelera)
  folderIds.forEach(function(fId) {
    try {
      var folder = DriveApp.getFolderById(fId);
      if (folder) {
        folder.setTrashed(true);
        results.filesTrashed++;
      }
    } catch(err) {
      try {
        var file = DriveApp.getFileById(fId);
        if (file) {
          file.setTrashed(true);
          results.filesTrashed++;
        }
      } catch(fileErr) {
        results.errors.push("Drive ID " + fId + ": " + fileErr.message);
      }
    }
  });

  // 2. Borrar fila(s) de la planilla PEDIDOS
  if (shPedidos && shPedidos.getLastRow() > 1) {
    var data = shPedidos.getDataRange().getValues();
    var gremioSearch = params.gremio ? params.gremio.toString().trim().toLowerCase() : "";
    var totalSearch = parseFloat(params.total) || 0;
    
    // Recorremos de abajo hacia arriba para borrar sin desplazar índices
    for (var i = data.length - 1; i >= 1; i--) {
      var rowDrive = data[i][5] ? data[i][5].toString().trim() : "";
      var rowGremio = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
      var rowTotal = parseFloat(data[i][3]) || 0;
      
      var matches = false;
      
      // Coincidencia por URL o Folder ID de Drive
      if (rowDrive) {
        for (var k = 0; k < folderIds.length; k++) {
          if (folderIds[k] && rowDrive.indexOf(folderIds[k]) > -1) {
            matches = true;
            break;
          }
        }
        if (!matches) {
          for (var u = 0; u < driveUrls.length; u++) {
            if (driveUrls[u] && (rowDrive.indexOf(driveUrls[u]) > -1 || driveUrls[u].indexOf(rowDrive) > -1)) {
              matches = true;
              break;
            }
          }
        }
      }
      
      // Coincidencia por Gremio y Total si no hubo match por Drive
      if (!matches && gremioSearch && rowGremio === gremioSearch) {
        if (totalSearch > 0 && Math.abs(rowTotal - totalSearch) < 1) {
          matches = true;
        }
      }
      
      if (matches) {
        shPedidos.deleteRow(i + 1);
        results.rowsDeleted++;
      }
    }
  }
  
  return results;
}

