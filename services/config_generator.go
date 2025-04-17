package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/hhftechnology/middleware-manager/database"
	"gopkg.in/yaml.v3"
)

// ConfigGenerator generates Traefik configuration files
type ConfigGenerator struct {
	db             *database.DB
	confDir        string
	stopChan       chan struct{}
	isRunning      bool
	mutex          sync.Mutex // Protects isRunning
	lastConfig     []byte     // Stores the last written configuration for comparison
	lastConfigHash string     // Hash of the last configuration for quicker comparison
}

// TraefikConfig represents the structure of the Traefik configuration
type TraefikConfig struct {
	HTTP struct {
		Middlewares map[string]interface{} `yaml:"middlewares,omitempty"`
		Routers     map[string]interface{} `yaml:"routers,omitempty"`
	} `yaml:"http"`
	
	TCP struct {
		Routers     map[string]interface{} `yaml:"routers,omitempty"`
	} `yaml:"tcp,omitempty"`
}

// NewConfigGenerator creates a new config generator
func NewConfigGenerator(db *database.DB, confDir string) *ConfigGenerator {
	return &ConfigGenerator{
		db:             db,
		confDir:        confDir,
		stopChan:       make(chan struct{}),
		isRunning:      false,
		lastConfig:     nil,
		lastConfigHash: "",
	}
}

