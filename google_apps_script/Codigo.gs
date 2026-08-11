// =============== CONFIGURACIÓN ===============
const DRIVE_FOLDER_NAME = "MR_Letreros_Pedidos";

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
  
  // 1. Cargar Stock por Tipo (Hoja STOCK: A=Ancho cm, B=Estado, C=Tipo)
  const sheetStock = getSheetByNameCaseInsensitive(ss, 'STOCK');
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
  const sheetPrecios = getSheetByNameCaseInsensitive(ss, 'PRECIOS');
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PEDIDOS');
  if (!sh) throw new Error("No se encontró la hoja PEDIDOS");
  sh.getRange(row, 5).setValue('Cancelado');
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

  // 1. Leer trabajos de la pestaña 'GREMIO'
  var shGremio = getSheetByNameCaseInsensitive(ss, 'GREMIO');
  if (shGremio && shGremio.getLastRow() > 1) {
    var dataG = shGremio.getDataRange().getValues();
    for (var i = 1; i < dataG.length; i++) {
      var nombre = dataG[i][0] ? dataG[i][0].toString().trim() : '';
      if (!nombre || nombre.toLowerCase() === 'nombre' || nombre.toLowerCase() === 'usuario' || nombre.toLowerCase() === 'gremio') continue;
      
      var tel = dataG[i][1] ? dataG[i][1].toString().trim() : '';
      var fecha = dataG[i][2] ? dataG[i][2].toString().trim() : '';
      var detalle = dataG[i][3] ? dataG[i][3].toString().trim() : 'Trabajo cargado en planilla Gremio';
      var monto = parseFloat(dataG[i][4]) || 0;
      var estado = dataG[i][5] ? dataG[i][5].toString().trim() : 'Pendiente';

      pending.push({
        row: i + 1,
        sourceSheet: 'GREMIO',
        gremio: nombre,
        whatsapp: tel,
        fecha: fecha,
        detalle: detalle,
        total: monto,
        estado: estado
      });
    }
  }

  // 2. Leer trabajos de la pestaña 'PEDIDOS'
  var shPedidos = getSheetByNameCaseInsensitive(ss, 'PEDIDOS');
  if (shPedidos && shPedidos.getLastRow() > 1) {
    var dataP = shPedidos.getDataRange().getValues();
    for (var j = 1; j < dataP.length; j++) {
      var estadoP = dataP[j][4] ? dataP[j][4].toString().trim() : '';
      if (estadoP === 'Pendiente' || estadoP === '') {
        pending.push({
          row: j + 1,
          sourceSheet: 'PEDIDOS',
          gremio: dataP[j][1] ? dataP[j][1].toString().trim() : 'Cliente Gremio',
          detalle: dataP[j][2] ? dataP[j][2].toString().trim() : 'Pedido Web',
          total: parseFloat(dataP[j][3]) || 0,
          driveUrl: dataP[j][5] ? dataP[j][5].toString().trim() : '',
          whatsapp: dataP[j][6] ? dataP[j][6].toString().trim() : '',
          estado: 'Pendiente'
        });
        try { shPedidos.getRange(j + 1, 5).setValue('Sincronizado'); } catch(e) {}
      }
    }
  }

  return pending;
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
  // A: Categoria, B: Producto, C: Precio Gremio, D: Unidad, E: Tipo/Subcategoria, F: Costo/Ancho
  var data = sh.getDataRange().getValues();
  var precios = [];
  for (var i = 1; i < data.length; i++) {
    var prod = data[i][1] ? data[i][1].toString().trim() : '';
    if (!prod || prod.toLowerCase() === 'producto' || prod.toLowerCase() === 'nombre') continue;
    
    var cat = data[i][0] ? data[i][0].toString().trim() : 'General';
    var precioGremio = parseFloat(data[i][2]) || 0;
    var unidad = (data[i][3] || 'm2').toString().trim();
    var tipo = data[i][4] ? data[i][4].toString().trim() : '';
    var costo = parseFloat(data[i][5]) || 0;

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
      costo: costo
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
    if (action === 'getGremios') return ContentService.createTextOutput(JSON.stringify(getGremiosList())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getCostos') return ContentService.createTextOutput(JSON.stringify(getCostosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getPrecios') return ContentService.createTextOutput(JSON.stringify(getPreciosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getGastos') return ContentService.createTextOutput(JSON.stringify(getGastosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getTerceros') return ContentService.createTextOutput(JSON.stringify(getTercerosData())).setMimeType(ContentService.MimeType.JSON);
    if (action === 'getFolderImages') {
      var folderId = e.parameter.folderId;
      return ContentService.createTextOutput(JSON.stringify(getFolderImages(folderId))).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Obtener la URL de publicación de la Web App
    var webAppUrl = ScriptApp.getService().getUrl();
    
    if (page === 'cotizador') {
      const template = HtmlService.createTemplateFromFile('Index');
      template.webAppUrl = webAppUrl;
      return template.evaluate().setTitle('Portal MR Letreros').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
    }
    
    // Por defecto renderiza la pantalla de login
    const template = HtmlService.createTemplateFromFile('login');
    template.webAppUrl = webAppUrl;
    return template.evaluate().setTitle('Acceso Gremio - MR Letreros').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
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
    
    if (action === 'cancelOrder') {
      const driveUrl = postData.driveUrl;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName('PEDIDOS');
      if (sh && driveUrl) {
        const data = sh.getDataRange().getValues();
        // Buscar fila que coincida con el Drive URL
        for (let i = 1; i < data.length; i++) {
          const rowDriveUrl = data[i][5] ? data[i][5].toString().trim() : "";
          if (rowDriveUrl && (rowDriveUrl.indexOf(driveUrl) > -1 || driveUrl.indexOf(rowDriveUrl) > -1)) {
            // Cambiar Estado (columna E, que es la 5) a 'Cancelado'
            sh.getRange(i + 1, 5).setValue('Cancelado');
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Pedido cancelado en Sheets' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Accion no valida' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

