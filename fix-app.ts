import fs from 'fs';

const filePath = './src/App.tsx';
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

// Deleting lines 2880 to 2887 (1-indexed)
// which are 2879 to 2886 (0-indexed)
lines.splice(2879, 8);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Fixed malformed lines in App.tsx');
