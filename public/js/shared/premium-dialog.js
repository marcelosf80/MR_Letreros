/**
 * ========================================
 * PREMIUM DIALOG SYSTEM - AsuraWebs Style
 * ========================================
 * Reemplaza los prompt() nativos con modales modernos (Glassmorphism)
 */

window.PremiumDialog = (function() {
    'use strict';

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'premium-dialog-overlay';
        document.body.appendChild(overlay);
        
        // Trigger reflow for transition
        void overlay.offsetWidth;
        overlay.classList.add('visible');
        return overlay;
    }

    function removeOverlay(overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        }, 300); // Matches transition duration
    }

    /**
     * Muestra un diálogo con múltiples opciones a elegir.
     * @param {string} title - El título del modal
     * @param {string} subtitle - El subtítulo o descripción (ej: "Actual: Pendiente")
     * @param {Array} options - Array de objetos { value: '1', label: 'Pendiente', colorClass: 'btn-warning' }
     * @returns {Promise<string|null>} El valor seleccionado, o null si canceló.
     */
    function select(title, subtitle, options) {
        return new Promise((resolve) => {
            const overlay = createOverlay();

            const dialog = document.createElement('div');
            dialog.className = 'premium-dialog-box animate-fade-in-up';
            
            let optionsHtml = options.map(opt => `
                <button class="btn ${opt.colorClass || 'btn-secondary'} premium-dialog-btn w-100 mb-2" data-val="${opt.value}">
                    ${opt.label}
                </button>
            `).join('');

            dialog.innerHTML = `
                <h3 class="premium-dialog-title">${title}</h3>
                ${subtitle ? `<p class="premium-dialog-subtitle">${subtitle}</p>` : ''}
                <div class="premium-dialog-options mt-4">
                    ${optionsHtml}
                </div>
                <div class="premium-dialog-footer mt-3">
                    <button class="btn btn-secondary w-100" id="btnPremiumCancel">Cancelar</button>
                </div>
            `;

            overlay.appendChild(dialog);

            // Events
            const buttons = dialog.querySelectorAll('.premium-dialog-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    resolve(btn.getAttribute('data-val'));
                    removeOverlay(overlay);
                });
            });

            dialog.querySelector('#btnPremiumCancel').addEventListener('click', () => {
                resolve(null);
                removeOverlay(overlay);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    resolve(null);
                    removeOverlay(overlay);
                }
            });
        });
    }

    /**
     * Muestra un diálogo para introducir texto.
     * @param {string} title - El título del modal
     * @param {string} defaultValue - El valor por defecto (opcional)
     * @param {string} type - Tipo de input ('text' o 'number')
     * @returns {Promise<string|null>} El texto ingresado, o null si canceló.
     */
    function text(title, defaultValue = '', type = 'text') {
        return new Promise((resolve) => {
            const overlay = createOverlay();

            const dialog = document.createElement('div');
            dialog.className = 'premium-dialog-box animate-fade-in-up';
            
            dialog.innerHTML = `
                <h3 class="premium-dialog-title">${title}</h3>
                <div class="premium-dialog-input-group mt-3">
                    <input type="${type}" class="form-control premium-dialog-input" id="premiumInputVal" value="${defaultValue}" autocomplete="off">
                </div>
                <div class="premium-dialog-footer mt-4 d-flex gap-2">
                    <button class="btn btn-secondary w-50" id="btnPremiumCancelText">Cancelar</button>
                    <button class="btn btn-primary w-50" id="btnPremiumAcceptText">Aceptar</button>
                </div>
            `;

            overlay.appendChild(dialog);
            
            const input = dialog.querySelector('#premiumInputVal');
            input.focus();
            
            // Si tiene texto, lo seleccionamos para fácil borrado
            if (defaultValue) {
                input.select();
            }

            const finish = (isAccept) => {
                if (isAccept) {
                    resolve(input.value);
                } else {
                    resolve(null);
                }
                removeOverlay(overlay);
            };

            dialog.querySelector('#btnPremiumAcceptText').addEventListener('click', () => finish(true));
            dialog.querySelector('#btnPremiumCancelText').addEventListener('click', () => finish(false));

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finish(true);
                if (e.key === 'Escape') finish(false);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) finish(false);
            });
        });
    }

    return {
        select,
        text
    };

})();
