#!/bin/bash
set -e

# Output colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Log function
log() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
   exit 1
fi

# Update system packages
log "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install essential packages
log "Installing essential packages..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    ufw \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    rsync

# Install Docker
log "Installing Docker..."
if command -v docker &> /dev/null; then
    warn "Docker is already installed, skipping installation"
else
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $SUDO_USER
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
fi

# Install Docker Compose
log "Installing Docker Compose..."
if command -v docker-compose &> /dev/null; then
    warn "Docker Compose is already installed, skipping installation"
else
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Configure firewall
log "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
echo "y" | ufw enable

# Configure swap
log "Configuring swap..."
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Create project directory
log "Creating project directory..."
mkdir -p /var/www/forestar
chown -R $SUDO_USER:$SUDO_USER /var/www/forestar

# Configure Nginx
log "Setting up Nginx configuration..."
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Add rate limiting configuration to http context
cat > /etc/nginx/conf.d/rate-limiting.conf <<EOF
# Basic rate limiting configuration
limit_req_zone \$binary_remote_addr zone=api:10m rate=5r/s;
EOF

# Prompt for domain name
read -p "Enter your API domain name (e.g., api.yourdomain.com): " DOMAIN_NAME

# Prompt for email
read -p "Enter your email for SSL certificate notifications: " EMAIL

# Create Nginx config file
cat > /etc/nginx/sites-available/forestar <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};

    # Reverse proxy to your Docker service
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Images with authentication
    location ~* ^/images/.+$ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Set cache for images
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        
        # Disable rate limiting for images
        limit_req off;
    }
    
    # Portainer configuration
    location /portainer/ {
        proxy_pass https://localhost:9443/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost:9443;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Error logs ,
    error_log /var/log/nginx/forestar-error.log;
    access_log /var/log/nginx/forestar-access.log;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/forestar /etc/nginx/sites-enabled/

# Test Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx

# Get SSL certificate
log "Setting up SSL certificate with Let's Encrypt..."
certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email $EMAIL --redirect

log "Server setup complete!"