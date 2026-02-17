// Default price data with both gremio and cliente prices
const defaultPriceData = {
  pvc: {
    name: 'Cartel PVC',
    gremio: 44500,
    cliente: 44500,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  polifan20: {
    name: 'Corte Polifan 20mm',
    gremio: 32000,
    cliente: 32000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  polifan30: {
    name: 'Corte Polifan 30mm',
    gremio: 42000,
    cliente: 42000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  lonaFront: {
    name: 'Lona Front 13 Oz',
    gremio: 9000,
    cliente: 31000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    hasLaqueado: true,
    laqueadoCost: 5900,
    gremioOptions: [],
    clienteOptions: [
      { name: 'con_colocacion', label: 'Con colocación', additionalCost: 14000 },
      { name: 'completo', label: 'Cartel completo', price: 95000 }
    ]
  },
  lonaBacklight: {
    name: 'Lona Backlight',
    gremio: 10800,
    cliente: 43000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    hasLaqueado: true,
    laqueadoCost: 5900,
    gremioOptions: [],
    clienteOptions: [
      { name: 'con_colocacion', label: 'Con colocación', additionalCost: 5000 },
      { name: 'laqueado_colocacion', label: 'Laqueado + colocación', additionalCost: 12000 },
      { name: 'completo', label: 'Cartel completo', price: 370000 }
    ]
  },
  viniloBaseGris: {
    name: 'Vinilo Base Gris',
    gremio: 9000,
    cliente: 28000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    hasLaqueado: true,
    laqueadoCost: 5900,
    gremioOptions: [],
    clienteOptions: []
  },
  viniloOracal: {
    name: 'Vinilo Oracal 3641',
    gremio: 14900,
    cliente: 45000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  viniloClearAvery: {
    name: 'Vinilo Clear Avery',
    gremio: 10500,
    cliente: 35000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  viniloMicroperforado: {
    name: 'Vinilo Microperforado',
    gremio: 13000,
    cliente: 45000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  viniloEsmerilado: {
    name: 'Vinilo Esmerilado',
    gremio: 13800,
    cliente: 46000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  viniloMateBq: {
    name: 'Vinilo Mate BQ',
    gremio: 9500,
    cliente: 30000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    hasLaqueado: true,
    laqueadoCost: 5900,
    gremioOptions: [],
    clienteOptions: []
  },
  viniloImpresoCorte: {
    name: 'Vinilo Impreso + Corte (plancha 55cm)',
    gremio: 10500,
    cliente: 20000,
    unit: 'metro lineal',
    hasSize: false,
    isLinear: true,
    hasLaqueado: true,
    laqueadoCost: 5900,
    gremioOptions: [],
    clienteOptions: []
  },
  papelBlueBack: {
    name: 'Papel Blue Back',
    gremio: 8900,
    cliente: 25000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  laca: {
    name: 'Laca (al agua)',
    gremio: 5900,
    cliente: 15000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  telaBandera: {
    name: 'Tela Bandera',
    gremio: 27000,
    cliente: 27000,
    unit: 'metro lineal',
    hasSize: false,
    isLinear: true,
    hasExtras: true,
    extras: {
      costura: 10000,
      transporte: 12000
    },
    gremioOptions: [],
    clienteOptions: []
  },
  pastillaRedonda40: {
    name: 'Cartel Pastilla Redondo 40cm',
    gremio: 295000,
    cliente: 295000,
    unit: 'unidad',
    hasSize: false,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  pastillaRedonda50: {
    name: 'Cartel Pastilla Redondo 50cm',
    gremio: 320000,
    cliente: 320000,
    unit: 'unidad',
    hasSize: false,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  pastillaCuadrada40: {
    name: 'Cartel Pastilla Cuadrado 40cm',
    gremio: 220000,
    cliente: 220000,
    unit: 'unidad',
    hasSize: false,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  cartelFrontDoble: {
    name: 'Cartel Front Doble Faz 150x70cm',
    gremio: 105900,
    cliente: 105900,
    unit: 'unidad',
    hasSize: false,
    isLinear: false,
    gremioOptions: [{ name: 'iva', label: '+ IVA', multiplier: 1.21 }],
    clienteOptions: [{ name: 'iva', label: '+ IVA', multiplier: 1.21 }]
  },
  cartelChapa: {
    name: 'Cartel Doble Faz Chapa 170x100cm',
    gremio: 700000,
    cliente: 700000,
    unit: 'unidad',
    hasSize: false,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  flyBanner: {
    name: 'Fly Banner (par) 230x89cm',
    gremio: 140000,
    cliente: 140000,
    unit: 'par',
    hasSize: false,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  rollup: {
    name: 'Roll Up',
    gremio: 90000,
    cliente: 90000,
    unit: 'unidad',
    hasSize: false,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  dosVelas: {
    name: 'Dos Velas',
    gremio: 78000,
    cliente: 78000,
    unit: 'unidad',
    hasSize: false,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  imanVehicular: {
    name: 'Imán Vehicular',
    gremio: 65000,
    cliente: 65000,
    unit: 'm²',
    hasSize: true,
    isLinear: false,
    gremioOptions: [],
    clienteOptions: []
  },
  ploteoKangoo: {
    name: 'Ploteo Kangoo/Partner/Berlingo (25m²)',
    gremio: 25,
    cliente: 25,
    unit: 'm²',
    hasSize: false,
    isLinear: false,
    fixedSize: 25,
    gremioOptions: [
      { name: 'impreso_laminado', label: 'Vinilo impreso + laminado', pricePerM2: 12000 },
      { name: 'oracal', label: 'Vinilo Oracal', pricePerM2: 16000 }
    ],
    clienteOptions: [
      { name: 'impreso_laminado', label: 'Vinilo impreso + laminado', pricePerM2: 12000 },
      { name: 'oracal', label: 'Vinilo Oracal', pricePerM2: 16000 }
    ]
  },
  ploteoChico: {
    name: 'Ploteo Auto Chico 208/C3/Onix (18m²)',
    gremio: 18,
    cliente: 18,
    unit: 'm²',
    hasSize: false,
    isLinear: false,
    fixedSize: 18,
    gremioOptions: [
      { name: 'impreso_laminado', label: 'Vinilo impreso + laminado', pricePerM2: 12000 },
      { name: 'oracal', label: 'Vinilo Oracal', pricePerM2: 16000 }
    ],
    clienteOptions: [
      { name: 'impreso_laminado', label: 'Vinilo impreso + laminado', pricePerM2: 12000 },
      { name: 'oracal', label: 'Vinilo Oracal', pricePerM2: 16000 }
    ]
  }
};

// Load price data from localStorage or use defaults
let priceData = JSON.parse(localStorage.getItem('mrLetrerosPrices') || 'null');
if (!priceData) {
  priceData = JSON.parse(JSON.stringify(defaultPriceData)); // Deep copy
  localStorage.setItem('mrLetrerosPrices', JSON.stringify(priceData));
}

let items = [];
let currentPriceType = 'gremio'; // 'gremio' or 'cliente'

// Elements
const btnGremio = document.getElementById('btnGremio');
const btnCliente = document.getElementById('btnCliente');
const showFormBtn = document.getElementById('showFormBtn');
const addForm = document.getElementById('addForm');
const cancelBtn = document.getElementById('cancelBtn');
const addItemBtn = document.getElementById('addItemBtn');
const categorySelect = document.getElementById('category');
const sizeInputs = document.getElementById('sizeInputs');
const linearInputs = document.getElementById('linearInputs');
const quantityOnly = document.getElementById('quantityOnly');
const optionsContainer = document.getElementById('optionsContainer');
const optionsSelect = document.getElementById('options');
const laqueadoOption = document.getElementById('laqueadoOption');
const telaBanderaOptions = document.getElementById('telaBanderaOptions');
const itemsSection = document.getElementById('itemsSection');
const itemsList = document.getElementById('itemsList');
const totalSection = document.getElementById('totalSection');
const totalAmount = document.getElementById('totalAmount');
const emptyState = document.getElementById('emptyState');
const exportBtn = document.getElementById('exportBtn');
const saveQuotationBtn = document.getElementById('saveQuotationBtn');

// Client Management Elements
const savedClientsSelect = document.getElementById('savedClients');
const btnSaveClient = document.getElementById('btnSaveClient');
const btnViewHistory = document.getElementById('btnViewHistory');

// History Modal Elements
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyClientInfo = document.getElementById('historyClientInfo');
const historyStats = document.getElementById('historyStats');
const historyList = document.getElementById('historyList');

// Quick History Elements
const clientQuickHistory = document.getElementById('clientQuickHistory');
const quickHistoryContent = document.getElementById('quickHistoryContent');
const btnViewFullHistory = document.getElementById('btnViewFullHistory');

// Full History Elements (in empty state)
const noClientMessage = document.getElementById('noClientMessage');
const clientFullHistory = document.getElementById('clientFullHistory');
const fullHistoryClientInfo = document.getElementById('fullHistoryClientInfo');
const fullHistoryStats = document.getElementById('fullHistoryStats');
const fullHistoryList = document.getElementById('fullHistoryList');

let currentSelectedClientId = null;
let currentFullHistoryClient = null;  // Para guardar cliente del historial completo
let currentFullHistoryData = null;    // Para guardar historial completo

// Price Editor Elements
const btnSettings = document.getElementById('btnSettings');
const priceEditorModal = document.getElementById('priceEditorModal');
const closeModal = document.getElementById('closeModal');
const productSelect = document.getElementById('productSelect');
const priceEditorForm = document.getElementById('priceEditorForm');
const gremioBasePrice = document.getElementById('gremioBasePrice');
const clienteBasePrice = document.getElementById('clienteBasePrice');
const gremioOptionsContainer = document.getElementById('gremioOptionsContainer');
const clienteOptionsContainer = document.getElementById('clienteOptionsContainer');
const btnSavePrices = document.getElementById('btnSavePrices');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnResetPrices = document.getElementById('btnResetPrices');
const btnImportClientePrices = document.getElementById('btnImportClientePrices');
const btnImportGremioPrices = document.getElementById('btnImportGremioPrices');

// Tabs
const tabPrecios = document.getElementById('tabPrecios');
const tabClientes = document.getElementById('tabClientes');
const tabDatos = document.getElementById('tabDatos');
const preciosTab = document.getElementById('preciosTab');
const clientesTab = document.getElementById('clientesTab');
const datosTab = document.getElementById('datosTab');

// Data Management Elements
const btnExportClients = document.getElementById('btnExportClients');
const btnImportClients = document.getElementById('btnImportClients');
const importClientsFile = document.getElementById('importClientsFile');
const clientHistorySelect = document.getElementById('clientHistorySelect');
const btnExportHistory = document.getElementById('btnExportHistory');
const btnImportHistory = document.getElementById('btnImportHistory');
const importHistoryFile = document.getElementById('importHistoryFile');
const btnExportClientFolder = document.getElementById('btnExportClientFolder');
const btnImportClientFolder = document.getElementById('btnImportClientFolder');
const importClientFolderFile = document.getElementById('importClientFolderFile');
const clientStatsDisplay = document.getElementById('clientStatsDisplay');
const btnExportAll = document.getElementById('btnExportAll');
const btnImportAll = document.getElementById('btnImportAll');
const importAllFile = document.getElementById('importAllFile');

// Theme Toggle
const btnThemeToggle = document.getElementById('btnThemeToggle');

// Gremio Clients Management
const gremioClientName = document.getElementById('gremioClientName');
const gremioClientContact = document.getElementById('gremioClientContact');
const gremioClientNotes = document.getElementById('gremioClientNotes');
const btnSaveGremioClient = document.getElementById('btnSaveGremioClient');
const gremioClientsList = document.getElementById('gremioClientsList');
const loadGremioClient = document.getElementById('loadGremioClient');

let currentEditingGremioClient = null;

// Event Listeners
btnGremio.addEventListener('click', () => switchPriceType('gremio'));
btnCliente.addEventListener('click', () => switchPriceType('cliente'));
btnSettings.addEventListener('click', openPriceEditor);
closeModal.addEventListener('click', closePriceEditor);
showFormBtn.addEventListener('click', () => {
  addForm.classList.remove('hidden');
  showFormBtn.classList.add('hidden');
});
cancelBtn.addEventListener('click', () => {
  addForm.classList.add('hidden');
  showFormBtn.classList.remove('hidden');
  resetForm();
});
categorySelect.addEventListener('change', updateFormFields);
addItemBtn.addEventListener('click', addItem);
exportBtn.addEventListener('click', exportToPDF);
saveQuotationBtn.addEventListener('click', saveQuotation);

// Approve Button Listener
const approveBtn = document.getElementById('approveBtn');
if (approveBtn) {
  approveBtn.addEventListener('click', approveQuotation);
}

// Price Editor Listeners
productSelect.addEventListener('change', loadProductForEdit);
btnSavePrices.addEventListener('click', saveProductPrices);
btnCancelEdit.addEventListener('click', () => {
  priceEditorForm.classList.add('hidden');
  productSelect.value = '';
});
btnResetPrices.addEventListener('click', resetToDefaultPrices);
btnImportClientePrices.addEventListener('click', importClientePrices);
btnImportGremioPrices.addEventListener('click', importGremioPrices);

// Close modal on outside click
priceEditorModal.addEventListener('click', (e) => {
  if (e.target === priceEditorModal) {
    closePriceEditor();
  }
});

historyModal.addEventListener('click', (e) => {
  if (e.target === historyModal) {
    closeHistory();
  }
});

// Client Management Listeners
btnSaveClient.addEventListener('click', saveClient);
savedClientsSelect.addEventListener('change', handleClientSelectChange);
btnViewHistory.addEventListener('click', openHistoryModal);
btnViewFullHistory.addEventListener('click', openHistoryModal);
closeHistoryModal.addEventListener('click', closeHistory);

// Download history PDF button
const btnDownloadHistoryPDF = document.getElementById('btnDownloadHistoryPDF');
if (btnDownloadHistoryPDF) {
  btnDownloadHistoryPDF.addEventListener('click', downloadHistoryPDF);
}

// Download full history PDF button (in index page)
const btnDownloadFullHistoryPDF = document.getElementById('btnDownloadFullHistoryPDF');
if (btnDownloadFullHistoryPDF) {
  btnDownloadFullHistoryPDF.addEventListener('click', downloadFullHistoryPDF);
}

// Tab Listeners
tabPrecios.addEventListener('click', () => switchTab('precios'));
tabClientes.addEventListener('click', () => switchTab('clientes'));
tabDatos.addEventListener('click', () => switchTab('datos'));

const tabCostos = document.getElementById('tabCostos');
if (tabCostos) {
  tabCostos.addEventListener('click', () => switchTab('costos'));
}

const tabActualizaciones = document.getElementById('tabActualizaciones');
if (tabActualizaciones) {
  tabActualizaciones.addEventListener('click', () => switchTab('actualizaciones'));
}

// Gremio Clients Listeners
btnSaveGremioClient.addEventListener('click', saveGremioClient);
loadGremioClient.addEventListener('change', loadGremioClientToForm);

// Data Management Listeners
btnExportClients.addEventListener('click', () => dataManager.exportClients());
btnImportClients.addEventListener('click', () => importClientsFile.click());
importClientsFile.addEventListener('change', handleImportClients);

clientHistorySelect.addEventListener('change', handleClientHistorySelect);
btnExportHistory.addEventListener('click', handleExportHistory);
btnImportHistory.addEventListener('click', () => importHistoryFile.click());
importHistoryFile.addEventListener('change', handleImportHistory);

btnExportClientFolder.addEventListener('click', handleExportClientFolder);
btnImportClientFolder.addEventListener('click', () => importClientFolderFile.click());
importClientFolderFile.addEventListener('change', handleImportClientFolder);

btnExportAll.addEventListener('click', () => dataManager.exportAllData());
btnImportAll.addEventListener('click', () => importAllFile.click());
importAllFile.addEventListener('change', handleImportAll);

// Theme Toggle Listener
btnThemeToggle.addEventListener('click', toggleTheme);

// Functions
function switchPriceType(type) {
  currentPriceType = type;
  
  // Cambiar colores del cotizador según tipo
  const cotizadorCard = document.querySelector('.cotizador-card');
  const preciosTitle = document.querySelector('.cotizador-card h2');
  const totalElement = document.querySelector('.total');
  const totalLabel = document.querySelector('.total-label');
  const totalValue = document.querySelector('.total-value');
  const addItemBtn = document.getElementById('addItemBtn');
  
  if (type === 'gremio') {
    btnGremio.classList.add('active');
    btnCliente.classList.remove('active');
    
    // Color verde para GREMIO - TODOS los elementos
    if (cotizadorCard) {
      cotizadorCard.style.borderColor = '#51CF66';
      cotizadorCard.style.boxShadow = '0 4px 12px rgba(81, 207, 102, 0.2)';
    }
    if (preciosTitle) {
      preciosTitle.style.color = '#51CF66';
      preciosTitle.style.textShadow = '0 0 20px rgba(81, 207, 102, 0.3)';
    }
    if (totalElement) {
      totalElement.style.background = 'linear-gradient(135deg, rgba(81, 207, 102, 0.2), rgba(81, 207, 102, 0.05))';
      totalElement.style.borderColor = '#51CF66';
    }
    if (totalLabel) {
      totalLabel.style.color = '#51CF66';
    }
    if (totalValue) {
      totalValue.style.color = '#51CF66';
    }
    if (addItemBtn) {
      addItemBtn.style.background = 'linear-gradient(135deg, #51CF66, #37B24D)';
      addItemBtn.style.boxShadow = '0 4px 15px rgba(81, 207, 102, 0.3)';
    }
  } else {
    btnCliente.classList.add('active');
    btnGremio.classList.remove('active');
    
    // Color naranja para CLIENTE - TODOS los elementos
    if (cotizadorCard) {
      cotizadorCard.style.borderColor = '#FF8C00';
      cotizadorCard.style.boxShadow = '0 4px 12px rgba(255, 140, 0, 0.2)';
    }
    if (preciosTitle) {
      preciosTitle.style.color = '#FF8C00';
      preciosTitle.style.textShadow = '0 0 20px rgba(255, 140, 0, 0.3)';
    }
    if (totalElement) {
      totalElement.style.background = 'linear-gradient(135deg, rgba(255, 140, 0, 0.2), rgba(255, 140, 0, 0.05))';
      totalElement.style.borderColor = '#FF8C00';
    }
    if (totalLabel) {
      totalLabel.style.color = '#FF8C00';
    }
    if (totalValue) {
      totalValue.style.color = '#FF8C00';
    }
    if (addItemBtn) {
      addItemBtn.style.background = 'linear-gradient(135deg, #FF8C00, #FF6B00)';
      addItemBtn.style.boxShadow = '0 4px 15px rgba(255, 140, 0, 0.3)';
    }
  }
  
  // Recalculate all items with new price type
  items = items.map(item => ({
    ...item,
    price: calculateItemPrice(
      item.category,
      item.width,
      item.height,
      item.linearMeters,
      item.quantity,
      item.selectedOption,
      item.includeLaqueado,
      item.includeCostura,
      item.includeTransporte
    )
  }));
  
  renderItems();
  updateTotal();
}

function updateFormFields() {
  const category = categorySelect.value;
  const product = priceData[category];

  // Hide all input types first
  sizeInputs.classList.add('hidden');
  linearInputs.classList.add('hidden');
  quantityOnly.classList.add('hidden');
  telaBanderaOptions.classList.add('hidden');
  laqueadoOption.classList.add('hidden');

  // Show appropriate inputs
  if (product.isLinear) {
    linearInputs.classList.remove('hidden');
    if (product.hasExtras) {
      telaBanderaOptions.classList.remove('hidden');
    }
  } else if (product.hasSize) {
    sizeInputs.classList.remove('hidden');
  } else {
    quantityOnly.classList.remove('hidden');
  }
  
  // Show laqueado checkbox if product has it
  if (product.hasLaqueado) {
    laqueadoOption.classList.remove('hidden');
    const laqueadoLabel = laqueadoOption.querySelector('span');
    laqueadoLabel.textContent = `Agregar Laqueado`;
  }

  // Update options based on current price type
  const options = currentPriceType === 'gremio' ? product.gremioOptions : product.clienteOptions;
  
  if (options && options.length > 0) {
    optionsContainer.classList.remove('hidden');
    optionsSelect.innerHTML = '<option value="">Seleccionar opción</option>';
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.name;
      option.textContent = opt.label;
      optionsSelect.appendChild(option);
    });
  } else {
    optionsContainer.classList.add('hidden');
  }
}

function calculateItemPrice(category, width, height, linearMeters, quantity, selectedOption, includeLaqueado, includeCostura, includeTransporte) {
  const product = priceData[category];
  if (!product) return 0;

  let basePrice = currentPriceType === 'gremio' ? product.gremio : product.cliente;
  let price = 0;
  let area = 1;
  
  // Get the correct options based on price type
  const options = currentPriceType === 'gremio' ? product.gremioOptions : product.clienteOptions;

  // Calculate based on product type
  if (product.isLinear) {
    // Linear meter products
    const meters = parseFloat(linearMeters) || 0;
    price = basePrice * meters;
    
    // Add laqueado cost if checked
    if (includeLaqueado && product.hasLaqueado) {
      price += (product.laqueadoCost || 5900) * meters;
    }
    
    // Add additional cost if option selected
    if (options && options.length > 0 && selectedOption) {
      const option = options.find(opt => opt.name === selectedOption);
      if (option && option.additionalCost !== undefined) {
        price += (option.additionalCost * meters);
      }
    }
    
    // Add extras for tela bandera
    if (product.hasExtras) {
      if (includeCostura) price += product.extras.costura;
      if (includeTransporte) price += product.extras.transporte;
    }
  } else if (product.hasSize && width && height) {
    // Area-based products (m²)
    area = (parseFloat(width) * parseFloat(height)) / 10000; // cm² to m²
    price = area * basePrice;
    
    // Add laqueado cost if checked
    if (includeLaqueado && product.hasLaqueado) {
      price += (product.laqueadoCost || 5900) * area;
    }
    
    console.log('Area calculation:', area, 'm²');
    console.log('Base price:', price);
    
    if (options && options.length > 0 && selectedOption) {
      const option = options.find(opt => opt.name === selectedOption);
      console.log('Found option:', option);
      if (option) {
        // Check if it has a fixed price (like "cartel completo")
        if (option.price !== undefined) {
          price = area * option.price;
          console.log('Using option price:', price, '=', area, '×', option.price);
        }
        // Or if it has additional cost to add to base
        else if (option.additionalCost !== undefined) {
          price += (area * option.additionalCost);
          console.log('Added additional cost:', area, '×', option.additionalCost);
        }
      }
    }
  } else if (product.fixedSize) {
    // Fixed size products (ploteo vehicular)
    area = product.fixedSize;
    const option = options?.find(opt => opt.name === selectedOption);
    if (option) {
      price = area * option.pricePerM2;
    }
  } else {
    // Unit-based products
    if (options && options.length > 0 && selectedOption) {
      const option = options.find(opt => opt.name === selectedOption);
      if (option) {
        price = basePrice;
        if (option.multiplier) {
          price *= option.multiplier;
        }
      } else {
        // Option selected but not found, use base price
        price = basePrice;
      }
    } else {
      // No options or no option selected, use base price
      price = basePrice;
    }
  }

  return price * (quantity || 1);
}

function addItem() {
  const category = categorySelect.value;
  const product = priceData[category];
  
  const width = document.getElementById('width').value;
  const height = document.getElementById('height').value;
  const linearMeters = document.getElementById('linearMeters').value;
  const quantity = product.isLinear ? 
    parseInt(document.getElementById('quantityLinear').value) :
    (product.hasSize ? 
      parseInt(document.getElementById('quantity').value) : 
      parseInt(document.getElementById('quantitySimple').value));
  const selectedOption = optionsSelect.value;
  const includeLaqueado = document.getElementById('includeLaqueado')?.checked || false;
  const includeCostura = document.getElementById('includeCostura')?.checked || false;
  const includeTransporte = document.getElementById('includeTransporte')?.checked || false;

  // Validation
  if (product.hasSize && (!width || !height)) {
    alert('Por favor ingresá las medidas');
    return;
  }
  
  if (product.isLinear && !linearMeters) {
    alert('Por favor ingresá los metros lineales');
    return;
  }

  // Options are now optional - no validation needed

  const price = calculateItemPrice(
    category,
    width,
    height,
    linearMeters,
    quantity,
    selectedOption,
    includeLaqueado,
    includeCostura,
    includeTransporte
  );
  
  console.log('=== DEBUG PRICE CALCULATION ===');
  console.log('Product:', product.name);
  console.log('Price Type:', currentPriceType);
  console.log('Selected Option:', selectedOption);
  console.log('Width:', width, 'Height:', height);
  console.log('Quantity:', quantity);
  console.log('Calculated Price:', price);
  console.log('===============================');

  const item = {
    id: Date.now(),
    category,
    name: product.name,
    productName: product.name,  // Agregado para compatibilidad con historial
    width,
    height,
    linearMeters,
    quantity,
    selectedOption,
    includeLaqueado,
    includeCostura,
    includeTransporte,
    price,
    priceType: currentPriceType
  };

  items.push(item);
  renderItems();
  updateTotal();
  
  addForm.classList.add('hidden');
  showFormBtn.classList.remove('hidden');
  resetForm();
}

function removeItem(id) {
  items = items.filter(item => item.id !== id);
  renderItems();
  updateTotal();
}

function renderItems() {
  if (items.length === 0) {
    itemsSection.classList.add('hidden');
    totalSection.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  itemsSection.classList.remove('hidden');
  totalSection.classList.remove('hidden');

  itemsList.innerHTML = items.map((item, idx) => {
    const product = priceData[item.category];
    let detailsText = '';
    
    if (item.width && item.height) {
      const area = (parseFloat(item.width) * parseFloat(item.height)) / 10000;
      detailsText = `${item.width}cm × ${item.height}cm (${area.toFixed(2)}m²)`;
    } else if (item.linearMeters) {
      detailsText = `${item.linearMeters}m lineales`;
    }
    
    if (detailsText) detailsText += ' • ';
    detailsText += `Cantidad: ${item.quantity}`;
    
    if (item.includeLaqueado) {
      detailsText += ' • Con laqueado';
    }
    
    if (item.selectedOption) {
      const options = item.priceType === 'gremio' ? product.gremioOptions : product.clienteOptions;
      const opt = options?.find(o => o.name === item.selectedOption);
      if (opt) detailsText += ` • ${opt.label}`;
    }
    
    if (item.includeCostura) detailsText += ' • Con costura';
    if (item.includeTransporte) detailsText += ' • Con transporte';

    return `
      <div class="item-card animate-in" style="animation-delay: ${idx * 0.05}s">
        <div class="item-info">
          <div class="item-name">${item.productName || item.name || 'Producto'}</div>
          <div class="item-details">${detailsText}</div>
        </div>
        <div class="item-actions">
          <div class="item-price">${formatPrice(item.price)}</div>
          <button class="btn-delete" onclick="removeItem(${item.id})">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateTotal() {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  totalAmount.textContent = formatPrice(total);
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(price);
}

function resetForm() {
  document.getElementById('width').value = '';
  document.getElementById('height').value = '';
  document.getElementById('linearMeters').value = '';
  document.getElementById('quantity').value = '1';
  document.getElementById('quantityLinear').value = '1';
  document.getElementById('quantitySimple').value = '1';
  optionsSelect.value = '';
  if (document.getElementById('includeLaqueado')) {
    document.getElementById('includeLaqueado').checked = false;
  }
  if (document.getElementById('includeCostura')) {
    document.getElementById('includeCostura').checked = false;
  }
  if (document.getElementById('includeTransporte')) {
    document.getElementById('includeTransporte').checked = false;
  }
  categorySelect.value = 'pvc';
  updateFormFields();
}

// Client Management Functions
async function loadSavedClients() {
  const clients = await dataManager.getClients(); // Usar clientes del gremio
  savedClientsSelect.innerHTML = '<option value="">Cargar cliente guardado...</option>';
  clients.forEach((client) => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = `${client.name} - ${client.contact || ''}`;
    savedClientsSelect.appendChild(option);
  });
}

async function saveClient() {
  const name = document.getElementById("clientName").value.trim();
  const contact = document.getElementById("clientContact").value.trim();
  
  if (!name) {
    alert("Por favor ingresá el nombre del cliente");
    return;
  }
  
  const client = { name, contact, notes: "" };
  
  const success = await gremioDataManager.saveClient(client);
  if (success) {
    alert("✅ Cliente guardado correctamente");
    loadSavedClients();
  } else {
    alert("❌ Error al guardar el cliente");
  }
}

async function saveClient_OLD() {
  const name = document.getElementById('clientName').value.trim();
  const contact = document.getElementById('clientContact').value.trim();
  
  if (!name) {
    alert('Por favor ingresá el nombre del cliente');
    return;
  }
  
  // Guardar usando dataManager
  const client = {
    name: name,
    contact: contact,
    notes: ''
  };
  
  dataManager.saveClient(client);
  loadSavedClients();
  alert('Cliente guardado correctamente');
}

async function loadClient() {
  const clientId = savedClientsSelect.value;
  if (!clientId) {
    clientQuickHistory.classList.add('hidden');
    noClientMessage.style.display = 'block';
    clientFullHistory.classList.add('hidden');
    return;
  }
  
  const clients = await dataManager.getClients();
  const client = clients.find(c => c.id === clientId);
  
  if (client) {
    // Cargar datos básicos
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientContact').value = client.contact || '';
    
    // Obtener estadísticas y historial
    const stats = await dataManager.getClientStats(clientId);
    const history = await dataManager.getClientHistory(clientId);
    
    console.log('📋 Cliente cargado:', client);
    console.log('📊 Estadísticas:', stats);
    console.log('📜 Historial:', history.length, 'cotizaciones');
    
    // Mostrar historial rápido
    showQuickHistory(client, history, stats);
    
    // Mostrar historial completo en el empty state
    showFullHistory(client, history, stats);
    
    // Mostrar notificación
    if (stats.totalCotizaciones > 0) {
      const notification = document.createElement('div');
      notification.className = 'client-notification';
      notification.innerHTML = `
        <strong>${client.name}</strong><br>
        ${stats.totalCotizaciones} cotizaciones • ${formatPrice(stats.totalFacturado)} facturado
      `;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #00c864, #00a854);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 200, 100, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }
}

function showQuickHistory(client, history, stats) {
  if (history.length === 0) {
    clientQuickHistory.classList.add('hidden');
    return;
  }
  
  clientQuickHistory.classList.remove('hidden');
  
  // Mostrar últimas 3 cotizaciones
  const recentHistory = history.slice(0, 3);
  
  quickHistoryContent.innerHTML = recentHistory.map(entry => {
    const date = new Date(entry.date);
    return `
      <div class="quick-history-item">
        <div class="quick-history-left">
          <div class="quick-history-date">${date.toLocaleDateString('es-AR')} ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="quick-history-details">
            <span class="quick-history-badge">${entry.priceType === 'gremio' ? 'GREMIO' : 'CLIENTE'}</span>
            ${entry.items.length} producto${entry.items.length !== 1 ? 's' : ''}
            ${entry.totalM2 > 0 ? ` • ${entry.totalM2.toFixed(2)} m²` : ''}
          </div>
        </div>
        <div class="quick-history-total">${formatPrice(entry.total)}</div>
      </div>
    `;
  }).join('');
}

function showFullHistory(client, history, stats) {
  if (history.length === 0) {
    // Mostrar mensaje de sin historial
    noClientMessage.style.display = 'block';
    clientFullHistory.classList.add('hidden');
    currentFullHistoryClient = null;
    currentFullHistoryData = null;
    return;
  }
  
  // Guardar para PDF
  currentFullHistoryClient = client;
  currentFullHistoryData = { history, stats };
  
  // Ocultar mensaje default y mostrar historial
  noClientMessage.style.display = 'none';
  clientFullHistory.classList.remove('hidden');
  
  // Info del cliente
  fullHistoryClientInfo.innerHTML = `
    <h4>${client.name}</h4>
    <p>${client.contact || 'Sin contacto'}</p>
    ${client.notes ? `<p style="font-style: italic; margin-top: 0.5rem;">${client.notes}</p>` : ''}
  `;
  
  // Estadísticas
  fullHistoryStats.innerHTML = `
    <div class="full-stat-card">
      <div class="full-stat-label">Total Cotizaciones</div>
      <div class="full-stat-value">${stats.totalCotizaciones}</div>
    </div>
    <div class="full-stat-card">
      <div class="full-stat-label">Facturado</div>
      <div class="full-stat-value">${formatPrice(stats.totalFacturado)}</div>
    </div>
    <div class="full-stat-card">
      <div class="full-stat-label">Total m²</div>
      <div class="full-stat-value">${stats.totalM2.toFixed(2)}</div>
    </div>
    <div class="full-stat-card">
      <div class="full-stat-label">Promedio</div>
      <div class="full-stat-value">${formatPrice(stats.promedioCotizacion)}</div>
    </div>
  `;
  
  // Lista completa de cotizaciones
  fullHistoryList.innerHTML = history.map((entry, index) => {
    const date = new Date(entry.date);
    return `
      <div class="full-history-item ${entry.approved ? 'approved' : ''}" data-entry-index="${index}">
        <div class="full-history-item-header">
          <div>
            <span class="full-history-item-date">${date.toLocaleDateString('es-AR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
            <span class="full-history-item-badge">${entry.priceType === 'gremio' ? 'GREMIO' : 'CLIENTE'}</span>
            ${entry.approved ? '<span class="approved-badge">✓ APROBADO</span>' : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="full-history-item-total">${formatPrice(entry.total)}</div>
            <div class="history-item-actions">
              <button class="btn-edit-history" onclick="editHistoryEntry(${index})" title="Editar cotización">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-delete-history" onclick="deleteHistoryEntry(${index})" title="Eliminar cotización">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="full-history-item-details">
          ${entry.items.length} producto${entry.items.length !== 1 ? 's' : ''}
          ${entry.totalM2 > 0 ? ` • ${entry.totalM2.toFixed(2)} m²` : ''}
          ${entry.rentabilidad ? ` • Margen: ${entry.rentabilidad.margenPorcentaje}%` : ''}
        </div>
        <div class="full-history-item-products">
          ${entry.items.map(item => `
            <div class="full-history-product">${item.productName || item.name || item.category || 'Producto'} - ${formatPrice(item.price)}</div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function handleClientSelectChange() {
  const clientId = savedClientsSelect.value;
  currentSelectedClientId = clientId;
  
  if (clientId) {
    btnViewHistory.disabled = false;
    await loadClient(); // Await para asegurar que se carga todo
  } else {
    btnViewHistory.disabled = true;
    clientQuickHistory.classList.add('hidden');
  }
}

// History Modal Functions
let m2ChartInstance = null;
let revenueChartInstance = null;

async function openHistoryModal() {
  if (!currentSelectedClientId) {
    alert('Por favor seleccioná un cliente primero');
    return;
  }
  
  const clients = await dataManager.getClients();
  const client = clients.find(c => c.id === currentSelectedClientId);
  
  if (!client) {
    alert('Cliente no encontrado');
    return;
  }
  
  // Show modal
  historyModal.classList.remove('hidden');
  
  // Load client info
  historyClientInfo.innerHTML = `
    <h3>${client.name}</h3>
    <p style="color: #888;">${client.contact || 'Sin contacto'}</p>
    ${client.notes ? `<p style="color: #666; font-style: italic; margin-top: 0.5rem;">${client.notes}</p>` : ''}
  `;
  
  // Load stats
  const stats = await dataManager.getClientStats(currentSelectedClientId);
  historyStats.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">Total Presupuestos</div>
      <div class="stat-card-value">${stats.totalPresupuestos}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Total Facturado</div>
      <div class="stat-card-value">${formatPrice(stats.totalFacturado)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Total m²</div>
      <div class="stat-card-value">${stats.totalM2.toFixed(2)} m²</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Promedio</div>
      <div class="stat-card-value">${formatPrice(stats.promedioPresupuesto)}</div>
    </div>
  `;
  
  // Load history
  const history = await dataManager.getClientHistory(currentSelectedClientId);
  
  // Generate charts
  generateCharts(history);
  
  if (history.length === 0) {
    historyList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No hay presupuestos en el historial</p>';
  } else {
    historyList.innerHTML = history.map(entry => `
      <div class="history-item">
        <div class="history-item-header">
          <div>
            <span class="history-item-badge">${entry.priceType === 'gremio' ? 'GREMIO' : 'CLIENTE'}</span>
            <span class="history-item-date">${new Date(entry.date).toLocaleDateString('es-AR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
          <div class="history-item-total">${formatPrice(entry.total)}</div>
        </div>
        <div class="history-item-details">
          ${entry.items.length} producto${entry.items.length !== 1 ? 's' : ''}
          ${entry.totalM2 > 0 ? ` • ${entry.totalM2.toFixed(2)} m²` : ''}
        </div>
      </div>
    `).join('');
  }
}

function generateCharts(history) {
  if (history.length === 0) {
    document.getElementById('historyCharts').style.display = 'none';
    return;
  }
  
  document.getElementById('historyCharts').style.display = 'grid';
  
  // Agrupar datos por mes
  const monthlyData = {};
  
  history.forEach(entry => {
    const date = new Date(entry.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        m2: 0,
        revenue: 0,
        count: 0
      };
    }
    
    monthlyData[monthKey].m2 += entry.totalM2 || 0;
    monthlyData[monthKey].revenue += entry.total;
    monthlyData[monthKey].count += 1;
  });
  
  // Ordenar por fecha
  const sortedMonths = Object.keys(monthlyData).sort();
  
  // Formatear labels (ej: "Ene 2026")
  const labels = sortedMonths.map(key => {
    const [year, month] = key.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
  });
  
  const m2Data = sortedMonths.map(key => monthlyData[key].m2.toFixed(2));
  const revenueData = sortedMonths.map(key => monthlyData[key].revenue);
  
  // Destroy previous charts if they exist
  if (m2ChartInstance) m2ChartInstance.destroy();
  if (revenueChartInstance) revenueChartInstance.destroy();
  
  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#888'
        },
        grid: {
          color: 'rgba(255, 193, 7, 0.1)'
        }
      },
      x: {
        ticks: {
          color: '#888'
        },
        grid: {
          color: 'rgba(255, 193, 7, 0.1)'
        }
      }
    }
  };
  
  // M² Chart
  const m2Ctx = document.getElementById('m2Chart').getContext('2d');
  m2ChartInstance = new Chart(m2Ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'm²',
        data: m2Data,
        backgroundColor: 'rgba(255, 193, 7, 0.7)',
        borderColor: '#FFC107',
        borderWidth: 2
      }]
    },
    options: chartOptions
  });
  
  // Revenue Chart
  const revenueCtx = document.getElementById('revenueChart').getContext('2d');
  revenueChartInstance = new Chart(revenueCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Facturación',
        data: revenueData,
        backgroundColor: 'rgba(0, 150, 255, 0.1)',
        borderColor: '#0096ff',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          ticks: {
            ...chartOptions.scales.y.ticks,
            callback: function(value) {
              return '$' + value.toLocaleString('es-AR');
            }
          }
        }
      }
    }
  });
}

function closeHistory() {
  historyModal.classList.add('hidden');
  // Destroy charts
  if (m2ChartInstance) {
    m2ChartInstance.destroy();
    m2ChartInstance = null;
  }
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
    revenueChartInstance = null;
  }
}

async function downloadHistoryPDF() {
  if (!currentSelectedClientId) return;
  
  const clients = dataManager.getClients();
  const client = clients.find(c => c.id === currentSelectedClientId);
  
  if (!client) return;
  
  const history = await dataManager.getClientHistory(currentSelectedClientId);
  const stats = await dataManager.getClientStats(currentSelectedClientId);
  
  if (!history || history.length === 0) {
    alert('Este cliente no tiene historial para descargar');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  let yPos = 20;
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 217, 255);
  doc.text('HISTORIAL DEL CLIENTE', 105, yPos, { align: 'center' });
  
  yPos += 15;
  
  // Client info
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(client.name, 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  if (client.contact) {
    doc.text(`Contacto: ${client.contact}`, 20, yPos);
    yPos += 6;
  }
  if (client.notes) {
    doc.text(`Notas: ${client.notes}`, 20, yPos);
    yPos += 6;
  }
  
  yPos += 5;
  
  // Stats
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('RESUMEN:', 20, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.text(`Total Presupuestos: ${stats.totalPresupuestos}`, 20, yPos);
  doc.text(`Total Facturado: $${stats.totalFacturado.toLocaleString('es-AR')}`, 110, yPos);
  yPos += 6;
  doc.text(`Total m²: ${stats.totalM2.toFixed(2)} m²`, 20, yPos);
  doc.text(`Promedio: $${stats.promedioPresupuesto.toLocaleString('es-AR')}`, 110, yPos);
  
  yPos += 15;
  
  // History list
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('HISTORIAL DE COTIZACIONES:', 20, yPos);
  yPos += 8;
  
  history.forEach((quotation, index) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    const date = new Date(quotation.date);
    const dateStr = date.toLocaleDateString('es-AR');
    const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`${index + 1}. ${dateStr} - ${timeStr}`, 20, yPos);
    
    yPos += 6;
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total: $${quotation.total.toLocaleString('es-AR')} | Tipo: ${quotation.priceType.toUpperCase()}`, 25, yPos);
    
    yPos += 5;
    
    // Products
    quotation.items.forEach((item) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      
      let productLine = `  • ${item.productName}`;
      if (item.width && item.height) {
        productLine += ` - ${item.width}x${item.height}cm`;
      }
      if (item.linearMeters) {
        productLine += ` - ${item.linearMeters}ml`;
      }
      if (item.quantity > 1) {
        productLine += ` (x${item.quantity})`;
      }
      productLine += ` - $${item.price.toLocaleString('es-AR')}`;
      
      doc.text(productLine, 30, yPos);
      yPos += 4;
    });
    
    yPos += 6;
  });
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`MR Letreros - Historial del Cliente - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
  }
  
  // Download
  const fileName = `Historial_${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

function downloadFullHistoryPDF() {
  if (!currentFullHistoryClient || !currentFullHistoryData) {
    alert('No hay historial para descargar');
    return;
  }
  
  const client = currentFullHistoryClient;
  const { history, stats } = currentFullHistoryData;
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  let yPos = 20;
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 217, 255);
  doc.text('HISTORIAL COMPLETO', 105, yPos, { align: 'center' });
  
  yPos += 15;
  
  // Client info
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(client.name, 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  if (client.contact) {
    doc.text(`Contacto: ${client.contact}`, 20, yPos);
    yPos += 6;
  }
  if (client.notes) {
    doc.text(`Notas: ${client.notes}`, 20, yPos);
    yPos += 6;
  }
  
  yPos += 5;
  
  // Stats
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('RESUMEN:', 20, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.text(`Total Cotizaciones: ${stats.totalCotizaciones}`, 20, yPos);
  doc.text(`Total Facturado: $${stats.totalFacturado.toLocaleString('es-AR')}`, 110, yPos);
  yPos += 6;
  doc.text(`Total m²: ${stats.totalM2.toFixed(2)} m²`, 20, yPos);
  doc.text(`Promedio: $${stats.promedioCotizacion.toLocaleString('es-AR')}`, 110, yPos);
  
  yPos += 15;
  
  // History list
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('HISTORIAL DE COTIZACIONES:', 20, yPos);
  yPos += 8;
  
  history.forEach((quotation, index) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    const date = new Date(quotation.date);
    const dateStr = date.toLocaleDateString('es-AR');
    const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`${index + 1}. ${dateStr} - ${timeStr}`, 20, yPos);
    
    yPos += 6;
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total: $${quotation.total.toLocaleString('es-AR')} | Tipo: ${quotation.priceType.toUpperCase()}`, 25, yPos);
    
    yPos += 5;
    
    // Products
    quotation.items.forEach((item) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      
      const productName = item.productName || item.name || item.category || 'Producto';
      let productLine = `  • ${productName}`;
      if (item.width && item.height) {
        productLine += ` - ${item.width}x${item.height}cm`;
      }
      if (item.linearMeters) {
        productLine += ` - ${item.linearMeters}ml`;
      }
      if (item.quantity > 1) {
        productLine += ` (x${item.quantity})`;
      }
      productLine += ` - $${item.price.toLocaleString('es-AR')}`;
      
      doc.text(productLine, 30, yPos);
      yPos += 4;
    });
    
    yPos += 6;
  });
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`MR Letreros - Historial Completo - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
  }
  
  // Download
  const fileName = `Historial_Completo_${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

function calculateTotalArea() {
  let totalArea = 0;
  items.forEach(item => {
    const product = priceData[item.category];
    if (product.hasSize && item.width && item.height) {
      const area = (parseFloat(item.width) * parseFloat(item.height)) / 10000;
      totalArea += area * item.quantity;
    }
  });
  return totalArea;
}

// Tab Management
function switchTab(tab) {
  const tabActualizaciones = document.getElementById('tabActualizaciones');
  const actualizacionesTab = document.getElementById('actualizacionesTab');
  const tabCostos = document.getElementById('tabCostos');
  const costosTab = document.getElementById('costosTab');
  
  if (tab === 'precios') {
    tabPrecios.classList.add('active');
    tabClientes.classList.remove('active');
    if (tabCostos) tabCostos.classList.remove('active');
    tabDatos.classList.remove('active');
    if (tabActualizaciones) tabActualizaciones.classList.remove('active');
    preciosTab.classList.remove('hidden');
    clientesTab.classList.add('hidden');
    if (costosTab) costosTab.classList.add('hidden');
    datosTab.classList.add('hidden');
    if (actualizacionesTab) actualizacionesTab.classList.add('hidden');
  } else if (tab === 'clientes') {
    tabPrecios.classList.remove('active');
    tabClientes.classList.add('active');
    if (tabCostos) tabCostos.classList.remove('active');
    tabDatos.classList.remove('active');
    if (tabActualizaciones) tabActualizaciones.classList.remove('active');
    preciosTab.classList.add('hidden');
    clientesTab.classList.remove('hidden');
    if (costosTab) costosTab.classList.add('hidden');
    datosTab.classList.add('hidden');
    if (actualizacionesTab) actualizacionesTab.classList.add('hidden');
    loadGremioClients();
  } else if (tab === 'costos') {
    tabPrecios.classList.remove('active');
    tabClientes.classList.remove('active');
    if (tabCostos) tabCostos.classList.add('active');
    tabDatos.classList.remove('active');
    if (tabActualizaciones) tabActualizaciones.classList.remove('active');
    preciosTab.classList.add('hidden');
    clientesTab.classList.add('hidden');
    if (costosTab) costosTab.classList.remove('hidden');
    datosTab.classList.add('hidden');
    if (actualizacionesTab) actualizacionesTab.classList.add('hidden');
    loadCostosTab();
  } else if (tab === 'datos') {
    tabPrecios.classList.remove('active');
    tabClientes.classList.remove('active');
    if (tabCostos) tabCostos.classList.remove('active');
    tabDatos.classList.add('active');
    if (tabActualizaciones) tabActualizaciones.classList.remove('active');
    preciosTab.classList.add('hidden');
    clientesTab.classList.add('hidden');
    if (costosTab) costosTab.classList.add('hidden');
    datosTab.classList.remove('hidden');
    if (actualizacionesTab) actualizacionesTab.classList.add('hidden');
    loadDataManagementTab();
  } else if (tab === 'actualizaciones') {
    tabPrecios.classList.remove('active');
    tabClientes.classList.remove('active');
    if (tabCostos) tabCostos.classList.remove('active');
    tabDatos.classList.remove('active');
    if (tabActualizaciones) tabActualizaciones.classList.add('active');
    preciosTab.classList.add('hidden');
    clientesTab.classList.add('hidden');
    if (costosTab) costosTab.classList.add('hidden');
    datosTab.classList.add('hidden');
    if (actualizacionesTab) actualizacionesTab.classList.remove('hidden');
  }
}

// Gremio Clients Management
async function loadGremioClients() {
  const clients = await dataManager.getClients();
  
  // Populate selector
  loadGremioClient.innerHTML = '<option value="">Seleccionar cliente...</option>';
  clients.forEach((client) => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = `${client.name} - ${client.contact}`;
    loadGremioClient.appendChild(option);
  });
  
  // Populate list
  if (clients.length === 0) {
    gremioClientsList.innerHTML = '<p style="color: #666; text-align: center; padding: 2rem;">No hay clientes guardados</p>';
    return;
  }
  
  gremioClientsList.innerHTML = clients.map((client) => `
    <div class="client-card">
      <div class="client-card-info">
        <div class="client-card-name">${client.name}</div>
        <div class="client-card-contact">${client.contact || ''}</div>
        ${client.notes ? `<div class="client-card-notes">${client.notes}</div>` : ''}
      </div>
      <div class="client-card-actions">
        <button class="btn-edit-client" onclick="editGremioClient('${client.id}')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn-delete-client" onclick="deleteGremioClient('${client.id}')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

async function saveGremioClient() {
  const name = gremioClientName.value.trim();
  const contact = gremioClientContact.value.trim();
  const notes = gremioClientNotes.value.trim();
  
  if (!name) {
    alert('Por favor ingresá el nombre del cliente');
    return;
  }
  
  const client = {
    name: name,
    contact: contact,
    notes: notes
  };

  try {
    if (currentEditingGremioClient !== null) {
      // Update existing client
      client.id = currentEditingGremioClient;
      const saved = await dataManager.saveClient(client);
      currentEditingGremioClient = null;
      
      if (saved) {
        alert('✅ Cliente actualizado correctamente');
      } else {
        alert('❌ Error al actualizar cliente');
        return;
      }
    } else {
      // Add new client
      const saved = await dataManager.saveClient(client);
      
      if (saved) {
        alert(`✅ Cliente guardado correctamente
        
Se creó la carpeta: ${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
      } else {
        alert('❌ Error al guardar cliente');
        return;
      }
    }
    
    // Clear form
    gremioClientName.value = '';
    gremioClientContact.value = '';
    gremioClientNotes.value = '';
    loadGremioClient.value = '';
    
    await loadGremioClients();
  } catch (error) {
    console.error('Error al guardar cliente:', error);
    alert('❌ Error al guardar cliente: ' + error.message);
  }
}

function loadGremioClientToForm() {
  const clientId = loadGremioClient.value;
  if (!clientId) return;
  
  const clients = dataManager.getClients();
  const client = clients.find(c => c.id === clientId);
  
  if (client) {
    gremioClientName.value = client.name;
    gremioClientContact.value = client.contact || '';
    gremioClientNotes.value = client.notes || '';
    currentEditingGremioClient = clientId;
  }
}

async function editGremioClient(clientId) {
  const clients = await dataManager.getClients();
  const client = clients.find(c => c.id === clientId);
  
  if (client) {
    gremioClientName.value = client.name;
    gremioClientContact.value = client.contact || '';
    gremioClientNotes.value = client.notes || '';
    currentEditingGremioClient = clientId;
    
    // Scroll to form
    gremioClientName.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function deleteGremioClient(clientId) {
  const clients = await dataManager.getClients();
  const client = clients.find(c => c.id === clientId);
  
  if (client && confirm(`¿Eliminar el cliente "${client.name}"?\n\nEsto eliminará también su carpeta y todas sus cotizaciones.`)) {
    const deleted = await dataManager.deleteClient(clientId);
    if (deleted) {
      alert('✅ Cliente eliminado correctamente');
      await loadGremioClients();
    } else {
      alert('❌ Error al eliminar cliente');
    }
  }
}

async function exportToPDF() {
  // Validar que haya productos
  if (items.length === 0) {
    alert('⚠️ No hay productos en la cotización para exportar');
    return;
  }
  
  const clientName = document.getElementById('clientName').value || 'Sin especificar';
  const clientContact = document.getElementById('clientContact').value || 'Sin especificar';
  const date = new Date().toLocaleDateString('es-AR', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  const priceTypeLabel = currentPriceType === 'gremio' ? 'GREMIO' : 'CLIENTE';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  
  // Cargar logo
  let logoImg = null;
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        logoImg = img;
        resolve();
      };
      img.onerror = reject;
      img.src = 'img/logoblack.png';
    });
  } catch (error) {
    console.log('No se pudo cargar el logo, usando diseño sin imagen');
  }
  
  // ============================================
  // FUNCIÓN PARA AGREGAR MEMBRETE EN CADA PÁGINA
  // ============================================
  function addLetterhead(pageNum) {
    // Fondo negro a la izquierda (parte del logo)
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 80, 35, 'F');
    
    // Fondo naranja/amarillo a la derecha
    doc.setFillColor(255, 165, 0);
    doc.rect(80, 0, pageWidth - 80, 35, 'F');
    
    // Si hay logo, usarlo; si no, usar texto
    if (logoImg) {
      // Agregar logo como imagen (ajustado al espacio negro)
      doc.addImage(logoImg, 'PNG', 5, 5, 70, 25);
    } else {
      // Logo "MR" en amarillo (fallback)
      doc.setFontSize(36);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 215, 0); // Amarillo dorado
      doc.text('MR', 15, 18);
      
      // "LETREROS" en blanco debajo de MR
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('LETREROS', 15, 28);
      
      // Rectángulo blanco para "LETREROS"
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1);
      doc.rect(14, 21, 38, 9);
    }
    
    // "SERVICIOS GRÁFICOS INTEGRALES" en blanco
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('SERVICIOS GRÁFICOS INTEGRALES', 90, 15);
    
    // Información de contacto en el header naranja
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    
    // Dirección
    doc.setFontSize(10);
    doc.setFillColor(255, 0, 0);
    doc.circle(85, 25, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('J.P.Lopez 3162', 90, 27);
    
    // Teléfono
    doc.setFillColor(255, 0, 0);
    doc.circle(130, 25, 2, 'F');
    doc.text('3426136868', 135, 27);
    
    // Instagram
    doc.setFillColor(255, 0, 0);
    doc.circle(165, 25, 2, 'F');
    doc.text('@mrletreros', 170, 27);
    
    // Línea decorativa debajo del header
    doc.setDrawColor(255, 165, 0);
    doc.setLineWidth(2);
    doc.line(0, 35, pageWidth, 35);
    
    // Footer elegante
    const footerY = pageHeight - 15;
    doc.setDrawColor(255, 165, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    doc.text('Presupuesto generado por Sistema MR Letreros', margin, footerY);
    doc.text(`Página ${pageNum}`, pageWidth - margin, footerY, { align: 'right' });
  }
  
  // ============================================
  // PÁGINA 1 - INFORMACIÓN PRINCIPAL
  // ============================================
  let currentPage = 1;
  addLetterhead(currentPage);
  
  let yPos = 50; // Empezar después del header
  
  // Título del documento con fondo
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 15, 3, 3, 'F');
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('PRESUPUESTO', margin + 5, yPos + 10);
  
  // Badge del tipo de precio
  const badgeX = pageWidth - margin - 50;
  if (priceTypeLabel === 'GREMIO') {
    doc.setFillColor(81, 207, 102); // Verde
  } else {
    doc.setFillColor(255, 165, 0); // Naranja
  }
  doc.roundedRect(badgeX, yPos + 2, 45, 10, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(priceTypeLabel, badgeX + 22.5, yPos + 8.5, { align: 'center' });
  
  yPos += 25;
  
  // Información del cliente en cuadro
  doc.setDrawColor(255, 165, 0); // Naranja
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 35, 3, 3);
  
  yPos += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 165, 0); // Naranja
  doc.text('DATOS DEL CLIENTE', margin + 5, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Cliente:', margin + 5, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(clientName, margin + 25, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Contacto:', margin + 5, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(clientContact, margin + 25, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Fecha:', margin + 5, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(date, margin + 25, yPos);
  
  yPos += 20;
  
  // Título de productos
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 165, 0); // Naranja
  doc.text('DETALLE DE PRODUCTOS', margin, yPos);
  
  yPos += 8;
  
  // ============================================
  // PRODUCTOS EN TABLA ELEGANTE
  // ============================================
  items.forEach((item, idx) => {
    // Verificar si necesita nueva página
    if (yPos > pageHeight - 60) {
      doc.addPage();
      currentPage++;
      addLetterhead(currentPage);
      yPos = 50;
    }
    
    const product = priceData[item.category];
    
    // Fondo alternado para cada producto
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
    } else {
      doc.setFillColor(245, 245, 245);
    }
    
    const boxHeight = 30; // Altura inicial
    let extraHeight = 0;
    
    // Calcular altura extra según opciones
    if (item.width && item.height) extraHeight += 5;
    if (item.linearMeters) extraHeight += 5;
    if (item.selectedOption) extraHeight += 5;
    if (item.includeLaqueado) extraHeight += 5;
    if (item.includeCostura) extraHeight += 5;
    if (item.includeTransporte) extraHeight += 5;
    
    doc.roundedRect(margin, yPos - 5, pageWidth - (margin * 2), boxHeight + extraHeight, 2, 2, 'F');
    
    // Número de item en círculo naranja
    doc.setFillColor(255, 165, 0); // Naranja
    doc.circle(margin + 5, yPos, 4, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${idx + 1}`, margin + 5, yPos + 1.5, { align: 'center' });
    
    // Nombre del producto
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(item.name, margin + 12, yPos);
    
    yPos += 6;
    
    // Detalles del producto
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    if (item.width && item.height) {
      const area = (parseFloat(item.width) * parseFloat(item.height)) / 10000;
      doc.text(`Medidas: ${item.width}cm x ${item.height}cm (${area.toFixed(2)}m2)`, margin + 12, yPos);
      yPos += 5;
    }
    
    if (item.linearMeters) {
      doc.text(`Metros lineales: ${item.linearMeters}m`, margin + 12, yPos);
      yPos += 5;
    }
    
    doc.text(`Cantidad: ${item.quantity}`, margin + 12, yPos);
    yPos += 5;
    
    // Opciones adicionales
    if (item.selectedOption) {
      const options = item.priceType === 'gremio' ? product.gremioOptions : product.clienteOptions;
      const opt = options?.find(o => o.name === item.selectedOption);
      if (opt) {
        doc.setTextColor(255, 140, 0); // Naranja oscuro
        doc.text(`+ ${opt.label}`, margin + 12, yPos);
        yPos += 5;
      }
    }
    
    if (item.includeLaqueado) {
      doc.setTextColor(255, 140, 0); // Naranja oscuro
      doc.text('+ Con laqueado', margin + 12, yPos);
      yPos += 5;
    }
    
    if (item.includeCostura) {
      doc.setTextColor(255, 140, 0); // Naranja oscuro
      doc.text('+ Con costura', margin + 12, yPos);
      yPos += 5;
    }
    
    if (item.includeTransporte) {
      doc.setTextColor(255, 140, 0); // Naranja oscuro
      doc.text('+ Con transporte', margin + 12, yPos);
      yPos += 5;
    }
    
    // Precio en el lado derecho con destaque naranja
    doc.setFillColor(255, 165, 0); // Naranja
    doc.roundedRect(pageWidth - margin - 45, yPos - boxHeight - extraHeight + 3, 43, 12, 2, 2, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(formatPrice(item.price), pageWidth - margin - 23.5, yPos - boxHeight - extraHeight + 11, { align: 'center' });
    
    yPos += 8;
  });
  
  // ============================================
  // TOTALES CON DISEÑO ELEGANTE
  // ============================================
  yPos += 10;
  
  // Verificar si necesita nueva página para totales
  if (yPos > pageHeight - 80) {
    doc.addPage();
    currentPage++;
    addLetterhead(currentPage);
    yPos = 50;
  }
  
  // Línea separadora naranja
  doc.setDrawColor(255, 165, 0); // Naranja
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 12;
  
  // Total m² si aplica
  const totalArea = calculateTotalArea();
  if (totalArea > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Total de superficie:', margin + 5, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 165, 0); // Naranja
    doc.text(`${totalArea.toFixed(2)} m2`, pageWidth - margin - 5, yPos, { align: 'right' });
    yPos += 10;
  }
  
  // TOTAL con fondo destacado naranja
  doc.setFillColor(255, 165, 0); // Naranja
  doc.roundedRect(margin, yPos - 5, pageWidth - (margin * 2), 18, 3, 3, 'F');
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL:', margin + 10, yPos + 7);
  
  const total = items.reduce((sum, item) => sum + item.price, 0);
  doc.setFontSize(18);
  doc.text(formatPrice(total), pageWidth - margin - 10, yPos + 7, { align: 'right' });
  
  yPos += 25;
  
  // Notas finales
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('• Presupuesto válido por 15 días', margin + 5, yPos);
  yPos += 5;
  doc.text('• Los precios no incluyen IVA', margin + 5, yPos);
  yPos += 5;
  doc.text('• Tiempo de entrega: a coordinar', margin + 5, yPos);
  
  // Agregar número de página a todas las páginas
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${i}`, pageWidth - margin, footerY, { align: 'right' });
  }
  
  // Save PDF
  doc.save(`Presupuesto_${priceTypeLabel}_${clientName.replace(/\s/g, '_')}_${Date.now()}.pdf`);
}

// ============================================
// COSTOS MANAGEMENT v2.2
// ============================================

let costosManager;

// Inicializar costos manager
async function initializeCostosManager() {
  const serverUrl = window.location.origin;
  costosManager = new CostosManager(serverUrl);
  await costosManager.loadCostos();
  console.log('✅ Costos Manager inicializado');
}

// Cargar tab de costos
async function loadCostosTab() {
  if (!costosManager) {
    await initializeCostosManager();
  }
  
  // Cargar configuración general
  const config = costosManager.configuracion;
  document.getElementById('mostrarCostosEnCotizacion').checked = config.mostrarCostosEnCotizacion;
  document.getElementById('mostrarMargenesEnCotizacion').checked = config.mostrarMargenesEnCotizacion;
  document.getElementById('alertarMargenBajo').checked = config.alertarMargenBajo;
  document.getElementById('margenMinimoGeneral').value = config.margenMinimoGeneral;
  document.getElementById('margenObjetivoGeneral').value = config.margenObjetivoGeneral;
  
  // Renderizar lista de productos
  renderCostosProductsList();
}

// Renderizar lista de productos con costos
function renderCostosProductsList() {
  const container = document.getElementById('costosProductsList');
  const costos = costosManager.costos;
  
  if (Object.keys(costos).length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-color-secondary); padding: 2rem;">No hay productos configurados</p>';
    return;
  }
  
  container.innerHTML = Object.entries(costos).map(([categoria, costo]) => {
    const lastUpdate = new Date(costo.ultimaActualizacion).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const tipoLabel = costo.tipo === 'm2' ? '/m²' : costo.tipo === 'ml' ? '/ml' : '/unidad';
    
    return `
      <div class="cost-product-card" data-categoria="${categoria}">
        <div class="cost-product-header">
          <div class="cost-product-name">📦 ${costo.producto}</div>
          <button class="btn-edit-cost" onclick="openEditCostModal('${categoria}')">
            ✏️ Editar
          </button>
        </div>
        
        <div class="cost-breakdown">
          <div class="cost-item">
            <span class="cost-item-label">💵 Material:</span>
            <span class="cost-item-value">${formatPrice(costo.costoMaterial)} ${tipoLabel}</span>
          </div>
          <div class="cost-item">
            <span class="cost-item-label">👷 Mano de Obra:</span>
            <span class="cost-item-value">${formatPrice(costo.costoManoObra)} ${tipoLabel}</span>
          </div>
          <div class="cost-item">
            <span class="cost-item-label">🏢 Indirectos:</span>
            <span class="cost-item-value">${formatPrice(costo.costosIndirectos)} ${tipoLabel}</span>
          </div>
        </div>
        
        <div class="cost-separator-line"></div>
        
        <div class="cost-total-row">
          <span class="cost-total-label">💰 COSTO TOTAL:</span>
          <span class="cost-total-value">${formatPrice(costo.costoTotal)} ${tipoLabel}</span>
        </div>
        
        <div class="cost-last-update">
          Última actualización: ${lastUpdate}
        </div>
      </div>
    `;
  }).join('');
}

// Abrir modal de edición de costo
function openEditCostModal(categoria) {
  const costo = costosManager.getCosto(categoria);
  if (!costo) return;
  
  costosManager.currentEditingCategory = categoria;
  
  // Llenar formulario
  document.getElementById('editCostProductName').textContent = costo.producto;
  document.getElementById('editCostoMaterial').value = costo.costoMaterial;
  document.getElementById('editCostoManoObra').value = costo.costoManoObra;
  document.getElementById('editCostosIndirectos').value = costo.costosIndirectos;
  document.getElementById('editMargenMinimo').value = costo.margenMinimo;
  document.getElementById('editMargenObjetivo').value = costo.margenObjetivo;
  
  // Seleccionar tipo
  document.querySelector(`input[name="costType"][value="${costo.tipo}"]`).checked = true;
  updateCostTypeUnits(costo.tipo);
  
  // Calcular total
  updateEditCostTotal();
  
  // Mostrar modal
  document.getElementById('editCostModal').classList.remove('hidden');
}

// Actualizar unidades según el tipo seleccionado
function updateCostTypeUnits(tipo) {
  const unit = tipo === 'm2' ? '/m²' : tipo === 'ml' ? '/ml' : '/unidad';
  document.getElementById('materialUnit').textContent = unit;
  document.getElementById('laborUnit').textContent = unit;
  document.getElementById('indirectUnit').textContent = unit;
  document.getElementById('totalUnit').textContent = unit;
}

// Actualizar total de costos en el modal de edición
function updateEditCostTotal() {
  const material = parseFloat(document.getElementById('editCostoMaterial').value) || 0;
  const manoObra = parseFloat(document.getElementById('editCostoManoObra').value) || 0;
  const indirectos = parseFloat(document.getElementById('editCostosIndirectos').value) || 0;
  
  const total = material + manoObra + indirectos;
  document.getElementById('editCostoTotal').textContent = formatPrice(total);
}

// Cerrar modal de edición de costo
function closeEditCostModal() {
  document.getElementById('editCostModal').classList.add('hidden');
  costosManager.currentEditingCategory = null;
}

// Guardar costo editado
async function saveEditedCost() {
  const categoria = costosManager.currentEditingCategory;
  if (!categoria) return;
  
  const costo = costosManager.getCosto(categoria);
  
  const costoData = {
    producto: costo.producto,
    categoria: categoria,
    tipo: document.querySelector('input[name="costType"]:checked').value,
    costoMaterial: parseFloat(document.getElementById('editCostoMaterial').value) || 0,
    costoManoObra: parseFloat(document.getElementById('editCostoManoObra').value) || 0,
    costosIndirectos: parseFloat(document.getElementById('editCostosIndirectos').value) || 0,
    costoTotal: 0,
    margenMinimo: parseFloat(document.getElementById('editMargenMinimo').value) || 15,
    margenObjetivo: parseFloat(document.getElementById('editMargenObjetivo').value) || 30
  };
  
  // Calcular total
  costoData.costoTotal = costoData.costoMaterial + costoData.costoManoObra + costoData.costosIndirectos;
  
  // Guardar
  const saved = await costosManager.saveCosto(categoria, costoData);
  
  if (saved) {
    alert('✅ Costo actualizado correctamente');
    closeEditCostModal();
    renderCostosProductsList();
  }
}

// Guardar todos los cambios de configuración
async function saveAllCostosChanges() {
  // Actualizar configuración
  costosManager.configuracion.mostrarCostosEnCotizacion = document.getElementById('mostrarCostosEnCotizacion').checked;
  costosManager.configuracion.mostrarMargenesEnCotizacion = document.getElementById('mostrarMargenesEnCotizacion').checked;
  costosManager.configuracion.alertarMargenBajo = document.getElementById('alertarMargenBajo').checked;
  costosManager.configuracion.margenMinimoGeneral = parseFloat(document.getElementById('margenMinimoGeneral').value) || 15;
  costosManager.configuracion.margenObjetivoGeneral = parseFloat(document.getElementById('margenObjetivoGeneral').value) || 30;
  
  // Guardar
  const saved = await costosManager.saveCostos();
  
  if (saved) {
    alert('✅ Configuración guardada correctamente');
  }
}

// Abrir modal de agregar nuevo producto
function openAddProductModal() {
  document.getElementById('addProductModal').classList.remove('hidden');
  // Limpiar formulario
  document.getElementById('newProductName').value = '';
  document.getElementById('newProductCategory').value = '';
  document.getElementById('newProductCostoMaterial').value = '';
  document.getElementById('newProductCostoManoObra').value = '';
  document.getElementById('newProductCostosIndirectos').value = '';
  document.querySelector('input[name="newProductType"][value="m2"]').checked = true;
  updateNewProductTypeUnits('m2');
  updateNewProductCostTotal();
}

// Cerrar modal de agregar producto
function closeAddProductModal() {
  document.getElementById('addProductModal').classList.add('hidden');
}

// Actualizar unidades en modal de nuevo producto
function updateNewProductTypeUnits(tipo) {
  const unit = tipo === 'm2' ? '/m²' : tipo === 'ml' ? '/ml' : '/unidad';
  document.getElementById('newMaterialUnit').textContent = unit;
  document.getElementById('newLaborUnit').textContent = unit;
  document.getElementById('newIndirectUnit').textContent = unit;
  document.getElementById('newTotalUnit').textContent = unit;
}

// Actualizar total en modal de nuevo producto
function updateNewProductCostTotal() {
  const material = parseFloat(document.getElementById('newProductCostoMaterial').value) || 0;
  const manoObra = parseFloat(document.getElementById('newProductCostoManoObra').value) || 0;
  const indirectos = parseFloat(document.getElementById('newProductCostosIndirectos').value) || 0;
  
  const total = material + manoObra + indirectos;
  document.getElementById('newProductCostoTotal').textContent = formatPrice(total);
}

// Guardar nuevo producto
async function saveNewProduct() {
  const nombre = document.getElementById('newProductName').value.trim();
  const categoria = document.getElementById('newProductCategory').value.trim().toLowerCase();
  
  if (!nombre || !categoria) {
    alert('⚠️ Debes completar el nombre y la categoría del producto');
    return;
  }
  
  // Validar categoría (solo letras, números y guiones bajos)
  if (!/^[a-z0-9_]+$/.test(categoria)) {
    alert('⚠️ La categoría solo puede contener letras minúsculas, números y guiones bajos');
    return;
  }
  
  // Verificar que no exista
  if (costosManager.getCosto(categoria)) {
    alert('⚠️ Ya existe un producto con esa categoría');
    return;
  }
  
  const tipo = document.querySelector('input[name="newProductType"]:checked').value;
  
  const costoData = {
    producto: nombre,
    categoria: categoria,
    tipo: tipo,
    costoMaterial: parseFloat(document.getElementById('newProductCostoMaterial').value) || 0,
    costoManoObra: parseFloat(document.getElementById('newProductCostoManoObra').value) || 0,
    costosIndirectos: parseFloat(document.getElementById('newProductCostosIndirectos').value) || 0,
    costoTotal: 0,
    margenMinimo: 15,
    margenObjetivo: 30
  };
  
  costoData.costoTotal = costoData.costoMaterial + costoData.costoManoObra + costoData.costosIndirectos;
  
  const saved = await costosManager.saveCosto(categoria, costoData);
  
  if (saved) {
    alert('✅ Producto agregado correctamente');
    closeAddProductModal();
    renderCostosProductsList();
  }
}

// Event listeners para modal de edición de costos
document.addEventListener('DOMContentLoaded', () => {
  // Modal de edición
  const closeEditCostModalBtn = document.getElementById('closeEditCostModal');
  const btnCancelEditCost = document.getElementById('btnCancelEditCost');
  const btnSaveEditCost = document.getElementById('btnSaveEditCost');
  const btnGuardarCostos = document.getElementById('btnGuardarCostos');
  
  if (closeEditCostModalBtn) {
    closeEditCostModalBtn.addEventListener('click', closeEditCostModal);
  }
  
  if (btnCancelEditCost) {
    btnCancelEditCost.addEventListener('click', closeEditCostModal);
  }
  
  if (btnSaveEditCost) {
    btnSaveEditCost.addEventListener('click', saveEditedCost);
  }
  
  if (btnGuardarCostos) {
    btnGuardarCostos.addEventListener('click', saveAllCostosChanges);
  }
  
  // Modal de agregar producto
  const btnAddNewProduct = document.getElementById('btnAddNewProduct');
  const closeAddProductModalBtn = document.getElementById('closeAddProductModal');
  const btnCancelAddProduct = document.getElementById('btnCancelAddProduct');
  const btnSaveNewProduct = document.getElementById('btnSaveNewProduct');
  
  if (btnAddNewProduct) {
    btnAddNewProduct.addEventListener('click', openAddProductModal);
  }
  
  if (closeAddProductModalBtn) {
    closeAddProductModalBtn.addEventListener('click', closeAddProductModal);
  }
  
  if (btnCancelAddProduct) {
    btnCancelAddProduct.addEventListener('click', closeAddProductModal);
  }
  
  if (btnSaveNewProduct) {
    btnSaveNewProduct.addEventListener('click', saveNewProduct);
  }
  
  // Inputs de costos - actualizar total al cambiar
  const costInputs = ['editCostoMaterial', 'editCostoManoObra', 'editCostosIndirectos'];
  costInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateEditCostTotal);
    }
  });
  
  // Inputs de nuevo producto - actualizar total
  const newProductInputs = ['newProductCostoMaterial', 'newProductCostoManoObra', 'newProductCostosIndirectos'];
  newProductInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateNewProductCostTotal);
    }
  });
  
  // Radio buttons de tipo - actualizar unidades
  const costTypeRadios = document.querySelectorAll('input[name="costType"]');
  costTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateCostTypeUnits(e.target.value);
    });
  });
  
  // Radio buttons de tipo nuevo producto
  const newProductTypeRadios = document.querySelectorAll('input[name="newProductType"]');
  newProductTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateNewProductTypeUnits(e.target.value);
    });
  });
  
  // Inicializar costos manager al cargar
  initializeCostosManager();
});

