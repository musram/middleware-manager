# Middleware Manager Integration Guide

This document describes how to integrate the Middleware Manager with a complex microservices architecture involving Traefik, CrowdSec, Pangolin, and FastMCP.

## Architecture Overview

```
Client --> Traefik --> CrowdSec Bouncer --> Pangolin --> FastMCP --> Internal Tools
                      (Traefik Plugin)     (Session Router)   (SSE/JSON-RPC)
```

### Component Details

1. **Client (e.g., MCP Inspector)**
   - Makes HTTPS requests to the gateway

2. **Traefik (MCP Gateway)**
   - TLS termination
   - Routing
   - Applies Forward Auth Middleware
   - Applies CrowdSec Bouncer

3. **CrowdSec Bouncer**
   - Blocks/filters malicious clients based on CrowdSec decisions
   - Deployed as a Traefik plugin

4. **Pangolin**
   - Handles session-aware routing
   - Maps sessionId → correct FastMCP backend
   - Uses Gerbil/Newt to manage WireGuard tunnels
   - Securely exposes FastMCP behind WireGuard
   - Integrates with Redis for session storage
   - Integrates with Prometheus for metrics

5. **WireGuard Tunnel**
   - Pangolin <--> FastMCP (private)
   - Secure channel so FastMCP is **not exposed publicly**

6. **FastMCP**
   - Implements Server-Sent Events (SSE) and JSON-RPC
   - Stateless; offloads auth to gateway

7. **Internal Tools**
   - Local tools/resources invoked by FastMCP

8. **CrowdSec Agent**
   - Monitors traffic logs from Traefik
   - Sends decisions to Redis or Bouncer

9. **Redis**
   - Stores sessions and CrowdSec decision cache

10. **Prometheus**
    - Collects metrics (Traefik, Pangolin, etc.)

## Middleware Manager Integration

The Middleware Manager enhances this architecture by providing a user-friendly interface to manage Traefik configurations, middlewares, and plugins. Here's how it integrates with each component:

### 1. Integration with Traefik and CrowdSec Bouncer

The Middleware Manager provides:
- Custom middleware management (including CrowdSec Bouncer plugin)
- Router configurations
- Service definitions
- Plugin management

#### CrowdSec Bouncer Integration
- Install and configure CrowdSec Bouncer as a Traefik plugin
- Manage bouncer configurations through UI
- Enable/disable bouncer for specific routes

#### Traefik Enhancement
- TLS termination configuration
- Routing rules management
- Forward Auth middleware configuration
- Centralized Traefik configuration management

### 2. Integration with Pangolin

The Middleware Manager supports two data sources:
- Direct Traefik API connection
- Pangolin API integration

For this architecture, use Pangolin integration to:
- Discover resources through Pangolin
- Manage session-aware routing configurations
- Integrate with existing Pangolin setup

### 3. Integration Configuration

```yaml
services:
  middleware-manager:
    image: hhftechnology/middleware-manager:v3.0.0
    container_name: middleware-manager
    restart: unless-stopped
    depends_on:
      - pangolin
      - traefik
    volumes:
      - ./mm_data:/data
      - ./traefik_rules:/conf
      - ./mm_config:/app/config
      - ./traefik_static_config:/etc/traefik
    environment:
      - PANGOLIN_API_URL=http://pangolin:3001/api/v1
      - TRAEFIK_API_URL=http://traefik:8080
      - TRAEFIK_CONF_DIR=/conf
      - DB_PATH=/data/middleware.db
      - PORT=3456
      - ACTIVE_DATA_SOURCE=pangolin
      - TRAEFIK_STATIC_CONFIG_PATH=/etc/traefik/traefik.yml
    networks:
      - pangolin_network
```

### 4. Key Benefits

#### Security Layer Management
- Centralized management of CrowdSec Bouncer configurations
- Easy configuration of Forward Auth middleware
- TLS certificate management
- Security headers configuration

#### Routing and Service Management
- Visual interface for managing Pangolin's session-aware routing
- Service discovery through Pangolin
- Load balancing configuration
- Health check management

#### Plugin Management
- Easy installation and configuration of the CrowdSec Bouncer plugin
- Management of other security-related plugins
- Version control of plugins

### 5. Integration Points

```
Client --> Traefik --> [Middleware Manager] --> CrowdSec Bouncer --> Pangolin --> FastMCP
                      (Manages Config)        (Plugin)            (Data Source)
```

The Middleware Manager connects to:
- **Traefik**: Manages all Traefik configurations
- **CrowdSec Bouncer**: Installs and configures as a plugin
- **Pangolin**: Uses as a data source for service discovery
- **Redis**: Can be configured for session storage
- **Prometheus**: Can be configured for metrics collection

### 6. Additional Features

- **Template Libraries**: Pre-configured templates for common security middlewares
- **Real-time Synchronization**: Keeps configurations in sync with services
- **Web-Based UI**: Easy management of all components
- **Cross-Provider Integration**: Works with multiple Traefik providers
- **Database Persistence**: Stores all configurations in SQLite

## Getting Started

1. Deploy the Middleware Manager using the provided docker-compose configuration
2. Configure it to use Pangolin as the data source
3. Install the CrowdSec Bouncer plugin through the UI
4. Configure security middlewares and routing rules
5. Monitor and manage your stack through the web interface

## Additional Clarifications

- The **CrowdSec Agent** works **out-of-band** and analyzes logs (e.g., from Traefik)
- The **CrowdSec Bouncer plugin** runs **inline** and blocks requests in real time
- **Pangolin** does not replace Traefik; it works behind it as a tunnel endpoint and intelligent router
- **FastMCP servers are not directly exposed** — they sit behind Pangolin and WireGuard

## Troubleshooting

1. **Plugin Issues**:
   - Verify `TRAEFIK_STATIC_CONFIG_PATH` points to the correct path
   - Ensure Traefik is restarted after plugin installation/removal
   - Check Traefik logs for plugin loading errors
   - Verify plugin `moduleName` and `version` in static config

2. **Integration Issues**:
   - Check network connectivity between components
   - Verify API endpoints are accessible
   - Ensure proper volume mounts for configuration files
   - Check logs for any connection or configuration errors 