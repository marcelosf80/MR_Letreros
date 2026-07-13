const fs = require('fs');
const log = fs.readFileSync('C:/Users/usuario/.gemini/antigravity-ide/brain/c845cff4-eff4-4965-b40f-a2ca30577ebe/.system_generated/tasks/task-482.log', 'utf8');

const lines = log.split('\n');
console.log('Total log lines:', lines.length);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('/api/trabajos') && (line.includes('POST') || line.includes('PUT') || line.includes('DELETE'))) {
    // Check if timestamp is on 2026-06-05
    if (line.includes('2026-06-05')) {
      console.log(`${i}: ${line}`);
    }
  }
}
