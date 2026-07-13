#include "mainwindow.h"
#include "../core/calculator.h"
#include "vectorview.h"
#include "../parser/svg_parser.h"
#include "../core/led_positioner.h"
#include <QHBoxLayout>
#include <QFormLayout>
#include <QGroupBox>
#include <QSettings>
#include <QFileDialog>
#include <QMessageBox>
#include <QCoreApplication>
#include <QDir>
#include <QDebug>

QString getKeyForMaterial(const QString &materialName) {
    QString name = materialName.toLower();
    if (name.contains("polifan 20") || name.contains("polifan 20mm") || name.contains("polifan 20 mm")) {
        return "polifan 20";
    } else if (name.contains("polifan 30") || name.contains("polifan 30mm") || name.contains("polifan 30 mm")) {
        return "polifan 30";
    } else if (name.contains("polifan 40") || name.contains("polifan 40mm") || name.contains("polifan 40 mm")) {
        return "polifan 40";
    } else if (name.contains("polifan 50") || name.contains("polifan 50mm") || name.contains("polifan 50 mm")) {
        return "polifan 50";
    }
    return "default";
}

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent), currentPerimeterCm(0.0) {
    ledPresets = LedPositioner::getCatalog();
    loadDatabase();
    setupUI();
}

QString MainWindow::findDataDir() {
    QSettings settings("MRLetreros", "CalculadoraVectores");
    QString savedPath = settings.value("databasePath").toString();
    if (!savedPath.isEmpty() && QDir(savedPath).exists()) {
        return savedPath;
    }

    QString appDir = QCoreApplication::applicationDirPath();
    QDir dir(appDir);
    for (int i = 0; i < 4; ++i) {
        if (dir.exists("datos_mr_letreros")) {
            QString path = dir.filePath("datos_mr_letreros");
            settings.setValue("databasePath", path);
            return path;
        }
        if (dir.exists("mr_letreros/datos_mr_letreros")) {
            QString path = dir.filePath("mr_letreros/datos_mr_letreros");
            settings.setValue("databasePath", path);
            return path;
        }
        if (!dir.cdUp()) break;
    }
    QString devPath = "C:/MR_Letreros/datos_mr_letreros";
    if (QDir(devPath).exists()) {
        settings.setValue("databasePath", devPath);
        return devPath;
    }
    return QString();
}

void MainWindow::loadDatabase() {
    QString dataDir = findDataDir();
    if (dataDir.isEmpty()) {
        qWarning() << "No se pudo encontrar el directorio de datos 'datos_mr_letreros'";
        return;
    }
    materiales = Database::loadMateriales(dataDir);
    calculadoraCostos = Database::loadCalculadoraCostos(dataDir);
    calculadoraPrecios = Database::loadCalculadoraPrecios(dataDir);

    if (materialSelect) {
        int oldIndex = materialSelect->currentIndex();
        materialSelect->clear();
        materialSelect->addItem("Seleccione material...");
        for (const Material &mat : materiales) {
            materialSelect->addItem(mat.productoNombre);
        }
        if (oldIndex >= 0 && oldIndex < materialSelect->count()) {
            materialSelect->setCurrentIndex(oldIndex);
        }
    }
}

void MainWindow::onChangeDatabasePathPressed() {
    QString dir = QFileDialog::getExistingDirectory(this, "Seleccionar carpeta datos_mr_letreros",
                                                     "", QFileDialog::ShowDirsOnly | QFileDialog::DontResolveSymlinks);
    if (!dir.isEmpty()) {
        QSettings settings("MRLetreros", "CalculadoraVectores");
        settings.setValue("databasePath", dir);
        loadDatabase();
    }
}

MainWindow::~MainWindow() {}

