"""
Utility functions for image upscaling operations.
"""

import logging

import numpy as np
from PIL import Image

from .upscaler import get_upsampler, resize_to_target

logger = logging.getLogger(__name__)


def upscale_image(img: Image.Image, target_width: int, target_height: int, model_name: str = "general") -> Image.Image:
    """
    Upscale an image to target dimensions using Real-ESRGAN.

    This function contains the core upscaling logic used by both the API and CLI.
    It converts the image to RGB/RGBA, upscales it 4x using Real-ESRGAN, and then
    resizes to the target dimensions while preserving aspect ratio.

    Args:
        img: PIL Image to upscale (will be converted to RGB/RGBA if needed)
        target_width: Target width in pixels
        target_height: Target height in pixels
        model_name: Real-ESRGAN model name to use ("general" or "anime")

    Returns:
        PIL Image upscaled and resized to target dimensions

    Raises:
        Exception: If upscaling fails
    """
    has_alpha = img.mode == "RGBA" or "transparency" in img.info
    if has_alpha:
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")

    logger.info(f"Original image size: {img.size} (has_alpha: {has_alpha})")

    # Get upsampler
    upsampler = get_upsampler(model_name)

    # If the image has transparency, we upscale the RGB channels using AI,
    # and the Alpha channel using high-quality interpolation to avoid black artifacts.
    if has_alpha:
        r, g, b, a = img.split()
        rgb_img = Image.merge("RGB", (r, g, b))
        
        logger.info("Starting upscaling process for RGB channels...")
        rgb_np = np.array(rgb_img)
        output_rgb, _ = upsampler.enhance(rgb_np, outscale=4)
        
        logger.info("Upscaling Alpha channel...")
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
        img_np = np.array(img)
        logger.info("Starting upscaling process...")
        output, _ = upsampler.enhance(img_np, outscale=4)
        upscaled_img = Image.fromarray(output)

    # Resize to target dimensions while preserving aspect ratio
    final_img = resize_to_target(upscaled_img, target_width, target_height)
    
    # Aplicar mejoras específicas de nitidez
    if model_name == "anime":
        logger.info("Applying illustration/logo specific sharpening...")
        try:
            import cv2
            from PIL import ImageFilter
            
            if final_img.mode == "RGBA":
                r, g, b, a = final_img.split()
                
                # Binarización adaptativa del canal Alfa para eliminar bordes borrosos/pixelados
                a_np = np.array(a)
                a_np = cv2.bilateralFilter(a_np, 5, 50, 50)
                _, a_thresh = cv2.threshold(a_np, 127, 255, cv2.THRESH_BINARY)
                a_smooth = cv2.GaussianBlur(a_thresh, (3, 3), 0.5)
                a_final = Image.fromarray(a_smooth)
                
                # Limpieza bilateral y enfoque en los canales RGB
                rgb_img = Image.merge("RGB", (r, g, b))
                rgb_np = cv2.cvtColor(np.array(rgb_img), cv2.COLOR_RGB2BGR)
                
                # Doble pasada de filtro bilateral para aplanar colores y remover bloques JPEG
                rgb_clean = cv2.bilateralFilter(rgb_np, d=9, sigmaColor=55, sigmaSpace=55)
                rgb_clean = cv2.bilateralFilter(rgb_clean, d=5, sigmaColor=35, sigmaSpace=35)
                rgb_clean = cv2.medianBlur(rgb_clean, 3)
                
                # Perfilar contornos con Laplacian suave
                laplacian = cv2.Laplacian(rgb_clean, cv2.CV_64F)
                laplacian = cv2.convertScaleAbs(laplacian)
                rgb_clean_sharp = cv2.addWeighted(rgb_clean, 1.0, laplacian, 0.20, 0)
                
                # Enfoque gaussiano y suavizado final
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
                
                # Doble pasada de filtro bilateral para aplanar colores planos y remover ruido JPEG
                clean = cv2.bilateralFilter(img_np, d=9, sigmaColor=55, sigmaSpace=55)
                clean = cv2.bilateralFilter(clean, d=5, sigmaColor=35, sigmaSpace=35)
                clean = cv2.medianBlur(clean, 3)
                
                # Perfilar contornos
                laplacian = cv2.Laplacian(clean, cv2.CV_64F)
                laplacian = cv2.convertScaleAbs(laplacian)
                clean_sharp = cv2.addWeighted(clean, 1.0, laplacian, 0.20, 0)
                
                # Enfoque gaussiano suave
                gaussian = cv2.GaussianBlur(clean_sharp, (0, 0), 1.2)
                final_cv = cv2.addWeighted(clean_sharp, 1.4, gaussian, -0.4, 0)
                
                # Suavizado de bordes final
                final_cv = cv2.bilateralFilter(final_cv, d=5, sigmaColor=25, sigmaSpace=25)
                
                final_img = Image.fromarray(cv2.cvtColor(final_cv, cv2.COLOR_BGR2RGB))
        except Exception as e:
            logger.error(f"Error in illustration sharpening: {e}")
            from PIL import ImageFilter
            final_img = final_img.filter(ImageFilter.DETAIL)
            final_img = final_img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
            final_img = final_img.filter(ImageFilter.SHARPEN)
    else:
        # Enfoque estándar para fotos
        from PIL import ImageFilter
        final_img = final_img.filter(ImageFilter.DETAIL)
        final_img = final_img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=150, threshold=2))
        final_img = final_img.filter(ImageFilter.SHARPEN)
    
    logger.info(f"Final image size: {final_img.size}")

    return final_img
