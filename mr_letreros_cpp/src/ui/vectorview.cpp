#include "vectorview.h"
#include "../parser/svg_parser.h"
#include <QGraphicsPathItem>
#include <QGraphicsRectItem>
#include <QPen>
#include <QBrush>
#include <QScrollBar>

VectorView::VectorView(QWidget *parent) : QGraphicsView(parent), isPanning(false), vectorContainer(nullptr), ledContainer(nullptr) {
    scene = new QGraphicsScene(this);
    setScene(scene);
    
    // Configuración visual básica
    setRenderHint(QPainter::Antialiasing);
    setRenderHint(QPainter::SmoothPixmapTransform);
    setViewportUpdateMode(QGraphicsView::FullViewportUpdate);
    setBackgroundBrush(QBrush(QColor(241, 245, 249))); // Color neutro var(--sb-bg)
    
    // Configurar scrollbars para que se oculten o sean discretos
    setHorizontalScrollBarPolicy(Qt::ScrollBarAsNeeded);
    setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);
}

void VectorView::setPaths(const QList<QPainterPath> &paths) {
    scene->clear();
    vectorContainer = nullptr;
    ledContainer = nullptr;
    vectorPaths = paths;
    
    QPen pen(QColor(99, 102, 241), 1.5); // Color de contorno var(--sb-accent)
    pen.setCosmetic(true);               // Mantener espesor uniforme al hacer zoom
    
    QBrush brush(QColor(99, 102, 241, 30)); // Relleno translúcido
    
    // Crear un contenedor para aplicar la transformación Y-up del CNC
    vectorContainer = new QGraphicsRectItem();
    vectorContainer->setPen(Qt::NoPen);
    vectorContainer->setBrush(Qt::NoBrush);
    scene->addItem(vectorContainer);
    
    ledContainer = new QGraphicsRectItem(vectorContainer);
    ledContainer->setPen(Qt::NoPen);
    ledContainer->setBrush(Qt::NoBrush);
    
    for (const QPainterPath &path : vectorPaths) {
        QGraphicsPathItem *item = new QGraphicsPathItem(path, vectorContainer);
        item->setPen(pen);
        item->setBrush(brush);
        item->setFlag(QGraphicsItem::ItemIsSelectable);
    }
    
    // Obtener los límites antes de la inversión
    QRectF bounds = vectorContainer->childrenBoundingRect();
    
    if (!bounds.isEmpty()) {
        // Inversión: Y_cnc = Alto_plancha - Y_pantalla
        QTransform cncTransform;
        cncTransform.translate(0, bounds.bottom());
        cncTransform.scale(1, -1);
        cncTransform.translate(0, -bounds.top());
        vectorContainer->setTransform(cncTransform);
    }
    
    // Ajustar la escena al contenedor transformado
    QRectF transformedBounds = vectorContainer->sceneBoundingRect();
    scene->setSceneRect(transformedBounds);
    
    // Centrar en pantalla
    if (!transformedBounds.isEmpty()) {
        fitInView(transformedBounds, Qt::KeepAspectRatio);
    }
}

void VectorView::clearLeds() {
    if (ledContainer) {
        delete ledContainer;
        ledContainer = nullptr;
    }
    if (vectorContainer) {
        ledContainer = new QGraphicsRectItem(vectorContainer);
        ledContainer->setPen(Qt::NoPen);
        ledContainer->setBrush(Qt::NoBrush);
    }
    scene->update();
}

