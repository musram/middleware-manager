# Network Setup and Port Configuration

This document explains how the networking and port configuration works in the middleware manager setup with Pangolin, Gerbil, and Traefik.

## Overview

The setup uses a combination of Docker networking and port sharing to enable secure access to services through WireGuard VPN and HTTP/HTTPS traffic.

## Network Architecture

### Container Network Mode
- Gerbil is the main container that exposes ports 80, 443, and 8080
- Traefik uses `network_mode: service:gerbil`, sharing Gerbil's network namespace
- This means Traefik's ports are actually exposed through Gerbil
- Ports are defined in the Gerbil service, not in Traefik

### Traefik API Access
Since Traefik shares Gerbil's network namespace, you can access Traefik's API in two ways:
- `http://traefik:8080` (internal Docker network)
- `http://gerbil:8080` (also works because they share the same network namespace)

Both URLs will work, but `http://traefik:8080` is more explicit and preferred.

## Domain and Port Mapping

When accessing `mcp.api.deepalign.ai`:
1. The request comes to port 80 (HTTP) or 443 (HTTPS)
2. These ports are exposed by Gerbil
3. Traefik (running in Gerbil's network namespace) receives the request
4. Traefik routes the request based on the domain name to the appropriate service

## Traffic Flow
```
External Request → Port 80/443 (Gerbil) → Traefik → Pangolin/Middleware Manager
```

## Why This Setup?

### Benefits
- Gerbil handles the WireGuard VPN and port forwarding
- Traefik runs inside Gerbil's network to handle HTTP/HTTPS traffic
- This allows Traefik to work with WireGuard while still handling web traffic

### Port Usage
The ports 80 and 443 are used by `mcp.api.deepalign.ai` because:
1. When someone visits `mcp.api.deepalign.ai`, their browser connects to port 443 (HTTPS)
2. This connection hits Gerbil's exposed port 443
3. Traefik (running in Gerbil's network) receives the request
4. Traefik routes it to the appropriate service based on the domain name

## Configuration Example

```yaml
services:
  gerbil:
    # ... other config ...
    ports:
      - "51820:51820/udp"  # WireGuard
      - "80:80"            # HTTP
      - "443:443"          # HTTPS
      - "8080:8080"        # Traefik Dashboard

  traefik:
    # ... other config ...
    network_mode: service:gerbil  # Share Gerbil's network namespace

  middleware-manager:
    # ... other config ...
    environment:
      - TRAEFIK_API_URL=http://traefik:8080  # Access Traefik API
```

## Best Practices

1. Always use `http://traefik:8080` for Traefik API access in configurations
2. Keep port mappings in the Gerbil service configuration
3. Ensure all services are on the same Docker network
4. Use HTTPS (port 443) for production traffic
5. Keep Traefik's network mode as `service:gerbil` for proper integration

## Troubleshooting

If you encounter networking issues:
1. Verify that Gerbil is exposing the correct ports
2. Check that Traefik is using the correct network mode
3. Ensure all services can communicate on the Docker network
4. Verify that the domain name is correctly pointing to your server's IP
5. Check Traefik's logs for routing issues 