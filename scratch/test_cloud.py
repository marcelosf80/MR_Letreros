import sys
import os
from gradio_client import Client, handle_file

def test_cloud_upscale():
    input_path = r"c:\MR_Letreros\uploads\temp\opt_ae276a41535340ed1a2ad96a7c1c771a.jpg"
    model_name = "4xNomos2_hq_dat2"
    print(f"Probando escalado en la nube con {input_path} y modelo {model_name}...")
    try:
        client = Client("Phips/Upscaler")
        result = client.predict(
            image=handle_file(input_path),
            model_selection=model_name,
            api_name="/upscale_image"
        )
        print("Resultado de la API:")
        print(result)
    except Exception as e:
        print(f"Error detectado: {e}")

if __name__ == "__main__":
    test_cloud_upscale()
