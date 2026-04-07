/**
 * One-time cleanup: remove duplicate cardapioweb route insertions.
 * patch_cardapioweb_all.js was missing a safety check and duplicated
 * the entire allEndpoints block on every deploy.
 *
 * Strategy:
 *  - Find all N copies of the cardapioweb block (starts with BLOCK_MARKER)
 *  - Keep: [code before first copy] + [ONE copy] + [kds-data anchor + rest]
 */
const fs = require('fs');

// Always start from server_current.js (fresh copy from container — first in chain)
const INPUT = '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

const BLOCK_MARKER = '\n// POST /api/functions/cardapioweb-webhook\n';
const KDS_ANCHOR   = '\n// POST /api/functions/kds-data';

// Count occurrences
let count = 0;
let pos = 0;
while ((pos = code.indexOf(BLOCK_MARKER, pos)) >= 0) { count++; pos++; }

if (count <= 1) {
  console.log('No duplicate cardapioweb routes found — nothing to clean');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

console.log(`Found ${count} copies of cardapioweb routes. Reducing to 1...`);

const firstStart = code.indexOf(BLOCK_MARKER);
const kdsPos     = code.indexOf(KDS_ANCHOR, firstStart);

if (kdsPos < 0) {
  console.error('ERROR: kds-data anchor not found after first cardapioweb block');
  process.exit(1);
}

// The duplicated region is from firstStart to kdsPos.
// Split it by BLOCK_MARKER to isolate each copy.
const duplicatedRegion = code.slice(firstStart, kdsPos);
const parts = duplicatedRegion.split(BLOCK_MARKER);
// parts[0] = '' (empty before first marker)
// parts[1] = content of first block copy
// parts[2..N] = content of subsequent copies

if (parts.length < 2) {
  console.error('ERROR: Could not split block copies');
  process.exit(1);
}

// Keep exactly one copy (the first one)
const oneBlock = BLOCK_MARKER + parts[1];

const before = code.slice(0, firstStart);
const after  = code.slice(kdsPos); // includes KDS_ANCHOR and everything after

const fixed = before + oneBlock + after;

// Verify
let remaining = 0;
pos = 0;
while ((pos = fixed.indexOf(BLOCK_MARKER, pos)) >= 0) { remaining++; pos++; }

console.log(`Remaining cardapioweb route copies: ${remaining}`);
console.log(`File size: ${code.length} → ${fixed.length} bytes (saved ${code.length - fixed.length} bytes)`);

if (remaining !== 1) {
  console.error('ERROR: dedup result unexpected, aborting');
  process.exit(1);
}

fs.writeFileSync(OUTPUT, fixed);
console.log('Dedup complete');
