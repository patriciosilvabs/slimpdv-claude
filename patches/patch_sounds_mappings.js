#!/usr/bin/env node
/**
 * Patch: add POST aliases for cardapioweb mappings + sounds endpoints
 * Anchor: inserts BEFORE the realtime stub at the end of the file
 * Does NOT touch any existing routes.
 */
const fs = require('fs');

const INPUT = fs.existsSync('/tmp/server_patched.js') ? '/tmp/server_patched.js' : '/tmp/server_current.js';
const OUTPUT = '/tmp/server_patched.js';

let code = fs.readFileSync(INPUT, 'utf8');

// Safety check: don't double-apply
if (code.includes('// PATCH: sounds + mapping POST aliases')) {
  console.log('Already patched — skipping');
  fs.writeFileSync(OUTPUT, code);
  process.exit(0);
}

const ANCHOR = `// ============================================================
// REALTIME: stub para evitar erros 404
app.all('/realtime/v1/*', (req, res) => res.json({}));`;

if (!code.includes(ANCHOR)) {
  console.error('ERROR: anchor not found in server.js');
  process.exit(1);
}

const NEW_ROUTES = `// ============================================================
// PATCH: sounds + mapping POST aliases

// ---- Cardapioweb mapping POST aliases (frontend uses supabase.functions.invoke = POST) ----

app.post('/api/functions/cardapioweb-group-mappings', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const r = await pool.query(
      'SELECT m.*, cg.name as local_group_name, cg.kds_category as local_kds_category FROM cardapioweb_group_mappings m LEFT JOIN complement_groups cg ON cg.id=m.local_group_id WHERE m.tenant_id=$1 ORDER BY m.cardapioweb_group_name',
      [tenantId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/functions/cardapioweb-option-mappings', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const r = await pool.query(
      'SELECT m.*, co.name as local_option_name, cg.name as local_group_name FROM cardapioweb_option_mappings m LEFT JOIN complement_options co ON co.id=m.local_option_id LEFT JOIN complement_groups cg ON cg.id=co.group_id WHERE m.tenant_id=$1 ORDER BY m.cardapioweb_group_name, m.cardapioweb_option_name',
      [tenantId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Sounds endpoints ----
// Table: sound_files (id, tenant_id, file_name, mime_type, file_data text/base64, created_at)

// Upload sound file — accepts JSON { fileName, contentBase64, mimeType }
app.post('/api/sounds/upload', express.json({ limit: '20mb' }), authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { fileName, contentBase64, mimeType } = req.body || {};
    if (!fileName || !contentBase64) return res.status(400).json({ error: 'fileName and contentBase64 required' });

    await pool.query(
      \`INSERT INTO sound_files (file_name, file_data, mime_type, tenant_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (file_name) DO UPDATE SET file_data=$2, mime_type=$3, tenant_id=$4\`,
      [fileName, contentBase64, mimeType || 'audio/mpeg', tenantId]
    );
    res.json({ path: fileName });
  } catch (err) {
    console.error('sounds upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve sound file (file_name matches the path after /api/sounds/file/)
app.get('/api/sounds/file/*', async (req, res) => {
  try {
    const fileName = req.params[0];
    const r = await pool.query('SELECT file_data, mime_type FROM sound_files WHERE file_name=$1', [fileName]);
    if (!r.rows.length) return res.status(404).json({ error: 'Sound not found' });
    const buf = Buffer.from(r.rows[0].file_data, 'base64');
    res.setHeader('Content-Type', r.rows[0].mime_type || 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete sound file
app.delete('/api/sounds/file/*', authMiddleware, async (req, res) => {
  try {
    const fileName = req.params[0];
    const tenantId = req.user.tenant_id;
    await pool.query('DELETE FROM sound_files WHERE file_name=$1 AND tenant_id=$2', [fileName, tenantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

`;

code = code.replace(ANCHOR, NEW_ROUTES + ANCHOR);
fs.writeFileSync(OUTPUT, code);
console.log('Patch applied successfully');
