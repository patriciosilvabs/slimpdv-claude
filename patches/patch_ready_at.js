#!/usr/bin/env node
/**
 * Patch: set ready_at timestamp when order status changes to 'ready'
 * Fixes: sound notification for "pedido pronto" was never triggered because
 * ready_at was always NULL — frontend uses it as the anchor to detect
 * when an order became ready after the app was opened.
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

if (code.includes('// PATCH: ready_at')) {
  console.log('ready_at patch already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

// Find the update_order_status block and replace it
const target = "if (action === 'update_order_status')";
const idx = code.indexOf(target);
if (idx === -1) {
  console.error('ERROR: update_order_status block not found');
  process.exit(1);
}

// Find the closing brace of this if block
let depth = 0;
let pos = code.indexOf('{', idx);
let blockEnd = -1;
while (pos < code.length) {
  if (code[pos] === '{') depth++;
  else if (code[pos] === '}') {
    depth--;
    if (depth === 0) { blockEnd = pos + 1; break; }
  }
  pos++;
}

if (blockEnd === -1) {
  console.error('ERROR: could not find end of update_order_status block');
  process.exit(1);
}

const oldBlock = code.slice(idx, blockEnd);
const newBlock = [
  "// PATCH: ready_at",
  "if (action === 'update_order_status') {",
  "      if (status === 'ready') {",
  "        await pool.query(",
  '          "UPDATE orders SET status = $1, updated_at = NOW(), ready_at = NOW() WHERE id = $2 AND tenant_id = $3",',
  "          [status, order_id, tenantId]",
  "        );",
  "      } else {",
  "        await pool.query(",
  '          "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3",',
  "          [status, order_id, tenantId]",
  "        );",
  "      }",
  "      return res.json({ success: true });",
  "    }",
].join('\n');

code = code.slice(0, idx) + newBlock + code.slice(blockEnd);
fs.writeFileSync(OUTPUT, code);
console.log('ready_at patch applied successfully');
