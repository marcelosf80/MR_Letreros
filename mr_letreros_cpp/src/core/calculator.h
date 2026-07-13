#ifndef CALCULATOR_H
#define CALCULATOR_H

class Calculator {
public:
    static double calculateProductionCost(double materialCost, double perimeterCm, double cutCostPerCm, double laborCost, double quantity);
    static double calculateSalePrice(double materialCost, double perimeterCm, double cutPricePerCm, double laborPrice, double markup, double quantity);
};

#endif // CALCULATOR_H
