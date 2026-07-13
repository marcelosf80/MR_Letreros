import os

base_dir = r'c:\MR_Letreros\google_apps_script'
out_file = os.path.join(base_dir, 'Planner.html')

with open(os.path.join(base_dir, 'Planner_CSS.html'), 'r', encoding='utf-8') as f:
    css = f.read()

with open(os.path.join(base_dir, 'Planner_HTML.html'), 'r', encoding='utf-8') as f:
    html = f.read()

with open(os.path.join(base_dir, 'Planner_JS.html'), 'r', encoding='utf-8') as f:
    js = f.read()

combined = css + '\n' + html + '\n' + js

with open(out_file, 'w', encoding='utf-8') as f:
    f.write(combined)

# Modify Index.html to only include Planner
with open(os.path.join(base_dir, 'Index.html'), 'r', encoding='utf-8') as f:
    index = f.read()

index = index.replace("<?!= include('Planner_CSS'); ?>", "")
index = index.replace("<?!= include('Planner_HTML'); ?>", "<?!= include('Planner'); ?>")
index = index.replace("<?!= include('Planner_JS'); ?>", "")

with open(os.path.join(base_dir, 'Index.html'), 'w', encoding='utf-8') as f:
    f.write(index)

print('Combined Planner.html generated and Index.html updated!')