// Price Editor Functions
function openPriceEditor() {
  priceEditorModal.classList.remove('hidden');
  populateProductSelect();
}

function closePriceEditor() {
  priceEditorModal.classList.add('hidden');
  priceEditorForm.classList.add('hidden');
  productSelect.value = '';
}

function populateProductSelect() {
  productSelect.innerHTML = '<option value="">Seleccionar producto</option>';
  Object.entries(priceData).forEach(([key, product]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = product.name;
    productSelect.appendChild(option);
  });
}

function loadProductForEdit() {
  const productKey = productSelect.value;
  if (!productKey) {
    priceEditorForm.classList.add('hidden');
    return;
  }

  currentEditingProduct = productKey;
  const product = priceData[productKey];

  // Set base prices
  gremioBasePrice.value = product.gremio;
  clienteBasePrice.value = product.cliente;

  // Add laqueado cost field if product has laqueado
  gremioOptionsContainer.innerHTML = '';
  if (product.hasLaqueado) {
    const laqueadoDiv = document.createElement('div');
    laqueadoDiv.className = 'option-editor';
    laqueadoDiv.innerHTML = `
      <h4>COSTO DE LAQUEADO</h4>
      <div class="option-item">
        <label>Laqueado (adicional por ${product.unit})</label>
        <input type="number" id="laqueadoCostInput" 
               value="${product.laqueadoCost || 5900}" min="0" step="100">
      </div>
    `;
    gremioOptionsContainer.appendChild(laqueadoDiv);
  }

  // Load options for gremio
  if (product.gremioOptions && product.gremioOptions.length > 0) {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'option-editor';
    optionsDiv.innerHTML = '<h4>OPCIONES GREMIO</h4>';
    
    product.gremioOptions.forEach((opt, idx) => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'option-item';
      const value = opt.price || opt.additionalCost || opt.pricePerM2 || '';
      const label = opt.price !== undefined ? 'Precio fijo' : 
                    opt.additionalCost !== undefined ? 'Costo adicional' : 
                    'Precio por m²';
      optionDiv.innerHTML = `
        <label>${opt.label} (${label})</label>
        <input type="number" data-option-type="gremio" data-option-idx="${idx}" 
               value="${value}" min="0" step="100">
      `;
      optionsDiv.appendChild(optionDiv);
    });
    gremioOptionsContainer.appendChild(optionsDiv);
  }

  // Load options for cliente
  clienteOptionsContainer.innerHTML = '';
  if (product.clienteOptions && product.clienteOptions.length > 0) {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'option-editor';
    optionsDiv.innerHTML = '<h4>OPCIONES CLIENTE</h4>';
    
    product.clienteOptions.forEach((opt, idx) => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'option-item';
      const value = opt.price || opt.additionalCost || opt.pricePerM2 || '';
      const label = opt.price !== undefined ? 'Precio fijo' : 
                    opt.additionalCost !== undefined ? 'Costo adicional' : 
                    'Precio por m²';
      optionDiv.innerHTML = `
        <label>${opt.label} (${label})</label>
        <input type="number" data-option-type="cliente" data-option-idx="${idx}" 
               value="${value}" min="0" step="100">
      `;
      optionsDiv.appendChild(optionDiv);
    });
    clienteOptionsContainer.appendChild(optionsDiv);
  }

  priceEditorForm.classList.remove('hidden');
}