void MainWindow::setupUI() {
    QWidget *centralWidget = new QWidget(this);
    setCentralWidget(centralWidget);

    QHBoxLayout *mainLayout = new QHBoxLayout(centralWidget);

    // Layout de columna izquierda
    QVBoxLayout *leftLayout = new QVBoxLayout();

    // Panel Izquierdo 1: Configuración de Cotización
    QGroupBox *configGroup = new QGroupBox("Configuración de Cotización", this);
    QFormLayout *formLayout = new QFormLayout(configGroup);

    loadButton = new QPushButton("📂 Cargar Diseño SVG", this);
    formLayout->addRow(loadButton);

    QPushButton *dbPathButton = new QPushButton("⚙️ Carpeta de Datos", this);
    formLayout->addRow(dbPathButton);

    materialSelect = new QComboBox(this);
    materialSelect->addItem("Seleccione material...");
    for (const Material &mat : materiales) {
        materialSelect->addItem(mat.productoNombre);
    }

    cutCostInput = new QDoubleSpinBox(this);
    cutCostInput->setRange(0, 10000);
    cutCostInput->setValue(10);

    laborCostInput = new QDoubleSpinBox(this);
    laborCostInput->setRange(0, 1000000);
    laborCostInput->setValue(0);

    cutPriceInput = new QDoubleSpinBox(this);
    cutPriceInput->setRange(0, 10000);
    cutPriceInput->setValue(25);

    laborPriceInput = new QDoubleSpinBox(this);
    laborPriceInput->setRange(0, 1000000);
    laborPriceInput->setValue(0);

    markupInput = new QDoubleSpinBox(this);
    markupInput->setRange(1, 100);
    markupInput->setValue(2.5);

    formLayout->addRow("Material Base:", materialSelect);
    formLayout->addRow("Costo x Cm Lineal ($):", cutCostInput);
    formLayout->addRow("Costo Mano de Obra ($):", laborCostInput);
    formLayout->addRow("Precio x Cm Lineal ($):", cutPriceInput);
    formLayout->addRow("Precio Mano de Obra ($):", laborPriceInput);
    formLayout->addRow("Margen de Ganancia (x):", markupInput);

    calcButton = new QPushButton("Calcular Letrero", this);
    formLayout->addRow(calcButton);

    leftLayout->addWidget(configGroup);

    // Panel Izquierdo 2: Posicionador LED
    QGroupBox *ledGroup = new QGroupBox("Posicionador LED / Neon", this);
    QFormLayout *ledFormLayout = new QFormLayout(ledGroup);

    ledPresetSelect = new QComboBox(this);
    ledPresetSelect->addItem("Seleccione preset...");
    for (auto it = ledPresets.constBegin(); it != ledPresets.constEnd(); ++it) {
        ledPresetSelect->addItem(it.key());
    }

    ledStepXInput = new QDoubleSpinBox(this);
    ledStepXInput->setRange(0.1, 100.0);
    ledStepXInput->setValue(8.5);
    ledStepXInput->setSuffix(" cm");

    ledStepYInput = new QDoubleSpinBox(this);
    ledStepYInput->setRange(0.1, 100.0);
    ledStepYInput->setValue(6.0);
    ledStepYInput->setSuffix(" cm");

    ledMarginInput = new QDoubleSpinBox(this);
    ledMarginInput->setRange(0.0, 50.0);
    ledMarginInput->setValue(1.2);
    ledMarginInput->setSuffix(" cm");

    populateLedsButton = new QPushButton("⚡ Generar Instalación LED", this);

    ledFormLayout->addRow("Preset LED:", ledPresetSelect);
    ledFormLayout->addRow("Paso X (c/c):", ledStepXInput);
    ledFormLayout->addRow("Paso Y (filas):", ledStepYInput);
    ledFormLayout->addRow("Margen al borde:", ledMarginInput);
    ledFormLayout->addRow(populateLedsButton);

    leftLayout->addWidget(ledGroup);

    mainLayout->addLayout(leftLayout, 1);

    // Panel Derecho: Visor y Resultados
    QWidget *rightContainer = new QWidget(this);
    QVBoxLayout *rightLayout = new QVBoxLayout(rightContainer);
    
    vectorView = new VectorView(this);
    rightLayout->addWidget(vectorView, 3); // Más peso al visor

    QGroupBox *resultsGroup = new QGroupBox("Resultados de Cotización", this);
    QVBoxLayout *resultsLayout = new QVBoxLayout(resultsGroup);

    perimeterLabel = new QLabel("Cm Lineales: 0 cm", this);
    costResultLabel = new QLabel("Costo de Producción: $0", this);
    priceResultLabel = new QLabel("Precio Sugerido (Venta): $0", this);
    profitResultLabel = new QLabel("Ganancia Estimada: $0", this);
    ledCountResultLabel = new QLabel("LEDs colocados: 0", this);
    ledPowerResultLabel = new QLabel("Consumo LED total: 0W", this);

    resultsLayout->addWidget(perimeterLabel);
    resultsLayout->addWidget(costResultLabel);
    resultsLayout->addWidget(priceResultLabel);
    resultsLayout->addWidget(profitResultLabel);
    resultsLayout->addWidget(ledCountResultLabel);
    resultsLayout->addWidget(ledPowerResultLabel);
    
    rightLayout->addWidget(resultsGroup, 1);

    mainLayout->addWidget(rightContainer, 2);

    // Conexiones de Señales y Slots (al final para evitar llamadas a controles no inicializados)
    connect(loadButton, &QPushButton::clicked, this, &MainWindow::onLoadSvgPressed);
    connect(dbPathButton, &QPushButton::clicked, this, &MainWindow::onChangeDatabasePathPressed);
    connect(materialSelect, QOverload<int>::of(&QComboBox::currentIndexChanged), this, &MainWindow::onMaterialChanged);
    connect(calcButton, &QPushButton::clicked, this, &MainWindow::onCalculatePressed);
    connect(ledPresetSelect, &QComboBox::currentTextChanged, this, &MainWindow::onLedPresetChanged);
    connect(populateLedsButton, &QPushButton::clicked, this, &MainWindow::onPopulateLedsPressed);
}

