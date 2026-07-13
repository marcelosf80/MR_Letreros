import sys
import argparse
import os
import re
from types import ModuleType

# Mock cairosvg to bypass the Windows Cairo DLL dependency
mock_cairosvg = ModuleType("cairosvg")
mock_cairosvg.svg2svg = lambda *args, **kwargs: b""
mock_cairosvg.svg2png = lambda *args, **kwargs: b""
sys.modules["cairosvg"] = mock_cairosvg

from PIL import Image
import torch

def clean_svg_content(raw_svg):
    """
    Limpia cualquier formato markdown del output del LLM (ej. ```xml ... ```)
    para asegurar que sea un SVG XML válido.
    """
    cleaned = raw_svg.strip()
    
    # Quitar delimitadores de markdown si existen
    if cleaned.startswith("```xml"):
        cleaned = cleaned.split("```xml", 1)[1]
    elif cleaned.startswith("```"):
        cleaned = cleaned.split("```", 1)[1]
        
    if "```" in cleaned:
        cleaned = cleaned.split("```", 1)[0]
        
    cleaned = cleaned.strip()
    
    # Asegurar que empieza con <svg y termina con </svg>
    if not cleaned.startswith("<svg") and "<svg" in cleaned:
        cleaned = cleaned[cleaned.find("<svg"):]
    if not cleaned.endswith("</svg>") and "</svg>" in cleaned:
        cleaned = cleaned[:cleaned.rfind("</svg>") + 6]
        
    return cleaned

