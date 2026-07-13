#include "database.h"
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDebug>
#include <QDir>

QVariantMap Database::loadJsonFile(const QString &filePath) {
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qWarning() << "No se pudo abrir archivo JSON para lectura:" << filePath;
        return QVariantMap();
    }
    
    QByteArray data = file.readAll();
    file.close();
    
    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (doc.isNull() || !doc.isObject()) {
        qWarning() << "Formato JSON inválido en archivo:" << filePath;
        return QVariantMap();
    }
    
    return doc.object().toVariantMap();
}

QVariantList Database::loadJsonArrayFile(const QString &filePath) {
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qWarning() << "No se pudo abrir archivo JSON array para lectura:" << filePath;
        return QVariantList();
    }
    
    QByteArray data = file.readAll();
    file.close();
    
    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (doc.isNull() || !doc.isArray()) {
        qWarning() << "Formato JSON array inválido en archivo:" << filePath;
        return QVariantList();
    }
    
    return doc.array().toVariantList();
}

QList<Material> Database::loadMateriales(const QString &dataDir) {
    QList<Material> filteredList;
    QString path = QDir(dataDir).filePath("gremio_materiales.json");
    QVariantList list = loadJsonArrayFile(path);
    
    QStringList excludedCategories = { "lonas", "vinilo", "laqueado", "tintas", "banners", "otros" };
    
    for (const QVariant &item : list) {
        QVariantMap map = item.toMap();
        QString cat = map.value("categoria").toString().toLower().trimmed();
        
        if (excludedCategories.contains(cat)) {
            continue; // Ignorar categorías no aptas para corte de vectores
        }
        
        Material mat;
        mat.id = map.value("id").toString();
        mat.categoria = map.value("categoria").toString();
        mat.productoNombre = map.value("productoNombre").toString();
        if (mat.productoNombre.isEmpty()) {
            mat.productoNombre = map.value("producto").toString();
        }
        mat.costoPorM2 = map.value("costoPorM2").toDouble();
        mat.precioLineal = map.value("precioLineal").toDouble();
        mat.ancho = map.value("ancho").toDouble();
        mat.largo = map.value("largo").toDouble();
        mat.unidad = map.value("unidad").toString();
        
        filteredList.append(mat);
    }
    
    return filteredList;
}

QVariantMap Database::loadCalculadoraCostos(const QString &dataDir) {
    QString path = QDir(dataDir).filePath("calculadora_costos.json");
    return loadJsonFile(path);
}

QVariantMap Database::loadCalculadoraPrecios(const QString &dataDir) {
    QString path = QDir(dataDir).filePath("calculadora_precios.json");
    return loadJsonFile(path);
}
