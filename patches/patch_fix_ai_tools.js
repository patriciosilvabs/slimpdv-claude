/**
 * One-time fix: remove AI_TOOLS entries that have no `name` property.
 * These were inserted by a broken version of patch_ai_expand.js.
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// Find AI_TOOLS array boundaries
const aiStart = code.indexOf('const AI_TOOLS = [');
const anchor = '];\n\nasync function executarFerramenta';
const aiEnd = code.indexOf(anchor, aiStart);

if (aiStart < 0 || aiEnd < 0) {
  console.log('AI_TOOLS array not found — nothing to fix (will be created by later patch)');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

const before = code.slice(0, aiStart + 'const AI_TOOLS = ['.length);
const chunk  = code.slice(aiStart + 'const AI_TOOLS = ['.length, aiEnd);
const after  = code.slice(aiEnd);

// Parse out each top-level entry and keep only those with a name property
let depth = 0;
let inStr = false;
let strChar = '';
let entryStart = -1;
const goodEntries = [];
const badEntries = [];

for (let i = 0; i < chunk.length; i++) {
  const c = chunk[i];
  if (inStr) {
    if (c === '\\') { i++; continue; }
    if (c === strChar) inStr = false;
    continue;
  }
  if (c === '"' || c === "'" || c === '`') { inStr = true; strChar = c; continue; }

  if (c === '{') {
    if (depth === 0) entryStart = i;
    depth++;
  } else if (c === '}') {
    depth--;
    if (depth === 0 && entryStart >= 0) {
      const entry = chunk.slice(entryStart, i + 1);
      // Check if this entry has a name property (simple string literal)
      const hasName = /name:\s*['"][a-zA-Z_][^'"]{0,80}['"]/.test(entry);
      if (hasName) {
        goodEntries.push(entry);
      } else {
        badEntries.push(entry.slice(0, 60) + '...');
      }
      entryStart = -1;
    }
  }
}

if (badEntries.length === 0) {
  console.log('No nameless AI_TOOLS entries found — nothing to fix');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

console.log('Removing', badEntries.length, 'nameless AI_TOOLS entries');
badEntries.forEach((e, i) => console.log('  bad[' + i + ']:', e));

// Rebuild the AI_TOOLS chunk with only good entries
const newChunk = '\n' + goodEntries.join(',\n') + '\n';

const fixed = before + newChunk + after;
fs.writeFileSync(OUTPUT, fixed);
console.log('Fixed: AI_TOOLS now has', goodEntries.length, 'entries');
