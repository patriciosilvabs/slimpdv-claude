/**
 * Patch: filter CardápioWeb integration to only process DELIVERY orders.
 * Takeout/onsite/dine-in orders should be created internally by staff, not via integration.
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// Safety check
if (code.includes('// Only process delivery orders')) {
  console.log('CardapioWeb delivery-only filter already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

const OLD = `    const order = await orderResp.json();

    const statusMap = { waiting_confirmation:'pending'`;

const NEW = `    const order = await orderResp.json();

    // Only process delivery orders — takeout/onsite/dine-in are handled internally by staff
    if (order.order_type && order.order_type !== 'delivery') {
      console.log(\`[CardapioWeb Webhook] Skipping non-delivery order \${externalOrderId} (type: \${order.order_type})\`);
      await pool.query('UPDATE cardapioweb_logs SET status=$1, error_message=$2 WHERE tenant_id=$3 AND external_order_id=$4 AND status=$5',
        ['skipped', \`Non-delivery order type: \${order.order_type}\`, tenantId, externalOrderId, 'received']).catch(()=>{});
      return;
    }

    const statusMap = { waiting_confirmation:'pending'`;

// Count occurrences (could be multiple if old duplicates remain partially)
const occurrences = code.split(OLD).length - 1;
if (occurrences === 0) {
  console.error('ERROR: anchor not found — order fetch anchor missing');
  process.exit(1);
}

// Replace ALL occurrences (handles any remaining partial duplicates)
code = code.split(OLD).join(NEW);
console.log(`CardapioWeb delivery-only filter applied (${occurrences} occurrence(s) patched)`);

fs.writeFileSync(OUTPUT, code);