def main():
    # Cargar variables de entorno desde .env si existe
    try:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        index = line.find('=')
                        key = line[:index].strip()
                        val = line[index+1:].strip()
                        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                            val = val[1:-1]
                        os.environ[key] = val
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="Vectorizador StarVector")
    parser.add_argument('--input', required=True, help='Ruta de imagen de entrada')
    parser.add_argument('--output', required=True, help='Ruta de salida SVG')
    parser.add_argument('--model', default='starvector/starvector-1b-im2svg', help='Identificador del modelo en Hugging Face')
    args = parser.parse_args()

    try:
        import contextlib
        @contextlib.contextmanager
        def dummy_init_empty_weights(*args, **kwargs):
            yield
        
        try:
            import accelerate
            accelerate.init_empty_weights = dummy_init_empty_weights
        except Exception:
            pass
            
        try:
            import accelerate.utils.modeling
            accelerate.utils.modeling.init_empty_weights = dummy_init_empty_weights
        except Exception:
            pass

        import transformers.modeling_utils
        transformers.modeling_utils.init_empty_weights = dummy_init_empty_weights
        
        if hasattr(transformers.modeling_utils, "get_torch_context_manager_or_global_device"):
            original_get_device = transformers.modeling_utils.get_torch_context_manager_or_global_device
            def patched_get_device(*args, **kwargs):
                dev = original_get_device(*args, **kwargs)
                import torch
                if dev == torch.device("meta"):
                    return torch.device("cpu")
                return dev
            transformers.modeling_utils.get_torch_context_manager_or_global_device = patched_get_device
    except Exception:
        pass

    try:
        from transformers import AutoModelForCausalLM, PreTrainedModel
        
        original_get_init_context = PreTrainedModel.get_init_context
        @classmethod
        def patched_get_init_context(cls, dtype, is_quantized, _is_ds_init_called, allow_all_kernels):
            contexts = original_get_init_context(dtype, is_quantized, _is_ds_init_called, allow_all_kernels)
            import torch
            filtered = []
            for ctx in contexts:
                if isinstance(ctx, torch.device) and ctx.type == "meta":
                    continue
                filtered.append(ctx)
            return filtered
        PreTrainedModel.get_init_context = patched_get_init_context

        if not hasattr(PreTrainedModel, "all_tied_weights_keys"):
            @property
            def all_tied_weights_keys_fallback(self):
                if not hasattr(self, "_all_tied_weights_keys_val"):
                    try:
                        self._all_tied_weights_keys_val = self.get_expanded_tied_weights_keys(all_submodels=False)
                    except Exception:
                        self._all_tied_weights_keys_val = {}
                return self._all_tied_weights_keys_val
            @all_tied_weights_keys_fallback.setter
            def all_tied_weights_keys_fallback(self, value):
                self._all_tied_weights_keys_val = value
            PreTrainedModel.all_tied_weights_keys = all_tied_weights_keys_fallback
    except ImportError:
        print("Error: La librería 'transformers' no está instalada.", file=sys.stderr)
        sys.exit(1)

    try:
        print(f"Detectando dispositivo de ejecución...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        # Usar float16 en GPU para ahorrar memoria y float32 en CPU para estabilidad/compatibilidad
        dtype = torch.float16 if device == "cuda" else torch.float32
        print(f"Dispositivo detectado: {device.upper()} | Tipo de datos: {dtype}")

        print(f"Cargando modelo '{args.model}' (esto puede demorar en la primera ejecución)...")
        # Cargar modelo desde Hugging Face
        starvector = AutoModelForCausalLM.from_pretrained(
            args.model,
            torch_dtype=dtype,
            trust_remote_code=True,
            low_cpu_mem_usage=False
        )
        
        # Obtener procesador
        processor = starvector.model.processor
        
        # Mover al dispositivo (CPU/GPU)
        print(f"Transfiriendo modelo al dispositivo ({device})...")
        starvector = starvector.to(device)
        starvector.eval()

        print(f"Cargando imagen: {args.input}...")
        image_pil = Image.open(args.input).convert('RGB')
        
        # Preprocesar imagen
        print("Procesando imagen con el procesador StarVector...")
        pixel_values = processor(image_pil, return_tensors="pt")['pixel_values'].to(device)
        
        if len(pixel_values.shape) == 3:
            pixel_values = pixel_values.unsqueeze(0)
            
        batch = {"image": pixel_values}

        print("Generando SVG con StarVector (max_length=4000)...")
        with torch.no_grad():
            raw_svg_list = starvector.generate_im2svg(batch, max_length=4000)
            raw_svg = raw_svg_list[0] if isinstance(raw_svg_list, list) else raw_svg_list

        # Limpiar y formatear el SVG resultante
        print("Limpiando salida SVG...")
        final_svg = clean_svg_content(raw_svg)

        # Crear directorios del output si no existen
        output_dir = os.path.dirname(args.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        # Guardar SVG
        print(f"Guardando archivo SVG final en: {args.output}...")
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(final_svg)
            
        print("Vectorización con StarVector completada con éxito.")
        sys.exit(0)

    except Exception as e:
        import traceback
        err_msg = str(e)
        print("--- TRACEBACK ORIGINAL ---", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print("--------------------------", file=sys.stderr)
        if "gated repo" in err_msg.lower() or "401" in err_msg or "unauthorized" in err_msg.lower():
            print("\n" + "="*80, file=sys.stderr)
            print("ERROR DE AUTORIZACIÓN (MODELO RESTRINGIDO / GATED REPO)", file=sys.stderr)
            print("El modelo StarVector requiere acceso al modelo base 'bigcode/starcoderbase-1b'.", file=sys.stderr)
            print("Por favor, sigue estos pasos para habilitarlo en tu PC:", file=sys.stderr)
            print("1. Inicia sesión en Hugging Face y acepta los términos en: ", file=sys.stderr)
            print("   https://huggingface.co/bigcode/starcoderbase-1b", file=sys.stderr)
            print("2. Crea un Access Token (con permisos de lectura) en: ", file=sys.stderr)
            print("   https://huggingface.co/settings/tokens", file=sys.stderr)
            print("3. Define la variable de entorno 'HF_TOKEN' con tu token en Windows", file=sys.stderr)
            print("   (o créala en tu archivo .env o terminal antes de iniciar el servidor).", file=sys.stderr)
            print("="*80 + "\n", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