function saveProductPrices() {
  if (!currentEditingProduct) return;

  const product = priceData[currentEditingProduct];

  // Update base prices
  product.gremio = parseFloat(gremioBasePrice.value) || 0;
  product.cliente = parseFloat(clienteBasePrice.value) || 0;
  
  // Update laqueado cost if product has it
  if (product.hasLaqueado) {
    const laqueadoCostInput = document.getElementById('laqueadoCostInput');
    if (laqueadoCostInput) {
      product.laqueadoCost = parseFloat(laqueadoCostInput.value) || 5900;
    }
  }

  // Update gremio options
  const gremioInputs = gremioOptionsContainer.querySelectorAll('[data-option-type="gremio"]');
  gremioInputs.forEach(input => {
    const idx = parseInt(input.dataset.optionIdx);
    const value = parseFloat(input.value) || 0;
    if (product.gremioOptions[idx].price !== undefined) {
      product.gremioOptions[idx].price = value;
    } else if (product.gremioOptions[idx].additionalCost !== undefined) {
      product.gremioOptions[idx].additionalCost = value;
    } else if (product.gremioOptions[idx].pricePerM2 !== undefined) {
      product.gremioOptions[idx].pricePerM2 = value;
    }
  });

  // Update cliente options
  const clienteInputs = clienteOptionsContainer.querySelectorAll('[data-option-type="cliente"]');
  clienteInputs.forEach(input => {
    const idx = parseInt(input.dataset.optionIdx);
    const value = parseFloat(input.value) || 0;
    if (product.clienteOptions[idx].price !== undefined) {
      product.clienteOptions[idx].price = value;
    } else if (product.clienteOptions[idx].additionalCost !== undefined) {
      product.clienteOptions[idx].additionalCost = value;
    } else if (product.clienteOptions[idx].pricePerM2 !== undefined) {
      product.clienteOptions[idx].pricePerM2 = value;
    }
  });

  // Save to localStorage
  localStorage.setItem('mrLetrerosPrices', JSON.stringify(priceData));

  alert('Precios guardados correctamente');
  priceEditorForm.classList.add('hidden');
  productSelect.value = '';
  
  // Update category select if it's open
  updateFormFields();
}

