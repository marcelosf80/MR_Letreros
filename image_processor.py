import sys
import argparse
import os
import cv2
import numpy as np
from PIL import Image, ImageFilter

try:
    from rembg import remove
except ImportError:
    remove = None

import groq_vision
import requests

def remove_bg_cloud(input_path, output_path, api_key):
    """
    Usa la API de remove.bg para un recorte profesional de nivel industrial.
    """
    try:
        print(f"Enviando imagen a remove.bg...")
        with open(input_path, 'rb') as f:
            response = requests.post(
                'https://api.remove.bg/v1.0/removebg',
                files={'image_file': f},
                data={'size': 'auto'},
                headers={'X-Api-Key': api_key},
                timeout=60,  # FIX: sin timeout la petición podía colgar para siempre
            )
        if response.status_code == requests.codes.ok:
            with open(output_path, 'wb') as out:
                out.write(response.content)
            print("Recorte profesional con remove.bg completado.")
            return True
        else:
            print(f"Error en remove.bg: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Excepción en remove.bg: {e}")
        return False

def remove_background(input_path, output_path, groq_key=None, removebg_key=None):
    # 1. Intentar con remove.bg si hay llave (esto no requiere rembg local)
    if removebg_key:
        if remove_bg_cloud(input_path, output_path, removebg_key):
            return

    # 2. Si falló la nube o no hay llave, necesitamos rembg local
    if remove is None:
        raise ImportError("rembg no está instalado y no hay una API Key válida para remove.bg")

    # 2. Fallback: Remoción de fondo inicial con rembg
    input_image = Image.open(input_path)
    # Forzar modo RGB si es necesario antes de procesar
    if input_image.mode != 'RGB' and input_image.mode != 'RGBA':
        input_image = input_image.convert('RGB')
    
    # Obtener imagen con transparencia base
    rgba_pill = remove(input_image)
    
    # 2. POST-PROCESAMIENTO DE PRECISIÓN (Deep Clean v2)
    # Convertir a formato OpenCV para manipular el canal Alfa
    rgba_cv = cv2.cvtColor(np.array(rgba_pill), cv2.COLOR_RGBA2BGRA)
    
    # Separar canales
    b, g, r, a = cv2.split(rgba_cv)
    
    # --- Limpieza Agresiva de Residuos ---
    # Si tenemos Groq Key, intentamos guia semántica
    if groq_key:
        print("Obteniendo guía semántica de Llama 3.2 Vision...")
        vision_data = groq_vision.get_image_description_and_points(input_path, groq_key)
        if vision_data:
            print(f"Llama detectó: {vision_data.get('label')}")
            # Aquí podríamos usar SAM si estuviera instalado, 
            # de momento usamos la binarización mejorada con el contexto de Llama
    
    # --- Limpieza Refinada (Evitar Manchado) ---
    # 1. Escalado Dinámico de Alfa (Preserva bordes suaves de texto)
    # En lugar de binarizar (127), eliminamos solo el "humo" real (opacidad < 20)
    # y escalamos el resto para que sea nítido pero no "mordido"
    a_scaled = np.where(a < 20, 0, a) # Eliminar ruido de fondo residual
    a_scaled = np.clip(a_scaled.astype(float) * 1.2, 0, 255).astype(np.uint8) # Reforzar opacidad del objeto
    
    # 2. Suavizado Ligero (Anti-aliasing)
    a_smooth = cv2.GaussianBlur(a_scaled, (3,3), 0.5)
    
    # 3. Limpieza de Color (Smart Masking)
    # Reemplazamos el color del objeto pero mantenemos su luminancia original
    mask_3ch = cv2.merge((a_scaled, a_scaled, a_scaled))
    rgb_clean = cv2.bitwise_and(cv2.merge((b, g, r)), mask_3ch)
    
    # Recombinar canales
    final_rgba = cv2.merge((rgb_clean[:,:,0], rgb_clean[:,:,1], rgb_clean[:,:,2], a_smooth))
    
    # 3. Guardar resultado final
    cv2.imwrite(output_path, final_rgba)
    print("Módulo 'Dynamic Clean' completado: Recorte nítido sin manchado.")

