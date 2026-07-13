const fs = require('fs');
const html = fs.readFileSync('scratch/folder_page.html', 'utf8');

const index = html.indexOf('imp.jpg');
if (index !== -1) {
  console.log('Surrounding 2000 chars:');
  console.log(html.substring(index - 1000, index + 1500));
}