function resetToDefaultPrices() {
  if (confirm('¿Estás seguro de restaurar todos los precios a los valores originales? Esta acción no se puede deshacer.')) {
    // Reset to defaults
    priceData = JSON.parse(JSON.stringify(defaultPriceData));
    
    localStorage.setItem('mrLetrerosPrices', JSON.stringify(priceData));
    alert('Precios restaurados a los valores originales');
    closePriceEditor();
    
    // Recalculate all items
    items = items.map(item => ({
      ...item,
      price: calculateItemPrice(
        item.category,
        item.width,
        item.height,
        item.linearMeters,
        item.quantity,
        item.selectedOption,
        item.includeLaqueado,
        item.includeCostura,
        item.includeTransporte
      )
    }));
    
    renderItems();
    updateTotal();
  }
}

function importClientePrices() {
  if (confirm('¿Importar precios de CLIENTE desde la lista original? Esto sobrescribirá los precios actuales de cliente.')) {
    Object.keys(importedClientePrices).forEach(key => {
      if (priceData[key]) {
        const imported = importedClientePrices[key];
        
        // Update base price
        if (imported.base !== undefined) {
          priceData[key].cliente = imported.base;
        }
        
        // Update options if they exist
        if (imported.options && priceData[key].clienteOptions) {
          Object.keys(imported.options).forEach(optName => {
            const option = priceData[key].clienteOptions.find(opt => opt.name === optName);
            if (option) {
              option.price = imported.options[optName];
            }
          });
        }
        
        // Handle special cases like ploteo
        if (imported.impreso_laminado) {
          const opt1 = priceData[key].clienteOptions.find(o => o.name === 'impreso_laminado');
          if (opt1) opt1.pricePerM2 = imported.impreso_laminado;
        }
        if (imported.oracal) {
          const opt2 = priceData[key].clienteOptions.find(o => o.name === 'oracal');
          if (opt2) opt2.pricePerM2 = imported.oracal;
        }
      }
    });
    
    localStorage.setItem('mrLetrerosPrices', JSON.stringify(priceData));
    alert('Precios de CLIENTE importados correctamente');
    
    // Reload if a product is being edited
    if (currentEditingProduct) {
      loadProductForEdit();
    }
  }
}

