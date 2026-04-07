# SlimPDV Migration Guide

Guia completo para migrar o SlimPDV de Supabase/Vercel para VPS com PostgreSQL local.

## 📋 Pré-requisitos

- [ ] Acesso SSH à VPS Ubuntu 24.04 LTS
- [ ] Domínio DNS apontando para a VPS (www.pdvslim.com.br)
- [ ] Dump do banco de dados Supabase
- [ ] Git instalado localmente

## 🚀 Passo a Passo

### Fase 1: Preparar VPS (No servidor)

```bash
# 1. Connect to VPS
ssh root@your-vps-ip

# 2. Run setup script
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/deployment/setup-vps.sh | bash

# 3. Wait for setup to complete (~5-10 minutes)
```

**O que foi feito:**
- ✅ Sistema atualizado (apt update/upgrade)
- ✅ Docker instalado
- ✅ Docker Compose instalado
- ✅ Nginx instalado
- ✅ Firewall (UFW) configurado
- ✅ Diretórios de backup criados
- ✅ Cron job de backup configurado

### Fase 2: Clonar Repositório e Configurar

```bash
# 1. Clone repository
git clone https://github.com/YOUR_REPO slimpdv
cd slimpdv

# 2. Setup environment
cp .env.example .env
```

**Editar .env com valores reais:**
```bash
nano .env
```

Configure:
- `DB_PASSWORD`: Senha forte do PostgreSQL
- `JWT_SECRET`: Secret para JWT tokens (gerar com: `openssl rand -base64 32`)
- `VITE_API_URL`: https://www.pdvslim.com.br/api
- `SUPABASE_URL`: URL do Supabase atual (para migração)
- `SUPABASE_ANON_KEY`: Chave do Supabase

### Fase 3: Configurar SSL com Let's Encrypt

```bash
# Create certificate
sudo certbot certonly --standalone -d www.pdvslim.com.br -d pdvslim.com.br \
  -d mail: admin@pdvslim.com.br \
  --agree-tos

# Certificate location:
# /etc/letsencrypt/live/www.pdvslim.com.br/fullchain.pem
# /etc/letsencrypt/live/www.pdvslim.com.br/privkey.pem
```

### Fase 4: Configurar Nginx

```bash
# Copy nginx config
sudo cp deployment/nginx-slimpdv.conf /etc/nginx/sites-available/slimpdv

# Enable site
sudo ln -s /etc/nginx/sites-available/slimpdv /etc/nginx/sites-enabled/slimpdv

# Disable default
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test config
sudo nginx -t

# Start/reload nginx
sudo systemctl start nginx
sudo systemctl reload nginx

# Enable on boot
sudo systemctl enable nginx
```

### Fase 5: Exportar Banco do Supabase

```bash
# Option 1: Via CLI psql (recomendado)
PGPASSWORD=<supabase-password> pg_dump \
  -h db.cphyoattbofiwrthtgrh.supabase.co \
  -U postgres \
  -d postgres \
  > supabase_backup.sql

# Option 2: Via interface Supabase
# Settings → Database → Download → Custom format

# Compress (opcional)
gzip supabase_backup.sql
```

### Fase 6: Importar Banco de Dados

```bash
# Copy dump to VPS
scp supabase_backup.sql root@your-vps-ip:/tmp/

# SSH into VPS
ssh root@your-vps-ip

# Go to deploy dir
cd /var/www/slimpdv

# Make script executable
chmod +x deployment/init-database.sh

# Run import
./deployment/init-database.sh /tmp/supabase_backup.sql

# Verify
docker-compose exec postgres psql -U slimpdv -d slimpdv \
  -c "SELECT COUNT(*) as users FROM profiles;"
```

### Fase 7: Build e Deploy

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Verify
docker-compose ps
docker-compose logs -f backend
docker-compose logs -f frontend

# Wait ~1-2 minutes for builds to complete
sleep 120

