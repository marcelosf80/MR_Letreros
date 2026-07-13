import re
import os

html_path = r"c:\MR_Letreros\public\gremio.html"
css_path = r"c:\MR_Letreros\public\css\gremio.css"

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the <style> block that contains 'Layout de 3 paneles'
pattern = re.compile(r'<style>\s*/\* ── Layout de 3 paneles ── \*/.*?</style>', re.DOTALL)
match = pattern.search(content)

if match:
    css_content = match.group(0).replace('<style>', '').replace('</style>', '').strip()
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css_content)
    
    # Replace in HTML
    replacement = """<!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="css/maxton-theme.css">
  <link rel="stylesheet" href="css/gremio.css">"""
    
    # Also add bootstrap js at bottom and bg-light to body
    content = content.replace(match.group(0), replacement)
    content = content.replace('<body>', '<body class="bg-light">')
    content = content.replace('</body>', '  <!-- Bootstrap 5 JS Bundle -->\n  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>\n</body>')
    
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Extraction successful.")
else:
    print("Match not found.")
