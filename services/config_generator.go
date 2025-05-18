package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/hhftechnology/middleware-manager/database"
	"github.com/hhftechnology/middleware-manager/models" // Correct import for your models
	"gopkg.in/yaml.v3"
)

// ConfigGenerator generates Traefik configuration files
type ConfigGenerator struct {
	db            *database.DB
	confDir       string
	configManager *ConfigManager // To access active data source
	stopChan      chan struct{}
	isRunning     bool
	mutex         sync.Mutex
	lastConfig    []byte
	// lastConfigHash string // This was commented out in your original struct, uncomment if needed
}

// TraefikConfig represents the structure of the Traefik configuration
type TraefikConfig struct {
	HTTP struct {
		Middlewares map[string]interface{} `yaml:"middlewares,omitempty"`
		Routers     map[string]interface{} `yaml:"routers,omitempty"`
		Services    map[string]interface{} `yaml:"services,omitempty"`
	} `yaml:"http"`

	TCP struct {
		Routers  map[string]interface{} `yaml:"routers,omitempty"`
		Services map[string]interface{} `yaml:"services,omitempty"`
	} `yaml:"tcp,omitempty"`

	UDP struct {
		Services map[string]interface{} `yaml:"services,omitempty"`
	} `yaml:"udp,omitempty"`
}

