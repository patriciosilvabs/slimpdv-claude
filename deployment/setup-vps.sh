#!/bin/bash

# SlimPDV VPS Setup Script
# Run this on a fresh Ubuntu 24.04 VPS
# Usage: curl -sSL https://your-repo-url/setup-vps.sh | bash

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-www.pdvslim.com.br}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/slimpdv}"
CERT_EMAIL="${CERT_EMAIL:-admin@pdvslim.com.br}"

log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
  exit 1
}

warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  error "This script must be run as root. Use: sudo $0"
fi

log "Starting SlimPDV VPS setup..."
info "Domain: $DOMAIN"
info "Deploy directory: $DEPLOY_DIR"

# Update system
log "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install dependencies
log "Installing dependencies..."
apt-get install -y \
  curl \
  wget \
  git \
  build-essential \
  software-properties-common \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release \
  net-tools \
  htop \
  vim \
  nano \
  certbot \
  python3-certbot-nginx

# Install Docker
log "Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose (standalone)
log "Installing Docker Compose..."
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
curl -L "https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Nginx
log "Installing Nginx..."
apt-get install -y nginx

# Create deploy directory
log "Creating deployment directory: $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Configure firewall (UFW)
log "Configuring firewall..."
apt-get install -y ufw
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Create non-root user for deployment (optional)
if ! id -u "slimpdv" &>/dev/null; then
  log "Creating deployment user 'slimpdv'..."
  useradd -m -s /bin/bash slimpdv
  usermod -aG docker slimpdv
fi

# Create backup directory
log "Creating backup directory..."
mkdir -p /var/backups/slimpdv
chmod 755 /var/backups/slimpdv

# Create log directory
log "Creating log directory..."
mkdir -p /var/log/slimpdv
chmod 755 /var/log/slimpdv

# Setup backup cron
log "Setting up automated backups..."
cat > /etc/cron.d/slimpdv-backup << 'EOF'
# SlimPDV Database Backup
# Run daily at 2 AM
0 2 * * * root /var/www/slimpdv/deployment/backup-database.sh >> /var/log/slimpdv/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/slimpdv-backup

log "All system dependencies installed successfully!"
echo ""
echo -e "${BLUE}=== Next Steps ===${NC}"
echo "1. Clone the repository:"
echo "   git clone <YOUR_REPO_URL> $DEPLOY_DIR"
echo ""
echo "2. Configure environment variables:"
echo "   cd $DEPLOY_DIR"
echo "   cp .env.example .env"
echo "   # Edit .env with your values"
echo ""
echo "3. Setup SSL certificate (Let's Encrypt):"
echo "   sudo certbot certonly --standalone -d $DOMAIN"
echo ""
echo "4. Configure Nginx:"
echo "   sudo ln -s $DEPLOY_DIR/deployment/nginx-slimpdv.conf /etc/nginx/sites-available/slimpdv"
echo "   sudo ln -s /etc/nginx/sites-available/slimpdv /etc/nginx/sites-enabled/slimpdv"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "5. Import database:"
echo "   cd $DEPLOY_DIR"
echo "   chmod +x deployment/init-database.sh"
echo "   ./deployment/init-database.sh /path/to/supabase_backup.sql"
echo ""
echo "6. Start the application:"
echo "   docker-compose up -d"
echo ""
echo "7. Verify everything is working:"
echo "   docker-compose ps"
echo "   docker-compose logs -f"
echo ""
log "Setup script completed successfully!"