# Test health
curl https://www.pdvslim.com.br/health
```

### Fase 8: Verificação

```bash
# 1. Test SSL
curl -I https://www.pdvslim.com.br

# 2. Test backend health
curl https://www.pdvslim.com.br/api/health

# 3. Test login
curl -X POST https://www.pdvslim.com.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 4. Check database
docker-compose exec postgres psql -U slimpdv -d slimpdv \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';" | wc -l

# 5. Monitor logs
docker-compose logs -f
```

## 📊 Pós-Migração

### Backups Automáticos

Backups são executados automaticamente às 02:00 UTC diariamente.

```bash
# Check backup
ls -lh /var/backups/slimpdv/

# Manual backup
./deployment/backup-database.sh

# Restore from backup
docker-compose exec postgres psql -U slimpdv -d slimpdv < /var/backups/slimpdv/slimpdv_2024-01-01_02-00-00.sql
```

### Monitoramento

```bash
# CPU/Memory usage
docker stats

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Check disk space
df -h
```

### Atualizações de Código

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose build
docker-compose up -d

# Verify
docker-compose logs -f
```

## 🔄 Rollback Plan

Se algo der errado:

### 1. Banco de dados comprometido?

```bash
# Restore from backup
BACKUP_FILE="/var/backups/slimpdv/slimpdv_YYYY-MM-DD_HH-MM-SS.sql.gz"
gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres \
  psql -U slimpdv -d slimpdv
```

### 2. Aplicação quebrada?

```bash
# Stop and revert
git revert HEAD~1
docker-compose build
docker-compose up -d
```

### 3. Usar Supabase como fallback (temporário)?

```bash
# Voltar DNS para Vercel/Supabase
# Edit DNS records to point to Vercel IP
# (Manter por 24-48 horas antes de deletar)
```

## 📝 Checklist Final

- [ ] DNS apontando para VPS
- [ ] SSL certificate válido (Let's Encrypt)
- [ ] Docker containers rodando (`docker-compose ps`)
- [ ] Nginx respondendo (curl -I)
- [ ] Backend respondendo (/health)
- [ ] Autenticação funcionando (/auth/login)
- [ ] Operações POS funcionando (criar pedido, atualizar mesa)
- [ ] KDS funcionando
- [ ] Backups automáticos configurados
- [ ] Logs sendo coletados (/var/log/slimpdv/)
- [ ] Firewall configurado (porta 22, 80, 443)
- [ ] SSH keys configuradas (sem senhas)

## ⚠️ Problemas Comuns

### "Connection refused" do backend
```bash
# Verificar se postgres está rodando
docker-compose logs postgres

# Verificar DATABASE_URL no .env
cat .env | grep DATABASE_URL

# Reiniciar
docker-compose restart postgres backend
```

### "502 Bad Gateway" do nginx
```bash
# Verificar se containers estão rodando
docker-compose ps

# Verificar logs
docker-compose logs frontend
docker-compose logs backend

# Reiniciar
docker-compose restart
```

### Certificado SSL expirado
```bash
# Renovar
sudo certbot renew

# Ou automático via cron (já configurado)
sudo systemctl status certbot.timer
```

### Sem espaço em disco
```bash
# Limpar velhos backups
find /var/backups/slimpdv -mtime +30 -delete

# Limpar Docker
docker system prune -a
```

## 📞 Suporte

Para problemas, verifique:
1. Logs: `docker-compose logs -f`
2. Conectividade: `telnet localhost 5432` (PostgreSQL)
3. Nginx: `sudo nginx -t && sudo systemctl status nginx`
4. DNS: `nslookup www.pdvslim.com.br`

---

**Migração concluída!** 🎉

SlimPDV agora está rodando em sua VPS com:
- ✅ PostgreSQL local (seguro e rápido)
- ✅ Backend Node.js próprio
- ✅ Frontend React com Vite
- ✅ SSL/TLS automático
- ✅ Backups automatizados
- ✅ Zero dependência do Supabase
