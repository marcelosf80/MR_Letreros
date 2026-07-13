#include "svg_parser.h"
#include <QFile>
#include <QDomDocument>
#include <QDomNodeList>
#include <QRegularExpression>
#include <QDebug>
#include <cmath>

QList<QPainterPath> SvgParser::parseSvgFile(const QString &filePath) {
    QList<QPainterPath> rawPaths;
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qWarning() << "No se pudo abrir el archivo SVG:" << filePath;
        return rawPaths;
    }

    QDomDocument doc;
    if (!doc.setContent(&file)) {
        file.close();
        qWarning() << "No se pudo parsear el XML del archivo SVG:" << filePath;
        return rawPaths;
    }
    file.close();

    QDomElement root = doc.documentElement();
    if (root.tagName().toLower() != "svg") {
        qWarning() << "El elemento raíz no es <svg>:" << root.tagName();
        return rawPaths;
    }

    const double PX_TO_MM = 25.4 / 96.0;
    QString widthStr = root.attribute("width");
    QString heightStr = root.attribute("height");
    QString viewBoxStr = root.attribute("viewBox");
    
    double widthMm = parseDimensionToMm(widthStr, -1.0);
    double heightMm = parseDimensionToMm(heightStr, -1.0);
    QRectF viewBox = parseViewBox(viewBoxStr);
    
    double scaleX = PX_TO_MM;
    double scaleY = PX_TO_MM;
    
    if (viewBox.isValid() && !viewBox.isEmpty()) {
        double refWidth = (widthMm > 0.0) ? widthMm : viewBox.width() * PX_TO_MM;
        double refHeight = (heightMm > 0.0) ? heightMm : viewBox.height() * PX_TO_MM;
        scaleX = refWidth / viewBox.width();
        scaleY = refHeight / viewBox.height();
    } else {
        if (widthMm > 0.0) scaleX = 1.0;
        if (heightMm > 0.0) scaleY = 1.0;
    }

    QTransform rootTransform;
    traverseSvgNode(root, rootTransform, rawPaths);

    QList<QPainterPath> scaledPaths;
    QTransform scaleTransform;
    scaleTransform.scale(scaleX, scaleY);
    
    for (const QPainterPath &p : rawPaths) {
        scaledPaths.append(scaleTransform.map(p));
    }

    return scaledPaths;
}

