/**
 * upscaler.js - Ampliar imágenes con IA (como iLoveIMG)
 * Usa algoritmos de interpolación y sharpening para mejorar la calidad
 */

/**
 * Amplía una imagen usando algoritmos de mejora
 * @param {string} imageUrl - URL de la imagen a ampliar
 * @param {number} scale - Factor de escala (2, 3, o 4)
 * @returns {Promise<string>} URL de la imagen ampliada
 */
async function upscaleImage(imageUrl, scale = 2) {
    const statusMsg = document.getElementById('statusMsg');
    const btnUpscale = document.getElementById('btnUpscale');
    
    if (btnUpscale) {
        btnUpscale.disabled = true;
        btnUpscale.innerHTML = '🔄 Ampliando...';
    }
    
    if (statusMsg) {
        statusMsg.textContent = `🎨 Ampliando imagen ${scale}x... Puede tardar unos segundos.`;
        statusMsg.style.color = '#FFD43B';
    }
    
    try {
        // Usar Canvas con algoritmo bicúbico mejorado
        const result = await upscaleWithCanvas(imageUrl, scale);
        
        if (statusMsg) {
            statusMsg.textContent = `✅ Imagen ampliada ${scale}x correctamente`;
            statusMsg.style.color = '#51CF66';
        }
        
        return result;
        
    } catch (error) {
        console.error('Error al ampliar imagen:', error);
        
        if (statusMsg) {
            statusMsg.textContent = '❌ Error al ampliar: ' + error.message;
            statusMsg.style.color = '#FF5252';
        }
        
        throw error;
        
    } finally {
        if (btnUpscale) {
            btnUpscale.disabled = false;
            btnUpscale.innerHTML = '🔍 Ampliar Imagen';
        }
    }
}

/**
 * Amplía imagen usando Canvas con interpolación bicúbica y sharpening
 */
async function upscaleWithCanvas(imageUrl, scale) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            // Crear canvas con dimensiones ampliadas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const newWidth = img.width * scale;
            const newHeight = img.height * scale;
            
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            // Configurar para máxima calidad
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Dibujar imagen escalada
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            
            // Aplicar sharpening para mejorar detalles
            const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
            const sharpened = applySharpen(imageData);
            ctx.putImageData(sharpened, 0, 0);
            
            // Convertir a blob
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                resolve(url);
            }, 'image/png', 1.0);
        };
        
        img.onerror = () => reject(new Error('Error al cargar imagen'));
        img.src = imageUrl;
    });
}

/**
 * Aplica filtro de sharpening para mejorar detalles
 */
function applySharpen(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Kernel de sharpening
    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];
    
    const output = new ImageData(width, height);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) { // RGB (sin alpha)
                let sum = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        const kernelIdx = (ky + 1) * 3 + (kx + 1);
                        sum += data[idx] * kernel[kernelIdx];
                    }
                }
                
                const idx = (y * width + x) * 4 + c;
                output.data[idx] = Math.max(0, Math.min(255, sum));
            }
            
            // Copiar alpha
            const idx = (y * width + x) * 4;
            output.data[idx + 3] = data[idx + 3];
        }
    }
    
    return output;
}

/**
 * Muestra preview del upscaling con comparación antes/después
 */
function showUpscalePreview(originalUrl, upscaledUrl) {
    const sheetsContainer = document.getElementById('sheetsContainer');
    
    // Obtener dimensiones de las imágenes para mostrar
    const imgOriginal = new Image();
    imgOriginal.src = originalUrl;
    
    const imgUpscaled = new Image();
    imgUpscaled.src = upscaledUrl;

    // Esperar a que carguen para tener dimensiones (aunque ya deberían estar cacheadas)
    // Usamos onload para asegurar
    
    sheetsContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
            <div style="text-align: center;">
                <h4 style="margin-bottom: 10px; color: #FFD43B;">Original</h4>
                <img src="${originalUrl}" style="max-width: 100%; border: 2px solid #555; border-radius: 8px;">
                <p style="margin-top: 5px; color: #aaa; font-size: 0.9em;" id="dimOriginal">Cargando dimensiones...</p>
            </div>
            <div style="text-align: center;">
                <h4 style="margin-bottom: 10px; color: #51CF66;">Ampliada</h4>
                <img src="${upscaledUrl}" style="max-width: 100%; border: 2px solid #51CF66; border-radius: 8px;">
                <p style="margin-top: 5px; color: #aaa; font-size: 0.9em;" id="dimUpscaled">Cargando dimensiones...</p>
            </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="useUpscaledImage('${upscaledUrl}')" class="btn-action" style="background: #51CF66; width: auto; padding: 10px 20px;">
                ✅ Usar Imagen Ampliada
            </button>
            <button onclick="location.reload()" class="btn-action" style="background: #e03131; width: auto; padding: 10px 20px; margin-left: 10px;">
                ❌ Descartar
            </button>
        </div>
    `;

    imgOriginal.onload = () => {
        document.getElementById('dimOriginal').textContent = `${imgOriginal.naturalWidth} x ${imgOriginal.naturalHeight} px`;
    };

    imgUpscaled.onload = () => {
        document.getElementById('dimUpscaled').textContent = `${imgUpscaled.naturalWidth} x ${imgUpscaled.naturalHeight} px`;
    };
}

/**
 * Usa la imagen ampliada como imagen actual
 */
function useUpscaledImage(url) {
    const sourcePreviewImg = document.getElementById('sourcePreviewImg');
    const miniPreview = document.getElementById('miniPreview');
    
    sourcePreviewImg.src = url;
    currentImgUrl = url;
    
    miniPreview.style.display = 'block';
    
    const sheetsContainer = document.getElementById('sheetsContainer');
    sheetsContainer.innerHTML = '';
    
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '500px';
    sheetsContainer.appendChild(img);
    
    document.getElementById('statusMsg').textContent = '✅ Imagen ampliada lista para vectorizar';
    document.getElementById('statusMsg').style.color = '#51CF66';
    
    document.getElementById('btnVectorize').disabled = false;
}