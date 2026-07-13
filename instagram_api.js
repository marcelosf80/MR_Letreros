// instagram_api.js
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

class InstagramAPI {
    constructor(pageId, accessToken) {
        this.pageId = pageId;
        this.accessToken = accessToken;
        this.graphUrl = 'https://graph.facebook.com/v19.0';
    }

    /**
     * Sube la imagen local a un servicio público (tmpfiles.org) para obtener una URL pública temporal
     */
    async uploadLocalImage(filePath) {
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath));
            
            // Usamos tmpfiles.org como host temporal sin auth (máximo 60 minutos o menos)
            const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
                headers: {
                    ...form.getHeaders()
                }
            });

            if (response.data && response.data.status === 'success') {
                // Tmpfiles retorna una URL de visualización. Transformamos a descarga directa.
                const viewUrl = response.data.data.url;
                const directUrl = viewUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                return directUrl;
            }
            throw new Error("Respuesta inválida del servidor de archivos temporal.");
        } catch (error) {
            console.error('[INSTAGRAM] Error subiendo imagen local:', error.message);
            throw new Error('No se pudo generar la URL pública de la imagen.');
        }
    }

    /**
     * Primero: Crear el contenedor de Media en Instagram
     */
    async createMediaContainer(imageUrl, caption) {
        try {
            const response = await axios.post(`${this.graphUrl}/${this.pageId}/media`, null, {
                params: {
                    image_url: imageUrl,
                    caption: caption,
                    access_token: this.accessToken
                }
            });
            return response.data.id; // Retorna el creation_id
        } catch (error) {
            console.error('[INSTAGRAM] Error creando contenedor:', error.response ? error.response.data : error.message);
            throw new Error('Error al crear el contenedor en Instagram.');
        }
    }

    /**
     * Segundo: Publicar el contenedor en el Feed
     */
    async publishMedia(creationId) {
        try {
            const response = await axios.post(`${this.graphUrl}/${this.pageId}/media_publish`, null, {
                params: {
                    creation_id: creationId,
                    access_token: this.accessToken
                }
            });
            return response.data.id; // Retorna el post id
        } catch (error) {
            console.error('[INSTAGRAM] Error publicando media:', error.response ? error.response.data : error.message);
            throw new Error('Error al publicar el post en Instagram.');
        }
    }

    /**
     * Flujo completo de publicación
     */
    async processAndPublish(filePath, caption) {
        console.log('[INSTAGRAM] 1. Subiendo imagen a servidor público interino...');
        const publicUrl = await this.uploadLocalImage(filePath);
        
        console.log('[INSTAGRAM] 2. Creando contenedor en Meta Graph con URL:', publicUrl);
        const creationId = await this.createMediaContainer(publicUrl, caption);
        
        console.log('[INSTAGRAM] 3. Publicando en Instagram...');
        const postId = await this.publishMedia(creationId);
        
        console.log('[INSTAGRAM] ✅ Publicación exitosa. ID:', postId);
        return postId;
    }
}

module.exports = InstagramAPI;