QPainterPath SvgParser::parsePathData(const QString &d) {
    QPainterPath path;
    
    // Formatear la cadena para facilitar el split
    QString cleanD = d;
    cleanD.replace(",", " ");
    
    // Insertar espacios alrededor de los comandos
    QRegularExpression cmdRegex("([MmLlHhVvCcSsQqTtAaZz])");
    cleanD.replace(cmdRegex, " \\1 ");
    
    // Separar por espacios
    QStringList tokens = cleanD.split(QRegularExpression("\\s+"), Qt::SkipEmptyParts);
    
    int i = 0;
    QPointF currentPoint(0, 0);
    QPointF lastControlPoint(0, 0);
    QChar lastCommand = ' ';
    
    while (i < tokens.size()) {
        QString token = tokens[i];
        if (token.isEmpty()) { i++; continue; }
        
        QChar cmd = token[0];
        bool isNumber = false;
        token.toDouble(&isNumber);
        
        if (isNumber) {
            cmd = lastCommand;
            // No incrementamos i, permitiendo leer este número en las coordenadas
        } else {
            i++;
            lastCommand = cmd;
        }
        
        if (cmd == 'M' || cmd == 'm') {
            if (i + 1 >= tokens.size()) break;
            double x = tokens[i++].toDouble();
            double y = tokens[i++].toDouble();
            if (cmd == 'm') {
                currentPoint += QPointF(x, y);
            } else {
                currentPoint = QPointF(x, y);
            }
            path.moveTo(currentPoint);
        } else if (cmd == 'L' || cmd == 'l') {
            if (i + 1 >= tokens.size()) break;
            double x = tokens[i++].toDouble();
            double y = tokens[i++].toDouble();
            if (cmd == 'l') {
                currentPoint += QPointF(x, y);
            } else {
                currentPoint = QPointF(x, y);
            }
            path.lineTo(currentPoint);
        } else if (cmd == 'H' || cmd == 'h') {
            if (i >= tokens.size()) break;
            double x = tokens[i++].toDouble();
            if (cmd == 'h') {
                currentPoint.setX(currentPoint.x() + x);
            } else {
                currentPoint.setX(x);
            }
            path.lineTo(currentPoint);
        } else if (cmd == 'V' || cmd == 'v') {
            if (i >= tokens.size()) break;
            double y = tokens[i++].toDouble();
            if (cmd == 'v') {
                currentPoint.setY(currentPoint.y() + y);
            } else {
                currentPoint.setY(y);
            }
            path.lineTo(currentPoint);
        } else if (cmd == 'C' || cmd == 'c') {
            if (i + 5 >= tokens.size()) break;
            double x1 = tokens[i++].toDouble();
            double y1 = tokens[i++].toDouble();
            double x2 = tokens[i++].toDouble();
            double y2 = tokens[i++].toDouble();
            double ex = tokens[i++].toDouble();
            double ey = tokens[i++].toDouble();
            
            QPointF cp1, cp2, end;
            if (cmd == 'c') {
                cp1 = currentPoint + QPointF(x1, y1);
                cp2 = currentPoint + QPointF(x2, y2);
                end = currentPoint + QPointF(ex, ey);
            } else {
                cp1 = QPointF(x1, y1);
                cp2 = QPointF(x2, y2);
                end = QPointF(ex, ey);
            }
            path.cubicTo(cp1, cp2, end);
            currentPoint = end;
            lastControlPoint = cp2;
        } else if (cmd == 'S' || cmd == 's') {
            if (i + 3 >= tokens.size()) break;
            double x2 = tokens[i++].toDouble();
            double y2 = tokens[i++].toDouble();
            double ex = tokens[i++].toDouble();
            double ey = tokens[i++].toDouble();
            
            QPointF cp1;
            if (lastCommand == 'C' || lastCommand == 'c' || lastCommand == 'S' || lastCommand == 's') {
                cp1 = currentPoint + (currentPoint - lastControlPoint);
            } else {
                cp1 = currentPoint;
            }
            
            QPointF cp2, end;
            if (cmd == 's') {
                cp2 = currentPoint + QPointF(x2, y2);
                end = currentPoint + QPointF(ex, ey);
            } else {
                cp2 = QPointF(x2, y2);
                end = QPointF(ex, ey);
            }
            path.cubicTo(cp1, cp2, end);
            currentPoint = end;
            lastControlPoint = cp2;
        } else if (cmd == 'Q' || cmd == 'q') {
            if (i + 3 >= tokens.size()) break;
            double x1 = tokens[i++].toDouble();
            double y1 = tokens[i++].toDouble();
            double ex = tokens[i++].toDouble();
            double ey = tokens[i++].toDouble();
            
            QPointF cp, end;
            if (cmd == 'q') {
                cp = currentPoint + QPointF(x1, y1);
                end = currentPoint + QPointF(ex, ey);
            } else {
                cp = QPointF(x1, y1);
                end = QPointF(ex, ey);
            }
            path.quadTo(cp, end);
            currentPoint = end;
            lastControlPoint = cp;
        } else if (cmd == 'T' || cmd == 't') {
            if (i + 1 >= tokens.size()) break;
            double ex = tokens[i++].toDouble();
            double ey = tokens[i++].toDouble();
            
            QPointF cp;
            if (lastCommand == 'Q' || lastCommand == 'q' || lastCommand == 'T' || lastCommand == 't') {
                cp = currentPoint + (currentPoint - lastControlPoint);
            } else {
                cp = currentPoint;
            }
            
            QPointF end;
            if (cmd == 't') {
                end = currentPoint + QPointF(ex, ey);
            } else {
                end = QPointF(ex, ey);
            }
            path.quadTo(cp, end);
            currentPoint = end;
            lastControlPoint = cp;
        } else if (cmd == 'Z' || cmd == 'z') {
            path.closeSubpath();
        } else {
            // Ignorar otros comandos para simplificar
            i++;
        }
    }
    return path;
}

