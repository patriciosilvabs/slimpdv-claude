# SlimPDV VPS Migration - Quick Start Guide

## ⚡ Resumo Executivo (5 min read)

Você transformou sua aplicação SlimPDV de **Supabase/Vercel → PostgreSQL/Docker na VPS**.

### O que mudou:
- ❌ Supabase → ✅ PostgreSQL (sua VPS)
- ❌ Vercel → ✅ Docker Compose (sua VPS)
- ❌ Supabase Auth → ✅ JWT próprio (mais rápido)
- ✅ React/Vite mantido (sem mudanças visuais)
- ✅ Dados migrados intactos

---

## 🎯 Arquivos Criados (Resumo)

### Backend (Nova Pasta)
```
backend/                          ← Aplicação Node.js Express
├── src/
│   ├── server.ts               ← Inicia o Express
│   ├── database/client.ts      ← Conecta PostgreSQL
│   ├── auth/                   ← Login/Logout/JWT
│   └── functions/              ← Rotas da API
├── Dockerfile                  ← Container
└── package.json               ← Dependências
```

### Infraestrutura
```
docker-compose.yml             ← Orquestra 3 containers
Dockerfile (atualizado)         ← Frontend multi-stage
deployment/
├── nginx-slimpdv.conf        ← Proxy reverso + SSL
├── setup-vps.sh              ← Setup automático
├── init-database.sh          ← Importa backup
└── backup-database.sh        ← Backups diários
```

### Frontend (Mudanças)
```
src/integrations/api/client.ts     ← Novo: HTTP client local
src/contexts/AuthContext.tsx       ← Atualizado: API local
```

### Documentação
```
MIGRATION.md                    ← Guia completo (passo-a-passo)
DEPLOYMENT_SUMMARY.md           ← Este resumo
backend/README.md              ← Documentação API
.env.example                   ← Template de variáveis
```

---

## 🚀 Próximos 3 Passos

### 1️⃣ Exportar dados do Supabase
```bash
# Na sua máquina local
PGPASSWORD=<sua-senha> pg_dump \
  -h db.cphyoattbofiwrthtgrh.supabase.co \
  -U postgres -d postgres > backup.sql

# Ou via interface Supabase:
# Settings → Database → Download → Custom format
```

### 2️⃣ Deploy na VPS
```bash
# SSH na VPS
ssh root@seu-vps-ip

# Run setup (instala Docker, Nginx, Certbot)
curl -sSL https://raw.githubusercontent.com/SEU_REPO/main/deployment/setup-vps.sh | bash

# Clonar repo
git clone https://seu-repo /var/www/slimpdv
cd /var/www/slimpdv

# Configurar
cp .env.example .env
nano .env  # Editar com suas credenciais

# Importar BD
chmod +x deployment/init-database.sh
./deployment/init-database.sh backup.sql
```

### 3️⃣ Iniciar
```bash
# Certificado SSL
sudo certbot certonly --standalone -d www.pdvslim.com.br

# Nginx
sudo cp deployment/nginx-slimpdv.conf /etc/nginx/sites-available/slimpdv
sudo ln -s /etc/nginx/sites-available/slimpdv /etc/nginx/sites-enabled/slimpdv
sudo nginx -t && sudo systemctl reload nginx

# Containers
docker-compose up -d

# Verificar
curl https://www.pdvslim.com.br/health
```

---

## 📋 Checklist de Migração

```
Preparação:
[ ] Exportar dump do Supabase
[ ] Ter acesso SSH à VPS
[ ] DNS apontando para VPS

Setup VPS:
[ ] Rodar setup-vps.sh
[ ] Certificado Let's Encrypt criado
[ ] Nginx configurado

Deploy Aplicação:
[ ] Clonar repositório
[ ] Arquivo .env preenchido com credenciais reais
[ ] Banco de dados importado
[ ] docker-compose build
[ ] docker-compose up -d

Verificação:
[ ] HTTPS funciona (curl -I https://seu-dominio)
[ ] Login funciona
[ ] Pedidos podem ser criados
[ ] KDS opera normalmente
[ ] Backups automáticos agendados
```