function importGremioPrices() {
  if (confirm('¿Importar precios de GREMIO desde la lista original? Esto sobrescribirá los precios actuales de gremio.')) {
    Object.keys(importedGremioPrices).forEach(key => {
      if (priceData[key]) {
        const imported = importedGremioPrices[key];
        
        // Update base price
        if (imported.base !== undefined) {
          priceData[key].gremio = imported.base;
        }
      }
    });
    
    localStorage.setItem('mrLetrerosPrices', JSON.stringify(priceData));
    alert('Precios de GREMIO importados correctamente');
    
    // Reload if a product is being edited
    if (currentEditingProduct) {
      loadProductForEdit();
    }
  }
}

// ========== DATA MANAGEMENT FUNCTIONS ==========

// Theme Management
function toggleTheme() {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  }
}

function loadDataManagementTab() {
  // Cargar clientes en el selector de historial
  const clients = dataManager.getClients();
  clientHistorySelect.innerHTML = '<option value="">Seleccionar cliente...</option>';
  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name;
    clientHistorySelect.appendChild(option);
  });
}

async function handleImportClients(e) {
  const file = e.target.files[0];
  if (!file) return;

  const result = await dataManager.importClients(file);
  if (result.success) {
    alert(`✅ Importados ${result.count} clientes correctamente`);
    loadDataManagementTab();
    loadGremioClients();
  } else {
    alert(`❌ Error al importar: ${result.error}`);
  }

  // Reset input
  importClientsFile.value = '';
}

