#include "led_positioner.h"
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

QMap<QString, LedPreset> LedPositioner::getCatalog() {
    QMap<QString, LedPreset> catalog;
    catalog["SMD-2835 Standard"] = {"SMD-2835 Standard", 6.6, 1.2, 8.5, 6.0, 1.2, 0.72, 12, "#FDE68A", "#B45309", false};
    catalog["Lupa 6012 High Power"] = {"Lupa 6012 High Power", 6.1, 1.2, 12.1, 10.0, 1.5, 1.20, 12, "#FDE68A", "#EA580C", false};
    catalog["SMD-2835 Mini"] = {"SMD-2835 Mini", 1.2, 1.2, 2.5, 2.0, 0.5, 0.48, 12, "#FEF9C3", "#92400E", false};
    catalog["SMD-5050 High Power"] = {"SMD-5050 High Power", 7.5, 1.5, 10.0, 8.0, 1.5, 1.20, 12, "#E0F2FE", "#0369A1", false};
    catalog["COB High Density"] = {"COB High Density", 7.0, 2.0, 12.0, 10.0, 2.0, 1.50, 24, "#A7F3D0", "#065F46", false};
    catalog["GOB IP68"] = {"GOB IP68", 7.2, 1.8, 9.0, 7.0, 1.5, 1.20, 12, "#BFDBFE", "#1E40AF", false};
    catalog["Neon Flex Mini (6x12)"] = {"Neon Flex Mini (6x12)", 0.6, 1.2, 1.0, 1.0, 0.3, 10.0, 12, "#F472B6", "#DB2777", true};
    catalog["Tira LED 5050"] = {"Tira LED 5050", 1.0, 0.2, 1.67, 8.0, 0.1, 4.8, 12, "#FEF08A", "#CA8A04", false};
    return catalog;
}

QList<LedPosition> LedPositioner::calculateLeds(const QList<QPainterPath> &paths, const LedPreset &preset) {
    QList<LedPosition> positions;
    double stepMm = preset.stepX * 10.0; // cm to mm
    if (stepMm <= 0.1) stepMm = 10.0;

    for (const QPainterPath &path : paths) {
        QList<QPolygonF> polygons = path.toSubpathPolygons();
        for (const QPolygonF &poly : polygons) {
            if (poly.size() < 2) continue;

            double distanceAccum = 0.0;
            double nextTarget = 0.0; 

            for (int i = 0; i < poly.size() - 1; ++i) {
                QPointF p1 = poly.at(i);
                QPointF p2 = poly.at(i + 1);

                double dx = p2.x() - p1.x();
                double dy = p2.y() - p1.y();
                double segLen = std::sqrt(dx*dx + dy*dy);

                if (segLen < 0.001) continue;

                while (nextTarget <= distanceAccum + segLen) {
                    double t = (nextTarget - distanceAccum) / segLen;
                    if (t < 0.0) t = 0.0;
                    if (t > 1.0) t = 1.0;

                    QPointF ledPos = p1 + t * (p2 - p1);
                    double angleRad = std::atan2(dy, dx);
                    // Qt graphics system operates in screen coords (Y-down) before CNC transform.
                    // However, we want to align correctly. Invert Y for angle if needed.
                    double angleDeg = angleRad * 180.0 / M_PI;

                    LedPosition led;
                    led.pos = ledPos;
                    led.angle = angleDeg;
                    positions.append(led);

                    nextTarget += stepMm;
                }
                distanceAccum += segLen;
            }
        }
    }
    return positions;
}
