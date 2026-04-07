#!/usr/bin/env node
/**
 * Patch: add missing device-mode action handlers to /api/functions/kds-data
 * Fixes: 400 "Unknown action" errors when KDS device clicks claim/ready/oven/dispatch buttons
 * Actions added: claim_item, complete_edge, send_to_oven, mark_item_ready,
 *               dispatch_oven_items, get_station_history_grouped
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

if (code.includes('// PATCH: kds_device_actions')) {
  console.log('kds_device_actions patch already applied — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

// Insert before the final "Unknown action" return inside the kds-data handler
const ANCHOR = "return res.status(400).json({ error: 'Unknown action: ' + action });";

// There may be multiple 400 returns; find the one inside kds-data by looking for it
// after the kds-data route definition
const KDS_ROUTE_MARKER = "// POST /api/functions/kds-data";
const routeIdx = code.indexOf(KDS_ROUTE_MARKER);
if (routeIdx === -1) {
  console.error('ERROR: kds-data route not found');
  process.exit(1);
}

const anchorIdx = code.indexOf(ANCHOR, routeIdx);
if (anchorIdx === -1) {
  console.error('ERROR: Unknown action anchor not found inside kds-data handler');
  process.exit(1);
}

const lines = [];
lines.push('    // PATCH: kds_device_actions');
lines.push('    if (action === \'claim_item\') {');
lines.push('      await pool.query(');
lines.push('        "UPDATE order_items SET station_status = \'in_progress\', claimed_by = $1, claimed_at = NOW(), station_started_at = NOW() WHERE id = $2 AND tenant_id = $3",');
lines.push('        [device_id, item_id, tenantId]');
lines.push('      );');
lines.push('      return res.json({ success: true });');
lines.push('    }');
lines.push('');
lines.push('    if (action === \'complete_edge\') {');
lines.push('      const asmRes = await pool.query(');
lines.push('        "SELECT id FROM kds_stations WHERE tenant_id = $1 AND is_active = true AND station_type = \'assembly\' ORDER BY sort_order ASC LIMIT 1",');
lines.push('        [tenantId]');
lines.push('      );');
lines.push('      const nextStation = asmRes.rows[0] ? asmRes.rows[0].id : null;');
lines.push('      await pool.query(');
lines.push('        "UPDATE order_items SET current_station_id = $1, station_status = \'waiting\', station_completed_at = NOW() WHERE id = $2 AND tenant_id = $3",');
lines.push('        [nextStation, item_id, tenantId]');
lines.push('      );');
lines.push('      return res.json({ success: true });');
lines.push('    }');
lines.push('');
lines.push('    if (action === \'send_to_oven\') {');
lines.push('      await pool.query(');
lines.push('        "UPDATE order_items SET station_status = \'in_oven\', oven_entry_at = NOW() WHERE id = $1 AND tenant_id = $2",');
lines.push('        [item_id, tenantId]');
lines.push('      );');
lines.push('      return res.json({ success: true });');
lines.push('    }');
lines.push('');
lines.push('    if (action === \'mark_item_ready\') {');
lines.push('      await pool.query(');
lines.push('        "UPDATE order_items SET station_status = \'ready\', ready_at = NOW() WHERE id = $1 AND tenant_id = $2",');
lines.push('        [item_id, tenantId]');
lines.push('      );');
lines.push('      // Check if all items in the order are ready → mark order ready');
lines.push('      const itemOrderRes = await pool.query(');
lines.push('        "SELECT order_id FROM order_items WHERE id = $1",');
lines.push('        [item_id]');
lines.push('      );');
lines.push('      if (itemOrderRes.rows[0]) {');
lines.push('        const orderId = itemOrderRes.rows[0].order_id;');
lines.push('        const countRes = await pool.query(');
lines.push('          "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE station_status = \'ready\') as ready_count FROM order_items WHERE order_id = $1 AND tenant_id = $2",');
lines.push('          [orderId, tenantId]');
lines.push('        );');
lines.push('        const total = parseInt(countRes.rows[0].total);');
lines.push('        const readyCount = parseInt(countRes.rows[0].ready_count);');
lines.push('        if (total > 0 && total === readyCount) {');
lines.push('          await pool.query(');
lines.push('            "UPDATE orders SET status = \'ready\', updated_at = NOW(), ready_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status NOT IN (\'delivered\',\'cancelled\')",');
lines.push('            [orderId, tenantId]');
lines.push('          );');
lines.push('        }');
lines.push('      }');
lines.push('      return res.json({ success: true });');
lines.push('    }');
lines.push('');
lines.push('    if (action === \'dispatch_oven_items\') {');
lines.push('      const itemIds = req.body.item_ids;');
lines.push('      if (!Array.isArray(itemIds) || itemIds.length === 0) {');
lines.push('        return res.status(400).json({ error: \'item_ids required\' });');
lines.push('      }');
lines.push('      const orderIdRes = await pool.query(');
lines.push('        "SELECT DISTINCT order_id FROM order_items WHERE id = ANY($1) AND tenant_id = $2",');
lines.push('        [itemIds, tenantId]');
lines.push('      );');
lines.push('      await pool.query(');
lines.push('        "UPDATE order_items SET station_status = \'dispatched\', current_station_id = NULL, station_completed_at = NOW() WHERE id = ANY($1) AND tenant_id = $2",');
lines.push('        [itemIds, tenantId]');
lines.push('      );');
lines.push('      for (const row of orderIdRes.rows) {');
lines.push('        const countRes = await pool.query(');
lines.push('          "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE station_status IN (\'ready\',\'dispatched\')) as done_count FROM order_items WHERE order_id = $1 AND tenant_id = $2",');
lines.push('          [row.order_id, tenantId]');
lines.push('        );');
lines.push('        const total = parseInt(countRes.rows[0].total);');
lines.push('        const doneCount = parseInt(countRes.rows[0].done_count);');
lines.push('        if (total > 0 && total === doneCount) {');
lines.push('          await pool.query(');
lines.push('            "UPDATE orders SET status = \'ready\', updated_at = NOW(), ready_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status NOT IN (\'delivered\',\'cancelled\')",');
lines.push('            [row.order_id, tenantId]');
lines.push('          );');
lines.push('        }');
lines.push('      }');
lines.push('      return res.json({ success: true });');
lines.push('    }');
lines.push('');
lines.push('    if (action === \'get_station_history_grouped\') {');
lines.push('      const stationId = req.body.station_id;');
lines.push('      const logsRes = await pool.query(');
lines.push('        "SELECT l.id, l.action, l.duration_seconds, l.notes, l.created_at," +');
lines.push('        " oi.product_id, p.name as product_name, o.id as order_id, t.number as table_number" +');
lines.push('        " FROM kds_station_logs l" +');
lines.push('        " LEFT JOIN order_items oi ON oi.id = l.order_item_id" +');
lines.push('        " LEFT JOIN products p ON p.id = oi.product_id" +');
lines.push('        " LEFT JOIN orders o ON o.id = oi.order_id" +');
lines.push('        " LEFT JOIN tables t ON t.id = o.table_id" +');
lines.push('        " WHERE l.tenant_id = $1 AND l.station_id = $2" +');
lines.push('        " ORDER BY l.created_at DESC LIMIT 100",');
lines.push('        [tenantId, stationId]');
lines.push('      );');
lines.push('      return res.json({ logs: logsRes.rows });');
lines.push('    }');
lines.push('');
lines.push('    ');

const NEW_ACTIONS = lines.join('\n');

code = code.slice(0, anchorIdx) + NEW_ACTIONS + code.slice(anchorIdx);
fs.writeFileSync(OUTPUT, code);
console.log('kds_device_actions patch applied: claim_item, complete_edge, send_to_oven, mark_item_ready, dispatch_oven_items, get_station_history_grouped');