function handleClientHistorySelect() {
  const clientId = clientHistorySelect.value;
  
  if (!clientId) {
    btnExportHistory.disabled = true;
    btnImportHistory.disabled = true;
    btnExportClientFolder.disabled = true;
    clientStatsDisplay.classList.add('hidden');
    return;
  }

  btnExportHistory.disabled = false;
  btnImportHistory.disabled = false;
  btnExportClientFolder.disabled = false;

  // Mostrar estadísticas
  const stats = dataManager.getClientStats(clientId);
  const client = dataManager.getClients().find(c => c.id === clientId);

  clientStatsDisplay.innerHTML = `
    <div class="stat-row">
      <span class="stat-label">Total de Presupuestos:</span>
      <span class="stat-value">${stats.totalPresupuestos}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Total Facturado:</span>
      <span class="stat-value">${formatPrice(stats.totalFacturado)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Total m²:</span>
      <span class="stat-value">${stats.totalM2.toFixed(2)} m²</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Promedio por Presupuesto:</span>
      <span class="stat-value">${formatPrice(stats.promedioPresupuesto)}</span>
    </div>
    ${stats.ultimoPresupuesto ? `
    <div class="stat-row">
      <span class="stat-label">Último Presupuesto:</span>
      <span class="stat-value">${new Date(stats.ultimoPresupuesto).toLocaleDateString('es-AR')}</span>
    </div>
    ` : ''}
  `;
  clientStatsDisplay.classList.remove('hidden');
}

