// =============== CONFIGURACIÓN ===============
const DRIVE_FOLDER_NAME = "MR_Letreros_Pedidos";

// =============== CARGAR CATÁLOGO Y STOCK ===============
function getCatalogData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Cargar Stock por Tipo (Hoja STOCK: A=Ancho cm, B=Estado, C=Tipo)
  const sheetStock = ss.getSheetByName('STOCK');
  const stockByType = {};
  if (sheetStock) {
    const data = sheetStock.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const ancho = parseFloat(data[i][0]);
      const estado = data[i][1] ? data[i][1].toString().toLowerCase().trim() : "";
      // Normalización agresiva: minúsculas, sin espacios y sin 's' final para evitar error Vinilo vs Vinilos
      let tipo = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "general";
      tipo = tipo.replace(/s$/, ""); // "vinilos" -> "vinilo"
      
      if (estado === 'en stock' && !isNaN(ancho) && ancho > 0) {
        if (!stockByType[tipo]) stockByType[tipo] = [];
        stockByType[tipo].push(ancho);
      }
    }
    // Ordenar cada lista de stock de menor a mayor
    Object.keys(stockByType).forEach(function(key) {
      stockByType[key].sort(function(a, b) { return a - b; });
    });
  }

  // 2. Cargar Catálogo (Hoja PRECIOS: A=Cat, B=Prod, C=Precio, D=Unidad, E=Tipo, F=Ancho cm)
  const sheetPrecios = ss.getSheetByName('PRECIOS');
  const catalogResult = [];
  if (sheetPrecios) {
    const data = sheetPrecios.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0] || !data[i][1]) continue;
      const precio = parseFloat(data[i][2]) || 0;
      const anchoRaw = parseFloat(data[i][5]);
      let tipo = data[i][4] ? data[i][4].toString().trim().toLowerCase() : "general";
      tipo = tipo.replace(/s$/, ""); // Normalizar también aquí
      
      catalogResult.push({
        id: 'p_' + i,
        categoria: data[i][0].toString().trim(),
        producto: data[i][1].toString().trim(),
        precioGremio: precio,
        unidad: (data[i][3] || 'm2').toString().trim(),
        tipo: tipo,
        anchoFijo: (!isNaN(anchoRaw) && anchoRaw > 0) ? anchoRaw : null
      });
    }
  }
  return { catalog: catalogResult, stock: stockByType };
}

// =============== PROCESAR PEDIDO ===============
function processOrder(jsonString) {
  const order = JSON.parse(jsonString);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    
    // Guardar archivo de texto con los detalles del pedido
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

  return { success: true, driveUrl: driveUrl };
}

// =============== FUNCIÓN PARA EL BOT ===============
function getPendingOrders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PEDIDOS'); if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var pending = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === 'Pendiente') {
      pending.push({
        row: i + 1,
        gremio: data[i][1],
        detalle: data[i][2],
        total: data[i][3],
        driveUrl: data[i][5],
        whatsapp: data[i][6] || ''
      });
      sh.getRange(i + 1, 5).setValue('Sincronizado');
    }
  }
  return pending;
}

// =============== OBTENER GREMIOS ===============
function getGremiosList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PEDIDOS'); if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var gremios = {};
  for (var i = 1; i < data.length; i++) {
    var gremio = data[i][1];
    if (gremio) {
      gremios[gremio.toString().trim()] = data[i][6] || '';
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
  var sh = ss.getSheetByName('PRECIOS');
  if (!sh) return [];
  // A: Categoria, B: Producto, C: Precio Gremio, D: Unidad
  var data = sh.getDataRange().getValues();
  var precios = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    precios.push({
      categoria: data[i][0].toString().trim(),
      producto: data[i][1].toString().trim(),
      precioGremio: parseFloat(data[i][2]) || 0,
      unidad: (data[i][3] || 'm2').toString().trim()
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
    if (!e || !e.parameter) return HtmlService.createHtmlOutput("Faltan parámetros");
    var action = e.parameter.action;
    
    if (action === 'getPending') return ContentService.createTextOutput(JSON.stringify(getPendingOrders())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getGremios') return ContentService.createTextOutput(JSON.stringify(getGremiosList())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getCostos') return ContentService.createTextOutput(JSON.stringify(getCostosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getPrecios') return ContentService.createTextOutput(JSON.stringify(getPreciosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getGastos') return ContentService.createTextOutput(JSON.stringify(getGastosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getTerceros') return ContentService.createTextOutput(JSON.stringify(getTercerosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getFolderImages') {
      var folderId = e.parameter.folderId;
      return ContentService.createTextOutput(JSON.stringify(getFolderImages(folderId))).setMimeType(ContentService.MimeType.JSON);
    }
    
    const template = HtmlService.createTemplateFromFile('Index');
    return template.evaluate().setTitle('Portal MR Letreros').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
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

