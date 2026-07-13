import re
import os

base_dir = r'c:\MR_Letreros\google_apps_script'
out_file = r'c:\MR_Letreros\public\cotizador_test.html'

with open(os.path.join(base_dir, 'Index.html'), 'r', encoding='utf-8') as f:
    index = f.read()

with open(os.path.join(base_dir, 'Planner_CSS.html'), 'r', encoding='utf-8') as f:
    css = f.read()

with open(os.path.join(base_dir, 'Planner_HTML.html'), 'r', encoding='utf-8') as f:
    html = f.read()

with open(os.path.join(base_dir, 'Planner_JS.html'), 'r', encoding='utf-8') as f:
    js = f.read()

# Replace includes
index = index.replace("<?!= include('Planner_CSS'); ?>", css)
index = index.replace("<?!= include('Planner_HTML'); ?>", html)
index = index.replace("<?!= include('Planner_JS'); ?>", js)

# Mock google.script.run
mock_script = '''
<script>
    // MOCK DE GOOGLE APPS SCRIPT PARA PRUEBAS LOCALES
    var google = {
        script: {
            run: {
                withSuccessHandler: function(callback) {
                    return {
                        getCatalogData: function() {
                            console.log('Mock: getCatalogData called');
                            setTimeout(() => {
                                callback({
                                    catalog: [
                                        { id: '1', categoria: 'Lonas', producto: 'Lona Front', unidad: 'm2', precioGremio: 5000, tipo: 'lona_front' },
                                        { id: '2', categoria: 'Vinilos', producto: 'Vinilo de Corte', unidad: 'm2', precioGremio: 8000, tipo: 'vinilo_corte', anchoFijo: null },
                                        { id: '3', categoria: 'Corpóreos', producto: 'Polifan 20mm', unidad: 'unidad', precioGremio: 15000, tipo: 'polifan' }
                                    ],
                                    stock: {
                                        lona_front: [150, 250, 320],
                                        vinilo_corte: [60, 122]
                                    }
                                });
                            }, 500);
                        },
                        processOrder: function(data) {
                            console.log('Mock: processOrder called with data:', JSON.parse(data));
                            setTimeout(() => {
                                callback();
                            }, 1000);
                        }
                    };
                }
            }
        }
    };
</script>
'''

index = index.replace('<script>', mock_script + '\n    <script>', 1)

with open(out_file, 'w', encoding='utf-8') as f:
    f.write(index)

print('cotizador_test.html created successfully!')
