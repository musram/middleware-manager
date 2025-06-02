#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[-]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root or with sudo"
    exit 1
fi

# Check for required commands
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is required but not installed. Please install it first."
        exit 1
    fi
}

print_status "Checking prerequisites..."
check_command docker
check_command docker-compose
check_command curl

# Create necessary directories
print_status "Creating required directories..."

# Remove old directories
rm -rf ./pangolin_config \
       ./gerbil_config \
       ./traefik_static_config \
       ./letsencrypt \
       ./config/traefik/rules \
       ./traefik_plugins \
       ./mm_data \
       ./mm_config \
       ./config/traefik \
       ./config/traefik/logs \
       ./public_html

# Create new directories
mkdir -p ./pangolin_config \
         ./gerbil_config \
         ./traefik_static_config \
         ./letsencrypt \
         ./config/traefik/rules \
         ./traefik_plugins \
         ./mm_data \
         ./mm_config \
         ./config/traefik \
         ./config/traefik/logs \
         ./public_html


# install docker-compose if not installed
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing docker-compose..."
    curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create Pangolin configuration
print_status "Creating Pangolin configuration..."
cat > ./pangolin_config/config.yml << 'EOL'
app:
  dashboard_url: "https://mcp.api.deepalign.ai"
  log_level: "debug" # Set to DEBUG for troubleshooting
  save_logs: true
  log_failed_attempts: true

server:
  external_port: 3002
  internal_port: 3003
  next_port: 3004
  internal_hostname: "pangolin"
  session_cookie_name: "p_session_token"
  resource_access_token_param: "p_token"
  resource_access_token_headers:
    id: "P-Access-Token-Id"
    token: "P-Access-Token"
  resource_session_request_param: "p_session_request"
  secret: "d28@a2b.2HFTe2bMtZHGneNYgQFKT2X4vm4HuXUXBcq6aVyNZjdGt6Dx-_A@9b3y"
  cors:
    origins: ["*"]
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allowed_headers: ["Content-Type", "Authorization", "Cookie"]
    credentials: true
  trust_proxy: true
  dashboard_session_length_hours: 720
  resource_session_length_hours: 720

domains:
  default:
    base_domain: "mcp.api.deepalign.ai"
    cert_resolver: "letsencrypt"
    prefer_wildcard_cert: false

traefik:
  http_entrypoint: "web"
  https_entrypoint: "websecure"

gerbil:
  start_port: 51820
  base_endpoint: "mcp.api.deepalign.ai"
  use_subdomain: false
  block_size: 24
  site_block_size: 30
  subnet_group: "100.89.137.0/20"

rate_limits:
  global:
    window_minutes: 1
    max_requests: 100

users:
  server_admin:
    email: "admin@example.com"
    password: "Password123!"

flags:
  require_email_verification: false
  disable_signup_without_invite: false
  disable_user_create_org: false
  allow_raw_resources: true
  allow_base_domain_resources: true
EOL

# Set proper permissions for Pangolin config
chmod 644 ./pangolin_config/config.yml

# Create Gerbil configuration
print_status "Creating Gerbil configuration..."
cat > ./gerbil_config/config.json << 'EOL'
{
    "privateKey": "kBGTgk7c+zncEEoSnMl+jsLjVh5ZVoL/HwBSQem+d1M=",
    "listenPort": 51820,
    "ipAddress": "10.0.0.1/24",
    "peers": [
        {
            "publicKey": "5UzzoeveFVSzuqK3nTMS5bA1jIMs1fQffVQzJ8MXUQM=",
            "allowedIps": ["10.0.0.0/28"]
        },
        {
            "publicKey": "kYrZpuO2NsrFoBh1GMNgkhd1i9Rgtu1rAjbJ7qsfngU=",
            "allowedIps": ["10.0.0.16/28"]
        },
        {
            "publicKey": "1YfPUVr9ZF4zehkbI2BQhCxaRLz+Vtwa4vJwH+mpK0A=",
            "allowedIps": ["10.0.0.32/28"]
        },
        {
            "publicKey": "2/U4oyZ+sai336Dal/yExCphL8AxyqvIxMk4qsUy4iI=",
            "allowedIps": ["10.0.0.48/28"]
        }
    ]
}
EOL

# set proper permissions for gerbil config
chmod 644 ./gerbil_config/config.json


# Debug: Verify config file exists and show its contents
print_status "Verifying Pangolin configuration..."
ls -l ./pangolin_config/config.yml
cat ./pangolin_config/config.yml


# Create basic traefik.yml if it doesn't exist
if [ ! -f ./traefik_static_config/traefik.yml ]; then
    print_status "Creating basic traefik.yml configuration..."
    cat > ./traefik_static_config/traefik_config.yml << 'EOL'
# Global configuration
global:
  checkNewVersion: true
  sendAnonymousUsage: false

