const fs = require('fs');
const data = JSON.parse(fs.readFileSync('datos_mr_letreros/trabajos.json', 'utf8'));

console.log('Total works in database:', data.works.length);

const todayWorks = data.works.filter(w => w.createdAt && w.createdAt.startsWith('2026-06-05'));
console.log('Works created on June 5th:', todayWorks.length);

todayWorks.forEach(w => {
  console.log(`ID: ${w.id}`);
  console.log(`Client: ${w.clientName}`);
  console.log(`Phone: ${w.clientPhone}`);
  console.log(`Total: ${w.total}`);
  console.log(`Created: ${w.createdAt}`);
  console.log(`Notes count: ${w.notes ? w.notes.length : 0}`);
  if (w.notes) {
    w.notes.forEach((n, i) => console.log(`  Note ${i}: ${n.text.substring(0, 100)}...`));
  }
  console.log('-------------------------');
});
