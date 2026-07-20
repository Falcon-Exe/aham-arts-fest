const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src', 'utils', 'scoringRules.js');
const destPath = path.join(__dirname, 'functions', 'scoringRules.js');

try {
  let content = fs.readFileSync(srcPath, 'utf8');

  // Convert "export function calculatePoints" to CommonJS
  content = content.replace('export function calculatePoints(', 'function calculatePoints(');
  content += '\n\nmodule.exports = { calculatePoints };\n';

  fs.writeFileSync(destPath, content, 'utf8');
  console.log('Successfully synced scoring rules to functions/scoringRules.js');
} catch (err) {
  console.error('Failed to sync scoring rules:', err);
  process.exit(1);
}
