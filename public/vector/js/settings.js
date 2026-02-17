// Gestión de persistencia (LocalStorage)

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('cncSettings'));
    if (!settings) return;

    if (settings.sheetWidth) document.getElementById('sheetWidth').value = settings.sheetWidth;
    if (settings.sheetHeight) document.getElementById('sheetHeight').value = settings.sheetHeight;
    if (settings.gap) document.getElementById('gap').value = settings.gap;
    if (settings.cncCutDepth) document.getElementById('cncCutDepth').value = settings.cncCutDepth;
    if (settings.cncFeedRate) document.getElementById('cncFeedRate').value = settings.cncFeedRate;
    if (settings.parkX) document.getElementById('parkX').value = settings.parkX;
    if (settings.parkY) document.getElementById('parkY').value = settings.parkY;
    if (settings.nestDirection) document.getElementById('nestDirection').value = settings.nestDirection;
    
    if (settings.hasOwnProperty('allowRotation')) document.getElementById('allowRotation').checked = settings.allowRotation;
    if (settings.hasOwnProperty('safeTravel')) document.getElementById('safeTravel').checked = settings.safeTravel;
}

function saveSettings() {
    const settings = {};
    ['sheetWidth', 'sheetHeight', 'gap', 'cncCutDepth', 'cncFeedRate', 'parkX', 'parkY', 'nestDirection'].forEach(id => {
        const el = document.getElementById(id);
        if(el) settings[id] = el.value;
    });
    ['allowRotation', 'safeTravel'].forEach(id => {
        const el = document.getElementById(id);
        if(el) settings[id] = el.checked;
    });
    localStorage.setItem('cncSettings', JSON.stringify(settings));
}

function initSettings() {
    ['sheetWidth', 'sheetHeight', 'gap', 'cncCutDepth', 'cncFeedRate', 'parkX', 'parkY', 'nestDirection', 'allowRotation', 'safeTravel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveSettings);
    });
    loadSettings();
}