void MainWindow::onMaterialChanged(int index) {
    if (index <= 0 || index > materiales.size()) {
        return;
    }
    
    const Material &mat = materiales.at(index - 1);
    QString name = mat.productoNombre;
    QString key = getKeyForMaterial(name);
    
    QVariantMap costMap = calculadoraCostos.value(key).toMap();
    if (costMap.isEmpty()) costMap = calculadoraCostos.value("default").toMap();
    
    bool hasSpecificPrice = calculadoraPrecios.contains(key);
    QVariantMap priceMap = hasSpecificPrice ? calculadoraPrecios.value(key).toMap() : calculadoraPrecios.value("default").toMap();
    
    double cutCost = costMap.value("cutCostPerCm", 10.0).toDouble();
    double laborCost = costMap.value("laborCost", 0.0).toDouble();
    double markup = priceMap.value("markup", 2.5).toDouble();
    double laborPrice = priceMap.value("laborPrice", 0.0).toDouble();
    double cutPrice = priceMap.value("cutPricePerCm", 25.0).toDouble();
    
    if (!hasSpecificPrice && name.toLower().contains("polifan")) {
        double platePrice = mat.costoPorM2;
        if (platePrice > 0.0) {
            cutPrice = platePrice * (345.0 / 2090.0);
        }
    }
    
    cutCostInput->setValue(cutCost);
    laborCostInput->setValue(laborCost);
    cutPriceInput->setValue(cutPrice);
    laborPriceInput->setValue(laborPrice);
    markupInput->setValue(markup);
    
    onCalculatePressed();
}

