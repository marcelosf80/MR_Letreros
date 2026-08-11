import base64
import requests
import json
import os
from PIL import Image

def get_image_description_and_points(image_path, api_key):
    """
    Usa Llama 3.2 Vision para analizar la imagen y encontrar puntos clave del objeto principal.
    """
    # Redimensionar para no exceder límites de API
    img = Image.open(image_path)
    img.thumbnail((800, 800))
    
    # Convertir a RGB si tiene transparencia (JPEG no soporta Alpha)
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        img = img.convert('RGB')
    
    import io
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

    prompt = """
    Analiza esta imagen para un recorte de fondo transparente.
    1. Identifica el objeto o texto principal (ej: 'Logotipo blanco de MR Letreros').
    2. Proporciona una coordenada central (x, y) aproximada del objeto principal en formato normalizado (0-1000).
    3. Responde SOLAMENTE en formato JSON: {"label": "descripción", "x": valor, "y": valor}
    """

    # --- INTENTO 1: GROQ CLOUD (PRIMARIO) ---
    try:
        url_groq = "https://api.groq.com/openai/v1/chat/completions"
        headers_groq = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data_groq = {
            "model": "llama-3.2-11b-vision-preview",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                }
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        
        print("Intentando visión con Groq Cloud...")
        response = requests.post(url_groq, headers=headers_groq, json=data_groq, timeout=15)
        if response.status_code == 200:
            result = response.json()
            print("✅ Visión Groq exitosa.")
            return json.loads(result['choices'][0]['message']['content'])
        else:
            print(f"⚠️ Groq Vision falló ({response.status_code}). Saltando a respaldo...")
    except Exception as e:
        print(f"⚠️ Excepción en Groq Vision: {e}. Saltando a respaldo...")

    # --- INTENTO 2: OLLAMA LOCAL (RESPALDO) ---
    try:
        url_ollama = "http://localhost:11434/v1/chat/completions"
        data_ollama = {
            "model": "gemma4:e4b",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                }
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        
        print("Intentando visión con Ollama Local (Respaldo)...")
        response = requests.post(url_ollama, json=data_ollama, timeout=60)
        if response.status_code == 200:
            result = response.json()
            print("✅ Visión Ollama exitosa.")
            return json.loads(result['choices'][0]['message']['content'])
    except Exception as e:
        print(f"❌ Falló el respaldo de Ollama: {e}")
        
    return None

if __name__ == "__main__":
    # Test rápido
    import sys
    if len(sys.argv) > 2:
        res = get_image_description_and_points(sys.argv[1], sys.argv[2])
        print(json.dumps(res, indent=2))
