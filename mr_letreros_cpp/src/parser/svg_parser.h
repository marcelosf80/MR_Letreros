#ifndef SVG_PARSER_H
#define SVG_PARSER_H

#include <QPainterPath>
#include <QString>
#include <QList>
#include <QRectF>
#include <QTransform>
#include <QDomNode>

class SvgParser {
public:
    static QList<QPainterPath> parseSvgFile(const QString &filePath);
    static QPainterPath parsePathData(const QString &d);
    static double calculatePathLength(const QPainterPath &path);

private:
    static double parseDimensionToMm(const QString &dimStr, double defaultValue);
    static QRectF parseViewBox(const QString &viewBoxStr);
    static QList<QPointF> parsePoints(const QString &pointsStr);
    static QTransform parseTransform(const QString &transformStr);
    static void traverseSvgNode(const QDomNode &node, const QTransform &parentTransform, QList<QPainterPath> &paths);
};

#endif // SVG_PARSER_H
