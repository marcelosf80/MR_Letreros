/**
 * Data Manager Extension - Trabajos
 * Extiende el data manager con métodos para gestión de trabajos
 * 
 * @version 1.0.0
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
                const response = await fetch('/api/trabajos', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    // Si no existe el archivo, retornar estructura vacía
                    if (response.status === 404) {
                        return { works: [], notifications: [] };
                    }
                    throw new Error('Error obteniendo trabajos');
                }
                
                const data = await response.json();
                return data || { works: [], notifications: [] };
            } catch (error) {
                console.error('[DATA-MGR] Error obteniendo trabajos:', error);
                // Retornar estructura vacía en caso de error
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
                const response = await fetch('/api/trabajos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    throw new Error('Error guardando trabajos');
                }
                
                return true;
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
                const response = await fetch('/api/gremio/cotizaciones', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    if (response.status === 404) return [];
                    throw new Error('Error obteniendo cotizaciones gremio');
                }
                
                const data = await response.json();
                return data || [];
            } catch (error) {
                console.error('[DATA-MGR] Error obteniendo cotizaciones gremio:', error);
                return [];
            }
        };
        
        /**
         * Guarda cotización de gremio
         * @param {Object} quote
         * @returns {Promise<Object>}
         */
        dm.saveGremioQuote = async function(quote) {
            try {
                const response = await fetch('/api/gremio/cotizaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(quote)
                });
                
                if (!response.ok) {
                    throw new Error('Error guardando cotización gremio');
                }
                
                return await response.json();
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
                const response = await fetch('/api/clientes/cotizaciones', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    if (response.status === 404) return [];
                    throw new Error('Error obteniendo cotizaciones clientes');
                }
                
                const data = await response.json();
                return data || [];
            } catch (error) {
                console.error('[DATA-MGR] Error obteniendo cotizaciones clientes:', error);
                return [];
            }
        };
        
        /**
         * Guarda cotización de clientes
         * @param {Object} quote
         * @returns {Promise<Object>}
         */
        dm.saveClientesQuote = async function(quote) {
            try {
                const response = await fetch('/api/clientes/cotizaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(quote)
                });
                
                if (!response.ok) {
                    throw new Error('Error guardando cotización clientes');
                }
                
                return await response.json();
            } catch (error) {
                console.error('[DATA-MGR] Error guardando cotización clientes:', error);
                throw error;
            }
        };
        
        console.log('[DATA-MGR-EXT] ✅ Métodos de trabajos agregados');
    }
    
    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWorkDataMethods);
    } else {
        initializeWorkDataMethods();
    }
})();
