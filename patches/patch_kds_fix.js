const fs = require('fs');

// Read from patched (output of previous patch) or current if patched doesn't exist
const inputFile = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
let code = fs.readFileSync(inputFile, 'utf8');

// Fix kds-data get_all handler to include extras (with kds_category), sub_items,
// proper product/variation objects, and all missing order_item fields.
// This fixes mobile KDS (device auth) not showing pizza flavors.
const newGetAllHandler = `if (action === 'get_all') {
      const orderStatuses = Array.isArray(statuses) && statuses.length > 0
        ? statuses : ['pending', 'preparing', 'ready'];

      const [ordersRes, settingsRes, stationsRes] = await Promise.all([
        pool.query(
          \`SELECT o.*,
            (SELECT json_build_object('number', t.number) FROM tables t WHERE t.id = o.table_id LIMIT 1) as "table",
            COALESCE(
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'order_id', oi.order_id,
                  'product_id', oi.product_id,
                  'variation_id', oi.variation_id,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'total_price', oi.total_price,
                  'notes', oi.notes,
                  'status', oi.status,
                  'station_status', oi.station_status,
                  'current_station_id', oi.current_station_id,
                  'next_sector_id', oi.next_sector_id,
                  'has_edge', COALESCE(oi.has_edge, false),
                  'claimed_by', oi.claimed_by,
                  'claimed_at', oi.claimed_at,
                  'oven_entry_at', oi.oven_entry_at,
                  'estimated_exit_at', oi.estimated_exit_at,
                  'ready_at', oi.ready_at,
                  'station_started_at', oi.station_started_at,
                  'fulfillment_type', oi.fulfillment_type,
                  'item_kind', oi.item_kind,
                  'external_code', oi.external_code,
                  'created_at', oi.created_at,
                  'tenant_id', oi.tenant_id,
                  'product', CASE WHEN p.id IS NOT NULL THEN json_build_object('id', p.id, 'name', p.name) ELSE NULL END,
                  'variation', CASE WHEN pv.id IS NOT NULL THEN json_build_object('id', pv.id, 'name', pv.name) ELSE NULL END,
                  'extras', COALESCE(
                    (SELECT json_agg(json_build_object(
                      'id', oie.id,
                      'extra_name', oie.extra_name,
                      'price', oie.price,
                      'kds_category', COALESCE(oie.kds_category, 'complement')
                    ))
                    FROM order_item_extras oie
                    WHERE oie.order_item_id = oi.id),
                    '[]'::json
                  ),
                  'sub_items', COALESCE(
                    (SELECT json_agg(json_build_object(
                      'id', ois.id,
                      'sub_item_index', ois.sub_item_index,
                      'notes', ois.notes,
                      'sub_extras', COALESCE(
                        (SELECT json_agg(json_build_object(
                          'group_name', sise.group_name,
                          'option_name', sise.option_name,
                          'kds_category', COALESCE(sise.kds_category, 'complement')
                        ))
                        FROM order_item_sub_item_extras sise
                        WHERE sise.sub_item_id = ois.id),
                        '[]'::json
                      )
                    ) ORDER BY ois.sub_item_index)
                    FROM order_item_sub_items ois
                    WHERE ois.order_item_id = oi.id),
                    '[]'::json
                  )
                ) ORDER BY oi.created_at
              ) FILTER (WHERE oi.id IS NOT NULL),
              '[]'::json
            ) as order_items
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.id
           LEFT JOIN products p ON p.id = oi.product_id
           LEFT JOIN product_variations pv ON pv.id = oi.variation_id
           WHERE o.tenant_id = $1 AND o.status = ANY($2::text[])
           GROUP BY o.id
           ORDER BY o.created_at ASC\`,
          [tenantId, orderStatuses]
        ),
        pool.query('SELECT * FROM kds_global_settings WHERE tenant_id = $1 LIMIT 1', [tenantId]),
        pool.query('SELECT * FROM kds_stations WHERE tenant_id = $1 AND is_active = true ORDER BY name', [tenantId]),
      ]);

      return res.json({
        orders: ordersRes.rows,
        settings: settingsRes.rows[0] || null,
        stations: stationsRes.rows,
      });
    }`;

const oldPattern = /if \(action === 'get_all'\) \{[\s\S]+?return res\.json\(\{\s*\n\s*orders: ordersRes\.rows,\s*\n\s*settings: settingsRes\.rows\[0\] \|\| null,\s*\n\s*stations: stationsRes\.rows,\s*\n\s*\}\);\s*\n\s*\}/;

if (!oldPattern.test(code)) {
  console.error('ERROR: kds-data get_all handler not found — already patched or pattern changed');
  process.exit(1);
}

code = code.replace(oldPattern, newGetAllHandler);
fs.writeFileSync('/tmp/server_patched.js', code);
console.log('kds-data get_all fixed: extras+kds_category+sub_items+product/variation added');
