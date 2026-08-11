import sys
import argparse
import os
import shutil
from gradio_client import Client, handle_file

def main():
    parser = argparse.ArgumentParser(description="Vectorizador usando Hugging Face Space (ovi054/image-to-vector)")
    parser.add_argument('--input', required=True, help='Ruta de imagen de entrada')
    parser.add_argument('--output', required=True, help='Ruta de salida SVG')
    # Ignorar --model si se le pasa por compatibilidad con el servidor
    parser.add_argument('--model', default='', help='Ignorado (se usa gradio_client)')
    args, unknown = parser.parse_known_args()

    try:
        print(f"Iniciando vectorización en la nube (Hugging Face Spaces)...")
        print(f"Subiendo imagen: {args.input}")
        
        client = Client("ovi054/image-to-vector")
        result = client.predict(
            image=handle_file(args.input),
            colormode="color",
            hierarchical="stacked",
            mode="spline",
            filter_speckle=4,
            color_precision=6,
            layer_difference=16,
            corner_threshold=60,
            length_threshold=4.0,
            max_iterations=10,
            splice_threshold=45,
            path_precision=3,
            api_name="/convert_to_vector_1"
        )
        
        # El resultado es una tupla: (html_string, filepath_to_svg)
        # Extraemos la ruta del SVG descargado
        svg_temp_path = result[1]
        
        # Crear directorios del output si no existen
        output_dir = os.path.dirname(args.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            
        print(f"Vectorización exitosa. Guardando en: {args.output}")
        shutil.copy(svg_temp_path, args.output)
        
        os._exit(0)
    except Exception as e:
        import traceback
        print("--- ERROR EN LA NUBE ---", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        os._exit(1)

if __name__ == "__main__":
    main()
