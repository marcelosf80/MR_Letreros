const fs = require('fs');
const html = fs.readFileSync('scratch/folder_page.html', 'utf8');

// Let's use a regex to find all matches of the file entries.
// They typically look like:
// data-id="FILE_ID" ... data-tooltip="FILENAME [type]" or class="JxSEve" aria-label="FILENAME ..."
// Let's search for divs with JxSEve or NYP1ee classes and check their data-id and tooltips.

const fileEntries = [];

// Regular expression to find blocks containing file data:
// e.g. class="JxSEve" aria-label="I1_Jamaica Fondo imp.jpg Image Shared" data-handled-by-drag-and-drop="true" ssk='...'
// Or data-id="14IBdERlL4MA9Y4IZFqi4alxfL_RTrrzk" jsname="vtaz5c" data-tooltip="I1_Jamaica Fondo imp.jpg Image"

const regex = /data-id="([a-zA-Z0-9_-]{28,40})"[^>]*data-tooltip="([^"]+)"/g;
let match;
while ((match = regex.exec(html)) !== null) {
  const [_, fileId, tooltip] = match;
  // Google tooltips might end with " Image", " PDF", " Archive", etc.
  const name = tooltip.replace(/\s+(Image|PDF|Archive|Word|Video|Folder|Text|Document)$/i, '');
  fileEntries.push({
    id: fileId,
    name: name,
    tooltip: tooltip
  });
}

console.log('Extracted files via Regex 1 (data-id + data-tooltip):', fileEntries.length);
console.log(fileEntries.slice(0, 10));

// Let's try another regex just in case they are separated
const regex2 = /class="JxSEve"\s+aria-label="([^"]+)"\s+data-handled-by-drag-and-drop="true"\s+ssk='[^']*38:([a-zA-Z0-9_-]{28,40})/g;
const fileEntries2 = [];
let match2;
while ((match2 = regex2.exec(html)) !== null) {
  const [_, ariaLabel, fileId] = match2;
  fileEntries2.push({
    id: fileId,
    name: ariaLabel
  });
}
console.log('Extracted files via Regex 2 (JxSEve + ssk):', fileEntries2.length);
console.log(fileEntries2.slice(0, 10));

// Let's also look for general occurrences of data-id:
const dataIds = html.match(/data-id="([a-zA-Z0-9_-]{28,40})"/g) || [];
console.log('Total data-id occurrences:', dataIds.length);