// Start begins generating configuration files
func (cg *ConfigGenerator) Start(interval time.Duration) {
	cg.mutex.Lock()
	if cg.isRunning {
		cg.mutex.Unlock()
		return
	}
	cg.isRunning = true
	cg.mutex.Unlock()
	
	log.Printf("Config generator started, checking every %v", interval)

	// Create conf directory if it doesn't exist
	if err := os.MkdirAll(cg.confDir, 0755); err != nil {
		log.Printf("Failed to create conf directory: %v", err)
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Generate initial configuration
	if err := cg.generateConfig(); err != nil {
		log.Printf("Initial config generation failed: %v", err)
	}

	for {
		select {
		case <-ticker.C:
			if err := cg.generateConfig(); err != nil {
				log.Printf("Config generation failed: %v", err)
			}
		case <-cg.stopChan:
			log.Println("Config generator stopped")
			return
		}
	}
}

// Stop stops the config generator
func (cg *ConfigGenerator) Stop() {
	cg.mutex.Lock()
	defer cg.mutex.Unlock()
	
	if !cg.isRunning {
		return
	}
	
	close(cg.stopChan)
	cg.isRunning = false
}

// generateConfig generates Traefik configuration files
func (cg *ConfigGenerator) generateConfig() error {
	log.Println("Generating Traefik configuration...")

	// Create a new configuration
	config := TraefikConfig{}
	config.HTTP.Middlewares = make(map[string]interface{})
	config.HTTP.Routers = make(map[string]interface{})
	config.TCP.Routers = make(map[string]interface{})

	// Process middlewares
	if err := cg.processMiddlewares(&config); err != nil {
		return fmt.Errorf("failed to process middlewares: %w", err)
	}

	// Process HTTP resources
	if err := cg.processResources(&config); err != nil {
		return fmt.Errorf("failed to process HTTP resources: %w", err)
	}
	
	// Process TCP resources
	if err := cg.processTCPRouters(&config); err != nil {
		return fmt.Errorf("failed to process TCP resources: %w", err)
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to convert config to YAML: %w", err)
	}

	// Check if configuration has changed
	if cg.hasConfigurationChanged(yamlData) {
		// Write configuration to file
		if err := cg.writeConfigToFile(yamlData); err != nil {
			return fmt.Errorf("failed to write config to file: %w", err)
		}
		log.Printf("Generated new Traefik configuration at %s", filepath.Join(cg.confDir, "resource-overrides.yml"))
	} else {
		log.Println("Configuration unchanged, skipping file write")
	}

	return nil
}

// hasConfigurationChanged checks if the configuration has changed
func (cg *ConfigGenerator) hasConfigurationChanged(newConfig []byte) bool {
	// If we don't have a previous configuration, this is the first run
	if cg.lastConfig == nil {
		cg.lastConfig = newConfig
		return true
	}

	// Quick length check before doing a full comparison
	if len(cg.lastConfig) != len(newConfig) {
		cg.lastConfig = newConfig
		return true
	}

	// Do a full byte-by-byte comparison
	if string(cg.lastConfig) != string(newConfig) {
		cg.lastConfig = newConfig
		return true
	}

	return false
}

// writeConfigToFile writes the configuration to a file
func (cg *ConfigGenerator) writeConfigToFile(yamlData []byte) error {
	// Create temporary file first to ensure atomic write
	configFile := filepath.Join(cg.confDir, "resource-overrides.yml")
	tempFile := configFile + ".tmp"

	// Write to temporary file
	if err := os.WriteFile(tempFile, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write temp config file: %w", err)
	}

	// Rename temp file to final file (atomic operation)
	if err := os.Rename(tempFile, configFile); err != nil {
		return fmt.Errorf("failed to rename temp config file: %w", err)
	}

	return nil
}

// processMiddlewares fetches and processes all middleware definitions
func (cg *ConfigGenerator) processMiddlewares(config *TraefikConfig) error {
	// Fetch all middlewares
	rows, err := cg.db.Query("SELECT id, name, type, config FROM middlewares")
	if err != nil {
		return fmt.Errorf("failed to fetch middlewares: %w", err)
	}
	defer rows.Close()

	// Process middlewares
	for rows.Next() {
		var id, name, typ, configStr string
		if err := rows.Scan(&id, &name, &typ, &configStr); err != nil {
			log.Printf("Failed to scan middleware: %v", err)
			continue
		}

		// Parse middleware config
		var middlewareConfig map[string]interface{}
		if err := json.Unmarshal([]byte(configStr), &middlewareConfig); err != nil {
			log.Printf("Failed to parse middleware config for %s: %v", name, err)
			continue
		}

		// Special handling for chain middlewares to ensure proper provider prefixes
		if typ == "chain" && middlewareConfig["middlewares"] != nil {
			if middlewares, ok := middlewareConfig["middlewares"].([]interface{}); ok {
				for i, middleware := range middlewares {
					if middlewareStr, ok := middleware.(string); ok {
						// If this is not already a fully qualified middleware reference
						if !strings.Contains(middlewareStr, "@") {
							// Assume it's from our file provider
							middlewares[i] = fmt.Sprintf("%s@file", middlewareStr)
						}
					}
				}
				middlewareConfig["middlewares"] = middlewares
			}
		}

		// Add middleware to config
		config.HTTP.Middlewares[id] = map[string]interface{}{
			typ: middlewareConfig,
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error during middleware rows iteration: %w", err)
	}

	return nil
}

// MiddlewareWithPriority represents a middleware with its priority value
type MiddlewareWithPriority struct {
    ID       string
    Priority int
}

// processResources fetches and processes all resources and their middlewares
func (cg *ConfigGenerator) processResources(config *TraefikConfig) error {
    // Fetch all active resources with custom headers
    rows, err := cg.db.Query(`
        SELECT r.id, r.host, r.service_id, r.entrypoints, r.tls_domains, 
               r.custom_headers, rm.middleware_id, rm.priority
        FROM resources r
        LEFT JOIN resource_middlewares rm ON r.id = rm.resource_id
        WHERE r.status = 'active'
        ORDER BY r.id, rm.priority DESC
    `)
    if err != nil {
        return fmt.Errorf("failed to fetch resources: %w", err)
    }
    defer rows.Close()

    // Group middlewares by resource and preserve priority
    resourceMiddlewares := make(map[string][]MiddlewareWithPriority)
    resourceInfo := make(map[string]struct {
        Host          string
        ServiceID     string
        Entrypoints   string
        TLSDomains    string
        CustomHeaders string
    })

    for rows.Next() {
        var resourceID, host, serviceID, entrypoints, tlsDomains, customHeaders string
        var middlewareID sql.NullString
        var priority sql.NullInt64
        
        if err := rows.Scan(&resourceID, &host, &serviceID, &entrypoints, &tlsDomains, 
                           &customHeaders, &middlewareID, &priority); err != nil {
            log.Printf("Failed to scan resource middleware: %v", err)
            continue
        }
        
        if middlewareID.Valid {
            middleware := MiddlewareWithPriority{
                ID:       middlewareID.String,
                Priority: int(priority.Int64),
            }
            resourceMiddlewares[resourceID] = append(resourceMiddlewares[resourceID], middleware)
        }
        
        resourceInfo[resourceID] = struct {
            Host          string
            ServiceID     string
            Entrypoints   string
            TLSDomains    string
            CustomHeaders string
        }{
            Host:          host,
            ServiceID:     serviceID,
            Entrypoints:   entrypoints,
            TLSDomains:    tlsDomains,
            CustomHeaders: customHeaders,
        }
    }

    if err := rows.Err(); err != nil {
        return fmt.Errorf("error during resource rows iteration: %w", err)
    }

    // Create routers for resources with custom middlewares
    for resourceID, middlewares := range resourceMiddlewares {
        info, exists := resourceInfo[resourceID]
        if !exists {
            log.Printf("Warning: Resource info not found for %s", resourceID)
            continue
        }
        
        // Sort middlewares by priority (higher numbers first)
        sort.Slice(middlewares, func(i, j int) bool {
            return middlewares[i].Priority > middlewares[j].Priority
        })
        
        // Process entrypoints (comma-separated list to array)
        entrypoints := []string{"websecure"} // Default
        if info.Entrypoints != "" {
            // Split by comma and trim spaces
            rawEntrypoints := strings.Split(info.Entrypoints, ",")
            entrypoints = make([]string, 0, len(rawEntrypoints))
            for _, ep := range rawEntrypoints {
                trimmed := strings.TrimSpace(ep)
                if trimmed != "" {
                    entrypoints = append(entrypoints, trimmed)
                }
            }
            
            // If after processing we have no valid entrypoints, use the default
            if len(entrypoints) == 0 {
                entrypoints = []string{"websecure"}
            }
        }
        
        // Process custom headers if present
        var customHeadersMiddleware string
        if info.CustomHeaders != "" && info.CustomHeaders != "{}" && info.CustomHeaders != "null" {
            // Parse the custom headers
            var customHeaders map[string]string
            if err := json.Unmarshal([]byte(info.CustomHeaders), &customHeaders); err != nil {
                log.Printf("Failed to parse custom headers for resource %s: %v", resourceID, err)
            } else if len(customHeaders) > 0 {
                // Create a custom headers middleware
                customHeadersMiddlewareID := fmt.Sprintf("%s-custom-headers", resourceID)
                
                // Add the middleware to the config
                config.HTTP.Middlewares[customHeadersMiddlewareID] = map[string]interface{}{
                    "headers": map[string]interface{}{
                        "customRequestHeaders": customHeaders,
                    },
                }
                
                // Add reference with file provider suffix
                customHeadersMiddleware = fmt.Sprintf("%s@file", customHeadersMiddlewareID)
            }
        }
        
        // Extract middleware IDs from the sorted slice
        var middlewareIDs []string
        
        // Add custom headers middleware at the beginning if it exists
        if customHeadersMiddleware != "" {
            middlewareIDs = append(middlewareIDs, customHeadersMiddleware)
        }
        
        // Add sorted middlewares
        for _, mw := range middlewares {
            middlewareIDs = append(middlewareIDs, mw.ID)
        }
        
        // Add "badger" middleware with http provider suffix if not already present
        if !stringSliceContains(middlewareIDs, "badger@http") {
            middlewareIDs = append(middlewareIDs, "badger@http")
        }

        // Process middleware references to add provider suffixes
        for i, middleware := range middlewareIDs {
            // If this is not already a fully qualified middleware reference and not the Pangolin badger middleware
            if !strings.Contains(middleware, "@") && middleware != "badger@http" && middleware != customHeadersMiddleware {
                // Assume it's from our file provider
                middlewareIDs[i] = fmt.Sprintf("%s@file", middleware)
            }
        }

        // Create a router with higher priority
        customRouterID := fmt.Sprintf("%s-auth", resourceID)
        
        // Basic router configuration
        routerConfig := map[string]interface{}{
            "rule":        fmt.Sprintf("Host(`%s`)", info.Host),
            "service":     fmt.Sprintf("%s@http", info.ServiceID),  // Reference service from http provider
            "entryPoints": entrypoints,
            "middlewares": middlewareIDs,
            "priority":    100, // Higher than Pangolin's default
        }
        
        // Add TLS configuration with optional domains for certificate
        if info.TLSDomains != "" {
            // Parse the comma-separated domains
            domains := strings.Split(info.TLSDomains, ",")
            // Clean up the domains
            var cleanDomains []string
            for _, domain := range domains {
                domain = strings.TrimSpace(domain)
                if domain != "" {
                    cleanDomains = append(cleanDomains, domain)
                }
            }
            
            if len(cleanDomains) > 0 {
                // Create TLS configuration with domains
                tlsConfig := map[string]interface{}{
                    "certResolver": "letsencrypt",
                    "domains": []map[string]interface{}{
                        {
                            "main": info.Host,
                            "sans": cleanDomains,
                        },
                    },
                }
                routerConfig["tls"] = tlsConfig
            } else {
                // Default TLS config if no additional domains
                routerConfig["tls"] = map[string]interface{}{
                    "certResolver": "letsencrypt",
                }
            }
        } else {
            // Default TLS config
            routerConfig["tls"] = map[string]interface{}{
                "certResolver": "letsencrypt",
            }
        }
        
        config.HTTP.Routers[customRouterID] = routerConfig
    }

    return nil
}

// processTCPRouters fetches and processes all resources with TCP SNI routing enabled
func (cg *ConfigGenerator) processTCPRouters(config *TraefikConfig) error {
	// Fetch resources with TCP routing enabled
	rows, err := cg.db.Query(`
		SELECT id, host, service_id, tcp_entrypoints, tcp_sni_rule
		FROM resources
		WHERE status = 'active' AND tcp_enabled = 1
	`)
	if err != nil {
		return fmt.Errorf("failed to fetch TCP resources: %w", err)
	}
	defer rows.Close()
	
	for rows.Next() {
		var id, host, serviceID, tcpEntrypoints, tcpSNIRule string
		if err := rows.Scan(&id, &host, &serviceID, &tcpEntrypoints, &tcpSNIRule); err != nil {
			log.Printf("Failed to scan TCP resource: %v", err)
			continue
		}
		
		// Process TCP entrypoints (comma-separated list to array)
		entrypoints := []string{"tcp"} // Default
		if tcpEntrypoints != "" {
			// Split by comma and trim spaces
			rawEntrypoints := strings.Split(tcpEntrypoints, ",")
			entrypoints = make([]string, 0, len(rawEntrypoints))
			for _, ep := range rawEntrypoints {
				trimmed := strings.TrimSpace(ep)
				if trimmed != "" {
					entrypoints = append(entrypoints, trimmed)
				}
			}
			
			// If after processing we have no valid entrypoints, use the default
			if len(entrypoints) == 0 {
				entrypoints = []string{"tcp"}
			}
		}
		
		// Create the rule - default to HostSNI for the domain if no custom rule
		rule := fmt.Sprintf("HostSNI(`%s`)", host)
		if tcpSNIRule != "" {
			rule = tcpSNIRule
		}
		
		// Create TCP router config
		tcpRouterID := fmt.Sprintf("%s-tcp", id)
		config.TCP.Routers[tcpRouterID] = map[string]interface{}{
			"rule":        rule,
			"service":     serviceID, // Reference service from http provider
			"entryPoints": entrypoints,
			"tls":         map[string]interface{}{},  // Enable TLS for SNI
		}
	}
	
	if err := rows.Err(); err != nil {
		return fmt.Errorf("error during TCP resources iteration: %w", err)
	}
	
	return nil
}

// stringSliceContains checks if a string is in a slice
func stringSliceContains(slice []string, str string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}