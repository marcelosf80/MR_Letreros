import sys
import json
import argparse
import vtracer

def main():
    # Configurar argumentos que vienen desde Node.js
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Ruta de imagen de entrada')
    parser.add_argument('--output', required=True, help='Ruta de salida SVG')
    parser.add_argument('--params', required=True, help='Parametros JSON')
    args = parser.parse_args()

    try:
        params = json.loads(args.params)
        
        # Usamos paso de argumentos posicionales para la entrada y salida
        # y nombres estándar para el resto
        vtracer.convert_image_to_svg_py(
            args.input,
            args.output,
            colormode=params.get('colormode', 'color'),
            hierarchical=params.get('hierarchical', 'stacked'),
            mode=params.get('mode', 'spline'),
            filter_speckle=int(params.get('filter_speckle', 4)),
            color_precision=int(params.get('color_precision', 6)),
            layer_difference=int(params.get('layer_difference', 16)),
            corner_threshold=int(params.get('corner_threshold', 60)),
            length_threshold=float(params.get('length_threshold', 4.0))
        )
        print("Vectorizacion completada con exito.")
    except Exception as e:
        print(f"Error en vectorizacion: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()