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
       ./config/traefik/rules \
       ./traefik_plugins \
       ./mm_data \
       ./mm_config \
       ./config/traefik \
       ./config/traefik/logs \
       ./public_html \
       ./config/traefik/logs

# Create new directories
mkdir -p ./pangolin_config \
         ./gerbil_config \
         ./traefik_plugins \
         ./mm_data \
         ./mm_config \
         ./config/traefik \
         ./config/letsencrypt \
         ./config/traefik/logs \
         ./config/traefik/rules \
         ./public_html

# Generate MCP_AUTH_TOKEN if not set
if [ -z "$MCP_AUTH_TOKEN" ]; then
    print_status "Generating MCP_AUTH_TOKEN..."
    export MCP_AUTH_TOKEN=$(openssl rand -hex 32)
    print_status "MCP_AUTH_TOKEN generated: $MCP_AUTH_TOKEN"
    # Save to .env file for future use
    echo "MCP_AUTH_TOKEN=$MCP_AUTH_TOKEN" > .env
fi

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
  external_port: 3000
  internal_port: 3001
  next_port: 3002
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

# Debug: Verify config file exists and show its contents
print_status "Verifying Pangolin configuration..."
ls -l ./pangolin_config/config.yml
cat ./pangolin_config/config.yml

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

# Create basic traefik.yml if it doesn't exist
print_status "Creating basic traefik_config.yml configuration..."
cat > ./config/traefik/traefik_config.yml << 'EOL'
# Global configuration
global:
  checkNewVersion: true
  sendAnonymousUsage: false

api:
  dashboard: true
  insecure: true

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
    transport:
      respondingTimeouts:
        readTimeout: "30m"
    http:
      tls:
        certResolver: "letsencrypt"
  traefik:
    address: ":8080"

certificatesResolvers:
  letsencrypt:
    acme:
      email: "admin@deepalign.ai"
      storage: "/letsencrypt/acme.json"
      #caServer: "https://acme-v02.api.letsencrypt.org/directory"  # prod (default)
      #caServer: "https://acme-staging-v02.api.letsencrypt.org/directory"   # staging
      httpChallenge:
        entryPoint: web
      tlsChallenge: {}

providers:
  file:
    directory: "/rules"
    watch: true
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik

log:
  level: DEBUG

accessLog:
  filePath: "/var/log/traefik/access.log"
  bufferingSize: 100
  fields:
    headers:
      names:
        User-Agent: keep

metrics:
  prometheus:
    buckets:
      - 0.1
      - 0.3
      - 1.2
      - 5.0
EOL

# Create Traefik dynamic configuration
print_status "Creating Traefik dynamic configuration..."
cat > ./config/traefik/rules/traefik_dynamic_config.yml << 'EOL'
# Dynamic config for traefik
http:
  routers:
    acme-challenge:
      rule: "Host(`mcp.api.deepalign.ai`) && PathPrefix(`/.well-known/acme-challenge/`)"
      entryPoints:
        - web
      service: "acme-http@internal"
      priority: 1000

    web-to-websecure:
      rule: "Host(`mcp.api.deepalign.ai`)"
      entryPoints:
        - web
      middlewares:
        - redirect-web-to-websecure
      service: "noop@internal"
      priority: 100

    pangolin-app-router-redirect:
      rule: "Host(`mcp.api.deepalign.ai`)"
      entryPoints:
        - web
        - websecure
      service: "pangolin-service"
      middlewares:
        - redirect-web-to-websecure
        - mcp-cors-headers
      tls:
        certResolver: letsencrypt
        domains:
          - main: "mcp.api.deepalign.ai"
      priority: 100

    pangolin-app-router-nextjs:
      rule: "Host(`mcp.api.deepalign.ai`) && !PathPrefix(`/api/v1`)" 
      entryPoints:
        - websecure
      service: "pangolin-service"
      tls:
        certResolver: letsencrypt
        domains:
          - main: "mcp.api.deepalign.ai"

    pangolin-app-router-api:
      rule: "Host(`mcp.api.deepalign.ai`) && PathPrefix(`/api/v1`)"
      entryPoints:
        - websecure
      service: "pangolin-api-service"
      tls:
        certResolver: letsencrypt
        domains:
          - main: "mcp.api.deepalign.ai"

    pangolin-app-router-websocket:
      rule: "Host(`mcp.api.deepalign.ai`)"
      entryPoints:
        - websecure
      service: "pangolin-api-service"
      tls:
        certResolver: letsencrypt
        domains:
          - main: "mcp.api.deepalign.ai"

    traefik-dashboard:
      rule: "Host(`mcp.api.deepalign.ai`) && PathPrefix(`/dashboard`)"
      entryPoints:
        - traefik
      service: "traefik-service"
      middlewares:
        - mcp-cors-headers
        - mcp-auth-headers
        - mcp-auth
      tls:
        certResolver: letsencrypt
        domains:
          - main: "mcp.api.deepalign.ai"

    mcp-auth-router:
      rule: "Host(`mcp.api.deepalign.ai`) && PathPrefix(`/sse`)"
      entryPoints:
        - websecure
      service: "mcp-auth-service"
      middlewares:
        - mcp-cors-headers
      tls:
        certResolver: letsencrypt
        domains:
          - main: "mcp.api.deepalign.ai"
      priority: 200

    middleware-manager-router:
      rule: "Host(`mcp.api.deepalign.ai`) && PathPrefix(`/middleware`)"
      entryPoints:
        - websecure
      service: "middleware-manager-service"
      middlewares:
        - mcp-cors-headers
        - mcp-auth-headers
        - mcp-auth
      tls:
        certResolver: letsencrypt
        domains:
          - main: "mcp.api.deepalign.ai"

  services:
    pangolin-service:
      loadBalancer:
        servers:
          - url: "http://pangolin:3002"

    pangolin-api-service:
      loadBalancer:
        servers:
          - url: "http://pangolin:3000/api/v1"  

    traefik-service:
      loadBalancer:
        servers:
          - url: "http://traefik:8080"

    mcp-auth-service:
      loadBalancer:
        passHostHeader: true
        responseForwarding:
          flushInterval: "100ms"
        servers:
          - url: "http://mcpauth:11000"
        strategy: "wrr"

    middleware-manager-service:
      loadBalancer:
        servers:
          - url: "http://middleware-manager:3456"

  middlewares:
    redirect-web-to-websecure:
      redirectScheme:
        scheme: https
        permanent: true

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
          - Cookie
        accessControlMaxAge: 86400
        accessControlAllowCredentials: true
        addVaryHeader: true

    mcp-auth:
      forwardAuth:
        address: "http://mcpauth:11000/sse"
        authResponseHeaders:
          - "Authorization"
          - "X-User-Email"
          - "X-User-Name"
          - "Cookie"
          - "X-Forwarded-User"
        maxBodySize: -1
        trustForwardHeader: true
        preserveRequestMethod: true

    mcp-auth-headers:
      headers:
        customRequestHeaders:
          Authorization: "Bearer ${MCP_AUTH_TOKEN}"
          X-User-Email: "admin@example.com"
          X-User-Name: "admin"
          Cookie: "session_token=1234567890"
          X-Forwarded-User: "admin"