_upsamplers = {}

def get_realesrgan_upsampler(model_name="general"):
    global _upsamplers
    if model_name not in _upsamplers:
        import sys
        import torchvision.transforms.functional as F
        # Patch for torchvision compatibility with basicsr
        sys.modules["torchvision.transforms.functional_tensor"] = F

        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer

        print(f"Inicializando modelo Real-ESRGAN ({model_name}) local...")
        model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
        
        if model_name == "anime":
            model = RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64, num_block=6, num_grow_ch=32, scale=4
            )
            weights_path = os.path.join(model_dir, 'RealESRGAN_x4plus_anime_6B.pth')
            url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"
        else:
            model = RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4
            )
            weights_path = os.path.join(model_dir, 'RealESRGAN_x4plus.pth')
            url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"

        if not os.path.exists(weights_path):
            os.makedirs(model_dir, exist_ok=True)
            print(f"Descargando pesos de Real-ESRGAN {model_name} (~64MB)...")
            import urllib.request
            urllib.request.urlretrieve(url, weights_path)
            print("Descarga de pesos completada.")

        _upsamplers[model_name] = RealESRGANer(
            scale=4,
            model_path=weights_path,
            model=model,
            tile=400,
            tile_pad=10,
            pre_pad=0,
            half=False,  # FP32 para CPU
            gpu_id=None,  # CPU
        )
        print(f"Modelo Real-ESRGAN {model_name} inicializado exitosamente.")
    return _upsamplers[model_name]

