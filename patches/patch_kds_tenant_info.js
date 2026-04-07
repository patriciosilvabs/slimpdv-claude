#!/usr/bin/env node
/**
 * Patch: add get_tenant_info action to /api/functions/kds-data
 * Returns tenant name for the device so the KDS header always shows which store it's linked to.
 * Works for existing sessions (no re-login required).
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

if (code.includes('// PATCH: kds_tenant_info')) {
  console.log('kds_tenant_info patch already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

const KDS_ROUTE_MARKER = "// POST /api/functions/kds-data";
const routeIdx = code.indexOf(KDS_ROUTE_MARKER);
if (routeIdx === -1) {
  console.error('ERROR: kds-data route not found');
  process.exit(1);
}

const ANCHOR = "return res.status(400).json({ error: 'Unknown action: ' + action });";
const anchorIdx = code.indexOf(ANCHOR, routeIdx);
if (anchorIdx === -1) {
  console.error('ERROR: Unknown action anchor not found inside kds-data handler');
  process.exit(1);
}

const lines = [];
lines.push('    // PATCH: kds_tenant_info');
lines.push("    if (action === 'get_tenant_info') {");
lines.push("      const tRes = await pool.query('SELECT name FROM tenants WHERE id = $1', [tenantId]);");
lines.push("      const tenantName = tRes.rows[0] ? tRes.rows[0].name : null;");
lines.push("      return res.json({ tenant_name: tenantName });");
lines.push("    }");
lines.push('');

const NEW_ACTION = lines.join('\n');
code = code.slice(0, anchorIdx) + NEW_ACTION + code.slice(anchorIdx);
fs.writeFileSync(OUTPUT, code);
console.log('kds_tenant_info patch applied: get_tenant_info action added to kds-data');
