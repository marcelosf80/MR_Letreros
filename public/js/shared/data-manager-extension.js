/**
 * Data Manager Extension - Trabajos
 * Extiende el data manager con métodos para gestión de trabajos
 *
 * FIX: todos los métodos usan dm.request (agrega Authorization automáticamente)
 * y los endpoints correctos (/api/gremio/data y /api/clientes/data).
 *
 * @version 1.1.0
 */

(function() {
    'use strict';

    // Esperar a que el data manager esté disponible
    function initializeWorkDataMethods() {
        if (!window.mrDataManager) {
            setTimeout(initializeWorkDataMethods, 100);
            return;
        }

        const dm = window.mrDataManager;

        /**
         * Obtiene todos los trabajos
         * @returns {Promise<Object>}
         */
        dm.getWorks = async function() {
            try {
                const data = await dm.request('/api/trabajos');
                return data || { works: [], notifications: [] };
            } catch (error) {
                console.error('[DATA-MGR] Error obteniendo trabajos:', error);
                return { works: [], notifications: [] };
            }
        };

        /**
         * Guarda trabajos
         * @param {Object} data - Datos a guardar
         * @returns {Promise<boolean>}
         */
        dm.saveWorks = async function(data) {
            try {
                const res = await dm.request('/api/trabajos', 'POST', data);
                return !!(res && res.success);
            } catch (error) {
                console.error('[DATA-MGR] Error guardando trabajos:', error);
                throw error;
            }
        };

        /**
         * Obtiene cotizaciones de gremio
         * @returns {Promise<Array>}
         */
        dm.getGremioQuotes = async function() {
            try {
                const data = await dm.request('/api/gremio/data');
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('[DATA-MGR] Error obteniendo cotizaciones gremio:', error);
                return [];
            }
        };

        /**
         * Guarda cotización de gremio (objeto → se agrega a la lista)
         * @param {Object} quote
         * @returns {Promise<Object>}
         */
        dm.saveGremioQuote = async function(quote) {
            try {
                return await dm.request('/api/gremio/data', 'POST', quote);
            } catch (error) {
                console.error('[DATA-MGR] Error guardando cotización gremio:', error);
                throw error;
            }
        };

        /**
         * Obtiene cotizaciones de clientes
         * @returns {Promise<Array>}
         */
        dm.getClientesQuotes = async function() {
            try {
                const data = await dm.request('/api/clientes/data');
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('[DATA-MGR] Error obteniendo cotizaciones clientes:', error);
                return [];
            }
        };

        /**
         * Guarda cotización de clientes (objeto → se agrega a la lista)
         * @param {Object} quote
         * @returns {Promise<Object>}
         */
        dm.saveClientesQuote = async function(quote) {
            try {
                return await dm.request('/api/clientes/data', 'POST', quote);
            } catch (error) {
                console.error('[DATA-MGR] Error guardando cotización clientes:', error);
                throw error;
            }
        };

        /**
         * Obtiene todos los clientes de la gestión
         * @returns {Promise<Array>}
         */
        dm.getClientes = async function() {
            try {
                const data = await dm.request('/api/clientes');
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('[DATA-MGR] Error obteniendo clientes:', error);
                return [];
            }
        };

        /**
         * Guarda clientes
         * @param {Array} clientes - Array de clientes
         * @returns {Promise<boolean>}
         */
        dm.saveClientes = async function(clientes) {
            try {
                const res = await dm.request('/api/clientes', 'POST', clientes);
                return !!(res && res.success);
            } catch (error) {
                console.error('[DATA-MGR] Error guardando clientes:', error);
                return false;
            }
        };

        /**
         * Busca clientes por término
         * @param {string} query - Término de búsqueda
         * @returns {Promise<Array>}
         */
        dm.searchClientes = async function(query) {
            try {
                const clientes = await this.getClientes();
                const q = query.toLowerCase();
                return clientes.filter(c =>
                    String(c.nombre || c.name || '').toLowerCase().includes(q) ||
                    (c.telefono && String(c.telefono).includes(q)) ||
                    (c.email && String(c.email).toLowerCase().includes(q))
                );
            } catch (error) {
                console.error('[DATA-MGR] Error buscando clientes:', error);
                return [];
            }
        };

        console.log('[DATA-MGR-EXT] ✅ Métodos de trabajos y clientes agregados');
    }

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWorkDataMethods);
    } else {
        initializeWorkDataMethods();
    }
})();
