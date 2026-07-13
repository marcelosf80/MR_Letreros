const fs = require('fs');
const html = fs.readFileSync('scratch/folder_page.html', 'utf8');

// Find all matches of 28 to 35 character ID strings (standard Drive file/folder ID format)
const idRegex = /[a-zA-Z0-9_-]{28,35}/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(html)) !== null) {
  // Let's filter out common strings and see if there are any specific matches
  const val = match[0];
  if (/[0-9]/.test(val) && /[a-zA-Z]/.test(val) && (val.includes('_') || val.includes('-') || val.toUpperCase() !== val)) {
    ids.add(val);
  }
}

console.log('Unique alphanumeric ID-like strings:', ids.size);
const idsList = Array.from(ids);
console.log('Sample IDs:', idsList.slice(0, 50));

// Let's see if we can find any file extension names like .png, .jpg, .jpeg
const fileRegex = /[^"'\s]*\.(png|jpg|jpeg|gif|pdf)/gi;
const files = html.match(fileRegex) || [];
console.log('File name occurrences:', new Set(files));