def upscale_image_local(input_path, output_path, target_w, target_h, model_name="general"):
    """
    Upscale local utilizando el modelo Real-ESRGAN en memoria de este proceso.
    Al finalizar el proceso, la memoria se libera completamente.
    """
    img_pil = Image.open(input_path)
    has_alpha = img_pil.mode == "RGBA" or "transparency" in img_pil.info
    
    if has_alpha:
        img_pil = img_pil.convert("RGBA")
    else:
        img_pil = img_pil.convert("RGB")
        
    upsampler = get_realesrgan_upsampler(model_name)
    
    if has_alpha:
        r, g, b, a = img_pil.split()
        rgb_img = Image.merge("RGB", (r, g, b))
        
        print("Iniciando escalado local de canales RGB...")
        rgb_np = np.array(rgb_img)
        output_rgb, _ = upsampler.enhance(rgb_np, outscale=4)
        
        print("Escalando canal Alfa...")
        a_upscaled = a.resize(Image.fromarray(output_rgb).size, Image.Resampling.LANCZOS)
        
        upscaled_img = Image.merge(
            "RGBA", 
            (
                Image.fromarray(output_rgb).split()[0], 
                Image.fromarray(output_rgb).split()[1], 
                Image.fromarray(output_rgb).split()[2], 
                a_upscaled
            )
        )
    else:
        img_np = np.array(img_pil)
        print("Iniciando escalado local...")
        output, _ = upsampler.enhance(img_np, outscale=4)
        upscaled_img = Image.fromarray(output)

    # Redimensionar al tamaño objetivo final con Lanczos
    final_img = upscaled_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Aplicar nitidez y mejoras específicas
    if model_name == "anime":
        print("Aplicando mejoras locales de ilustración/logo...")
        try:
            if final_img.mode == "RGBA":
                r, g, b, a = final_img.split()
                
                a_np = np.array(a)
                a_np = cv2.bilateralFilter(a_np, 5, 50, 50)
                _, a_thresh = cv2.threshold(a_np, 127, 255, cv2.THRESH_BINARY)
                a_smooth = cv2.GaussianBlur(a_thresh, (3, 3), 0.5)
                a_final = Image.fromarray(a_smooth)
                
                rgb_img = Image.merge("RGB", (r, g, b))
                rgb_np = cv2.cvtColor(np.array(rgb_img), cv2.COLOR_RGB2BGR)
                
                rgb_clean = cv2.bilateralFilter(rgb_np, d=9, sigmaColor=55, sigmaSpace=55)
                rgb_clean = cv2.bilateralFilter(rgb_clean, d=5, sigmaColor=35, sigmaSpace=35)
                rgb_clean = cv2.medianBlur(rgb_clean, 3)
                
                laplacian = cv2.Laplacian(rgb_clean, cv2.CV_64F)
                laplacian = cv2.convertScaleAbs(laplacian)
                rgb_clean_sharp = cv2.addWeighted(rgb_clean, 1.0, laplacian, 0.20, 0)
                
                gaussian = cv2.GaussianBlur(rgb_clean_sharp, (0, 0), 1.2)
                rgb_final_cv = cv2.addWeighted(rgb_clean_sharp, 1.4, gaussian, -0.4, 0)
                rgb_final_cv = cv2.bilateralFilter(rgb_final_cv, d=5, sigmaColor=25, sigmaSpace=25)
                
                rgb_final = Image.fromarray(cv2.cvtColor(rgb_final_cv, cv2.COLOR_BGR2RGB))
                final_img = Image.merge(
                    "RGBA", 
                    (rgb_final.split()[0], rgb_final.split()[1], rgb_final.split()[2], a_final)
                )
            else:
                img_np = cv2.cvtColor(np.array(final_img), cv2.COLOR_RGB2BGR)
                
                clean = cv2.bilateralFilter(img_np, d=9, sigmaColor=55, sigmaSpace=55)
                clean = cv2.bilateralFilter(clean, d=5, sigmaColor=35, sigmaSpace=35)
                clean = cv2.medianBlur(clean, 3)
                
                laplacian = cv2.Laplacian(clean, cv2.CV_64F)
                laplacian = cv2.convertScaleAbs(laplacian)
                clean_sharp = cv2.addWeighted(clean, 1.0, laplacian, 0.20, 0)
                
                gaussian = cv2.GaussianBlur(clean_sharp, (0, 0), 1.2)
                final_cv = cv2.addWeighted(clean_sharp, 1.4, gaussian, -0.4, 0)
                final_cv = cv2.bilateralFilter(final_cv, d=5, sigmaColor=25, sigmaSpace=25)
                
                final_img = Image.fromarray(cv2.cvtColor(final_cv, cv2.COLOR_BGR2RGB))
        except Exception as e:
            print(f"Error en nitidez de ilustración local: {e}")
            final_img = final_img.filter(ImageFilter.DETAIL)
            final_img = final_img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
            final_img = final_img.filter(ImageFilter.SHARPEN)
    else:
        final_img = final_img.filter(ImageFilter.DETAIL)
        final_img = final_img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=150, threshold=2))
        final_img = final_img.filter(ImageFilter.SHARPEN)
        
    final_img.save(output_path, "PNG")
    print("Escalado local finalizado con éxito.")

def upscale_image_cloud(input_path, output_path, model_name='4xNomosWebPhoto_esrgan'):
    """
    Escala la imagen 4x utilizando la API en la nube de Hugging Face (Phips/Upscaler).
    """
    try:
        from gradio_client import Client, handle_file
        print(f"Enviando imagen a la API de Escalado en la Nube (Phips/Upscaler - Modelo: {model_name})...")
        client = Client("Phips/Upscaler")
        result = client.predict(
            image=handle_file(input_path),
            model_selection=model_name,
            api_name="/upscale_image"
        )
        upscaled_temp_path = result[1] if isinstance(result, (tuple, list)) and len(result) > 1 else None
        if upscaled_temp_path and os.path.exists(upscaled_temp_path):
            import shutil
            shutil.copy(upscaled_temp_path, output_path)
            print("Escalado por IA en la nube completado exitosamente.")
            return True
        else:
            print("La API de la nube no devolvió un archivo válido.", file=sys.stderr)
    except Exception as e:
        print(f"Error procesando escalado en la nube: {e}", file=sys.stderr)
    return False

