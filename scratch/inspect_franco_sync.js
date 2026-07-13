const fs = require('fs');
const log = fs.readFileSync('C:/Users/usuario/.gemini/antigravity-ide/brain/c845cff4-eff4-4965-b40f-a2ca30577ebe/.system_generated/tasks/task-482.log', 'utf8');

const lines = log.split('\n');
const lineNum = 497196; // 1-indexed

const start = Math.max(0, lineNum - 30);
const end = Math.min(lines.length, lineNum + 40);

console.log(`Printing lines ${start} to ${end}:`);
for (let i = start; i < end; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
