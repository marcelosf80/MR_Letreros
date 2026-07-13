#ifndef DATABASE_H
#define DATABASE_H

#include <QString>
#include <QVariantMap>
#include <QVariantList>

struct Material {
    QString id;
    QString categoria;
    QString productoNombre;
    double costoPorM2;
    double precioLineal;
    double ancho;
    double largo;
    QString unidad;
};

class Database {
public:
    static QVariantMap loadJsonFile(const QString &filePath);
    static QVariantList loadJsonArrayFile(const QString &filePath);
    
    static QList<Material> loadMateriales(const QString &dataDir);
    static QVariantMap loadCalculadoraCostos(const QString &dataDir);
    static QVariantMap loadCalculadoraPrecios(const QString &dataDir);
};

#endif // DATABASE_H
