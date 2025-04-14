package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/hhftechnology/middleware-manager/database"
	"gopkg.in/yaml.v3"
)

// ConfigGenerator generates Traefik configuration files
type ConfigGenerator struct {
	db            *database.DB
	confDir       string
	stopChan      chan struct{}
	isRunning     bool
	mutex         sync.Mutex // Protects isRunning
}

// TraefikConfig represents the structure of the Traefik configuration
type TraefikConfig struct {
	HTTP struct {
		Middlewares map[string]interface{} `yaml:"middlewares,omitempty"`
		Routers     map[string]interface{} `yaml:"routers,omitempty"`
	} `yaml:"http"`
}

// NewConfigGenerator creates a new config generator
func NewConfigGenerator(db *database.DB, confDir string) *ConfigGenerator {
	return &ConfigGenerator{
		db:       db,
		confDir:  confDir,
		stopChan: make(chan struct{}),
		isRunning: false,
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
	
	log.Printf("Config generator started, generating every %v", interval)

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

	// Process middlewares
	if err := cg.processMiddlewares(&config); err != nil {
		return fmt.Errorf("failed to process middlewares: %w", err)
	}

	// Process resources
	if err := cg.processResources(&config); err != nil {
		return fmt.Errorf("failed to process resources: %w", err)
	}

	// Write configuration to file
	return cg.writeConfigToFile(&config)
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

// processResources fetches and processes all resources and their middlewares
func (cg *ConfigGenerator) processResources(config *TraefikConfig) error {
	// Fetch all resources and their middlewares
	rows, err := cg.db.Query(`
		SELECT r.id, r.host, r.service_id, rm.middleware_id, rm.priority
		FROM resources r
		JOIN resource_middlewares rm ON r.id = rm.resource_id
		ORDER BY rm.priority DESC
	`)
	if err != nil {
		return fmt.Errorf("failed to fetch resources: %w", err)
	}
	defer rows.Close()

	// Group middlewares by resource
	resourceMiddlewares := make(map[string][]string)
	resourceInfo := make(map[string]struct {
		Host      string
		ServiceID string
	})

	for rows.Next() {
		var resourceID, host, serviceID, middlewareID string
		var priority int
		if err := rows.Scan(&resourceID, &host, &serviceID, &middlewareID, &priority); err != nil {
			log.Printf("Failed to scan resource middleware: %v", err)
			continue
		}

		resourceMiddlewares[resourceID] = append(resourceMiddlewares[resourceID], middlewareID)
		resourceInfo[resourceID] = struct {
			Host      string
			ServiceID string
		}{
			Host:      host,
			ServiceID: serviceID,
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
		
		// Add "badger" middleware with http provider suffix if not already present
		if !stringSliceContains(middlewares, "badger@http") {
			middlewares = append(middlewares, "badger@http")
		}

		// Process middleware references to add provider suffixes
		for i, middleware := range middlewares {
			// If this is not already a fully qualified middleware reference and not the Pangolin badger middleware
			if !strings.Contains(middleware, "@") && middleware != "badger@http" {
				// Assume it's from our file provider
				middlewares[i] = fmt.Sprintf("%s@file", middleware)
			}
		}

		// Create a router with higher priority
		customRouterID := fmt.Sprintf("%s-auth", resourceID)
		
		config.HTTP.Routers[customRouterID] = map[string]interface{}{
			"rule":        fmt.Sprintf("Host(`%s`)", info.Host),
			"service":     fmt.Sprintf("%s@http", info.ServiceID),  // Reference service from http provider
			"entryPoints": []string{"websecure"},
			"middlewares": middlewares,
			"priority":    100, // Higher than Pangolin's default
			"tls": map[string]interface{}{
				"certResolver": "letsencrypt",
			},
		}
	}

	return nil
}

// writeConfigToFile writes the configuration to a file
func (cg *ConfigGenerator) writeConfigToFile(config *TraefikConfig) error {
	// Create temporary file first to ensure atomic write
	configFile := filepath.Join(cg.confDir, "resource-overrides.yml")
	tempFile := configFile + ".tmp"
	
	// Convert to YAML
	yamlData, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to convert config to YAML: %w", err)
	}

	// Write to temporary file
	if err := os.WriteFile(tempFile, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write temp config file: %w", err)
	}

	// Rename temp file to final file (atomic operation)
	if err := os.Rename(tempFile, configFile); err != nil {
		return fmt.Errorf("failed to rename temp config file: %w", err)
	}

	log.Printf("Generated Traefik configuration at %s", configFile)
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