// NewConfigGenerator creates a new config generator
func NewConfigGenerator(db *database.DB, confDir string, configManager *ConfigManager) *ConfigGenerator {
	return &ConfigGenerator{
		db:            db,
		confDir:       confDir,
		configManager: configManager,
		stopChan:      make(chan struct{}),
		isRunning:     false,
		lastConfig:    nil,
		// lastConfigHash: "", // ensure this matches your struct
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

	if err := os.MkdirAll(cg.confDir, 0755); err != nil {
		log.Printf("Failed to create conf directory: %v", err)
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

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

	config := TraefikConfig{}
	config.HTTP.Middlewares = make(map[string]interface{})
	config.HTTP.Routers = make(map[string]interface{})
	config.HTTP.Services = make(map[string]interface{})
	config.TCP.Routers = make(map[string]interface{})
	config.TCP.Services = make(map[string]interface{})
	config.UDP.Services = make(map[string]interface{})


	if err := cg.processMiddlewares(&config); err != nil {
		return fmt.Errorf("failed to process middlewares: %w", err)
	}
	if err := cg.processServices(&config); err != nil {
		return fmt.Errorf("failed to process services: %w", err)
	}
	if err := cg.processResourcesWithServices(&config); err != nil {
		return fmt.Errorf("failed to process HTTP resources with services: %w", err)
	}
	if err := cg.processTCPRouters(&config); err != nil {
		return fmt.Errorf("failed to process TCP resources: %w", err)
	}

	processedConfig := preserveTraefikValues(config)

	yamlNode := &yaml.Node{}
	err := yamlNode.Encode(processedConfig)
	if err != nil {
		return fmt.Errorf("failed to encode config to YAML node: %w", err)
	}
	preserveStringsInYamlNode(yamlNode)
	yamlData, err := yaml.Marshal(yamlNode)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML node: %w", err)
	}

	if cg.hasConfigurationChanged(yamlData) {
		if err := cg.writeConfigToFile(yamlData); err != nil {
			return fmt.Errorf("failed to write config to file: %w", err)
		}
		log.Printf("Generated new Traefik configuration at %s", filepath.Join(cg.confDir, "resource-overrides.yml"))
	} else {
		log.Println("Configuration unchanged, skipping file write")
	}

	return nil
}

func (cg *ConfigGenerator) processMiddlewares(config *TraefikConfig) error {
	rows, err := cg.db.Query("SELECT id, name, type, config FROM middlewares")
	if err != nil {
		return fmt.Errorf("failed to fetch middlewares: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id, name, typ, configStr string
		if err := rows.Scan(&id, &name, &typ, &configStr); err != nil {
			log.Printf("Failed to scan middleware: %v", err)
			continue
		}
		var middlewareConfig map[string]interface{}
		if err := json.Unmarshal([]byte(configStr), &middlewareConfig); err != nil {
			log.Printf("Failed to parse middleware config for %s: %v", name, err)
			continue
		}
		
		// Use the centralized processing logic from models package
		middlewareConfig = models.ProcessMiddlewareConfig(typ, middlewareConfig)

		config.HTTP.Middlewares[id] = map[string]interface{}{
			typ: middlewareConfig,
		}
	}
	return rows.Err()
}

func (cg *ConfigGenerator) processServices(config *TraefikConfig) error {
	rows, err := cg.db.Query("SELECT id, name, type, config FROM services")
	if err != nil {
		return fmt.Errorf("failed to fetch services: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id, name, typ, configStr string
		if err := rows.Scan(&id, &name, &typ, &configStr); err != nil {
			log.Printf("Failed to scan service row: %v", err)
			continue
		}
		var serviceConfig map[string]interface{}
		if err := json.Unmarshal([]byte(configStr), &serviceConfig); err != nil {
			log.Printf("Failed to parse service config for %s: %v", name, err)
			continue
		}
		
		// Use the centralized processing logic from models package
		serviceConfig = models.ProcessServiceConfig(typ, serviceConfig)

		protocol := determineServiceProtocol(typ, serviceConfig)
		serviceEntry := map[string]interface{}{typ: serviceConfig}

		switch protocol {
		case "http":
			config.HTTP.Services[id] = serviceEntry
		case "tcp":
			config.TCP.Services[id] = serviceEntry
		case "udp":
			config.UDP.Services[id] = serviceEntry
		}
	}
	return rows.Err()
}

func (cg *ConfigGenerator) processResourcesWithServices(config *TraefikConfig) error {
	activeDSConfig, err := cg.configManager.GetActiveDataSourceConfig()
	if err != nil {
		log.Printf("Warning: Could not get active data source config in ConfigGenerator: %v. Defaulting to Pangolin logic.", err)
		activeDSConfig.Type = models.PangolinAPI
	}

	query := `
		SELECT r.id, r.host, r.service_id, r.entrypoints, r.tls_domains,
		       r.custom_headers, r.router_priority, r.source_type, 
		       rm.middleware_id, rm.priority,
		       rs.service_id as custom_service_id
		FROM resources r
		LEFT JOIN resource_middlewares rm ON r.id = rm.resource_id
		LEFT JOIN resource_services rs ON r.id = rs.resource_id
		WHERE r.status = 'active'
		ORDER BY r.id, rm.priority DESC
	`
	rows, err := cg.db.Query(query)
	if err != nil {
		return fmt.Errorf("failed to fetch resources for HTTP routers: %w", err)
	}
	defer rows.Close()

	resourceDataMap := make(map[string]struct {
		Info        models.Resource
		Middlewares []MiddlewareWithPriority
		CustomServiceID sql.NullString
	})

	for rows.Next() {
		var rID, host, serviceID, entrypoints, tlsDomains, customHeadersStr, sourceType string
		var routerPriority sql.NullInt64 // Use sql.NullInt64 for router_priority
		var middlewareID sql.NullString
		var middlewarePriority sql.NullInt64
		var customServiceIDVal sql.NullString

		err := rows.Scan(
			&rID, &host, &serviceID, &entrypoints, &tlsDomains,
			&customHeadersStr, &routerPriority, &sourceType,
			&middlewareID, &middlewarePriority, &customServiceIDVal,
		)
		if err != nil {
			log.Printf("Failed to scan resource data for HTTP router: %v", err)
			continue
		}
		
		data, exists := resourceDataMap[rID]
		if !exists {
			data.Info = models.Resource{
				ID:            rID,
				Host:          host,
				ServiceID:     serviceID,
				Entrypoints:   entrypoints,
				TLSDomains:    tlsDomains,
				CustomHeaders: customHeadersStr,
				SourceType:    sourceType,
				// RouterPriority will be set from sql.NullInt64
			}
			if routerPriority.Valid {
				data.Info.RouterPriority = int(routerPriority.Int64)
			} else {
				data.Info.RouterPriority = 100 // Default if NULL
			}
			data.CustomServiceID = customServiceIDVal
		}
		if middlewareID.Valid {
			mwPriority := 100 // Default priority
			if middlewarePriority.Valid {
				mwPriority = int(middlewarePriority.Int64)
			}
			data.Middlewares = append(data.Middlewares, MiddlewareWithPriority{
				ID:       middlewareID.String,
				Priority: mwPriority,
			})
		}
		resourceDataMap[rID] = data
	}
	if err = rows.Err(); err != nil {
		return fmt.Errorf("error iterating resource rows for HTTP: %w", err)
	}
	
	for _, data := range resourceDataMap {
		info := data.Info
		assignedMiddlewares := data.Middlewares // Already sorted by DB or sort here if needed
		sort.SliceStable(assignedMiddlewares, func(i, j int) bool {
			return assignedMiddlewares[i].Priority > assignedMiddlewares[j].Priority
		})

		routerEntryPoints := strings.Split(strings.TrimSpace(info.Entrypoints), ",")
		if len(routerEntryPoints) == 0 || routerEntryPoints[0] == "" {
			routerEntryPoints = []string{"websecure"}
		}

		var customHeadersMiddlewareID string
		if info.CustomHeaders != "" && info.CustomHeaders != "{}" && info.CustomHeaders != "null" {
			var headersMap map[string]string
			if err := json.Unmarshal([]byte(info.CustomHeaders), &headersMap); err == nil && len(headersMap) > 0 {
				middlewareName := fmt.Sprintf("%s-customheaders", info.ID)
				config.HTTP.Middlewares[middlewareName] = map[string]interface{}{
					"headers": map[string]interface{}{"customRequestHeaders": headersMap},
				}
				customHeadersMiddlewareID = fmt.Sprintf("%s@file", middlewareName)
			}
		}

		var finalMiddlewares []string
		if customHeadersMiddlewareID != "" {
			finalMiddlewares = append(finalMiddlewares, customHeadersMiddlewareID)
		}
		for _, mw := range assignedMiddlewares {
			finalMiddlewares = append(finalMiddlewares, fmt.Sprintf("%s@file", mw.ID))
		}
		
		// Conditionally add "badger@http"
		if activeDSConfig.Type == models.PangolinAPI {
			isBadgerPresent := false
			for _, m := range finalMiddlewares {
				if m == "badger@http" {
					isBadgerPresent = true
					break
				}
			}
			if !isBadgerPresent {
				finalMiddlewares = append(finalMiddlewares, "badger@http")
			}
		}
		
		var serviceReference string
		if data.CustomServiceID.Valid && data.CustomServiceID.String != "" {
			serviceReference = fmt.Sprintf("%s@file", data.CustomServiceID.String)
		} else {
			providerSuffix := "http" // Default for Pangolin or unknown resource source
			if activeDSConfig.Type == models.TraefikAPI {
				if models.DataSourceType(info.SourceType) == models.TraefikAPI {
					providerSuffix = "docker" // Resource from Traefik API, likely a Docker service
				}
			}
			if strings.Contains(info.ServiceID, "@") {
				serviceReference = info.ServiceID // Already has a provider
			} else {
				serviceReference = fmt.Sprintf("%s@%s", info.ServiceID, providerSuffix)
			}
		}
		log.Printf("Resource %s (HTTP): Router service set to %s. (SourceType: %s, ActiveDS: %s, CustomSvc: %s)", info.ID, serviceReference, info.SourceType, activeDSConfig.Type, data.CustomServiceID.String)


		routerID := fmt.Sprintf("%s-auth", info.ID) // Ensure unique router ID
		routerConfig := map[string]interface{}{
			"rule":        fmt.Sprintf("Host(`%s`)", info.Host),
			"service":     serviceReference,
			"entryPoints": routerEntryPoints,
			"priority":    info.RouterPriority,
		}
		if len(finalMiddlewares) > 0 {
			routerConfig["middlewares"] = finalMiddlewares
		}

		tlsConfig := map[string]interface{}{"certResolver": "letsencrypt"}
		if info.TLSDomains != "" {
			sans := strings.Split(strings.TrimSpace(info.TLSDomains), ",")
			var cleanSans []string
			for _, s := range sans {
				if trimmed := strings.TrimSpace(s); trimmed != "" {
					cleanSans = append(cleanSans, trimmed)
				}
			}
			if len(cleanSans) > 0 {
				tlsConfig["domains"] = []map[string]interface{}{{"main": info.Host, "sans": cleanSans}}
			}
		}
		routerConfig["tls"] = tlsConfig
		config.HTTP.Routers[routerID] = routerConfig
	}
	return nil
}


func (cg *ConfigGenerator) processTCPRouters(config *TraefikConfig) error {
	activeDSConfig, err := cg.configManager.GetActiveDataSourceConfig()
	if err != nil {
		log.Printf("Warning: Could not get active data source config for TCP routers: %v. Defaulting to Pangolin logic.", err)
		activeDSConfig.Type = models.PangolinAPI
	}
	
	query := `
		SELECT r.id, r.host, r.service_id, r.tcp_entrypoints, r.tcp_sni_rule, r.router_priority, r.source_type,
		       rs.service_id as custom_service_id
		FROM resources r
		LEFT JOIN resource_services rs ON r.id = rs.resource_id
		WHERE r.status = 'active' AND r.tcp_enabled = 1
	`
	rows, err := cg.db.Query(query)
	if err != nil {
		return fmt.Errorf("failed to fetch TCP resources: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id, host, serviceID, tcpEntrypointsStr, tcpSNIRule, sourceType string
		var routerPriority sql.NullInt64
		var customServiceID sql.NullString
		if err := rows.Scan(&id, &host, &serviceID, &tcpEntrypointsStr, &tcpSNIRule, &routerPriority, &sourceType, &customServiceID); err != nil {
			log.Printf("Failed to scan TCP resource: %v", err)
			continue
		}

		priority := 100
		if routerPriority.Valid {
			priority = int(routerPriority.Int64)
		}

		entrypoints := strings.Split(strings.TrimSpace(tcpEntrypointsStr), ",")
		if len(entrypoints) == 0 || entrypoints[0] == "" {
			entrypoints = []string{"tcp"} // Default TCP entrypoint
		}
		
		rule := tcpSNIRule
		if rule == "" { // Default SNI rule if not specified
			rule = fmt.Sprintf("HostSNI(`%s`)", host)
		}

		var tcpServiceReference string
		if customServiceID.Valid && customServiceID.String != "" {
			tcpServiceReference = fmt.Sprintf("%s@file", customServiceID.String)
		} else {
			providerSuffix := "http" // Default, implies the HTTP service definition might be used or Traefik handles internally
			if activeDSConfig.Type == models.TraefikAPI {
				if models.DataSourceType(sourceType) == models.TraefikAPI {
					// For TCP services linked to Docker, Traefik often resolves service by name from Docker provider
					if !strings.Contains(serviceID, "@") { // Only add @docker if no provider specified
						providerSuffix = "docker"
					} else {
						providerSuffix = "" // Keep existing provider
					}
				}
			}
			if providerSuffix != "" && !strings.Contains(serviceID, "@") {
				tcpServiceReference = fmt.Sprintf("%s@%s", serviceID, providerSuffix)
			} else {
				tcpServiceReference = serviceID // Use as-is
			}
		}
		log.Printf("Resource %s (TCP): Router service set to %s. (SourceType: %s, ActiveDS: %s, CustomSvc: %s)", id, tcpServiceReference, sourceType, activeDSConfig.Type, customServiceID.String)


		tcpRouterID := fmt.Sprintf("%s-tcp", id)
		config.TCP.Routers[tcpRouterID] = map[string]interface{}{
			"rule":        rule,
			"service":     tcpServiceReference,
			"entryPoints": entrypoints,
			"priority":    priority,
			"tls":         map[string]interface{}{}, // TCP routers with SNI usually involve TLS
		}
	}
	return rows.Err()
}


// --- Helper functions (isNumeric, preserveStringsInYamlNode, preserveTraefikValues, etc.) ---
// These should be mostly the same as previously provided, ensure `models.ProcessMiddlewareConfig`
// and `models.ProcessServiceConfig` are used where appropriate for type-specific logic.

func (cg *ConfigGenerator) hasConfigurationChanged(newConfig []byte) bool {
	if cg.lastConfig == nil || len(cg.lastConfig) != len(newConfig) || string(cg.lastConfig) != string(newConfig) {
		cg.lastConfig = make([]byte, len(newConfig))
		copy(cg.lastConfig, newConfig)
		return true
	}
	return false
}

func (cg *ConfigGenerator) writeConfigToFile(yamlData []byte) error {
	configFile := filepath.Join(cg.confDir, "resource-overrides.yml")
	tempFile := configFile + ".tmp"
	if err := os.WriteFile(tempFile, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write temp config file: %w", err)
	}
	return os.Rename(tempFile, configFile)
}

// MiddlewareWithPriority represents a middleware with its priority value
type MiddlewareWithPriority struct {
	ID       string
	Priority int
}

func stringSliceContains(slice []string, str string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

func determineServiceProtocol(serviceType string, config map[string]interface{}) string {
	if serviceType == string(models.LoadBalancerType) {
		if servers, ok := config["servers"].([]interface{}); ok {
			for _, s := range servers {
				if serverMap, ok := s.(map[string]interface{}); ok {
					if _, hasAddress := serverMap["address"]; hasAddress {
						// Could be TCP or UDP. Default to TCP.
						// UDP services might need more specific markers or be handled by a separate UDP services map in TraefikConfig
						return "tcp" 
					}
					if _, hasURL := serverMap["url"]; hasURL {
						return "http"
					}
				}
			}
		}
	}
	// For weighted, mirroring, failover, they reference other services.
	// The protocol is typically determined by the nature of those referenced services.
	// For simplicity here, assume HTTP if not explicitly a loadbalancer with address.
	return "http"
}


func preserveStringsInYamlNode(node *yaml.Node) {
	if node == nil { return }
	switch node.Kind {
	case yaml.DocumentNode, yaml.SequenceNode:
		for i := range node.Content {
			preserveStringsInYamlNode(node.Content[i])
		}
	case yaml.MappingNode:
		for i := 0; i < len(node.Content); i += 2 {
			keyNode := node.Content[i]
			valueNode := node.Content[i+1]
			if (keyNode.Value == "Server" || keyNode.Value == "X-Powered-By" || strings.HasPrefix(keyNode.Value, "X-")) &&
				valueNode.Kind == yaml.ScalarNode && valueNode.Value == "" {
				valueNode.Style = yaml.DoubleQuotedStyle
			}
			if containsSpecialStringField(keyNode.Value) && valueNode.Kind == yaml.ScalarNode {
				valueNode.Style = yaml.DoubleQuotedStyle
			}
			preserveStringsInYamlNode(keyNode)   // Recursive call for key (though keys are usually simple strings)
			preserveStringsInYamlNode(valueNode) // Recursive call for value
		}
	case yaml.ScalarNode:
		if node.Value == "" {
			node.Style = yaml.DoubleQuotedStyle
		} else if isNumericString(node.Value) && len(node.Value) > 5 { // Example condition for large numbers
            node.Tag = "!!str" // Force as string if it's a long number that might get scientific notation
        }
	}
}

func isNumericString(s string) bool {
    _, err := strconv.ParseFloat(s, 64)
    return err == nil
}

func containsSpecialStringField(fieldName string) bool {
	specialFields := []string{
		"key", "token", "secret", "apiKey", "Key", "Token", "Secret", "Password", "Pass", "User", "Users",
		"regex", "replacement", "Regex", "Path", "path", "scheme", "url", "address",
		"prefix", "prefixes", "expression", "rule", "certResolver", "address", "authResponseHeaders",
		"customRequestHeaders", "customResponseHeaders", "customFrameOptionsValue", "contentSecurityPolicy",
		"referrerPolicy", "permissionsPolicy", "stsSeconds", "excludedIPs", "sourceRange",
		"query", "service", "fallback", "flushInterval", "interval", "timeout", // Some of these are durations but might be passed as strings
	}
	for _, field := range specialFields {
		if strings.EqualFold(fieldName, field) || strings.Contains(strings.ToLower(fieldName), strings.ToLower(field)) {
			return true
		}
	}
	return false
}

func preserveTraefikValues(data interface{}) interface{} {
	// This function is now more about structural integrity than type coercion,
	// as specific type processing is handled by models.ProcessMiddlewareConfig and models.ProcessServiceConfig.
	// It can still be useful for deeply nested generic maps or arrays if they occur outside of those.
	if data == nil {
		return nil
	}
	switch v := data.(type) {
	case map[string]interface{}:
		for key, val := range v {
			v[key] = preserveTraefikValues(val)
		}
		return v
	case []interface{}:
		for i, item := range v {
			v[i] = preserveTraefikValues(item)
		}
		return v
	default:
		return v // Primitives (string, int, bool, float64) are returned as is.
	}
}