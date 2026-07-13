/**
 * Promotions Manager
 * Replaces the old Products block and discount-config.js
 * Manages volume discount rules and applies them to quotes.
 */

class PromotionsManager {
    constructor() {
        this.promotions = [];
        this.storageKey = 'mr_promotions_config';
        this.loadPromotions();
        this.injectModalUI();
        this.renderPromotionsList();
    }

    loadPromotions() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.promotions = JSON.parse(saved);
            } else {
                // Default rules if none exist
                this.promotions = [
                    { id: 'promo_1', minM2: 10, maxM2: 24.99, discountPercent: 5 },
                    { id: 'promo_2', minM2: 25, maxM2: 49.99, discountPercent: 10 },
                    { id: 'promo_3', minM2: 50, maxM2: 99.99, discountPercent: 15 },
                    { id: 'promo_4', minM2: 100, maxM2: 99999, discountPercent: 20 }
                ];
                this.savePromotions();
            }
        } catch (e) {
            console.error('[PromotionsManager] Error loading promotions:', e);
            this.promotions = [];
        }
    }

    savePromotions() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.promotions));
    }

    getApplicablePromotion(totalM2) {
        if (!totalM2 || totalM2 <= 0) return null;
        
        // Find promotion that matches the M2 range
        // Sort by minM2 descending to get the highest applicable tier just in case
        const sorted = [...this.promotions].sort((a, b) => b.minM2 - a.minM2);
        
        for (let rule of sorted) {
            if (totalM2 >= rule.minM2 && totalM2 <= rule.maxM2) {
                return rule;
            }
        }
        return null;
    }

    renderPromotionsList() {
        const listDiv = document.getElementById('promotionsList');
        if (!listDiv) return;

        if (this.promotions.length === 0) {
            listDiv.innerHTML = '<p class="empty-state">No hay promociones activas</p>';
            return;
        }

        // Sort by minimum M2
        const sorted = [...this.promotions].sort((a, b) => a.minM2 - b.minM2);

        listDiv.innerHTML = sorted.map(rule => `
            <div style="background: rgba(76, 175, 80, 0.1); padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(76, 175, 80, 0.3);">
                <div>
                    <h4 style="margin: 0; color: #4CAF50; font-size: 1rem;">🎁 Descuento del ${rule.discountPercent}%</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">
                        Si la superficie está entre <strong>${rule.minM2} m²</strong> y <strong>${rule.maxM2 === 99999 ? '∞' : rule.maxM2} m²</strong>.
                    </p>
                </div>
                <button onclick="window.promotionsManager.deletePromotion('${rule.id}')" style="background: none; border: none; cursor: pointer; color: #EF4444; font-size: 1.2rem;">
                    ×
                </button>
            </div>
        `).join('');
    }

    deletePromotion(id) {
        if (!confirm('¿Seguro que quieres eliminar esta promoción?')) return;
        this.promotions = this.promotions.filter(p => p.id !== id);
        this.savePromotions();
        this.renderPromotionsList();
        if (window.calculateTotals) window.calculateTotals(); // Recalculate quote
    }

    injectModalUI() {
        if (document.getElementById('promotionModal')) return;

        const modalHtml = `
        <div class="modal" id="promotionModal">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <h2 class="modal-title">🎁 Nueva Promoción</h2>
              <button class="btn-close" onclick="window.MRModals.close(document.getElementById('promotionModal'))">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Mínimo (m²)</label>
                <input type="number" id="promoMinM2" class="form-input" placeholder="Ej: 10" step="0.01">
              </div>
              <div class="form-group">
                <label class="form-label">Máximo (m²)</label>
                <input type="number" id="promoMaxM2" class="form-input" placeholder="Ej: 50 o déjalo vacío para sin límite" step="0.01">
                <small style="color:var(--text-secondary);">Dejar vacío equivale a infinito.</small>
              </div>
              <div class="form-group">
                <label class="form-label">Descuento (%)</label>
                <input type="number" id="promoDiscount" class="form-input" placeholder="Ej: 15" step="0.1">
              </div>
              <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" onclick="window.promotionsManager.saveNewPromotion()">
                Guardar Promoción
              </button>
            </div>
          </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    openModal() {
        // Reset fields
        document.getElementById('promoMinM2').value = '';
        document.getElementById('promoMaxM2').value = '';
        document.getElementById('promoDiscount').value = '';
        
        const modal = document.getElementById('promotionModal');
        if (modal && window.MRModals) {
            window.MRModals.open(modal);
        } else {
            console.error('Modal promotionModal not found or MRModals not initialized');
        }
    }

    saveNewPromotion() {
        const minStr = document.getElementById('promoMinM2').value;
        const maxStr = document.getElementById('promoMaxM2').value;
        const discStr = document.getElementById('promoDiscount').value;

        const min = parseFloat(minStr);
        let max = parseFloat(maxStr);
        const disc = parseFloat(discStr);

        if (isNaN(min) || isNaN(disc) || min < 0 || disc <= 0 || disc > 100) {
            alert('⚠️ Por favor ingresa el mínimo y un porcentaje de descuento válido (1-100).');
            return;
        }

        if (isNaN(max) || max <= 0) {
            max = 99999; // Represents infinity basically
        }

        if (min > max) {
            alert('⚠️ El mínimo M2 no puede ser mayor que el máximo M2.');
            return;
        }

        this.promotions.push({
            id: 'promo_' + Date.now(),
            minM2: min,
            maxM2: max,
            discountPercent: disc
        });

        this.savePromotions();
        this.renderPromotionsList();
        window.MRModals.close(document.getElementById('promotionModal'));
        if (window.calculateTotals) window.calculateTotals(); // Recalculate quote
    }
}

// Initializing
document.addEventListener('DOMContentLoaded', () => {
    window.promotionsManager = new PromotionsManager();
});