void MainWindow::onLoadSvgPressed() {
    QString filePath = QFileDialog::getOpenFileName(this, "Cargar Diseño SVG", "", "Archivos SVG (*.svg)");
    if (filePath.isEmpty()) return;

    QList<QPainterPath> paths = SvgParser::parseSvgFile(filePath);
    if (paths.isEmpty()) {
        QMessageBox::warning(this, "Advertencia", "No se encontraron vectores válidos en el archivo SVG.");
        return;
    }

    currentPaths = paths;
    vectorView->setPaths(paths);
    
    // Obtener perímetro total en mm y convertir a cm
    double perimeterMm = vectorView->getTotalPerimeter();
    currentPerimeterCm = perimeterMm / 10.0;
    
    perimeterLabel->setText(QString("Cm Lineales: %1 cm").arg(qRound(currentPerimeterCm)));
    onCalculatePressed();
}

void MainWindow::onCalculatePressed() {
    double perimeter = currentPerimeterCm;
    if (perimeter <= 0.0) {
        perimeter = 500.0; // Fallback simulado si no hay vector cargado
    }
    double qty = 1.0;
    
    int index = materialSelect->currentIndex();
    double platePrice = 0.0;
    if (index > 0 && index <= materiales.size()) {
        platePrice = materiales.at(index - 1).costoPorM2;
    } else {
        platePrice = 2090.0; // Fallback
    }

    // Calcular costos
    double materialCost = 0.15 * platePrice * qty; // 0.15 m2 de plancha simulados
    double prodCost = Calculator::calculateProductionCost(materialCost, perimeter, cutCostInput->value(), laborCostInput->value(), qty);
    double salePrice = Calculator::calculateSalePrice(materialCost, perimeter, cutPriceInput->value(), laborPriceInput->value(), markupInput->value(), qty);
    double profit = salePrice - prodCost;

    costResultLabel->setText(QString("Costo de Producción: $%1").arg(qRound(prodCost)));
    priceResultLabel->setText(QString("Precio Sugerido (Venta): $%1").arg(qRound(salePrice)));
    profitResultLabel->setText(QString("Ganancia Estimada: $%1").arg(qRound(profit)));
}

void MainWindow::onLedPresetChanged(const QString &presetName) {
    if (!ledPresets.contains(presetName)) return;
    const LedPreset &preset = ledPresets[presetName];
    ledStepXInput->setValue(preset.stepX);
    ledStepYInput->setValue(preset.stepY);
    ledMarginInput->setValue(preset.margin);
    
    ledStepYInput->setEnabled(!preset.isNeon);
    ledMarginInput->setEnabled(!preset.isNeon);
}

void MainWindow::onPopulateLedsPressed() {
    if (currentPaths.isEmpty()) {
        QMessageBox::warning(this, "Advertencia", "Carga un archivo SVG primero.");
        return;
    }
    
    QString presetName = ledPresetSelect->currentText();
    if (!ledPresets.contains(presetName)) {
        QMessageBox::warning(this, "Advertencia", "Selecciona un preset de LED válido.");
        return;
    }
    
    LedPreset preset = ledPresets[presetName];
    preset.stepX = ledStepXInput->value();
    preset.stepY = ledStepYInput->value();
    preset.margin = ledMarginInput->value();
    
    QList<LedPosition> leds = LedPositioner::calculateLeds(currentPaths, preset);
    
    vectorView->drawLeds(leds, preset);
    
    int count = leds.size();
    double power = 0.0;
    
    if (preset.isNeon) {
        double perimeterM = currentPerimeterCm / 100.0;
        power = perimeterM * preset.watt;
        ledCountResultLabel->setText(QString("Metros de Neon: %1 m").arg(perimeterM, 0, 'f', 2));
        ledPowerResultLabel->setText(QString("Consumo Neon total: %1 W").arg(qRound(power)));
    } else {
        power = count * preset.watt;
        ledCountResultLabel->setText(QString("LEDs colocados: %1").arg(count));
        ledPowerResultLabel->setText(QString("Consumo LED total: %1 W").arg(qRound(power)));
    }
}

