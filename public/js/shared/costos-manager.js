// ============================================
// GESTOR DE COSTOS Y RENTABILIDAD
// VERSIÓN CORREGIDA CON LOCALSTORAGE
// ============================================

const costosManager = {
  costos: { products: [] },
  STORAGE_KEY: 'gremio_costos_db',

  // ========================================
  // CARGA Y GUARDADO
  // ========================================

  async loadCostos() {
    try {
      // INTENTO PRIMARIO: Cargar desde el servidor (Network Data Manager)
      if (window.mrDataManager) {
        console.log('[costosManager] 📡 Cargando desde servidor...');
        const serverData = await window.mrDataManager.getCostos();
        if (Array.isArray(serverData)) {
          this.costos = { products: serverData };
          console.log('✅ Costos cargados desde servidor:', serverData.length);
          // Actualizar localStorage como cache
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.costos));
          return this.costos;
        }
      }

      // FALLBACK: LocalStorage
      const data = localStorage.getItem(this.STORAGE_KEY);
      this.costos = data ? JSON.parse(data) : { products: [] };
      
      if (!this.costos.products) {
        this.costos.products = [];
      }
      console.log('⚠️ Costos cargados desde LocalStorage (Fallback):', this.costos.products.length);
      return this.costos;
    } catch (error) {
      console.error('Error cargando costos:', error);
      return { products: [] };
    }
  },

  async saveCostos() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.costos));
      console.log('✅ Costos guardados correctamente');
      return true;
    } catch (error) {
      console.error('Error guardando costos:', error);
      return false;
    }
  },

  // ========================================
  // GESTIÓN DE PRODUCTOS
  // ========================================

  async addProduct(product) {
    try {
      if (!product.id) {
        product.id = 'prod_' + Date.now();
      }
      this.costos.products.push(product);
      await this.saveCostos();
      return true;
    } catch (error) {
      console.error('Error agregando producto:', error);
      return false;
    }
  },

  async updateProduct(productId, updates) {
    try {
      const productIndex = this.costos.products.findIndex(p => p.id === productId || p.category === productId);
      if (productIndex === -1) {
        console.error('Producto no encontrado:', productId);
        return false;
      }

      // Actualizar producto
      this.costos.products[productIndex] = {
        ...this.costos.products[productIndex],
        ...updates
      };

      // Recalcular costo total
      const product = this.costos.products[productIndex];
      product.costs.total = this.calculateTotalCost(product.costs);

      // Guardar
      return await this.saveCostos();
    } catch (error) {
      console.error('Error actualizando producto:', error);
      return false;
    }
  },

  async deleteProduct(productId) {
    try {
      this.costos.products = this.costos.products.filter(
        p => p.id !== productId && p.category !== productId
      );
      return await this.saveCostos();
    } catch (error) {
      console.error('Error eliminando producto:', error);
      return false;
    }
  },

  getProduct(productId) {
    return this.costos.products.find(p => p.id === productId || p.category === productId);
  },

  getAllProducts() {
    return this.costos.products;
  },

  // ========================================
  // CÁLCULOS DE COSTOS
  // ========================================

  calculateTotalCost(costs) {
    const material = parseFloat(costs.material) || 0;
    const labor = parseFloat(costs.labor) || 0;
    const indirect = parseFloat(costs.indirect) || 0;
    return material + labor + indirect;
  },

  updateCostField(productId, field, value) {
    const product = this.getProduct(productId);
    if (!product) return false;

    // Actualizar campo específico
    product.costs[field] = parseFloat(value) || 0;

    // Recalcular total automáticamente
    product.costs.total = this.calculateTotalCost(product.costs);

    return true;
  },

  // ========================================
  // CÁLCULOS DE RENTABILIDAD
  // ========================================

  calculateProfitability(salePrice, productCost) {
    const price = parseFloat(salePrice) || 0;
    const cost = parseFloat(productCost) || 0;
    if (cost === 0) return { margin: 0, profit: 0, percentage: 0, status: 'sin-datos' };
    if (price === 0) return { margin: 0, profit: 0, percentage: 0, status: 'sin-precio' };

    const profit = price - cost;
    const percentage = (profit / price) * 100;
    // Determinar estado del semáforo
    let status = 'rojo';
    if (percentage > 30) status = 'verde';
    else if (percentage >= 15) status = 'amarillo';

    return {
      margin: profit,
      profit: profit,
      percentage: percentage,
      status: status
    };
  },

  getProfitabilityClass(percentage) {
    if (percentage > 30) return 'profit-green';
    if (percentage >= 15) return 'profit-yellow';
    return 'profit-red';
  },

  getProfitabilityIcon(percentage) {
    if (percentage > 30) return '🟢';
    if (percentage >= 15) return '🟡';
    return '🔴';
  },

  getProfitabilityLabel(percentage) {
    if (percentage > 30) return 'Excelente';
    if (percentage >= 15) return 'Aceptable';
    return 'Bajo';
  },

  // ========================================
  // ANÁLISIS Y REPORTES
  // ========================================

  async generateProfitabilityReport(quotations) {
    const report = {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      averageMargin: 0,
      productsProfitability: [],
      bestProducts: [],
      worstProducts: []
    };

    try {
      await this.loadCostos();

      for (const quotation of quotations) {
        for (const item of quotation.items) {
          const product = this.getProduct(item.category);
          if (product) {
            const salePrice = parseFloat(item.unitPrice) || 0;
            const quantity = parseFloat(item.quantity) || 1;
            const totalSale = salePrice * quantity;
            const totalCost = product.costs.total * quantity;
            const profit = totalSale - totalCost;
            const profitability = this.calculateProfitability(salePrice, product.costs.total);

            report.totalRevenue += totalSale;
            report.totalCost += totalCost;
            report.totalProfit += profit;

            report.productsProfitability.push({
              name: item.name,
              category: item.category,
              quantity: quantity,
              totalSale: totalSale,
              totalCost: totalCost,
              profit: profit,
              percentage: profitability.percentage,
              status: profitability.status
            });
          }
        }
      }

      // Calcular margen promedio
      if (report.totalRevenue > 0) {
        report.averageMargin = (report.totalProfit / report.totalRevenue) * 100;
      }

      // Ordenar por rentabilidad
      report.productsProfitability.sort((a, b) => b.percentage - a.percentage);

      // Mejores y peores productos
      report.bestProducts = report.productsProfitability.slice(0, 5);
      report.worstProducts = report.productsProfitability.slice(-5).reverse();

      return report;
    } catch (error) {
      console.error('Error generando reporte de rentabilidad:', error);
      return report;
    }
  },

  getMostProfitableProducts(limit = 5) {
    const products = this.getAllProducts().map(product => {
      // Calcular rentabilidad estimada (usando precio base)
      const basePrice = product.basePrice || product.costs.total * 1.5;
      const profitability = this.calculateProfitability(basePrice, product.costs.total);
      return {
        ...product,
        profitability
      };
    });

    return products
      .sort((a, b) => b.profitability.percentage - a.profitability.percentage)
      .slice(0, limit);
  },

  getLeastProfitableProducts(limit = 5) {
    const products = this.getAllProducts().map(product => {
      const basePrice = product.basePrice || product.costs.total * 1.5;
      const profitability = this.calculateProfitability(basePrice, product.costs.total);
      return {
        ...product,
        profitability
      };
    });

    return products
      .sort((a, b) => a.profitability.percentage - b.profitability.percentage)
      .slice(0, limit);
  },

  // ========================================
  // RECOMENDACIONES CON IA
  // ========================================

  async getAIRecommendations(quotation) {
    const recommendations = {
      suggestions: [],
      warnings: [],
      opportunities: []
    };

    try {
      await this.loadCostos();

      for (const item of quotation.items) {
        const product = this.getProduct(item.category);
        if (!product) {
          recommendations.warnings.push({
            type: 'producto-sin-costos',
            message: `⚠️ El producto "${item.name}" no tiene costos configurados`,
            action: 'Configurá los costos en la pestaña de Costos para calcular rentabilidad'
          });
          continue;
        }

        const profitability = this.calculateProfitability(item.unitPrice, product.costs.total);

        // Recomendaciones según rentabilidad
        if (profitability.status === 'rojo') {
          recommendations.warnings.push({
            type: 'baja-rentabilidad',
            product: item.name,
            message: `🔴 Baja rentabilidad (${profitability.percentage.toFixed(1)}%) en "${item.name}"`,
            action: `Considerá aumentar el precio o revisar los costos. Precio sugerido mínimo: $${(product.costs.total * 1.15).toFixed(2)}`
          });
        } else if (profitability.status === 'amarillo') {
          recommendations.suggestions.push({
            type: 'rentabilidad-mejorable',
            product: item.name,
            message: `🟡 Rentabilidad aceptable (${profitability.percentage.toFixed(1)}%) en "${item.name}"`,
            action: `Podés mejorar el margen. Precio sugerido: $${(product.costs.total * 1.35).toFixed(2)}`
          });
        } else {
          recommendations.opportunities.push({
            type: 'buena-rentabilidad',
            product: item.name,
            message: `🟢 Excelente rentabilidad (${profitability.percentage.toFixed(1)}%) en "${item.name}"`
          });
        }

        // Detectar oportunidades de upselling
        if (item.quantity > 10 && profitability.status === 'verde') {
          recommendations.opportunities.push({
            type: 'volumen-alto',
            product: item.name,
            message: `📈 Alto volumen en producto rentable "${item.name}"`,
            action: 'Considerá ofrecer descuento por volumen manteniendo margen del 25%'
          });
        }
      }

      // Recomendación de cotización total
      const totalCost = quotation.items.reduce((sum, item) => {
        const product = this.getProduct(item.category);
        return sum + (product ? product.costs.total * item.quantity : 0);
      }, 0);

      const totalPrice = quotation.total;
      const overallProfitability = this.calculateProfitability(totalPrice, totalCost);

      if (overallProfitability.status === 'rojo') {
        recommendations.warnings.push({
          type: 'cotizacion-no-rentable',
          message: `⚠️ COTIZACIÓN TOTAL CON BAJA RENTABILIDAD (${overallProfitability.percentage.toFixed(1)}%)`,
          action: `Revisá todos los precios. Precio mínimo sugerido: $${(totalCost * 1.15).toFixed(2)}`
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error generando recomendaciones:', error);
      return recommendations;
    }
  },

  // Análisis de tendencias (para dashboard)
  analyzeTrends(historicalQuotations) {
    const trends = {
      avgMarginByMonth: {},
      topProductsByProfit: [],
      improvementOpportunities: []
    };

    // Agrupar por mes
    const byMonth = {};
    historicalQuotations.forEach(q => {
      const month = new Date(q.date).toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(q);
    });

    // Calcular margen promedio por mes
    for (const month in byMonth) {
      const quotations = byMonth[month];
      let totalRevenue = 0;
      let totalCost = 0;

      quotations.forEach(q => {
        q.items.forEach(item => {
          const product = this.getProduct(item.category);
          if (product) {
            totalRevenue += item.unitPrice * item.quantity;
            totalCost += product.costs.total * item.quantity;
          }
        });
      });

      if (totalRevenue > 0) {
        trends.avgMarginByMonth[month] = ((totalRevenue - totalCost) / totalRevenue) * 100;
      }
    }

    return trends;
  }
};

// Inicializar
costosManager.loadCostos().then(() => {
  console.log('✅ Costos Manager inicializado');
});

// ========================================
// ✅ EXPORTAR A WINDOW (CORRECCIÓN CRÍTICA)
// ========================================

window.costosManager = costosManager;

console.log('✅ Costos Manager v2.0 (localStorage) cargado correctamente');
console.log('✅ window.costosManager disponible:', typeof window.costosManager);
