const fs = require('fs');
let code = fs.readFileSync('/tmp/server_current.js', 'utf8');

// 1. Add authOrDeviceMiddleware before LOGIN route
const newMiddleware = `
// Auth middleware that accepts either user JWT or KDS device auth headers
const authOrDeviceMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const token = auth.split(' ')[1];
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: 'Token invalido' });
    }
  }
  const deviceId = req.headers['x-device-id'];
  const authCode = req.headers['x-auth-code'];
  const tenantId = req.headers['x-tenant-id'];
  if (deviceId && authCode && tenantId) {
    try {
      const result = await pool.query(
        'SELECT * FROM kds_devices WHERE device_id = $1 AND auth_code = $2 AND tenant_id = $3 AND is_active = true',
        [deviceId, authCode, tenantId]
      );
      if (result.rows.length === 0) return res.status(401).json({ error: 'Device auth invalido' });
      req.user = { id: deviceId, tenant_id: tenantId, role: 'kds_device' };
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Erro na autenticacao do dispositivo' });
    }
  }
  return res.status(401).json({ error: 'Token nao fornecido' });
};
`;

// Insert before LOGIN route
code = code.replace('// LOGIN\n', newMiddleware + '// LOGIN\n');

// 2. Change dispatch-checklist to use authOrDeviceMiddleware
code = code.replace(
  "app.get('/api/orders/:orderId/dispatch-checklist', authMiddleware,",
  "app.get('/api/orders/:orderId/dispatch-checklist', authOrDeviceMiddleware,"
);

fs.writeFileSync('/tmp/server_patched.js', code);
const patched = fs.readFileSync('/tmp/server_patched.js', 'utf8');
console.log('authOrDeviceMiddleware added:', patched.includes('authOrDeviceMiddleware'));
console.log('dispatch-checklist updated:', patched.includes("dispatch-checklist', authOrDeviceMiddleware"));