void VectorView::drawLeds(const QList<LedPosition> &leds, const LedPreset &preset) {
    clearLeds();
    if (!ledContainer) return;

    if (preset.isNeon) {
        // Neon Flex: Dibujar contornos gruesos y brillantes sobre los vectores
        QColor neonColor(preset.color.isEmpty() ? "#F472B6" : preset.color);
        QColor glowColor(preset.stroke.isEmpty() ? "#DB2777" : preset.stroke);
        double neonW = qMax(4.0, preset.modH * 10.0); // mm

        for (const QPainterPath &path : vectorPaths) {
            // Capa 1: Brillo exterior grueso
            QGraphicsPathItem *outerGlow = new QGraphicsPathItem(path, ledContainer);
            QPen glowPen(glowColor, neonW);
            glowPen.setCapStyle(Qt::RoundCap);
            glowPen.setJoinStyle(Qt::RoundJoin);
            outerGlow->setPen(glowPen);
            outerGlow->setOpacity(0.4);

            // Capa 2: Neon color medio
            QGraphicsPathItem *middleNeon = new QGraphicsPathItem(path, ledContainer);
            QPen neonPen(neonColor, neonW * 0.7);
            neonPen.setCapStyle(Qt::RoundCap);
            neonPen.setJoinStyle(Qt::RoundJoin);
            middleNeon->setPen(neonPen);

            // Capa 3: Núcleo blanco brillante
            QGraphicsPathItem *innerCore = new QGraphicsPathItem(path, ledContainer);
            QPen corePen(Qt::white, neonW * 0.25);
            corePen.setCapStyle(Qt::RoundCap);
            corePen.setJoinStyle(Qt::RoundJoin);
            innerCore->setPen(corePen);
        }
    } else {
        // Módulos LED discretos
        QColor ledColor(preset.color.isEmpty() ? "#FDE68A" : preset.color);
        QColor strokeColor(preset.stroke.isEmpty() ? "#B45309" : preset.stroke);
        
        QPen ledPen(strokeColor, qMax(0.5, preset.modH * 0.5));
        QBrush ledBrush(ledColor);
        
        double auraRadius = preset.stepY * 5.0; // mm (paso Y en cm * 10 / 2)
        QBrush auraBrush(QColor(ledColor.red(), ledColor.green(), ledColor.blue(), 38)); // ~15% opacidad
        
        for (const LedPosition &led : leds) {
            // Aura de iluminación
            QGraphicsEllipseItem *aura = new QGraphicsEllipseItem(
                -auraRadius, -auraRadius, auraRadius * 2, auraRadius * 2, ledContainer
            );
            aura->setPen(Qt::NoPen);
            aura->setBrush(auraBrush);
            aura->setPos(led.pos);
            aura->setZValue(1);

            // Módulo LED físico
            QGraphicsRectItem *mod = new QGraphicsRectItem(
                -preset.modW * 5.0, -preset.modH * 5.0, preset.modW * 10.0, preset.modH * 10.0, ledContainer
            );
            mod->setPen(ledPen);
            mod->setBrush(ledBrush);
            mod->setPos(led.pos);
            mod->setRotation(led.angle);
            mod->setZValue(2);
        }
    }
    scene->update();
}

double VectorView::getTotalPerimeter() const {
    double total = 0.0;
    for (const QPainterPath &path : vectorPaths) {
        total += SvgParser::calculatePathLength(path);
    }
    return total; // En unidades lógicas (px/mm)
}

void VectorView::wheelEvent(QWheelEvent *event) {
    // Zoom relativo
    double scaleFactor = 1.15;
    if (event->angleDelta().y() < 0) {
        scaleFactor = 1.0 / scaleFactor;
    }
    scale(scaleFactor, scaleFactor);
    event->accept();
}

void VectorView::mousePressEvent(QMouseEvent *event) {
    if (event->button() == Qt::LeftButton && (event->modifiers() & Qt::AltModifier)) {
        isPanning = true;
        panStartPos = event->pos();
        setCursor(Qt::ClosedHandCursor);
        event->accept();
        return;
    }
    QGraphicsView::mousePressEvent(event);
}

void VectorView::mouseMoveEvent(QMouseEvent *event) {
    if (isPanning) {
        QPoint delta = event->pos() - panStartPos;
        panStartPos = event->pos();
        
        horizontalScrollBar()->setValue(horizontalScrollBar()->value() - delta.x());
        verticalScrollBar()->setValue(verticalScrollBar()->value() - delta.y());
        event->accept();
        return;
    }
    QGraphicsView::mouseMoveEvent(event);
}

void VectorView::mouseReleaseEvent(QMouseEvent *event) {
    if (isPanning) {
        isPanning = false;
        unsetCursor();
        event->accept();
        return;
    }
    QGraphicsView::mouseReleaseEvent(event);
}