double SvgParser::calculatePathLength(const QPainterPath &path) {
    double totalLength = 0.0;
    QList<QPolygonF> polygons = path.toSubpathPolygons();
    for (const QPolygonF &poly : polygons) {
        for (int i = 1; i < poly.size(); ++i) {
            QPointF p1 = poly.at(i - 1);
            QPointF p2 = poly.at(i);
            double dx = p2.x() - p1.x();
            double dy = p2.y() - p1.y();
            totalLength += std::sqrt(dx*dx + dy*dy);
        }
    }
    return totalLength;
}

double SvgParser::parseDimensionToMm(const QString &dimStr, double defaultValue) {
    if (dimStr.isEmpty()) return defaultValue;
    
    QRegularExpression regex("^([\\d\\.]+)\\s*([a-zA-Z]*)$");
    QRegularExpressionMatch match = regex.match(dimStr.trimmed());
    if (!match.hasMatch()) return defaultValue;
    
    double val = match.captured(1).toDouble();
    QString unit = match.captured(2).toLower();
    
    if (unit == "mm") {
        return val;
    } else if (unit == "cm") {
        return val * 10.0;
    } else if (unit == "in") {
        return val * 25.4;
    } else if (unit == "pt") {
        return val * 25.4 / 72.0;
    } else if (unit == "pc") {
        return val * 25.4 / 6.0;
    } else if (unit == "px" || unit.isEmpty()) {
        return val * 25.4 / 96.0;
    }
    return val;
}

QRectF SvgParser::parseViewBox(const QString &viewBoxStr) {
    if (viewBoxStr.isEmpty()) return QRectF();
    QString cleanStr = viewBoxStr;
    cleanStr.replace(",", " ");
    QStringList parts = cleanStr.split(QRegularExpression("\\s+"), Qt::SkipEmptyParts);
    if (parts.size() < 4) return QRectF();
    double x = parts[0].toDouble();
    double y = parts[1].toDouble();
    double w = parts[2].toDouble();
    double h = parts[3].toDouble();
    return QRectF(x, y, w, h);
}

QList<QPointF> SvgParser::parsePoints(const QString &pointsStr) {
    QList<QPointF> points;
    QString cleanStr = pointsStr;
    cleanStr.replace(",", " ");
    QStringList tokens = cleanStr.split(QRegularExpression("\\s+"), Qt::SkipEmptyParts);
    for (int i = 0; i + 1 < tokens.size(); i += 2) {
        points.append(QPointF(tokens[i].toDouble(), tokens[i+1].toDouble()));
    }
    return points;
}

QTransform SvgParser::parseTransform(const QString &transformStr) {
    QTransform transform;
    if (transformStr.isEmpty()) return transform;
    
    QRegularExpression regex("([a-zA-Z]+)\\s*\\(([^\\)]+)\\)");
    QRegularExpressionMatchIterator it = regex.globalMatch(transformStr);
    while (it.hasNext()) {
        QRegularExpressionMatch match = it.next();
        QString type = match.captured(1).toLower();
        QString argsStr = match.captured(2);
        argsStr.replace(",", " ");
        QStringList args = argsStr.split(QRegularExpression("\\s+"), Qt::SkipEmptyParts);
        
        if (type == "matrix" && args.size() >= 6) {
            transform = QTransform(args[0].toDouble(), args[1].toDouble(),
                                   args[2].toDouble(), args[3].toDouble(),
                                   args[4].toDouble(), args[5].toDouble()) * transform;
        } else if (type == "translate" && args.size() >= 1) {
            double tx = args[0].toDouble();
            double ty = (args.size() >= 2) ? args[1].toDouble() : 0.0;
            transform.translate(tx, ty);
        } else if (type == "scale" && args.size() >= 1) {
            double sx = args[0].toDouble();
            double sy = (args.size() >= 2) ? args[1].toDouble() : sx;
            transform.scale(sx, sy);
        } else if (type == "rotate" && args.size() >= 1) {
            double angle = args[0].toDouble();
            if (args.size() >= 3) {
                double cx = args[1].toDouble();
                double cy = args[2].toDouble();
                transform.translate(cx, cy);
                transform.rotate(angle);
                transform.translate(-cx, -cy);
            } else {
                transform.rotate(angle);
            }
        }
    }
    return transform;
}

