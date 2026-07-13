#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include "../db/database.h"
#include "../core/led_positioner.h"

class VectorView;

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void onMaterialChanged(int index);
    void onCalculatePressed();
    void onLoadSvgPressed();
    void onChangeDatabasePathPressed();
    void onLedPresetChanged(const QString &presetName);
    void onPopulateLedsPressed();

private:
    void setupUI();
    void loadDatabase();
    QString findDataDir();

    QComboBox *materialSelect;
    QDoubleSpinBox *cutCostInput;
    QDoubleSpinBox *laborCostInput;
    QDoubleSpinBox *cutPriceInput;
    QDoubleSpinBox *laborPriceInput;
    QDoubleSpinBox *markupInput;

    // Controles del Posicionador LED
    QComboBox *ledPresetSelect;
    QDoubleSpinBox *ledStepXInput;
    QDoubleSpinBox *ledStepYInput;
    QDoubleSpinBox *ledMarginInput;
    QPushButton *populateLedsButton;

    QLabel *costResultLabel;
    QLabel *priceResultLabel;
    QLabel *profitResultLabel;
    QLabel *perimeterLabel;
    
    // Estadísticas LED
    QLabel *ledCountResultLabel;
    QLabel *ledPowerResultLabel;

    QPushButton *calcButton;
    QPushButton *loadButton;
    
    VectorView *vectorView;
    double currentPerimeterCm;
    QList<QPainterPath> currentPaths;

    QList<Material> materiales;
    QVariantMap calculadoraCostos;
    QVariantMap calculadoraPrecios;
    QMap<QString, LedPreset> ledPresets;
};

#endif // MAINWINDOW_H
