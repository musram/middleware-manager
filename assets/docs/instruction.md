# Middleware Manager Setup Instructions

This document provides detailed instructions for setting up and running the Middleware Manager with its complete stack.

## Prerequisites

Before running the setup script, ensure you have the following installed:

- Docker
- Docker Compose
- curl
- Root or sudo access

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/hhftechnology/middleware-manager.git
cd middleware-manager
```

2. Make the setup script executable:
```bash
chmod +x setup.sh
```

3. Run the setup script with sudo:
```bash
sudo ./setup.sh
```

## What the Setup Script Does

The setup script (`setup.sh`) automates the following tasks:

### 1. Prerequisites Check
- Verifies root/sudo access
- Checks for required commands (docker, docker-compose, curl)

### 2. Directory Structure Creation
Creates the following directory structure:
```
./
├── pangolin_config/
├── gerbil_config/
├── traefik_static_config/
├── letsencrypt/
├── traefik_rules/
├── traefik_plugins/
├── mm_data/
├── mm_config/
├── config/
│   └── traefik/
│       └── logs/
└── public_html/
```

### 3. Configuration Files
The script creates or updates the following configuration files:

#### traefik.yml
Basic Traefik configuration with:
- API dashboard enabled
- HTTP and HTTPS entrypoints
- Docker provider configuration
- File provider for dynamic configuration
- Plugin support

#### config.json
Middleware Manager configuration with:
- Pangolin and Traefik data source settings
- Basic authentication configuration
- Active data source selection

#### docker-compose.yml
Complete stack configuration including:
- Pangolin service
- Gerbil VPN service
- Traefik reverse proxy
- Middleware Manager service
- Network configuration
- Volume mappings
- Environment variables

### 4. Security Configuration
- Sets appropriate file permissions:
  - `config.json`: 600 (read/write for owner only)
  - `traefik.yml`: 644 (read for all, write for owner)
  - `docker-compose.yml`: 644 (read for all, write for owner)

### 5. Service Deployment
- Pulls required Docker images
- Starts all services in detached mode
- Waits for services to initialize
- Verifies service status

## Accessing the Services

After successful setup, you can access:

1. **Middleware Manager UI**
   - URL: http://localhost:3456
   - Purpose: Manage middlewares, services, and plugins

2. **Traefik Dashboard**
   - URL: http://localhost:8080
   - Purpose: Monitor and manage Traefik configuration

## Important Notes

1. **Security**
   - The setup creates a basic configuration suitable for development
   - Review and modify security settings before production use
   - Consider enabling authentication for the Traefik dashboard
   - Review and update the `config.json` credentials

2. **Service Dependencies**
   - Services are configured to restart automatically unless stopped
   - Proper health checks are implemented
   - Service startup order is managed through dependencies

3. **Configuration Files**
   - All configuration files are created in their respective directories
   - Review and modify configurations in:
     - `./mm_config/` for Middleware Manager settings
     - `./traefik_static_config/` for Traefik settings
     - `./pangolin_config/` for Pangolin settings

4. **Data Persistence**
   - All data is persisted in the created directories
   - Database is stored in `./mm_data/`
   - Logs are stored in `./config/traefik/logs/`

## Troubleshooting

If you encounter issues:

1. **Service Startup Problems**
   ```bash
   # Check service logs
   docker-compose logs
   
   # Check specific service logs
   docker-compose logs [service-name]
   ```

2. **Configuration Issues**
   - Verify file permissions
   - Check configuration file syntax
   - Ensure all required directories exist

3. **Network Issues**
   - Verify all required ports are available
   - Check network connectivity between services
   - Ensure Docker network is properly configured

## Maintenance

1. **Updating Services**
   ```bash
   # Pull latest images
   docker-compose pull
   
   # Restart services
   docker-compose up -d
   ```

2. **Backup**
   - Regularly backup the following directories:
     - `./mm_data/` (database)
     - `./mm_config/` (configuration)
     - `./traefik_static_config/` (Traefik configuration)

3. **Logs**
   - Monitor logs in `./config/traefik/logs/`
   - Consider implementing log rotation
   - Review logs for any issues or warnings

## Production Considerations

Before deploying to production:

1. **Security**
   - Enable authentication for all services
   - Configure proper TLS certificates
   - Review and update security headers
   - Implement proper access controls

2. **Performance**
   - Adjust resource limits for containers
   - Configure proper logging levels
   - Implement monitoring and alerting
   - Consider high availability setup

3. **Backup**
   - Implement regular backup strategy
   - Test backup and restore procedures
   - Document recovery procedures

## Support

For issues and support:
- Open an issue on GitHub
- Check the documentation
- Review troubleshooting guides
- Contact the development team 