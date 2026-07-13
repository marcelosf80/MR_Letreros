#ifndef LED_POSITIONER_H
#define LED_POSITIONER_H

#include <QList>
#include <QPointF>
#include <QPainterPath>
#include <QString>
#include <QMap>

struct LedPreset {
    QString name;
    double modW;       // in cm
    double modH;       // in cm
    double stepX;      // in cm
    double stepY;      // in cm
    double margin;     // in cm
    double watt;       // per module (or per meter if Neon)
    double voltage;    // 12 or 24
    QString color;
    QString stroke;
    bool isNeon;
};

struct LedPosition {
    QPointF pos;       // mm
    double angle;      // degrees
};

class LedPositioner {
public:
    static QMap<QString, LedPreset> getCatalog();
    static QList<LedPosition> calculateLeds(const QList<QPainterPath> &paths, const LedPreset &preset);
};

#endif // LED_POSITIONER_H