EOL

# Set proper permissions for Traefik configs
chmod 644 ./config/traefik/traefik_config.yml
chmod 644 ./config/traefik/rules/traefik_dynamic_config.yml

# Create basic config.json for middleware-manager
print_status "Creating middleware-manager configuration..."
cat > ./mm_config/config.json << 'EOL'
{
  "active_data_source": "pangolin",
  "data_sources": {
    "pangolin": {
      "type": "pangolin",
      "url": "http://pangolin:3001/api/v1",
      "auth": {
        "type": "basic",
        "username": "admin@example.com",
        "password": "Password123!"
      }
    },
    "traefik": {
      "type": "traefik",
      "url": "http://traefik:8080",
      "basic_auth": {
        "username": "",
        "password": ""
      }
    },
    "mcpauth": {
      "type": "mcpauth",
      "url": "http://mcpauth:11000",
      "auth": {
        "type": "bearer",
        "token": "${MCP_AUTH_TOKEN}"
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
    name: Authentication Middleware
    type: forwardAuth
    config:
      address: "http://pangolin:3001/api/v1/auth/verify"
      trustForwardHeader: true
      authResponseHeaders:
        - "Authorization"
        - "X-User-Email"
        - "X-User-Name"
        - "Cookie"
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
        - Cookie
      accessControlMaxAge: 86400
      accessControlAllowCredentials: true
      addVaryHeader: true

  - id: redirect-regex
    name: Regex Redirect
    type: redirectregex
    config:
      regex: "^https://([a-z0-9-]+)\\.mcp\\.api\\.deepalign\\.ai/\\.well-known/oauth-authorization-server"
      replacement: "https://oauth.mcp.api.deepalign.ai/.well-known/oauth-authorization-server"
      permanent: true
EOL

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
print_status "You can access the middleware-manager UI at: http://mcp.api.deepalign.ai:3456"
print_status "Traefik dashboard is available at: http://mcp.api.deepalign.ai:8080"
print_status "Pangolin app is available at: https://mcp.api.deepalign.ai"
print_warning "Please review and update the following before using in production:"
print_warning "1. Update email in traefik.yml for Let's Encrypt"
print_warning "2. Configure proper authentication in traefik.yml"
print_warning "3. Review and update service and middleware templates"
print_warning "4. Set proper credentials in config.json"

# Create MCP Auth configuration
print_status "Creating MCP Auth configuration..."
cat > ./config/traefik/rules/mcp_auth.yml << 'EOL'
http:
  middlewares:
    mcp-auth:
      forwardAuth:
        address: "http://mcpauth:11000/sse"
        authResponseHeaders:
          - "Authorization"
          - "X-User-Email"
          - "X-User-Name"
          - "Cookie"
          - "X-Forwarded-User"
        maxBodySize: -1
        trustForwardHeader: true
        preserveRequestMethod: true

  services:
    mcp-auth-service:
      loadBalancer:
        passHostHeader: true
        responseForwarding:
          flushInterval: "100ms"
        servers:
          - url: "http://mcpauth:11000"
        strategy: "wrr"
EOL

# Set proper permissions
chmod 644 ./config/traefik/rules/mcp_auth.yml 