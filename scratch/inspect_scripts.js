const fs = require('fs');
const s21 = fs.readFileSync('scratch/script_21.txt', 'utf8');
const s35 = fs.readFileSync('scratch/script_35.txt', 'utf8');

function inspect(text, name) {
  console.log(`--- Inspecting ${name} ---`);
  // Google Drive folder page scripts usually contain a window.LSD or a list of files.
  // Let's search for occurrences of 'imp.jpg'
  const index = text.indexOf('imp.jpg');
  if (index !== -1) {
    console.log(`Found 'imp.jpg' in ${name} at index ${index}.`);
    console.log('Surrounding text:', text.substring(index - 200, index + 300));
  } else {
    console.log(`'imp.jpg' not found in ${name}`);
  }
}

inspect(s21, 'script_21.txt');
inspect(s35, 'script_35.txt');
inspect(fs.readFileSync('scratch/folder_page.html', 'utf8'), 'folder_page.html');
