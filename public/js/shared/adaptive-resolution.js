/**
 * ADAPTIVE RESOLUTION DETECTOR
 * Script para detectar y adaptar la interfaz según la resolución de pantalla
 * 
 * Para usar: Agregar antes del </body> en cualquier HTML
 * <script src="js/shared/adaptive-resolution.js"></script>
 */

(function() {
    'use strict';
    
    console.log('[ADAPTIVE-RES] 📱 Inicializando detección de resolución...');
    
    // ==================== BREAKPOINTS ====================
    const BREAKPOINTS = {
        MOBILE_SMALL: 480,
        MOBILE: 768,
        TABLET: 1024,
        DESKTOP: 1440,
        DESKTOP_LARGE: 1920
    };
    
    // ==================== DETECTAR RESOLUCIÓN ====================
    function detectResolution() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const isPortrait = height > width;
        const isLandscape = width > height;
        
        // Determinar tipo de dispositivo
        let deviceType = 'desktop-large';
        if (width < BREAKPOINTS.MOBILE_SMALL) {
            deviceType = 'mobile-small';
        } else if (width < BREAKPOINTS.MOBILE) {
            deviceType = 'mobile';
        } else if (width < BREAKPOINTS.TABLET) {
            deviceType = 'tablet';
        } else if (width < BREAKPOINTS.DESKTOP) {
            deviceType = 'desktop';
        } else if (width < BREAKPOINTS.DESKTOP_LARGE) {
            deviceType = 'desktop-large';
        } else {
            deviceType = 'desktop-xl';
        }
        
        const info = {
            width,
            height,
            deviceType,
            isPortrait,
            isLandscape,
            isMobile: width < BREAKPOINTS.MOBILE,
            isTablet: width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP,
            isDesktop: width >= BREAKPOINTS.DESKTOP,
            isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            pixelRatio: window.devicePixelRatio || 1
        };
        
        return info;
    }
    
    // ==================== APLICAR CLASES AL BODY ====================
    function applyClasses(info) {
        // Remover clases anteriores
        const body = document.body;
        body.classList.remove(
            'mobile-small', 'mobile', 'tablet', 'desktop', 'desktop-large', 'desktop-xl',
            'portrait', 'landscape', 'touch-device', 'retina'
        );
        
        // Agregar nuevas clases
        body.classList.add(info.deviceType);
        body.classList.add(info.isPortrait ? 'portrait' : 'landscape');
        if (info.isTouchDevice) body.classList.add('touch-device');
        if (info.pixelRatio >= 2) body.classList.add('retina');
        
        // Agregar atributos de datos
        body.dataset.width = info.width;
        body.dataset.height = info.height;
        body.dataset.deviceType = info.deviceType;
    }
    
    // ==================== AJUSTES DINÁMICOS ====================
    function applyDynamicAdjustments(info) {
        const root = document.documentElement;
        
        // Ajustar tamaño de fuente base según resolución
        if (info.isMobile) {
            root.style.fontSize = '14px';
        } else if (info.isTablet) {
            root.style.fontSize = '15px';
        } else {
            root.style.fontSize = '16px';
        }
        
        // Ajustar altura de viewport en móviles (para barras de navegación)
        if (info.isMobile || info.isTablet) {
            const vh = window.innerHeight * 0.01;
            root.style.setProperty('--vh', `${vh}px`);
        }
        
        // Variables CSS personalizadas
        root.style.setProperty('--screen-width', `${info.width}px`);
        root.style.setProperty('--screen-height', `${info.height}px`);
        root.style.setProperty('--device-type', info.deviceType);
    }
    
    // ==================== OPTIMIZACIONES DE RENDIMIENTO ====================
    function applyPerformanceOptimizations(info) {
        // Desactivar animaciones en dispositivos de baja potencia
        if (info.isMobile && info.pixelRatio < 2) {
            document.body.classList.add('reduce-animations');
        }
        
        // Reducir partículas en móviles
        if (info.isMobile) {
            const particles = document.querySelectorAll('.particle');
            particles.forEach((particle, index) => {
                if (index > 20) particle.remove(); // Solo 20 partículas en móvil
            });
        }
    }
    
    // ==================== LOG DE INFORMACIÓN ====================
    function logInfo(info) {
        console.log('[ADAPTIVE-RES] 📊 Información de pantalla:', {
            '📐 Resolución': `${info.width}x${info.height}`,
            '📱 Dispositivo': info.deviceType,
            '🔄 Orientación': info.isPortrait ? 'Portrait' : 'Landscape',
            '👆 Touch': info.isTouchDevice ? 'Sí' : 'No',
            '🖥️ Pixel Ratio': info.pixelRatio + 'x',
            '📏 Breakpoint': info.isMobile ? 'Mobile' : info.isTablet ? 'Tablet' : 'Desktop'
        });
    }
    
    // ==================== EVENTO DE ORIENTACIÓN ====================
    function handleOrientationChange() {
        console.log('[ADAPTIVE-RES] 🔄 Cambio de orientación detectado');
        updateResolution();
    }
    
    // ==================== ACTUALIZAR TODO ====================
    function updateResolution() {
        const info = detectResolution();
        applyClasses(info);
        applyDynamicAdjustments(info);
        applyPerformanceOptimizations(info);
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('resolutionChanged', { detail: info }));
        
        return info;
    }
    
    // ==================== DEBOUNCE PARA RESIZE ====================
    let resizeTimeout;
    function debouncedResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateResolution();
        }, 150);
    }
    
    // ==================== INICIALIZACIÓN ====================
    function init() {
        const info = updateResolution();
        logInfo(info);
        
        // Eventos
        window.addEventListener('resize', debouncedResize);
        window.addEventListener('orientationchange', handleOrientationChange);
        
        // Escuchar cambios de orientación en móviles
        if (window.screen && window.screen.orientation) {
            window.screen.orientation.addEventListener('change', handleOrientationChange);
        }
        
        console.log('[ADAPTIVE-RES] ✅ Sistema adaptativo activado');
    }
    
    // ==================== ESPERAR DOM ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // ==================== EXPORTAR API GLOBAL ====================
    window.AdaptiveResolution = {
        detect: detectResolution,
        update: updateResolution,
        info: detectResolution(),
        BREAKPOINTS
    };
    
})();

/**
 * USO EN OTROS SCRIPTS:
 * 
 * // Obtener información actual
 * const screenInfo = window.AdaptiveResolution.info;
 * console.log('Ancho:', screenInfo.width);
 * console.log('Es móvil:', screenInfo.isMobile);
 * 
 * // Escuchar cambios
 * window.addEventListener('resolutionChanged', function(e) {
 *   console.log('Nueva resolución:', e.detail);
 * });
 * 
 * // Forzar actualización
 * window.AdaptiveResolution.update();
 */