# API and Dashboard configuration
api:
  dashboard: true
  insecure: true  # Set to false in production and configure proper authentication
  debug: true

# Entrypoints configuration
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt
  traefik:
    address: ":8080"

# Certificate resolver configuration
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@deepalign.ai
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
      
# Providers configuration
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik
    useBindPortIP: true
  file:
    directory: "/rules"
    watch: true

# Logging configuration
log:
  level: DEBUG
  filePath: "/var/log/traefik/traefik.log"

# Access log configuration
accessLog:
  filePath: "/var/log/traefik/access.log"
  bufferingSize: 100

# Metrics configuration
metrics:
  prometheus:
    buckets:
      - 0.1
      - 0.3
      - 1.2
      - 5.0

# Experimental features (for plugins)
experimental:
  plugins:
    # Plugin configurations will be added here by middleware-manager
    # Example:
    # myplugin:
    #   moduleName: github.com/vendor/my-traefik-plugin
    #   version: v1.0.0
EOL
fi


# Create dynnamic config for traefik
if [ ! -f ./config/traefik/rules/dynamic_config.yml ]; then
    print_status "Creating dynamic config for traefik..."
    cat > ./config/traefik/rules/dynamic_config.yml << 'EOL'
    # Dynamic config for traefik
    http:
    routers:
      pangolin-router:
        rule: "Host(`mcp.api.deepalign.ai`) && PathPrefix(`/`)"
        entrypoints:
          - web
          - websecure
        service: pangolin-service
        middlewares:
          - mcp-auth
          - mcp-cors-headers
        tls:
          certResolver: letsencrypt
          domains:
            - main: "mcp.api.deepalign.ai"
            - sans: "www.mcp.api.deepalign.ai"

      traefik-router:
        rule: "Host(`mcp.api.deepalign.ai`) && PathPrefix(`/dashboard`)"
        entrypoints:
          - web
          - websecure
        service: traefik-service
        middlewares:
          - mcp-auth
          - redirect-regex
          - crowdsec
        tls:
          certResolver: letsencrypt
          domains:
            - main: "mcp.api.deepalign.ai"
            - sans: "www.mcp.api.deepalign.ai"

    services:
      pangolin-service:
        loadBalancer:
          servers:
            - url: "http://pangolin:3002"

      traefik-service:
        loadBalancer:
          servers:
            - url: "http://traefik:8080"

    middlewares:
      mcp-auth:
        forwardAuth:
          address: "http://mcpauth:11000/sse"
          authResponseHeaders:
            - "X-Forwarded-User"

      mcp-cors-headers:
        headers:
          accessControlAllowMethods:
            - GET
            - POST
            - OPTIONS
          accessControlAllowOriginList:
            - "*"
          accessControlAllowHeaders:
            - Authorization
            - Content-Type
            - mcp-protocol-version
          accessControlMaxAge: 86400
          accessControlAllowCredentials: true
          addVaryHeader: true

      redirect-regex:
        redirectRegex:
          regex: "^https://([a-z0-9-]+)\\.yourdomain\\.com/\\.well-known/oauth-authorization-server"
          replacement: "https://oauth.yourdomain.com/.well-known/oauth-authorization-server"
          permanent: true

      crowdsec:
        plugin:
          crowdsec:
            enabled: true
            crowdsecAppsecHost: "crowdsec:7422"
            crowdsecAppsecPort: 7422
            crowdsecApiKey: "your-api-key"
            captchaProvider: turnstile
            httpTimeout: 10s
            updateIntervalSeconds: 15
            updateMaxFailures: 0
EOL
fi

# Create basic config.json for middleware-manager
print_status "Creating middleware-manager configuration..."
cat > ./mm_config/config.json << 'EOL'
{
  "active_data_source": "pangolin",
  "data_sources": {
    "pangolin": {
      "type": "pangolin",
      "url": "http://pangolin:3002/api/v1",
      "basic_auth": {
        "username": "",
        "password": ""
      }
    },
    "traefik": {
      "type": "traefik",
      "url": "http://traefik:8080",
      "basic_auth": {
        "username": "",
        "password": ""
      }
    }
  }
}
EOL

# set proper permissions for middleware-manager config
chmod 644 ./mm_config/config.json

# Create service templates
print_status "Creating service templates..."
cat > ./mm_config/templates_services.yaml << 'EOL'
# Service templates for common use cases
templates:
  - name: "Basic LoadBalancer"
    type: "loadbalancer"
    config:
      servers:
        - url: "http://backend:8080"
      healthCheck:
        path: "/health"
        interval: "10s"
        timeout: "3s"

  - name: "Weighted Service"
    type: "weighted"
    config:
      services:
        - name: "service1"
          weight: 2
        - name: "service2"
          weight: 1

  - name: "Failover Service"
    type: "failover"
    config:
      service: "primary"
      fallback: "backup"

  - name: "Mirror Service"
    type: "mirroring"
    config:
      service: "main"
      mirrors:
        - name: "mirror1"
          percent: 10