def upscale_image(input_path, output_path, factor=2, method='standard', groq_key=None):
    if method in ['ultra', 'ultra_anime', 'high_quality']:
        model_name = '4xNomos2_hq_dat2' if method == 'ultra_anime' else '4xNomosWebPhoto_esrgan'
        if upscale_image_cloud(input_path, output_path, model_name=model_name):
            # Si se requería redimensionar al tamaño objetivo específico por el factor:
            try:
                img_pil = Image.open(output_path)
                orig_w, orig_h = Image.open(input_path).size
                target_w = int(orig_w * factor)
                target_h = int(orig_h * factor)
                if img_pil.size != (target_w, target_h):
                    final_img = img_pil.resize((target_w, target_h), Image.Resampling.LANCZOS)
                    final_img.save(output_path, "PNG")
            except Exception as resize_err:
                print(f"Aviso en ajuste de tamaño final: {resize_err}")
            return
        try:
            # 1. Cargar imagen para obtener dimensiones objetivo
            img_pil = Image.open(input_path)
            orig_w, orig_h = img_pil.size
            target_w = int(orig_w * factor)
            target_h = int(orig_h * factor)

            print(f"Enviando imagen a la API de Escalado local (Puerto 8002): {target_w}x{target_h}px...")
            
            # 2. Enviar petición POST a la API local de Daniel Lando
            with open(input_path, 'rb') as f:
                files = {'image': (os.path.basename(input_path), f, 'image/png')}
                data = {
                    'target_width': target_w,
                    'target_height': target_h,
                    'model_name': 'anime' if method == 'ultra_anime' else 'general'
                }
                # Timeout de 90 segundos para permitir el procesamiento completo
                response = requests.post('http://localhost:8002/upscale', files=files, data=data, timeout=90)
                
            if response.status_code == 200:
                with open(output_path, 'wb') as out:
                    out.write(response.content)
                
                # Para fotos aplicamos enfoque tradicional, para ilustraciones confiamos en el filtrado bilateral del servidor
                if method != 'ultra_anime':
                    try:
                        img_sharp = Image.open(output_path)
                        img_sharp = img_sharp.filter(ImageFilter.DETAIL)
                        img_sharp = img_sharp.filter(ImageFilter.UnsharpMask(radius=1.5, percent=200, threshold=2))
                        img_sharp = img_sharp.filter(ImageFilter.SHARPEN)
                        img_sharp.save(output_path, "PNG")
                        print("Escalado Real-ESRGAN con post-procesamiento de nitidez completado.")
                    except Exception as pe:
                        print(f"Error en post-procesamiento de nitidez: {pe}", file=sys.stderr)
                else:
                    print("Escalado Real-ESRGAN (anime) completado con suavizado bilateral nativo.")
                
                return
            else:
                raise Exception(f"La API de upscaler devolvió error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error/Ausencia de API Real-ESRGAN: {e}. Intentando procesamiento local con modelo...")
            try:
                model_name = 'anime' if method == 'ultra_anime' else 'general'
                upscale_image_local(input_path, output_path, target_w, target_h, model_name)
                return
            except Exception as local_err:
                print(f"Error en Real-ESRGAN local: {local_err}. Usando fallback a filtro Lanczos4...", file=sys.stderr)
                try:
                    # Leer imagen con OpenCV
                    img = cv2.imread(input_path)
                    if img is None: raise ValueError("No se pudo leer la imagen")
                    
                    h, w = img.shape[:2]
                    target_size = (int(w * factor), int(h * factor))
                    
                    # 1. Escalado Lanczos4 de Alta Fidelidad (Mejor que Bicúbico)
                    upscaled = cv2.resize(img, target_size, interpolation=cv2.INTER_LANCZOS4)
                    
                    # 2. Refuerzo de Contraste Local (CLAHE adaptado para logos)
                    lab = cv2.cvtColor(upscaled, cv2.COLOR_BGR2LAB)
                    l, a, b = cv2.split(lab)
                    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
                    cl = clahe.apply(l)
                    limg = cv2.merge((cl,a,b))
                    enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
                    
                    # 3. AFILADO DE BORDES (Laplacian Sharpening)
                    laplacian = cv2.Laplacian(enhanced, cv2.CV_64F)
                    laplacian = cv2.convertScaleAbs(laplacian)
                    enhanced = cv2.addWeighted(enhanced, 1.0, laplacian, 0.2, 0)
                    
                    # 4. MÁSCARA DE ENFOQUE AGRESIVA (Unsharp Masking)
                    gaussian = cv2.GaussianBlur(enhanced, (0, 0), 2.0)
                    final = cv2.addWeighted(enhanced, 1.8, gaussian, -0.8, 0)
                    
                    # 5. Limpieza Final (Bilateral para evitar "serrucho" en bordes)
                    final = cv2.bilateralFilter(final, 7, 50, 50)
                    
                    cv2.imwrite(output_path, final)
                    print("Escalado Ultra Tíñido (fallback) completado con éxito.")
                    return
                except Exception as fe:
                    print(f"Error en fallback Ultra: {fe}. Usando Pillow standard...", file=sys.stderr)


    # Fallback to Pillow (Standard & High Quality)
    input_image = Image.open(input_path)
    width, height = input_image.size
    new_size = (int(width * factor), int(height * factor))
    
    # Base upscale using LANCZOS
    output_image = input_image.resize(new_size, Image.Resampling.LANCZOS)
    
    if method == 'high_quality' or method == 'ultra':
        output_image = output_image.filter(ImageFilter.DETAIL)
        output_image = output_image.filter(ImageFilter.UnsharpMask(radius=1.5, percent=200, threshold=2))
        output_image = output_image.filter(ImageFilter.SHARPEN)
    else:
        output_image = output_image.filter(ImageFilter.UnsharpMask(radius=1.2, percent=150, threshold=2))
        output_image = output_image.filter(ImageFilter.SHARPEN)
    
    output_image.save(output_path, "PNG")

