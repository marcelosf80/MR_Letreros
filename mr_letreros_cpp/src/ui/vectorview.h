#ifndef VECTORVIEW_H
#define VECTORVIEW_H

#include <QGraphicsView>
#include <QGraphicsScene>
#include <QPainterPath>
#include <QWheelEvent>
#include <QMouseEvent>

#include "../core/led_positioner.h"
#include <QGraphicsRectItem>

class VectorView : public QGraphicsView {
    Q_OBJECT

public:
    VectorView(QWidget *parent = nullptr);
    void setPaths(const QList<QPainterPath> &paths);
    double getTotalPerimeter() const;
    void drawLeds(const QList<LedPosition> &leds, const LedPreset &preset);
    void clearLeds();

protected:
    void wheelEvent(QWheelEvent *event) override;
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;

private:
    QGraphicsScene *scene;
    QList<QPainterPath> vectorPaths;
    
    QGraphicsRectItem *vectorContainer;
    QGraphicsRectItem *ledContainer;
    
    // Paneo (Alt + Drag)
    bool isPanning;
    QPoint panStartPos;
};

#endif // VECTORVIEW_H