EOL

# Create middleware templates
print_status "Creating middleware templates..."
cat > ./mm_config/templates.yaml << 'EOL'
# Middleware templates for common use cases
middlewares:
  - id: mcp-auth
    name: MCP Authentication
    type: forwardAuth
    config:
      address: "http://mcpauth:11000/sse"
      authResponseHeaders:
        - "X-Forwarded-User"

  - id: mcp-cors-headers
    name: MCP CORS Headers
    type: headers
    config:
      accessControlAllowMethods:
        - GET
        - POST
        - OPTIONS
      accessControlAllowOriginList:
        - "*"
      accessControlAllowHeaders:
        - Authorization
        - Content-Type
        - mcp-protocol-version
      accessControlMaxAge: 86400
      accessControlAllowCredentials: true
      addVaryHeader: true

  - id: redirect-regex
    name: Regex Redirect
    type: redirectregex
    config:
      regex: "^https://([a-z0-9-]+)\\.yourdomain\\.com/\\.well-known/oauth-authorization-server"
      replacement: "https://oauth.yourdomain.com/.well-known/oauth-authorization-server"
      permanent: true
EOL

# Create docker-compose.yml if it doesn't exist
if [ ! -f ./docker-compose.yml ]; then
    print_status "Creating docker-compose.yml..."
    cat > ./docker-compose.yml << 'EOL'
version: '3.8'

networks:
  traefik:
    driver: bridge
    name: traefik

services:
  # MCPAuth Service
  # mcpauth:
  #   build: .
  #   environment:
  #     - PORT=11000
  #     - CLIENT_ID=${CLIENT_ID}
  #     - CLIENT_SECRET=${CLIENT_SECRET}
  #     - OAUTH_DOMAIN=${OAUTH_DOMAIN}
  #     - ALLOWED_EMAILS=${ALLOWED_EMAILS}
  #   networks:
  #     - pangolin_network
  #   healthcheck:
  #     test: ["CMD", "curl", "-f", "http://localhost:11000/health"]
  #     interval: 30s
  #     timeout: 10s
  #     retries: 3
  #   depends_on:
  #     pangolin:
  #       condition: service_healthy

  # Pangolin Router
  pangolin:
    image: fosrl/pangolin:1.3.0
    container_name: pangolin
    restart: unless-stopped
    volumes:
      - ./pangolin_config:/app/config
    environment:
      - NODE_ENV=development
      - CONFIG_PATH=/app/config/config.yml
      - PORT=3002
    ports:
      - "3002:3002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api/v1/"]
      interval: "10s"
      timeout: "5s"
      retries: 3
      start_period: "30s"
    networks:
      - traefik

  # Gerbil Service
  gerbil:
    image: fosrl/gerbil:1.0.0
    container_name: gerbil
    restart: unless-stopped
    depends_on:
      pangolin:
        condition: service_healthy
    command:
      - --config=/var/config/config.json
      - --reachableAt=http://gerbil:3003
      - --generateAndSaveKeyTo=/var/config/key
      - --log-level=DEBUG
      - --interface=wg0
      - --listen=:3003
    volumes:
      - ./gerbil_config:/var/config
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    ports:
      - "51820:51820/udp"  # WireGuard
      - "80:80"            # HTTP
      - "443:443"          # HTTPS
      - "8080:8080"        # Traefik Dashboard
    networks:
      - traefik

  # Traefik Gateway
  traefik:
    image: traefik:v3.3.3
    container_name: traefik
    restart: unless-stopped
    network_mode: service:gerbil # This is important for Traefik to work with Gerbil
    depends_on:
      pangolin:
        condition: service_healthy
    command:
      - --configFile=/etc/traefik/traefik_config.yml
      - --log.level=DEBUG
      - --accesslog=true
      - --api.dashboard=true
      - --api.insecure=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.docker.network=pangolin
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.traefik.address=:8080
    volumes:
      - ./config/traefik:/etc/traefik:ro # Volume to store the Traefik configuration
      - ./config/letsencrypt:/letsencrypt # Volume to store the Let's Encrypt certificates
      - ./config/traefik/logs:/var/log/traefik # Volume to store Traefik logs
      - ./traefik/plugins-storage:/plugins-storage:rw
      - ./traefik/plugins-storage:/plugins-local:rw
      - ./config/traefik/rules:/rules
      - ./public_html:/var/www/html:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro # Add Docker socket mount
  
  # Middleware Manager
  middleware-manager:
    image: hhftechnology/middleware-manager:v3.0.0
    container_name: middleware-manager
    restart: unless-stopped
    depends_on:
      - pangolin
      - traefik  # This is important for Traefik to work with Gerbil
    volumes:
      - ./mm_data:/data                             # For the SQLite database
      - ./traefik_rules:/conf                     # MUST MATCH Traefik's rule directory
      - ./mm_config/templates.yaml:/app/config/templates.yaml # Optional custom middleware templates
      - ./mm_config/templates_services.yaml:/app/config/templates_services.yaml # Optional custom service templates
      - ./mm_config/config.json:/app/config/config.json       # For data source settings
      # Mount Traefik's static config directory for plugin management
      - ./traefik_static_config:/etc/traefik 
    environment:
      - PANGOLIN_API_URL=http://pangolin:3002/api/v1 # If ACTIVE_DATA_SOURCE is pangolin
      - TRAEFIK_API_URL=http://traefik:8080 # Or http://gerbil:8080 if Traefik API is via Gerbil
      - TRAEFIK_CONF_DIR=/conf
      - DB_PATH=/data/middleware.db
      - PORT=3456
      - ACTIVE_DATA_SOURCE=pangolin # Set to 'pangolin' or 'traefik'
      # Path to Traefik's main static config file *inside this container* (due to volume mount)
      - TRAEFIK_STATIC_CONFIG_PATH=/etc/traefik/traefik_config.yml
      - PLUGINS_JSON_URL=https://raw.githubusercontent.com/hhftechnology/middleware-manager/traefik-int/plugin/plugins.json
      # - DEBUG=true # Optional for development
    ports:
      - "3456:3456"
    networks:
      - traefik

  # Redis for Session Management
  redis:
    image: redis:alpine
    container_name: redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: "10s"
      timeout: "5s"
      retries: 3
    networks:
      - traefik

  # MCP Server (Example with 3 replicas)
  # mcp-server:
  #   image: your-mcp-server-image
  #   deploy:
  #     replicas: 3
  #     update_config:
  #       parallelism: 1
  #       delay: 10s
  #     restart_policy:
  #       condition: on-failure
  #   environment:
  #     - MCP_SERVER_ID=${MCP_SERVER_ID:-mcp-${HOSTNAME}}
  #     - REDIS_URL=redis://redis:6379
  #     - REGISTER_WITH_PANGOLIN=true
  #     - PANGOLIN_API_URL=http://pangolin:3002/api/v1
  #     - PANGOLIN_INTEGRATION_API_URL=http://pangolin:3002/api/v1/integration
  #     - SERVICE_NAME=mcp-server
  #     - SERVICE_PORT=8080
  #     - SERVICE_TYPE=http
  #     - SERVICE_PROTOCOL=http
  #     - SERVICE_DOMAIN=localhost
  #     - SERVICE_PATH=/
  #     - SERVICE_HEALTH_CHECK_PATH=/health
  #     - SERVICE_HEALTH_CHECK_INTERVAL=30s
  #     - SERVICE_HEALTH_CHECK_TIMEOUT=5s
  #     - SERVICE_HEALTH_CHECK_RETRIES=3
  #   networks:
  #     - traefik
  #   depends_on:
  #     - pangolin
  #     - redis
  #   healthcheck:
  #     test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  #     interval: "30s"
  #     timeout: "5s"
  #     retries: 3
  #     start_period: "30s"

