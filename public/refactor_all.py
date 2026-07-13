import os
import re

public_dir = r"c:\MR_Letreros\public"
css_dir = os.path.join(public_dir, "css")

files_to_refactor = [
    "index2.html",
    "admin-precios-finales.html",
    "admin-prompt.html",
    "asistente.html",
    "chatbot-admin.html",
    "clientes.html",
    "clientes-gestion.html",
    "clientess.html",
    "costos.html",
    "led-wizard.html",
    "login.html",
    "mantenimiento.html",
    "materiales.html",
    "perfil.html",
    "precios.html",
    "rendimientos.html",
    "terceros.html",
    "test.html",
    "trabajos.html",
    "usuarios.html",
    "vectores.html",
    "vectores_paperjs.html",
    "vectorizador.html"
]

def refactor_file(filename):
    html_path = os.path.join(public_dir, filename)
    if not os.path.exists(html_path):
        print(f"Skipping {filename}: not found.")
        return
        
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Already refactored check
    if 'bootstrap.min.css' in content:
        print(f"Skipping {filename}: already refactored.")
        return

    css_filename = filename.replace('.html', '.css')
    css_path = os.path.join(css_dir, css_filename)
    
    # Extract <style>
    style_pattern = re.compile(r'<style>(.*?)</style>', re.DOTALL)
    styles = style_pattern.findall(content)
    
    extracted_css = ""
    if styles:
        # Join all style tags found
        extracted_css = "\n".join([s.strip() for s in styles])
        # Save to css file
        with open(css_path, 'w', encoding='utf-8') as f:
            f.write(extracted_css)
        
        # Remove all <style> blocks from HTML
        content = style_pattern.sub('', content)

    # Reconstruct <head> to inject links before </head>
    links_to_add = f"""    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="css/maxton-theme.css">
    <link rel="stylesheet" href="css/{css_filename}">\n"""
    
    content = content.replace('</head>', links_to_add + '</head>')
    
    # Body tag
    content = content.replace('<body>', '<body class="bg-light">')
    
    # Script tag
    script_to_add = """    <!-- Bootstrap 5 JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>\n</body>"""
    content = content.replace('</body>', script_to_add)
    
    # Replace top bar
    content = content.replace('<div class="top-bar">', '<div class="mx-topbar">')
    content = content.replace('<h1 class="top-bar-title">', '<h1 class="top-bar-title m-0">')
    
    # Replace cards with mx-card and animate
    # Simple regex replacing to inject classes safely
    def replace_cards(match):
        attrs = match.group(1)
        if 'mx-card' not in attrs:
            # We add mx-card and animate
            return f'<div class="card mx-card animate-fade-in-up"{attrs}>'
        return match.group(0)

    content = re.sub(r'<div class="card"([^>]*)>', replace_cards, content)

    # Some cards are "stat-card"
    def replace_stat_cards(match):
        attrs = match.group(1)
        if 'mx-card' not in attrs:
            return f'<div class="stat-card mx-card animate-fade-in-up"{attrs}>'
        return match.group(0)
    
    content = re.sub(r'<div class="stat-card([^>]*)>', replace_stat_cards, content)
    
    # Write back
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Refactored {filename}")

for filename in files_to_refactor:
    refactor_file(filename)

print("All files processed.")
