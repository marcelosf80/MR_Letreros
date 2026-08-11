"""
Core upscaling functionality using Real-ESRGAN.
"""

import logging

from PIL import Image

logger = logging.getLogger(__name__)

# Conversion constant
WIDTH_INCH_CM = 2.54

# Initialize Real-ESRGAN upsampler instances lazily to avoid startup delays
_upsamplers = {}


def get_upsampler(model_name: str = "general"):
    """
    Lazy initialization of Real-ESRGAN models (general or anime).

    Args:
        model_name: The name of the model to retrieve ("general" or "anime")

    Returns:
        RealESRGANer: Initialized upsampler instance
    """
    global _upsamplers
    if model_name not in _upsamplers:
        try:
            # Import torch dependencies only when needed
            import sys
            import os

            import torchvision.transforms.functional as F

            # Patch for torchvision compatibility with basicsr
            sys.modules["torchvision.transforms.functional_tensor"] = F

            from basicsr.archs.rrdbnet_arch import RRDBNet
            from realesrgan import RealESRGANer

            logger.info(f"Initializing Real-ESRGAN model ({model_name})...")

            if model_name == "anime":
                # RealESRGAN_x4plus_anime_6B uses num_block=6
                model = RRDBNet(
                    num_in_ch=3, num_out_ch=3, num_feat=64, num_block=6, num_grow_ch=32, scale=4
                )
                local_weights = "C:\\MR_Letreros\\models\\RealESRGAN_x4plus_anime_6B.pth"
                model_path = local_weights if os.path.exists(local_weights) else "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"
            else:
                # Standard RealESRGAN_x4plus uses num_block=23
                model = RRDBNet(
                    num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4
                )
                local_weights = "C:\\MR_Letreros\\models\\RealESRGAN_x4plus.pth"
                model_path = local_weights if os.path.exists(local_weights) else "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"

            # Auto-download if not exists
            if not os.path.exists(local_weights):
                logger.info(f"Downloading model weights to local path: {local_weights}...")
                os.makedirs(os.path.dirname(local_weights), exist_ok=True)
                import urllib.request
                urllib.request.urlretrieve(model_path, local_weights)
                logger.info("Download completed successfully.")

            # Initialize upsampler
            _upsamplers[model_name] = RealESRGANer(
                scale=4,
                model_path=local_weights,
                model=model,
                tile=400,
                tile_pad=10,
                pre_pad=0,
                half=False,  # Use FP32 for CPU compatibility
                gpu_id=None,  # Use CPU
            )
            logger.info(f"Real-ESRGAN model {model_name} initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Real-ESRGAN: {e}")
            raise
    return _upsamplers[model_name]


def cm_to_pixels(width_cm: float, height_cm: float, dpi: int) -> tuple[int, int]:
    """
    Convert dimensions from centimeters to pixels.

    Args:
        width_cm: Width in centimeters
        height_cm: Height in centimeters
        dpi: Dots per inch (resolution)

    Returns:
        Tuple of (width_px, height_px) in pixels
    """
    width_inch = width_cm / WIDTH_INCH_CM
    height_inch = height_cm / WIDTH_INCH_CM
    width_px = int(round(width_inch * dpi))
    height_px = int(round(height_inch * dpi))
    return width_px, height_px


def resize_to_target(image: Image.Image, target_width: int, target_height: int) -> Image.Image:
    """
    Resize image to target dimensions while preserving aspect ratio.
    The image will fit within the target dimensions.

    Args:
        image: PIL Image to resize
        target_width: Target width in pixels
        target_height: Target height in pixels

    Returns:
        PIL Image resized to fit within target dimensions
    """
    original_width, original_height = image.size

    # Calculate aspect ratios
    target_ratio = target_width / target_height
    original_ratio = original_width / original_height

    # Determine new size maintaining aspect ratio
    if original_ratio > target_ratio:
        # Width is the limiting factor
        new_width = target_width
        new_height = int(target_width / original_ratio)
    else:
        # Height is the limiting factor
        new_height = target_height
        new_width = int(target_height * original_ratio)

    return image.resize((new_width, new_height), Image.LANCZOS)