---

## 🔧 Estrutura da API

### Autenticação
```
POST   /auth/login              → email + password → token
POST   /auth/register           → novo usuário
POST   /auth/refresh            → renovar token
GET    /auth/me                 → usuário logado
```

### Pedidos
```
GET    /api/orders              → listar pedidos
POST   /api/orders              → criar pedido
PUT    /api/orders/:id/status   → atualizar status
```

### Kitchen Display System
```
GET    /api/kds/pending-orders  → pedidos para cozinha
PUT    /api/kds/order/:id/ready → marcar pronto
```

### Produtos
```
GET    /api/products            → catálogo
GET    /api/products/categories/list → categorias
```

---

## 🐳 Comandos Docker Úteis

```bash
# Ver containers rodando
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Logs específicos
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Acessar banco de dados
docker-compose exec postgres psql -U slimpdv -d slimpdv

# Parar tudo
docker-compose down

# Reiniciar um container
docker-compose restart backend
```

---

## 🔄 Deploy de Atualizações

Depois que está em produção, para fazer deploy de novas mudanças:

```bash
# Na VPS
cd /var/www/slimpdv

# Puxar código novo
git pull origin main

# Rebuild
docker-compose build

# Reiniciar
docker-compose up -d

# Verificar
docker-compose logs -f
```

---

## 📊 Banco de Dados

### Tabelas principais:
- `profiles` - Usuários
- `orders` - Pedidos
- `order_items` - Items do pedido
- `products` - Cardápio
- `categories` - Categorias
- `tables` - Mesas
- `tenants` - Múltiplos restaurantes

### Variáveis do .env:
```bash
DB_NAME=slimpdv              # Nome do banco
DB_USER=slimpdv              # Usuário
DB_PASSWORD=senha-forte      # Senha (gerar com: openssl rand -base64 32)
DATABASE_URL=postgresql://... # String de conexão (gerada automaticamente)
```

---

## ⚠️ Antes de Migrar (IMPORTANTE)

1. **Backup do Supabase** - SEMPRE faça backup antes!
2. **Teste localmente** - Rode docker-compose local primeiro
3. **DNS pronto** - Tenha domínio apontando para VPS
4. **Variáveis seguras** - Não commitar .env com senhas reais
5. **Manter Supabase ativo** - Por 48h como fallback

---

## 🆘 Problemas Comuns

### "Connection refused"
```bash
# Ver se postgres está rodando
docker-compose logs postgres

# Reiniciar
docker-compose restart postgres backend
```

### "502 Bad Gateway"
```bash
# Ver se backends estão rodando
docker-compose ps

# Checar logs
docker-compose logs backend frontend
```

### Certificado expirado
```bash
# Renovar (automático, mas pode forçar)
sudo certbot renew
```

### Sem espaço em disco
```bash
# Limpar backups antigos
find /var/backups/slimpdv -mtime +30 -delete

# Limpar Docker
docker system prune -a
```

---

## 📞 Documentação Completa

Para guia completo passo-a-passo: **Veja `MIGRATION.md`**

Para detalhes da API: **Veja `backend/README.md`**

---

## 🎯 Tempo Estimado

| Etapa | Tempo |
|-------|-------|
| Setup VPS | 5-10 min |
| Certificado SSL | 5 min |
| Importar banco | 5-20 min* |
| Build containers | 10-15 min |
| Verificação | 5 min |
| **TOTAL** | **30-60 min** |

*Depende do tamanho do banco

---

## ✅ Você está pronto!

Todos os arquivos foram criados. Agora é só colocar em produção seguindo os 3 passos acima.

**Boa sorte! 🚀**

---

Dúvidas? Veja:
- MIGRATION.md (guia completo)
- backend/README.md (API details)
- Plano no .claude/plans/ (arquitetura)
