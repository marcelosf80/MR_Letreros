// ==================== SERVER-WHATSAPP.JS - MR LETREROS ====================
// Módulo independiente para gestionar el bot de WhatsApp.

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

console.log('🤖 Iniciando el bot de WhatsApp de MR Letreros...');

// --- CONFIGURACIÓN DE CONEXIÓN ---
// RECOMENDACIÓN: Mover esta URL a una variable de entorno (process.env.API_URL) para mayor flexibilidad.
const SERVER_API_URL = 'http://localhost:3000/api/precios';

// --- INICIALIZACIÓN DEL CLIENTE DE WHATSAPP ---

// Usamos 'LocalAuth' para guardar la sesión y no tener que escanear el QR cada vez.
// Se creará una carpeta .wwebjs_auth/ para guardar la sesión.
const client = new Client({
    authStrategy: new LocalAuth()
});

// 1. Generar el código QR en la terminal
client.on('qr', (qr) => {
    console.log('================================================');
    console.log('¡Escanea este código QR con tu WhatsApp!');
    console.log('================================================');
    qrcode.generate(qr, { small: true });
});

// 2. Confirmar que el bot está listo y conectado
client.on('ready', () => {
    console.log('✅ ¡Bot de WhatsApp conectado y listo para recibir consultas!');
});

// --- Helper para obtener propiedades de forma segura ---
const getProductProperty = (product, properties, defaultValue = '') => {
    for (const prop of properties) {
        if (product && typeof product[prop] !== 'undefined' && product[prop] !== null) {
            return product[prop];
        }
    }
    return defaultValue;
};


// 3. Lógica principal: Escuchar mensajes entrantes
client.on('message', async (message) => {
    const messageBody = message.body.toLowerCase();

    // Palabras clave que activan la respuesta
    const keywords = ['precio', 'cotizar', 'valor', 'costo'];

    // Comprobar si el mensaje contiene alguna palabra clave
    if (keywords.some(keyword => messageBody.includes(keyword))) {
        console.log(`💬 Mensaje de [${message.from}]: "${message.body}" -> Activó respuesta de precios.`);

        // 1. Extraer el término de búsqueda del producto de forma más robusta
        let searchTerm = messageBody;
        const wordsToRemove = [
            'precio', 'precios', 'cotizar', 'valor', 'costo', 'cuanto', 'cuánto', 'cuesta',
            'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'uno', 'unas', 'unos',
            'es', 'me', 'podrias', 'podrías', 'dar', 'quisiera', 'saber', 'por', 'favor'
        ];

        const regex = new RegExp(`\\b(${wordsToRemove.join('|')})\\b`, 'gi');
        searchTerm = searchTerm.replace(regex, '').replace(/\s+/g, ' ').trim();

        try {
            // Consultar precios al servidor principal (API)
            const response = await axios.get(SERVER_API_URL);
            const precios = response.data;

            if (precios && precios.length > 0) {
                let foundProduct = null;
                // 2. Si hay un término de búsqueda, buscar el producto
                if (searchTerm) {
                    // Búsqueda más flexible en nombre o material
                    foundProduct = precios.find(p =>
                        getProductProperty(p, ['name', 'material'], '').toLowerCase().includes(searchTerm)
                    );
                }

                // 3. Construir la respuesta
                if (foundProduct) {
                    // Respuesta para producto específico encontrado
                    const nombreProducto = getProductProperty(foundProduct, ['name', 'material'], 'Producto');
                    const precioProducto = getProductProperty(foundProduct, ['price', 'precio_gremio'], 0);
                    const imageUrl = foundProduct.image; // Asumimos que hay un campo 'image' con una URL

                    const caption = `¡Hola! El precio de *${nombreProducto}* es de *$${precioProducto}*.`;

                    if (imageUrl) {
                        try {
                            const media = await MessageMedia.fromUrl(imageUrl);
                            await client.sendMessage(message.from, media, { caption: caption });
                            console.log(`✔️ Respuesta con imagen para "${searchTerm}" enviada a [${message.from}].`);
                        } catch (mediaError) {
                            console.error(`❌ Error al cargar la imagen desde ${imageUrl}. Enviando solo texto.`, mediaError);
                            await message.reply(caption);
                        }
                    } else {
                        await message.reply(caption);
                        console.log(`✔️ Respuesta de texto para "${searchTerm}" enviada a [${message.from}].`);
                    }
                } else {
                    // Respuesta genérica si no se busca nada o no se encuentra el producto
                    const primerProducto = precios[0];
                    const nombreProducto = getProductProperty(primerProducto, ['name', 'material'], 'Producto de ejemplo');
                    const precioProducto = getProductProperty(primerProducto, ['price', 'precio_gremio'], 0);

                    const respuesta = searchTerm
                        ? `No encontré un producto que coincida con "${searchTerm}".\n\nA modo de ejemplo, el precio de *${nombreProducto}* es de *$${precioProducto}*.`
                        : `¡Hola! Gracias por tu consulta. A modo de ejemplo, el precio de *${nombreProducto}* es de *$${precioProducto}*. Para una cotización detallada, por favor danos más información.`;
                    
                    await message.reply(respuesta);
                    console.log(`✔️ Respuesta genérica enviada a [${message.from}].`);
                }
            } else {
                await message.reply('Hola, de momento no tengo precios para mostrar. Un asesor se comunicará contigo pronto.');
            }
        } catch (error) {
            console.error('❌ Error al conectar con el servidor de precios:', error.message);
            await message.reply('¡Hola! Tuve un problema para consultar los precios. Un asesor se comunicará contigo a la brevedad.');
        }
    }
});

// Iniciar el cliente
client.initialize();

// Manejo de errores de autenticación
client.on('auth_failure', msg => {
    console.error('❌ ERROR DE AUTENTICACIÓN:', msg);
});