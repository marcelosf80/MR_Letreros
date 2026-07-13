/**
 * Notification Polling - Sistema de Monitoreo de Notificaciones V2
 * Verifica periódicamente si hay nuevas notificaciones en el servidor
 * y las muestra usando el Notification System + Badge visual.
 * 
 * @version 2.0.0
 */

(function() {
    'use strict';
    
    let isPolling = false;
    const POLL_INTERVAL = 15000; // 15 segundos
    const SEEN_KEY = 'mr_seen_notifications'; // localStorage key
    
    // --- BADGE VISUAL EN EL HEADER ---
    function createNotificationBadge() {
        const topbar = document.querySelector('.mx-topbar');
        if (!topbar || document.getElementById('notif-bell-container')) return;

        const container = document.createElement('div');
        container.id = 'notif-bell-container';
        container.style.cssText = 'position:relative;cursor:pointer;margin-left:auto;margin-right:12px;';
        container.innerHTML = `
            <div id="notifBell" style="font-size:22px;position:relative;padding:8px 12px;border-radius:12px;transition:all 0.3s ease;color:var(--txt);" title="Notificaciones">
                <i class="fa-solid fa-bell"></i>
                <span id="notifBadge" style="display:none;position:absolute;top:4px;right:4px;background:#ef4444;color:white;font-size:10px;font-weight:900;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:50%;padding:0 4px;box-shadow:0 0 10px rgba(239, 68, 68, 0.5);"></span>
            </div>
            <div id="notifDropdown" style="display:none;position:absolute;top:54px;right:-10px;width:380px;max-height:450px;overflow-y:auto;background:var(--bg-surface, #1e1e2e);border:1px solid var(--glass-border, #333);border-radius:16px;box-shadow:0 15px 50px rgba(0,0,0,0.5);z-index:999999;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);">
                <div style="padding:16px 20px;border-bottom:1px solid var(--glass-border, #333);display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.02);">
                    <span style="font-weight:800;color:var(--txt);font-size:15px;letter-spacing:0.5px;">Notificaciones</span>
                    <button id="notifClearAll" style="background:none;border:none;color:var(--txt-2);font-size:12px;cursor:pointer;transition:color 0.2s;font-weight:600;"><i class="fa-solid fa-check-double" style="margin-right:4px;"></i>Marcar leídas</button>
                </div>
                <div id="notifList" style="padding:10px;">
                    <p style="text-align:center;color:var(--txt-2);padding:30px;font-size:13px;font-weight:500;">No hay notificaciones nuevas 🎉</p>
                </div>
            </div>
        `;

        // Insertar antes del botón de estrategia
        const btnStrategy = document.getElementById('btnStrategy');
        if (btnStrategy) {
            topbar.insertBefore(container, btnStrategy);
        } else {
            topbar.appendChild(container);
        }

        // Toggle dropdown
        document.getElementById('notifBell').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = document.getElementById('notifDropdown');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });

        // Cerrar al hacer clic fuera
        document.addEventListener('click', () => {
            document.getElementById('notifDropdown').style.display = 'none';
        });

        // Marcar todo leído
        document.getElementById('notifClearAll').addEventListener('click', async () => {
            await markAllRead();
            updateBadge(0);
            document.getElementById('notifList').innerHTML = '<p style="text-align:center;color:var(--txt-2);padding:30px;font-size:13px;font-weight:500;">No hay notificaciones nuevas 🎉</p>';
        });
    }

    function updateBadge(count) {
        const badge = document.getElementById('notifBadge');
        if (!badge) return;
        if (count > 0) {
            badge.style.display = 'block';
            badge.textContent = count > 9 ? '9+' : count;
            // Animación de rebote
            const bell = document.getElementById('notifBell');
            bell.style.animation = 'none';
            setTimeout(() => { bell.style.animation = 'bellShake 0.6s ease'; }, 10);
        } else {
            badge.style.display = 'none';
        }
    }

    function renderNotifications(notifications) {
        const list = document.getElementById('notifList');
        if (!list) return;
        
        if (notifications.length === 0) {
            list.innerHTML = '<p style="text-align:center;color:var(--txt-2);padding:30px;font-size:13px;font-weight:500;">No hay notificaciones nuevas 🎉</p>';
            return;
        }

        list.innerHTML = notifications.map(n => {
            const timeAgo = getTimeAgo(n.date);
            return `
                <div data-notif-id="${n.id}" class="notif-item-premium" style="padding:14px 16px;border-radius:12px;margin-bottom:8px;background:${n.read ? 'transparent' : 'var(--bg-mid, rgba(0,0,0,0.05))'};border-left:4px solid ${n.read ? 'transparent' : 'var(--bs-primary, #ffd700)'};cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;gap:6px;" 
                     onclick="window.location.href='trabajos.html'">
                    <div style="font-weight:${n.read ? '600' : '800'};font-size:14px;color:var(--txt);display:flex;align-items:center;gap:6px;">
                        ${n.read ? '' : '<span style="width:8px;height:8px;background:var(--bs-primary, #ffd700);border-radius:50%;display:inline-block;box-shadow:0 0 8px var(--bs-primary, #ffd700);"></span>'}${n.title || 'Nuevo Pedido'}
                    </div>
                    <div style="font-size:13px;color:var(--txt-2);line-height:1.4;">${n.message || ''}</div>
                    <div style="font-size:11px;color:var(--txt-3, #999);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${timeAgo}</div>
                </div>
            `;
        }).join('');
    }

    function getTimeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Ahora mismo';
        if (mins < 60) return `Hace ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Hace ${hours}h`;
        return `Hace ${Math.floor(hours / 24)} días`;
    }

    // --- AGREGAR ANIMACIÓN CSS ---
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes bellShake {
                0% { transform: rotate(0); }
                15% { transform: rotate(14deg); }
                30% { transform: rotate(-14deg); }
                45% { transform: rotate(10deg); }
                60% { transform: rotate(-8deg); }
                75% { transform: rotate(4deg); }
                100% { transform: rotate(0); }
            }
            #notifBell:hover { background: var(--bg-mid, rgba(0,0,0,0.05)); }
            .notif-item-premium:hover { background: var(--bg-mid, rgba(0,0,0,0.05)) !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        `;
        document.head.appendChild(style);
    }

    // --- POLLING ---
    function startPolling() {
        if (isPolling) return;
        isPolling = true;
        
        console.log('[NOTIF-POLL] 📡 Iniciando monitoreo de notificaciones v2...');
        
        // Primera ejecución inmediata
        checkNotifications();
        
        // Intervalo periódico
        setInterval(checkNotifications, POLL_INTERVAL);
    }
    
    async function checkNotifications() {
        try {
            const token = localStorage.getItem('mr_token');
            if (!token) return;
            
            const response = await fetch('/api/trabajos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            const notifications = data.notifications || [];
            
            if (notifications.length === 0) return;

            // Contar no leídas
            const unread = notifications.filter(n => !n.read);
            
            // Actualizar el badge
            updateBadge(unread.length);
            
            // Renderizar en el dropdown
            renderNotifications(notifications);

            // Mostrar toast para las nuevas que no hayamos visto en esta sesión
            const seenIds = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
            
            for (const notif of unread) {
                if (seenIds.includes(notif.id)) continue;
                
                // Mostrar toast visual
                if (window.showNotification) {
                    window.showNotification({
                        title: notif.title || 'Nuevo Pedido Web',
                        message: notif.message || '',
                        type: notif.type || 'success',
                        duration: 10000,
                        actions: notif.workId ? [
                            {
                                text: '👁️ Ver Trabajo',
                                type: 'primary',
                                onClick: () => window.location.href = 'trabajos.html'
                            }
                        ] : null
                    });
                }
                
                // Guardar como "visto en esta sesión"
                seenIds.push(notif.id);
            }
            
            localStorage.setItem(SEEN_KEY, JSON.stringify(seenIds));
            
        } catch (error) {
            // Silenciar errores para no spamear la consola
        }
    }
    
    async function markAllRead() {
        try {
            const token = localStorage.getItem('mr_token');
            if (!token) return;
            
            const response = await fetch('/api/trabajos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.notifications) {
                data.notifications.forEach(n => n.read = true);
            }
            
            await fetch('/api/trabajos', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error('[NOTIF-POLL] Error al marcar como leídas:', e);
        }
    }
    
    // --- INICIAR ---
    window.addEventListener('load', () => {
        injectStyles();
        createNotificationBadge();
        setTimeout(startPolling, 1500);
        console.log('[NOTIF-POLL] ✅ Sistema de notificaciones v2 activo.');
    });
    
})();
