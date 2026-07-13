const fs = require('fs');
const html = fs.readFileSync('scratch/folder_page.html', 'utf8');

// Let's search for the folder ID '1rFXDtGbygXGobiojQiGENTJ7j14C4xog' or look for filenames/images
console.log('HTML Length:', html.length);

// Frequently, file list is in window._drive_data or in script tags as a bootstrap JSON block.
// Let's find all script tags and look for matches.
const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
console.log('Script tags found:', scriptTags.length);

// Let's print script tags containing JSON or key phrases
scriptTags.forEach((tag, i) => {
  if (tag.includes('drive-web') || tag.includes('bootstrap') || tag.includes('pinned') || tag.includes('1rFXDtGbygXGobiojQiGENTJ7j14C4xog') || tag.includes('folders')) {
    console.log(`Script ${i} matches key phrases. Length:`, tag.length);
    fs.writeFileSync(`scratch/script_${i}.txt`, tag);
  }
});

// Let's also look for matches of Google Drive file ID pattern in the html: 28-33 char string of alphanumeric and underscores/hyphens.
// A common pattern is: https://drive.google.com/file/d/([a-zA-Z0-9_-]{28,35})/view
const fileMatches = html.match(/\/file\/d\/([a-zA-Z0-9_-]{28,35})/g) || [];
console.log('Direct file link matches:', fileMatches);

// Let's find any IDs or array patterns.
// Google Drive folder bootstrap data is typically inside: init('...some large JSON...')
// Let's search for JSON-like arrays:
const jsonLike = html.match(/\["([a-zA-Z0-9_-]{28,35})","([^"]+)"/g) || [];
console.log('JSON-like ID+Name matches:', jsonLike.slice(0, 10));