void SvgParser::traverseSvgNode(const QDomNode &node, const QTransform &parentTransform, QList<QPainterPath> &paths) {
    QDomNodeList children = node.childNodes();
    for (int i = 0; i < children.size(); ++i) {
        QDomNode child = children.at(i);
        if (!child.isElement()) continue;
        
        QDomElement el = child.toElement();
        QString tagName = el.tagName().toLower();
        
        QTransform localTransform = parseTransform(el.attribute("transform"));
        QTransform currentTransform = localTransform * parentTransform;
        
        if (tagName == "g") {
            traverseSvgNode(child, currentTransform, paths);
        } else if (tagName == "path") {
            QString d = el.attribute("d");
            if (!d.isEmpty()) {
                QPainterPath path = parsePathData(d);
                paths.append(currentTransform.map(path));
            }
        } else if (tagName == "rect") {
            double x = el.attribute("x", "0").toDouble();
            double y = el.attribute("y", "0").toDouble();
            double w = el.attribute("width", "0").toDouble();
            double h = el.attribute("height", "0").toDouble();
            double rx = el.attribute("rx", "0").toDouble();
            double ry = el.attribute("ry", "0").toDouble();
            if (ry == 0.0) ry = rx;
            if (rx == 0.0) rx = ry;
            
            QPainterPath path;
            if (rx > 0.0 || ry > 0.0) {
                path.addRoundedRect(x, y, w, h, rx, ry);
            } else {
                path.addRect(x, y, w, h);
            }
            paths.append(currentTransform.map(path));
        } else if (tagName == "circle") {
            double cx = el.attribute("cx", "0").toDouble();
            double cy = el.attribute("cy", "0").toDouble();
            double r = el.attribute("r", "0").toDouble();
            
            QPainterPath path;
            path.addEllipse(QPointF(cx, cy), r, r);
            paths.append(currentTransform.map(path));
        } else if (tagName == "ellipse") {
            double cx = el.attribute("cx", "0").toDouble();
            double cy = el.attribute("cy", "0").toDouble();
            double rx = el.attribute("rx", "0").toDouble();
            double ry = el.attribute("ry", "0").toDouble();
            
            QPainterPath path;
            path.addEllipse(QPointF(cx, cy), rx, ry);
            paths.append(currentTransform.map(path));
        } else if (tagName == "line") {
            double x1 = el.attribute("x1", "0").toDouble();
            double y1 = el.attribute("y1", "0").toDouble();
            double x2 = el.attribute("x2", "0").toDouble();
            double y2 = el.attribute("y2", "0").toDouble();
            
            QPainterPath path;
            path.moveTo(x1, y1);
            path.lineTo(x2, y2);
            paths.append(currentTransform.map(path));
        } else if (tagName == "polyline" || tagName == "polygon") {
            QString pointsStr = el.attribute("points");
            QList<QPointF> points = parsePoints(pointsStr);
            if (!points.isEmpty()) {
                QPainterPath path;
                path.moveTo(points[0]);
                for (int p = 1; p < points.size(); ++p) {
                    path.lineTo(points[p]);
                }
                if (tagName == "polygon") {
                    path.closeSubpath();
                }
                paths.append(currentTransform.map(path));
            }
        }
    }
}
