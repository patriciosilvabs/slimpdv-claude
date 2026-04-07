# SlimPDV Backend

API backend para SlimPDV - Sistema de Gestão de Restaurante (POS).

## 🏗️ Estrutura

```
backend/
├── src/
│   ├── server.ts              # Express app main
│   ├── database/
│   │   └── client.ts          # PostgreSQL pool
│   ├── auth/
│   │   ├── jwt.ts             # JWT utilities
│   │   ├── middleware.ts       # Auth middleware
│   │   └── routes.ts          # Login, Register, Refresh
│   └── functions/
│       ├── kds/               # Kitchen Display System
│       ├── orders/            # Order management
│       ├── products/          # Product catalog
│       └── ...                # Other features
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🚀 Instalação

### Requisitos
- Node.js 20+
- PostgreSQL 16+
- npm ou yarn

### Setup Local

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL

# Start dev server
npm run dev

# Build for production
npm run build

# Run production
npm start
```

## 🔐 Autenticação

Sistema JWT baseado em Bearer tokens.

### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin",
    "tenant_id": "tenant-uuid"
  },
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Usar Token
```bash
GET /api/orders
Authorization: Bearer <token>
```

### Refresh Token
```bash
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}

Response:
{
  "token": "<new_token>"
}
```

## 📚 API Endpoints

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/register` - Registrar
- `POST /auth/refresh` - Renovar token
- `GET /auth/me` - Usuário atual
- `POST /auth/logout` - Logout

### Pedidos
- `GET /api/orders` - Listar pedidos
- `GET /api/orders/:id` - Detalhes do pedido
- `POST /api/orders` - Criar pedido
- `PUT /api/orders/:id/status` - Atualizar status

### Kitchen Display System
- `GET /api/kds/pending-orders` - Pedidos pendentes
- `PUT /api/kds/order/:id/ready` - Marcar como pronto
- `POST /api/kds/device-auth` - Autenticar dispositivo

### Produtos
- `GET /api/products` - Listar produtos
- `GET /api/products/:id` - Detalhes do produto
- `GET /api/products/categories/list` - Categorias

## 🗄️ Banco de Dados

Conecta a PostgreSQL via variável de ambiente `DATABASE_URL`.

### Connection String
```
postgresql://user:password@localhost:5432/slimpdv
```

### Tabelas Principais
- `profiles` - Usuários
- `orders` - Pedidos
- `order_items` - Items do pedido
- `products` - Catálogo
- `categories` - Categorias
- `tables` - Mesas
- `tenants` - Multi-tenant

## 🐳 Docker

### Build
```bash
docker build -t slimpdv-backend .
```

### Run
```bash
docker run \
  -e DATABASE_URL="postgresql://user:pass@host:5432/slimpdv" \
  -e JWT_SECRET="secret-key" \
  -p 5000:3000 \
  slimpdv-backend
```

### Com Docker Compose
```bash
docker-compose up -d backend
docker-compose logs -f backend
```

## 📊 Variáveis de Ambiente

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/slimpdv

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d

# Server
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://www.pdvslim.com.br
```

## 🧪 Testes

```bash
# Lint
npm run lint

# Type check
npm run type-check
```

## 📈 Performance

- Connection pooling: 20 conexões máximo
- Query timeout: 2 segundos
- Idle timeout: 30 segundos

### Monitorar
```bash
docker stats slimpdv-backend
docker-compose logs -f backend
```

## 🔄 Migração de Edge Functions

As 28 Edge Functions do Supabase foram migradas para rotas Express:

| Função | Endpoint |
|--------|----------|
| kds-device-auth | POST /api/kds/device-auth |
| kds-data | GET /api/kds/pending-orders |
| order-webhooks | POST /api/webhooks/orders |
| cardapioweb-* | POST /api/integrations/cardapioweb/* |
| import-menu | POST /api/admin/import-menu |
| delivery-logistics-processor | POST /api/logistics/* |
| ... | ... |

## 🛠️ Desenvolvimento

### Adicionar Nova Rota

```typescript
// src/functions/myfeature/routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../auth/middleware.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  // Implementation
});

export default router;
```

### Registrar Rota

```typescript
// src/server.ts
import myfeatureRoutes from './functions/myfeature/routes.js';
app.use('/api/myfeature', myfeatureRoutes);
```

## 📝 Logging

Logs são enviados para stdout/stderr via Docker.

```bash
# View all logs
docker-compose logs backend

# Follow logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

## ⚠️ Tratamento de Erro

Respostas de erro seguem padrão:

```json
{
  "error": "Error message",
  "status": 400
}
```

Status codes:
- 200: OK
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## 🚀 Deploy

### Docker
```bash
docker-compose up -d backend

# Verificar
docker-compose ps
curl http://localhost:5000/health
```

### Nginx (reverse proxy)
Backend roda na porta 5000, Nginx redireciona `/api/*` para backend.

## 📞 Troubleshooting

### Connection refused
- Verificar DATABASE_URL
- Verificar PostgreSQL está rodando: `docker-compose logs postgres`

### Token inválido
- Verificar JWT_SECRET
- Verificar token não expirou

### Erro de query
- Verificar estrutura do banco de dados
- Rodar migrations: `npm run migrate`

---

Made with ❤️ for SlimPDV
