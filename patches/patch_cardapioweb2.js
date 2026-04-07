const fs = require('fs');
let code = fs.readFileSync('/tmp/server_current.js', 'utf8');

const oldEndpoint = `// POST /api/functions/cardapioweb-test-connection
app.post('/api/functions/cardapioweb-test-connection', async (req, res) => {
  try {
    const { api_token } = req.body || {};
    if (!api_token) return res.json({ success: false, message: 'O campo api_token é obrigatório' });

    const https = require('https');
    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'integracao.cardapioweb.com',
        path: '/api/partner/v1/merchant',
        method: 'GET',
        headers: { 'X-API-KEY': api_token, 'Accept': 'application/json' },
      };
      const req2 = https.request(options, (r) => {
        let body = '';
        r.on('data', (chunk) => body += chunk);
        r.on('end', () => resolve({ status: r.statusCode, body }));
      });
      req2.on('error', reject);
      req2.end();
    });

    if (response.status !== 200) {
      return res.json({ success: false, message: 'API retornou status ' + response.status, details: response.body });
    }

    let parsed = {};
    try { parsed = JSON.parse(response.body); } catch { parsed = { raw: response.body }; }

    return res.json({
      success: true,
      message: 'Conexão estabelecida com sucesso',
      merchantName: parsed.name || parsed.trading_name || parsed.company_name || null,
      merchantId: parsed.id || parsed.merchant_id || null,
      raw: parsed,
    });
  } catch (err) {
    res.json({ success: false, message: err.message || 'Erro interno ao testar conexão' });
  }
});`;

const newEndpoint = `// POST /api/functions/cardapioweb-test-connection
app.post('/api/functions/cardapioweb-test-connection', async (req, res) => {
  try {
    const { api_token } = req.body || {};
    if (!api_token) return res.json({ success: false, message: 'O campo api_token é obrigatório' });

    const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/merchant', {
      headers: { 'X-API-KEY': api_token, 'Accept': 'application/json' },
    });

    const body = await response.text();
    if (!response.ok) {
      return res.json({ success: false, message: 'API retornou status ' + response.status, details: body });
    }

    let parsed = {};
    try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }

    return res.json({
      success: true,
      message: 'Conexão estabelecida com sucesso',
      merchantName: parsed.name || parsed.trading_name || parsed.company_name || null,
      merchantId: parsed.id || parsed.merchant_id || null,
      raw: parsed,
    });
  } catch (err) {
    res.json({ success: false, message: err.message || 'Erro interno ao testar conexão' });
  }
});`;

if (!code.includes('cardapioweb-test-connection')) {
  console.error('ERROR: endpoint not found');
  process.exit(1);
}
code = code.replace(oldEndpoint, newEndpoint);
fs.writeFileSync('/tmp/server_patched.js', code);
console.log('fixed:', code.includes("await fetch('https://integracao.cardapioweb.com"));