function handleExportClientFolder() {
  const clientId = clientHistorySelect.value;
  if (!clientId) return;

  dataManager.exportClientFolder(clientId);
}

async function handleImportClientFolder(e) {
  const file = e.target.files[0];
  if (!file) return;

  const result = await dataManager.importClientFolder(file);
  if (result.success) {
    alert(`✅ Carpeta de "${result.clientName}" importada correctamente
    
${result.presupuestos} presupuestos importados`);
    loadDataManagementTab();
    loadGremioClients();
  } else {
    alert(`❌ Error al importar: ${result.error}`);
  }

  // Reset input
  importClientFolderFile.value = '';
}

function handleExportHistory() {
  const clientId = clientHistorySelect.value;
  if (!clientId) return;

  const client = dataManager.getClients().find(c => c.id === clientId);
  if (client) {
    dataManager.exportClientHistory(clientId, client.name);
  }
}

async function handleImportHistory(e) {
  const file = e.target.files[0];
  if (!file) return;

  const clientId = clientHistorySelect.value;
  if (!clientId) {
    alert('❌ Por favor seleccioná un cliente primero');
    return;
  }

  const result = await dataManager.importClientHistory(clientId, file);
  if (result.success) {
    alert(`✅ Importadas ${result.count} entradas al historial`);
    handleClientHistorySelect(); // Actualizar estadísticas
  } else {
    alert(`❌ Error al importar: ${result.error}`);
  }

  // Reset input
  importHistoryFile.value = '';
}

async function handleImportAll(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!confirm('⚠️ Esto reemplazará TODOS los datos actuales. ¿Continuar?')) {
    importAllFile.value = '';
    return;
  }

  const result = await dataManager.importAllData(file);
  if (result.success) {
    alert(`✅ Importados ${result.clients} clientes y sus historiales correctamente`);
    loadDataManagementTab();
    loadGremioClients();
  } else {
    alert(`❌ Error al importar: ${result.error}`);
  }

  // Reset input
  importAllFile.value = '';
}

