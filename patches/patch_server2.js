const fs = require('fs');
let code = fs.readFileSync('/tmp/server_current.js', 'utf8');

// ── Fix 1: complete_edge — advance item to first assembly station ──────────────
const oldCompleteEdge = `    if (action === 'complete_edge') {
      const { item_id: edgeItemId } = req.body;
      await pool.query(
        \`UPDATE order_items SET station_status = 'edge_done', station_completed_at = NOW()
         WHERE id = $1 AND tenant_id = $2\`,
        [edgeItemId, tenantId]
      );
      return res.json({ success: true });
    }`;

const newCompleteEdge = `    if (action === 'complete_edge') {
      const { item_id: edgeItemId } = req.body;
      // Find first active assembly station for this tenant (replicates complete_edge_preparation RPC)
      const nextStRes = await pool.query(
        \`SELECT id FROM kds_stations WHERE tenant_id = $1 AND is_active = true AND station_type = 'assembly' ORDER BY sort_order ASC LIMIT 1\`,
        [tenantId]
      );
      const nextStationId = nextStRes.rows[0]?.id || null;
      await pool.query(
        \`UPDATE order_items SET current_station_id = $1, station_status = 'waiting', station_completed_at = NOW()
         WHERE id = $2 AND tenant_id = $3\`,
        [nextStationId, edgeItemId, tenantId]
      );
      return res.json({ success: true });
    }`;

if (!code.includes(oldCompleteEdge.slice(0, 60))) {
  console.error('ERROR: could not find complete_edge block');
  process.exit(1);
}
code = code.replace(oldCompleteEdge, newCompleteEdge);

// ── Fix 2: send_to_oven — also set current_station_id to oven_expedite station ─
const oldSendToOven_part1 = `      if (ovenMinutes > 0) {
        await pool.query(
          \`UPDATE order_items SET station_status = 'in_oven', oven_entry_at = NOW(),
           estimated_exit_at = NOW() + ($1 || ' minutes')::interval
           WHERE id = $2 AND tenant_id = $3\`,
          [ovenMinutes, ovenItemId, tenantId]
        );
      } else {
        await pool.query(
          \`UPDATE order_items SET station_status = 'in_oven', oven_entry_at = NOW(), estimated_exit_at = NULL
           WHERE id = $1 AND tenant_id = $2\`,
          [ovenItemId, tenantId]
        );
      }
      return res.json({ success: true });`;

const newSendToOven_part1 = `      // Also set current_station_id to the oven station so history logs work
      const ovenStRes2 = await pool.query(
        \`SELECT id FROM kds_stations WHERE tenant_id = $1 AND is_active = true AND station_type = 'oven_expedite' LIMIT 1\`,
        [tenantId]
      );
      const ovenStationId = ovenStRes2.rows[0]?.id || null;
      if (ovenMinutes > 0) {
        await pool.query(
          \`UPDATE order_items SET station_status = 'in_oven', current_station_id = $1, oven_entry_at = NOW(),
           estimated_exit_at = NOW() + ($2 || ' minutes')::interval
           WHERE id = $3 AND tenant_id = $4\`,
          [ovenStationId, ovenMinutes, ovenItemId, tenantId]
        );
      } else {
        await pool.query(
          \`UPDATE order_items SET station_status = 'in_oven', current_station_id = $1, oven_entry_at = NOW(), estimated_exit_at = NULL
           WHERE id = $2 AND tenant_id = $3\`,
          [ovenStationId, ovenItemId, tenantId]
        );
      }
      return res.json({ success: true });`;

if (!code.includes(oldSendToOven_part1.slice(0, 60))) {
  console.error('ERROR: could not find send_to_oven block');
  process.exit(1);
}
code = code.replace(oldSendToOven_part1, newSendToOven_part1);

// ── Fix 3: dispatch_oven_items — get station IDs BEFORE the UPDATE ─────────────
const oldDispatch = `      await pool.query(
        \`UPDATE order_items SET station_status = 'dispatched', station_completed_at = NOW(), current_station_id = NULL
         WHERE id = ANY($1) AND tenant_id = $2\`,
        [item_ids, tenantId]
      );
      // Insert dispatch logs
      const itemsRes = await pool.query(
        \`SELECT id, current_station_id, order_id FROM order_items WHERE id = ANY($1)\`, [item_ids]
      );`;

const newDispatch = `      // Get station IDs BEFORE nullifying them
      const itemsRes = await pool.query(
        \`SELECT id, current_station_id, order_id FROM order_items WHERE id = ANY($1)\`, [item_ids]
      );
      await pool.query(
        \`UPDATE order_items SET station_status = 'dispatched', station_completed_at = NOW(), current_station_id = NULL
         WHERE id = ANY($1) AND tenant_id = $2\`,
        [item_ids, tenantId]
      );
      // Insert dispatch logs`;

if (!code.includes(oldDispatch.slice(0, 60))) {
  console.error('ERROR: could not find dispatch_oven_items block');
  process.exit(1);
}
code = code.replace(oldDispatch, newDispatch);

fs.writeFileSync('/tmp/server_patched.js', code);

// Verify
const patched = fs.readFileSync('/tmp/server_patched.js', 'utf8');
console.log('complete_edge fixed:', patched.includes("station_type = 'assembly'") && patched.includes("station_status = 'waiting'"));
console.log('send_to_oven fixed:', patched.includes("current_station_id = $1, oven_entry_at"));
console.log('dispatch_oven_items fixed:', patched.includes('Get station IDs BEFORE'));
