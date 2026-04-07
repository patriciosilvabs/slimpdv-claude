#!/usr/bin/env node
/**
 * Patch: include tenant_name in kds-device-auth login response
 * So the KDS screen can display which store it's linked to.
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

if (code.includes('// PATCH: kds_tenant_name')) {
  console.log('kds_tenant_name patch already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

const OLD = "const { password_hash, auth_code: _ac, verification_code: _vc, ...safeDevice } = device;\n      return res.json({ success: true, device: safeDevice });";

if (!code.includes(OLD)) {
  console.error('ERROR: kds login anchor not found');
  process.exit(1);
}

const lines = [];
lines.push('// PATCH: kds_tenant_name');
lines.push("const { password_hash, auth_code: _ac, verification_code: _vc, ...safeDevice } = device;");
lines.push("      // Also fetch tenant name to display in KDS header");
lines.push("      let tenantName = null;");
lines.push("      if (safeDevice.tenant_id) {");
lines.push("        const tenantRes = await pool.query('SELECT name FROM tenants WHERE id = $1', [safeDevice.tenant_id]);");
lines.push("        tenantName = tenantRes.rows[0] ? tenantRes.rows[0].name : null;");
lines.push("      }");
lines.push("      return res.json({ success: true, device: { ...safeDevice, tenant_name: tenantName } });");

const NEW = lines.join('\n');

code = code.replace(OLD, function() { return NEW; });
fs.writeFileSync(OUTPUT, code);
console.log('kds_tenant_name patch applied: tenant_name included in login response');
