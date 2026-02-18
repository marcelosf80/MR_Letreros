import os
import re

print("🔍 AUDITORÍA COMPLETA - MR LETREROS")
print("=" * 60)

# Analizar server.js
with open('server.js', 'r', encoding='utf-8') as f:
    server_content = f.read()
    server_lines = server_content.split('\n')

bugs = []

# BUG 1: Buscar referencias a PUBLIC_DIR correcto
if "'./public'" in server_content or '"./public"' in server_content:
    bugs.append({
        'id': 'PATH-001',
        'severity': '🔴 CRÍTICO',
        'file': 'server.js',
        'issue': 'Ruta relativa a public incorrecta',
        'detail': 'PUBLIC_DIR debe ser absoluta'
    })

# BUG 2: Buscar funciones duplicadas
functions = re.findall(r'function (\w+)\(', server_content)
if len(functions) != len(set(functions)):
    duplicates = [f for f in functions if functions.count(f) > 1]
    bugs.append({
        'id': 'DUP-001',
        'severity': '🟡 MODERADO',
        'file': 'server.js',
        'issue': f'Funciones duplicadas: {set(duplicates)}'
    })

# BUG 3: Buscar rutas sin try-catch
routes = re.findall(r'app\.(get|post|put|delete)\([^)]+\)', server_content)
print(f"\n📊 Rutas encontradas: {len(routes)}")

# BUG 4: Buscar await sin async
for i, line in enumerate(server_lines, 1):
    if 'await ' in line and i < len(server_lines):
        # Buscar la función contenedora
        for j in range(max(0, i-20), i):
            if 'function' in server_lines[j] and 'async' not in server_lines[j]:
                bugs.append({
                    'id': f'ASYNC-{i}',
                    'severity': '🔴 CRÍTICO',
                    'file': 'server.js',
                    'line': i,
                    'issue': 'await sin async'
                })
                break

# BUG 5: Buscar console.log excesivos (más de 50)
console_logs = len(re.findall(r'console\.log', server_content))
if console_logs > 50:
    bugs.append({
        'id': 'LOG-001',
        'severity': '🟢 MENOR',
        'file': 'server.js',
        'issue': f'Demasiados console.log: {console_logs}'
    })

# Analizar archivos HTML
html_files = []
for root, dirs, files in os.walk('./public'):
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            html_files.append(filepath)
            
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                html_content = f.read()
                
                # BUG: Scripts sin defer/async
                scripts = re.findall(r'<script[^>]*src=[^>]*>', html_content)
                for script in scripts:
                    if 'defer' not in script and 'async' not in script:
                        bugs.append({
                            'id': 'HTML-SCRIPT',
                            'severity': '🟡 MODERADO',
                            'file': file,
                            'issue': 'Script sin defer/async puede bloquear renderizado'
                        })
                        break

print(f"📄 Archivos HTML: {len(html_files)}")

# Analizar archivos JS
js_files = []
for root, dirs, files in os.walk('./public/js'):
    for file in files:
        if file.endswith('.js'):
            js_files.append(file)

print(f"📜 Archivos JS: {len(js_files)}")

print(f"\n🐛 BUGS ENCONTRADOS: {len(bugs)}\n")

# Mostrar bugs
for bug in bugs[:20]:  # Primeros 20
    print(f"{bug.get('severity', '🟡')} {bug['id']}")
    print(f"   Archivo: {bug['file']}")
    if 'line' in bug:
        print(f"   Línea: {bug['line']}")
    print(f"   Problema: {bug.get('issue', bug.get('detail', 'N/A'))}")
    print()

if len(bugs) > 20:
    print(f"... y {len(bugs) - 20} bugs más\n")

