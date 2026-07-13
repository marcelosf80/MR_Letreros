#include <QApplication>
#include "ui/mainwindow.h"

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);

    MainWindow window;
    window.setWindowTitle("MR Letreros - Calculadora de Vectores");
    window.resize(1200, 800);
    window.show();

    return app.exec();
}