// Nueva función: Guardar Cotización
async function saveQuotation() {
  // Primero verificar si hay un cliente seleccionado
  let clientId = currentSelectedClientId;
  const clientName = document.getElementById('clientName').value.trim();
  
  if (!clientName) {
    alert('⚠️ Por favor ingresá el nombre del cliente');
    return;
  }
  
  if (items.length === 0) {
    alert('⚠️ No hay productos en la cotización');
    return;
  }
  
  // Si no hay cliente seleccionado, buscar o crear
  if (!clientId) {
    let clients = await dataManager.getClients();
    let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    
    if (!client) {
      // Cliente nuevo - crear
      const contact = document.getElementById('clientContact').value.trim();
      client = await dataManager.saveClient({
        name: clientName,
        contact: contact,
        notes: ''
      });
      
      if (!client) {
        alert('❌ Error al crear el cliente');
        return;
      }
      
      console.log('✅ Nuevo cliente creado:', client);
      clientId = client.id;
      currentSelectedClientId = clientId;
    } else {
      clientId = client.id;
      currentSelectedClientId = clientId;
    }
  }
  
  // Guardar cotización en el historial del cliente
  const totalArea = calculateTotalArea();
  const total = items.reduce((sum, item) => sum + item.price, 0);
  
  const quotation = {
    priceType: currentPriceType,
    items: [...items], // Copiar array
    total: total,
    totalM2: totalArea,
    clientName: clientName,
    clientContact: document.getElementById('clientContact').value || ''
  };
  
  const saved = await dataManager.addToHistory(clientId, quotation);
  
  if (saved) {
    alert(`✅ Cotización guardada exitosamente para ${clientName}
    
Total: ${formatPrice(total)}
m² totales: ${totalArea.toFixed(2)}

Los datos se guardaron en el servidor.`);
    
    // Actualizar selector de clientes y recargar historial
    await loadSavedClients();
    if (clientId) {
      savedClientsSelect.value = clientId;
      await loadClient(); // Recargar para mostrar la nueva cotización
    }
  } else {
    alert('❌ Error al guardar la cotización');
  }
}

// ============================================
// APROBAR COTIZACIÓN (MARCAR COMO VENDIDO)
// ============================================

async function approveQuotation() {
  // Validaciones
  if (items.length === 0) {
    alert('⚠️ No hay productos en la cotización');
    return;
  }

  const clientName = document.getElementById('clientName').value;
  if (!clientName) {
    alert('⚠️ Debes ingresar un nombre de cliente');
    return;
  }

  // Buscar o crear cliente
  let clientId = savedClientsSelect.value;
  
  if (!clientId) {
    // Cliente nuevo - guardar primero
    const clients = await dataManager.getClients();
    const existingClient = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const newClient = {
        name: clientName,
        contact: document.getElementById('clientContact').value || '',
        notes: ''
      };
      
      const saved = await dataManager.saveClient(newClient);
      if (saved) {
        clientId = saved.id;
      } else {
        alert('❌ Error al guardar cliente');
        return;
      }
    }
  }

  // Calcular totales
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const totalM2 = items.reduce((sum, item) => {
    if (item.width && item.height) {
      const m2 = (parseFloat(item.width) * parseFloat(item.height)) / 10000;
      return sum + (m2 * item.quantity);
    }
    return sum;
  }, 0);

  // Calcular rentabilidad si hay costosManager
  let rentabilidad = null;
  if (typeof costosManager !== 'undefined' && costosManager) {
    rentabilidad = costosManager.calculateTotalMargin(items);
  }

  // Crear cotización APROBADA
  const quotation = {
    date: new Date().toISOString(),
    priceType: currentPriceType,
    items: items.map(item => ({
      ...item,
      productName: item.name || item.productName || item.category
    })),
    total: total,
    totalM2: totalM2,
    clientName: clientName,
    clientContact: document.getElementById('clientContact').value || '',
    approved: true, // ← MARCA COMO APROBADO
    approvedDate: new Date().toISOString(),
    rentabilidad: rentabilidad // Datos de rentabilidad
  };
  
  const saved = await dataManager.addToHistory(clientId, quotation);
  
  if (saved) {
    const margenInfo = rentabilidad ? `
Margen: ${rentabilidad.margenPorcentaje}%
Ganancia: ${formatPrice(rentabilidad.gananciaTotal)}` : '';

    alert(`✅ ¡COTIZACIÓN APROBADA Y GUARDADA!

Cliente: ${clientName}
Total: ${formatPrice(total)}
m² totales: ${totalM2.toFixed(2)}${margenInfo}

Esta venta se registró para el cálculo de rentabilidad.`);
    
    // Limpiar formulario
    items = [];
    renderItems();
    updateTotal();
    document.getElementById('clientName').value = '';
    document.getElementById('clientContact').value = '';
    
    // Actualizar historial
    await loadSavedClients();
    if (clientId) {
      savedClientsSelect.value = clientId;
      await loadClient();
    }
  } else {
    alert('❌ Error al guardar la cotización aprobada');
  }
}

// ============================================
// FUNCIONES PARA EDITAR/BORRAR HISTORIAL
// ============================================

async function editHistoryEntry(index) {
  if (!currentFullHistoryClient || !currentFullHistoryData) {
    alert('Error: No se puede editar esta cotización');
    return;
  }
  
  const entry = currentFullHistoryData.history[index];
  if (!entry) {
    alert('Error: Cotización no encontrada');
    return;
  }
  
  // Confirmar edición
  if (!confirm('¿Deseas cargar esta cotización para editarla?\n\nNota: Esto reemplazará la cotización actual en pantalla.')) {
    return;
  }
  
  // Limpiar cotización actual
  items = [];
  
  // Cargar datos del cliente
  document.getElementById('clientName').value = currentFullHistoryClient.name;
  document.getElementById('clientContact').value = currentFullHistoryClient.contact || '';
  
  // Cargar tipo de precio
  currentPriceType = entry.priceType;
  updatePriceTypeButtons();
  
  // Cargar items
  items = entry.items.map(item => ({
    ...item,
    id: Date.now() + Math.random() // Nuevo ID para evitar conflictos
  }));
  
  // Actualizar UI
  renderItems();
  updateTotal();
  
  // Scroll al inicio
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  alert('✅ Cotización cargada. Puedes editarla y guardarla nuevamente.');
}

async function deleteHistoryEntry(index) {
  if (!currentFullHistoryClient || !currentFullHistoryData) {
    alert('Error: No se puede eliminar esta cotización');
    return;
  }
  
  const entry = currentFullHistoryData.history[index];
  if (!entry) {
    alert('Error: Cotización no encontrada');
    return;
  }
  
  const date = new Date(entry.date);
  const dateStr = date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Confirmar eliminación
  if (!confirm(`¿Estás seguro de eliminar esta cotización?\n\nFecha: ${dateStr}\nTotal: ${formatPrice(entry.total)}\n\n⚠️ Esta acción no se puede deshacer.`)) {
    return;
  }
  
  // Eliminar del servidor
  const success = await dataManager.deleteHistoryEntry(currentFullHistoryClient.id, index);
  
  if (success) {
    alert('✅ Cotización eliminada correctamente');
    
    // Recargar historial
    await loadClient();
  } else {
    alert('❌ Error al eliminar la cotización');
  }
}

// Initialize
loadTheme(); // Cargar tema guardado
if (typeof dataManager !== 'undefined') {
  dataManager.migrateOldClients(); // Migrar clientes antiguos si existen
} else {
  console.error('⚠️ data-manager.js no está cargado. Asegurate de incluir el script antes de app.js');
}
loadSavedClients();
updateFormFields();
// Aplicar colores iniciales según tipo de precio
switchPriceType(currentPriceType);

// ============================================
// AUTO-BORRADO DE COTIZACIONES ANTIGUAS (+30 días)
// ============================================

async function autoDeleteOldQuotations() {
  if (typeof dataManager === 'undefined') return;
  
  try {
    const clients = await dataManager.getClients();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    let totalDeleted = 0;
    
    for (const client of clients) {
      const fullData = await dataManager.getFullClientHistory(client.id);
      if (!fullData || !fullData.history) continue;
      
      const oldQuotations = [];
      
      // Encontrar cotizaciones antiguas NO aprobadas
      fullData.history.forEach((entry, index) => {
        const entryDate = new Date(entry.date);
        
        // Solo borrar cotizaciones NO aprobadas de +30 días
        if (!entry.approved && entryDate < thirtyDaysAgo) {
          oldQuotations.push(index);
        }
      });
      
      // Borrar de atrás hacia adelante para no afectar los índices
      for (let i = oldQuotations.length - 1; i >= 0; i--) {
        const index = oldQuotations[i];
        await dataManager.deleteHistoryEntry(client.id, index);
        totalDeleted++;
      }
    }
    
    if (totalDeleted > 0) {
      console.log(`🗑️ Auto-borrado: ${totalDeleted} cotización(es) antigua(s) eliminada(s)`);
    }
  } catch (error) {
    console.error('Error en auto-borrado:', error);
  }
}

// Ejecutar auto-borrado al cargar la página
setTimeout(() => {
  autoDeleteOldQuotations();
}, 3000); // Esperar 3 segundos después de cargar

// Ejecutar auto-borrado cada 24 horas
setInterval(() => {
  autoDeleteOldQuotations();
}, 24 * 60 * 60 * 1000); // 24 horas


// ============================================
// HISTORIAL GLOBAL DE COTIZACIONES
// ============================================

let currentGlobalFilter = 'all';
let allGlobalQuotations = [];

async function loadGlobalHistory() {
  try {
    const clients = await dataManager.getClients();
    allGlobalQuotations = [];
    
    // Recopilar todas las cotizaciones de todos los clientes
    for (const client of clients) {
      const fullData = await dataManager.getFullClientHistory(client.id);
      if (fullData && fullData.history) {
        fullData.history.forEach(entry => {
          allGlobalQuotations.push({
            ...entry,
            clientName: client.name,
            clientId: client.id
          });
        });
      }
    }
    
    // Ordenar por fecha (más recientes primero)
    allGlobalQuotations.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Renderizar
    renderGlobalHistory();
    updateGlobalStats();
  } catch (error) {
    console.error('Error cargando historial global:', error);
  }
}

function renderGlobalHistory() {
  const container = document.getElementById('globalHistoryList');
  if (!container) return;
  
  // Filtrar según selección
  let filtered = allGlobalQuotations;
  
  if (currentGlobalFilter === 'gremio') {
    filtered = allGlobalQuotations.filter(q => q.priceType === 'gremio');
  } else if (currentGlobalFilter === 'cliente') {
    filtered = allGlobalQuotations.filter(q => q.priceType === 'cliente');
  } else if (currentGlobalFilter === 'approved') {
    filtered = allGlobalQuotations.filter(q => q.approved === true);
  } else if (currentGlobalFilter === 'pending') {
    filtered = allGlobalQuotations.filter(q => !q.approved);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-color-secondary); padding: 2rem;">No hay cotizaciones para mostrar</p>';
    return;
  }
  
  container.innerHTML = filtered.map(entry => {
    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const priceTypeClass = entry.priceType === 'gremio' ? 'gremio' : 'cliente';
    const approvedClass = entry.approved ? 'approved' : '';
    
    return `
      <div class="global-history-item ${priceTypeClass} ${approvedClass}">
        <div class="global-history-item-header">
          <div class="global-history-client">👤 ${entry.clientName}</div>
          <div class="global-history-badges">
            <span class="history-badge ${priceTypeClass}">
              ${entry.priceType === 'gremio' ? '🟢 GREMIO' : '🟠 CLIENTE'}
            </span>
            ${entry.approved ? '<span class="history-badge approved">✓ APROBADO</span>' : ''}
          </div>
        </div>
        <div class="global-history-details">
          <span class="global-history-date">📅 ${dateStr}</span>
          <span class="global-history-total">${formatPrice(entry.total)}</span>
        </div>
        ${entry.totalM2 > 0 ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-color-secondary);">📐 ${entry.totalM2.toFixed(2)} m² • ${entry.items.length} producto${entry.items.length !== 1 ? 's' : ''}</div>` : ''}
      </div>
    `;
  }).join('');
}

function updateGlobalStats() {
  const total = allGlobalQuotations.length;
  const gremio = allGlobalQuotations.filter(q => q.priceType === 'gremio').length;
  const cliente = allGlobalQuotations.filter(q => q.priceType === 'cliente').length;
  const approved = allGlobalQuotations.filter(q => q.approved).length;
  const pending = allGlobalQuotations.filter(q => !q.approved).length;
  const revenue = allGlobalQuotations
    .filter(q => q.approved)
    .reduce((sum, q) => sum + (q.total || 0), 0);
  
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statGremio').textContent = gremio;
  document.getElementById('statCliente').textContent = cliente;
  document.getElementById('statApproved').textContent = approved;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statRevenue').textContent = formatPrice(revenue);
}

// Event listeners para filtros
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remover active de todos
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    
    // Agregar active al clickeado
    btn.classList.add('active');
    
    // Aplicar filtro
    currentGlobalFilter = btn.dataset.filter;
    renderGlobalHistory();
  });
});

// Cargar historial global al iniciar
setTimeout(() => {
  loadGlobalHistory();
}, 2000);

