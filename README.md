# Pangolin Middleware Manager

A microservice that allows you to add custom middleware to Pangolin resources without modifying Pangolin itself.

## Overview

Middleware Manager watches for resources created in Pangolin and allows you to attach additional Traefik middlewares such as authentication providers (Authelia, Authentik) to these resources through a simple UI.


## Features

- Automatically synchronizes with Pangolin resources
- Add authentication middlewares to specific resources
- Support for various middleware types (ForwardAuth, BasicAuth, etc.)
- Template library for common middleware configurations
- Web UI for easy management
- Compatible with Authelia, Authentik, and other Traefik-supported authentication providers

## Prerequisites

- A running Pangolin setup with Traefik
- Docker and Docker Compose

## Quick Start

1. Clone this repository:
   ```
   git clone https://github.com/hhftechnology/middleware-manager.git
   cd middleware-manager
   ```

2. Configure the environment:
   ```
   cp .env.example .env
   # Edit .env with your specific configuration
   ```

3. Start the service:
   ```
   docker compose up -d
   ```

4. Access the UI:
   ```
   http://your-server:3456
   ```

## Configuration

### Environment Variables

- `PANGOLIN_API_URL`: URL of your Pangolin API (default: `http://pangolin:3001/api/v1`)
- `TRAEFIK_CONF_DIR`: Directory to output Traefik configuration (default: `/conf`)
- `DB_PATH`: Path to SQLite database file (default: `/data/middleware.db`)
- `PORT`: Port to run the API server on (default: `3456`)

### Middleware Templates

Custom middleware templates can be added to `config/templates.yaml`. Several default templates are included:

- Authelia
- Authentik
- Basic Auth
- JWT Auth
- Custom ForwardAuth

## Usage

1. Create resources in Pangolin as usual
2. In the Middleware Manager UI, select a resource
3. Choose a middleware type and configure it
4. Save the configuration
5. The middleware will be automatically applied to the resource

## Docker Compose Integration

Add this service to your existing Pangolin `docker-compose.yml`:

```yaml
services:
  middleware-manager:
    image: hhftechmology/middleware-manager:latest
    container_name: middleware-manager
    restart: unless-stopped
    networks:
      - pangolin
    volumes:
      - ./config/traefik/conf:/conf
      - ./data/middleware:/data
    environment:
      - PANGOLIN_API_URL=http://pangolin:3001/api/v1
      - TRAEFIK_CONF_DIR=/conf
    depends_on:
      - pangolin
      - traefik
    ports:
      - "3456:3456"
```

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

### Build Docker Image

```bash
make build
# or 
docker build -t middleware-manager .
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.