volumes:
  redis_data:
EOL
fi

# Set proper permissions
print_status "Setting proper permissions..."
chmod 600 ./mm_config/config.json
chmod 644 ./traefik_static_config/traefik_config.yml
chmod 644 ./docker-compose.yml
chmod 644 ./mm_config/templates.yaml
chmod 644 ./mm_config/templates_services.yaml

# Pull required images
print_status "Pulling required docker images..."
docker-compose pull

# Start the services
print_status "Starting services..."
docker-compose up -d pangolin

# Wait for Pangolin to be healthy
print_status "Waiting for Pangolin to be healthy..."
until docker-compose ps pangolin | grep -q "healthy"; do
    sleep 5
    if [ $((SECONDS)) -gt 60 ]; then
        print_error "Pangolin failed to become healthy within 60 seconds"
        exit 1
    fi
done

# Start remaining services
print_status "Starting remaining services..."
docker-compose up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Check if services are running
print_status "Checking service status..."
docker-compose ps

# Verify service health
print_status "Verifying service health..."
if ! docker-compose ps | grep -q "healthy"; then
    print_warning "Some services may not be healthy. Check logs with: docker-compose logs"
fi

print_status "Setup completed!"
print_status "You can access the middleware-manager UI at: http://localhost:3456"
print_status "Traefik dashboard is available at: http://localhost:8080"
print_warning "Please review and update the following before using in production:"
print_warning "1. Update email in traefik.yml for Let's Encrypt"
print_warning "2. Configure proper authentication in traefik.yml"
print_warning "3. Review and update service and middleware templates"
print_warning "4. Set proper credentials in config.json" 