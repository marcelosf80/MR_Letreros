#include "calculator.h"

double Calculator::calculateProductionCost(double materialCost, double perimeterCm, double cutCostPerCm, double laborCost, double quantity) {
    // Formula: Material + (Perímetro * Costo por cm * Cantidad) + Mano de Obra
    return materialCost + (perimeterCm * cutCostPerCm * quantity) + laborCost;
}

double Calculator::calculateSalePrice(double materialCost, double perimeterCm, double cutPricePerCm, double laborPrice, double markup, double quantity) {
    // Formula: (Material * Markup) + (Perímetro * Precio por cm * Cantidad) + Mano de Obra Venta
    return (materialCost * markup) + (perimeterCm * cutPricePerCm * quantity) + laborPrice;
}
