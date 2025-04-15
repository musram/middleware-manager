# Pangolin Middleware Manager

A specialized microservice that enhances your Pangolin deployment by enabling custom Traefik middleware attachment to resources without modifying Pangolin itself. This provides crucial functionality for implementing authentication, security headers, rate limiting, and other middleware-based protections.

## Overview

The Middleware Manager monitors resources created in Pangolin and provides a simple web interface to attach additional Traefik middlewares to these resources. This allows you to implement advanced functionality such as:

- Authentication layers (Authelia, Authentik, Basic Auth)
- Security headers and content policies
- Geographic IP blocking
- Rate limiting and DDoS protection
- Custom redirect and path manipulation rules
- Integration with security tools like CrowdSec

When you add a middleware to a resource through the Middleware Manager, it creates Traefik configuration files that properly reference both the middleware and the original service with the correct provider references.

## Key Features

- **Real-time synchronization** with Pangolin resources
- **Web-based management UI** for easy configuration
- **Template library** for common middleware setups
- **Cross-provider integration** that properly references Traefik resources
- **Database persistence** for configuration storage
- **Wide middleware support** including ForwardAuth, BasicAuth, Headers, RateLimit, and more
- **Plugin compatibility** with Traefik v2/v3 plugins like CrowdSec, GeoBlock, and CloudflareWarp

## Prerequisites

- A working Pangolin deployment (with Traefik v2.x or v3.x)
- Docker and Docker Compose
- Network connectivity between the Middleware Manager and Pangolin's API

## Quick Start

### Using Docker Compose

Add the Middleware Manager to your existing Pangolin `docker-compose.yml`:

```yaml
middleware-manager:
  image: hhftechnology/middleware-manager:latest
  container_name: middleware-manager
  restart: unless-stopped
  volumes:
    - ./data:/data
    - ./config/traefik/rules:/conf
    - ./config/middleware-manager/templates.yaml:/app/config/templates.yaml  # Optional for custom templates
  environment:
    - PANGOLIN_API_URL=http://pangolin:3001/api/v1
    - TRAEFIK_CONF_DIR=/conf
    - DB_PATH=/data/middleware.db
    - PORT=3456
  ports:
    - "3456:3456"
```

Start the service:

```bash
docker-compose up -d middleware-manager
```

Access the UI:
```
http://your-server:3456
```

### Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/hhftechnology/middleware-manager.git
   cd middleware-manager
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your specific configuration
   ```

3. Build and start the service:
   ```bash
   make build
   ./middleware-manager
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PANGOLIN_API_URL` | URL to your Pangolin API | `http://pangolin:3001/api/v1` |
| `TRAEFIK_CONF_DIR` | Directory to write Traefik configurations | `/conf` |
| `DB_PATH` | Path to SQLite database | `/data/middleware.db` |
| `PORT` | Port for web UI and API | `3456` |
| `CHECK_INTERVAL_SECONDS` | How often to check for new resources (seconds) | `30` |
| `GENERATE_INTERVAL_SECONDS` | How often to update configuration files (seconds) | `10` |
| `DEBUG` | Enable debug logging | `false` |
| `ALLOW_CORS` | Enable CORS for API | `false` |
| `CORS_ORIGIN` | Allowed CORS origin | `""` (all) |

### Custom Middleware Templates

Create a file at `./config/middleware-manager/templates.yaml` with this structure:

```yaml
middlewares:
  - id: "security-headers"
    name: "Strong Security Headers"
    type: "headers"
    config:
      customResponseHeaders:
        Server: ""
        X-Powered-By: ""
      browserXSSFilter: true
      contentTypeNosniff: true
      customFrameOptionsValue: "SAMEORIGIN"
      forceSTSHeader: true
      stsIncludeSubdomains: true
      stsSeconds: 63072000
      
  - id: "rate-limit"
    name: "Standard Rate Limiting"
    type: "rateLimit"
    config:
      average: 100
      burst: 50
      
  # Add more middleware templates as needed
```

## Usage Guide

### Adding Middleware to a Resource

1. Create resources in Pangolin as usual
2. Open the Middleware Manager UI (`http://your-server:3456`)
3. Navigate to the "Resources" tab
4. Click "Manage" next to the resource you want to protect
5. Click "Add Middleware"
6. Select a middleware from the dropdown (or create a new one)
7. Set the priority value if needed (higher numbers have lower precedence)
8. Click "Add Middleware"
9. The middleware will be automatically applied to the resource

### Creating Custom Middleware

1. In the Middleware Manager UI, navigate to the "Middlewares" tab
2. Click "Create Middleware"
3. Enter a name for your middleware
4. Select the middleware type (ForwardAuth, BasicAuth, Headers, etc.)
5. Configure the middleware settings using the JSON editor
6. Click "Create Middleware"
7. The new middleware will be available to assign to resources

## Important: Understanding Cross-Provider References

The Middleware Manager works by creating Traefik configurations that reference services defined by Pangolin. For this to work correctly, services and middlewares need proper provider references:

- When your file-based configuration references a service defined by Pangolin, it needs the `@http` suffix
- When your file-based configuration references a middleware defined by Pangolin, it needs the `@http` suffix
- Conversely, middlewares defined in your file need the `@file` suffix when referenced

The Middleware Manager automatically handles these references for you, but it's important to understand this if you encounter any "service/middleware does not exist" errors in Traefik.

## Traefik Plugin Integration

To use Traefik plugins like CrowdSec, GeoBlock, or CloudflareWarp:

1. Add the plugin to your Traefik static configuration:
   ```yaml
   # In traefik_config.yml
   experimental:
     plugins:
       crowdsec:
         moduleName: github.com/crowdsecurity/traefik-plugin-crowdsec
         version: v1.4.2
       geoblock:
         moduleName: github.com/PascalMinder/geoblock
         version: v0.3.2
   ```

2. Add the plugin middleware template to your templates.yaml:
   ```yaml
   middlewares:
     - id: "crowdsec-protection"
       name: "CrowdSec Security Protection"
       type: "plugin"
       config:
         plugin:
           crowdsec:
             enabled: true
             # Additional configuration...
   ```

3. The plugin middleware will now be available in the Middleware Manager UI

## Troubleshooting

### "The service does not exist" error in Traefik logs

This usually means the cross-provider reference isn't working correctly. The Middleware Manager should automatically use `@http` suffix for Pangolin services, but if you see this error:

1. Check if the middleware configuration file was generated correctly in your `/conf` directory
2. Verify that service references include the `@http` suffix
3. Restart the Middleware Manager

### "The middleware does not exist" error in Traefik logs

Similar to the service error, but for middlewares:

1. Check if the middleware is properly defined
2. Ensure Pangolin-defined middlewares have an `@http` suffix when referenced
3. Check if the middleware requires a Traefik plugin that isn't installed

### Middleware not being applied

1. Check Traefik's dashboard for routing information
2. Verify the middleware is correctly associated with the resource
3. Check the middleware priority (lower numbers have higher precedence)
4. Look for errors in the Traefik logs

## Development

### Prerequisites

- Go 1.19+
- Node.js 16+
- npm or yarn

### Backend Development

```bash
# Run backend in development mode
go run main.go

# Build backend
go build -o middleware-manager
```

### Frontend Development

```bash
cd ui
npm install
npm start
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