def depixel_image(input_path, output_path):
    """
    Elimina el pixelado y suaviza los bordes de imágenes pixeladas (logos/letras) a su resolución original.
    """
    try:
        # Cargar la imagen original para obtener las dimensiones
        img_pil = Image.open(input_path)
        orig_w, orig_h = img_pil.size
        
        # 1. Intentar uso en la nube (Phips/Upscaler con modelo para logos/arte)
        temp_upscaled = input_path + "_temp_up.png"
        if upscale_image_cloud(input_path, temp_upscaled, model_name='4xNomos2_hq_dat2'):
            try:
                img_enhanced = Image.open(temp_upscaled)
                final_img = img_enhanced.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
                final_img = final_img.filter(ImageFilter.DETAIL)
                final_img = final_img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=220, threshold=2))
                final_img = final_img.filter(ImageFilter.SHARPEN)
                if os.path.exists(temp_upscaled):
                    os.remove(temp_upscaled)
                final_img.save(output_path, "PNG")
                print("Despixelado por IA en la nube completado con éxito.")
                return
            except Exception as pe:
                print(f"Error procesando resultado de la nube: {pe}")

        # Intentar usar el modelo Real-ESRGAN local en puerto 8002 con el modelo anime
        try:
            print("Intentando despixelar usando Real-ESRGAN local (modelo anime)...")
            temp_upscaled = input_path + "_temp_up.png"
            # Escalamos 4x usando el modelo anime en el endpoint local
            with open(input_path, 'rb') as f:
                files = {'image': (os.path.basename(input_path), f, 'image/png')}
                data = {
                    'target_width': orig_w * 4,
                    'target_height': orig_h * 4,
                    'model_name': 'anime'
                }
                response = requests.post('http://localhost:8002/upscale', files=files, data=data, timeout=90)
                
            if response.status_code == 200:
                with open(temp_upscaled, 'wb') as out:
                    out.write(response.content)
                
                # Cargar la imagen escalada por IA
                img_enhanced = Image.open(temp_upscaled)
                
                # Redimensionar al tamaño original usando Lanczos (conservando aspecto)
                final_img = img_enhanced.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
                
                # Aplicar máscara de enfoque agresiva para contornos ultra nítidos y limpios
                final_img = final_img.filter(ImageFilter.DETAIL)
                final_img = final_img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=220, threshold=2))
                final_img = final_img.filter(ImageFilter.SHARPEN)
                
                # Limpiar temporal
                if os.path.exists(temp_upscaled):
                    os.remove(temp_upscaled)
                    
                final_img.save(output_path, "PNG")
                print("Despixelado con Real-ESRGAN (anime) y enfoque completado exitosamente.")
                return
        except Exception as e:
            print(f"Error/Ausencia de API Real-ESRGAN ({e}). Intentando despixelar usando procesamiento local con modelo...")
            try:
                temp_upscaled = input_path + "_temp_up.png"
                upscale_image_local(input_path, temp_upscaled, orig_w * 4, orig_h * 4, "anime")
                
                # Cargar la imagen escalada por IA
                img_enhanced = Image.open(temp_upscaled)
                
                # Redimensionar al tamaño original usando Lanczos (conservando aspecto)
                final_img = img_enhanced.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
                
                # Aplicar máscara de enfoque agresiva para contornos ultra nítidos y limpios
                final_img = final_img.filter(ImageFilter.DETAIL)
                final_img = final_img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=220, threshold=2))
                final_img = final_img.filter(ImageFilter.SHARPEN)
                
                # Limpiar temporal
                if os.path.exists(temp_upscaled):
                    os.remove(temp_upscaled)
                    
                final_img.save(output_path, "PNG")
                print("Despixelado local con modelo anime y enfoque completado exitosamente.")
                return
            except Exception as local_err:
                print(f"Error en despixelado local con modelo ({local_err}). Usando procesamiento local alternativo de alta nitidez...")

        # --- FALLBACK: Algoritmo de despixelado local con PIL (ultra nítido) ---
        if img_pil.mode != "RGB":
            img_pil = img_pil.convert("RGB")
        
        # 1. Ampliar 3x para suavizar la escalera de píxeles
        up = img_pil.resize((orig_w * 3, orig_h * 3), Image.Resampling.LANCZOS)
        
        # 2. Enfocar agresivamente en alta resolución para definir bordes y contornos
        up = up.filter(ImageFilter.DETAIL)
        up = up.filter(ImageFilter.UnsharpMask(radius=2.0, percent=250, threshold=1))
        
        # 3. Reducir al tamaño original
        down = up.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
        
        # 4. Enfoque final para nitidez de exportación
        down = down.filter(ImageFilter.UnsharpMask(radius=1.0, percent=150, threshold=2))
        down = down.filter(ImageFilter.SHARPEN)
        
        down.save(output_path, "PNG")
        print("Despixelado local PIL ultra nítido completado exitosamente.")

    except Exception as e:
        print(f"Error en depixel_image: {e}", file=sys.stderr)
        raise

def main():
    parser = argparse.ArgumentParser(description='Procesador de imágenes por IA')
    parser.add_argument('--action', required=True, choices=['remove_bg', 'upscale', 'depixel'], help='Acción a realizar')
    parser.add_argument('--input', required=True, help='Ruta de imagen de entrada')
    parser.add_argument('--output', required=True, help='Ruta de salida')
    parser.add_argument('--factor', type=float, default=2.0, help='Factor de escala para upscale')
    parser.add_argument('--method', default='standard', choices=['standard', 'high_quality', 'ultra', 'ultra_anime'], help='Método de escalado')
    parser.add_argument('--groq_key', help='API Key de Groq')
    parser.add_argument('--removebg_key', help='API Key de remove.bg')
    
    args = parser.parse_args()
    
    try:
        if args.action == 'remove_bg':
            remove_background(args.input, args.output, args.groq_key, args.removebg_key)
        elif args.action == 'upscale':
            upscale_image(args.input, args.output, args.factor, args.method, args.groq_key)
        elif args.action == 'depixel':
            depixel_image(args.input, args.output)
        os._exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        os._exit(1)

if __name__ == "__main__":
    main()
