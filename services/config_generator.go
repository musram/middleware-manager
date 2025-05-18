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
	"strconv"
	"sync"
	"time"

	"github.com/hhftechnology/middleware-manager/database"
	"github.com/hhftechnology/middleware-manager/models"
	"gopkg.in/yaml.v3"
)

// ConfigGenerator generates Traefik configuration files
type ConfigGenerator struct {
	db             *database.DB
	confDir        string
	configManager  *ConfigManager // Add ConfigManager
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
		Services    map[string]interface{} `yaml:"services,omitempty"`
	} `yaml:"http"`
	
	TCP struct {
		Routers     map[string]interface{} `yaml:"routers,omitempty"`
		Services    map[string]interface{} `yaml:"services,omitempty"`
	} `yaml:"tcp,omitempty"`
	
	UDP struct {
		Services map[string]interface{} `yaml:"services,omitempty"`
	} `yaml:"udp,omitempty"`
}

// NewConfigGenerator creates a new config generator
func NewConfigGenerator(db *database.DB, confDir string, configManager *ConfigManager) *ConfigGenerator { // Add configManager parameter
	return &ConfigGenerator{
		db:             db,
		confDir:        confDir,
		configManager:  configManager, // Store it
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

// preserveTraefikValues ensures all values in Traefik configurations are properly handled
// This handles special cases in different middleware types and ensures precise value preservation
func preserveTraefikValues(data interface{}) interface{} {
	if data == nil {
		return nil
	}

	switch v := data.(type) {
	case map[string]interface{}:
		// Process each key-value pair in the map
		for key, val := range v {
			// Process values based on key names that might need special handling
			switch {
			// URL or path related fields
			case key == "path" || key == "url" || key == "address" || strings.HasSuffix(key, "Path"):
				// Ensure path strings keep their exact format
				if strVal, ok := val.(string); ok && strVal != "" {
					// Keep exact string formatting
					v[key] = strVal
				} else {
					v[key] = preserveTraefikValues(val)
				}
			
			// Regex and replacement patterns
			case key == "regex" || key == "replacement" || strings.HasSuffix(key, "Regex"):
				// Ensure regex patterns are preserved exactly
				if strVal, ok := val.(string); ok && strVal != "" {
					// Keep exact string formatting with special characters
					v[key] = strVal
				} else {
					v[key] = preserveTraefikValues(val)
				}
			
			// API keys and security tokens
			case key == "key" || key == "token" || key == "secret" || 
				 strings.Contains(key, "Key") || strings.Contains(key, "Token") || 
				 strings.Contains(key, "Secret") || strings.Contains(key, "Password"):
				// Ensure API keys and tokens are preserved exactly
				if strVal, ok := val.(string); ok {
					// Always preserve keys/tokens exactly as-is, even if empty
					v[key] = strVal
				} else {
					v[key] = preserveTraefikValues(val)
				}
			
			// Empty header values (common in security headers middleware)
			case key == "Server" || key == "X-Powered-By" || strings.HasPrefix(key, "X-"):
				// Empty string values are often used to remove headers
				if strVal, ok := val.(string); ok {
					// Preserve empty strings exactly
					v[key] = strVal
				} else {
					v[key] = preserveTraefikValues(val)
				}
			
			// IP addresses and networks
			case key == "ip" || key == "clientIP" || strings.Contains(key, "IP") ||
				 key == "sourceRange" || key == "excludedIPs":
				// IP addresses often need exact formatting
				v[key] = preserveTraefikValues(val)
			
			// Boolean flags that control behavior
			case strings.HasPrefix(key, "is") || strings.HasPrefix(key, "has") || 
				 strings.HasPrefix(key, "enable") || strings.HasSuffix(key, "enabled") ||
				 strings.HasSuffix(key, "Enabled") || key == "permanent" || key == "forceSlash":
				// Ensure boolean values are preserved as actual booleans
				if boolVal, ok := val.(bool); ok {
					v[key] = boolVal
				} else if strVal, ok := val.(string); ok {
					// Convert string "true"/"false" to actual boolean if needed
					if strVal == "true" {
						v[key] = true
					} else if strVal == "false" {
						v[key] = false
					} else {
						v[key] = strVal // Keep as is if not a boolean string
					}
				} else {
					v[key] = preserveTraefikValues(val)
				}
			
			// Integer values like timeouts, ports, limits
			case key == "amount" || key == "burst" || key == "port" || 
				 strings.HasSuffix(key, "Seconds") || strings.HasSuffix(key, "Limit") || 
				 strings.HasSuffix(key, "Timeout") || strings.HasSuffix(key, "Size") ||
				 key == "depth" || key == "priority" || key == "statusCode" || 
				 key == "attempts" || key == "responseCode":
				// Ensure numeric values are preserved as numbers
				switch numVal := val.(type) {
				case int:
					v[key] = numVal
				case float64:
					// Keep as float if it has decimal part, otherwise convert to int
					if numVal == float64(int(numVal)) {
						v[key] = int(numVal)
					} else {
						v[key] = numVal
					}
				case string:
					// Try to convert string to number if it looks like one
					if i, err := strconv.Atoi(numVal); err == nil {
						v[key] = i
					} else if f, err := strconv.ParseFloat(numVal, 64); err == nil {
						v[key] = f
					} else {
						v[key] = numVal // Keep as string if not numeric
					}
				default:
					v[key] = preserveTraefikValues(val)
				}
			
			// Default handling for other keys
			default:
				v[key] = preserveTraefikValues(val)
			}
		}
		return v
	
	case []interface{}:
		// Process each element in the array
		for i, item := range v {
			v[i] = preserveTraefikValues(item)
		}
		return v
	
	case string:
		// Preserve all string values exactly as they are
		return v
	
	case int, float64, bool:
		// Preserve primitive types as they are
		return v
	
	default:
		// For any other type, return as is
		return v
	}
}

// generateConfig generates Traefik configuration files
func (cg *ConfigGenerator) generateConfig() error {
	log.Println("Generating Traefik configuration...")

	// Create a new configuration
	config := TraefikConfig{}
	config.HTTP.Middlewares = make(map[string]interface{})
	config.HTTP.Routers = make(map[string]interface{})
	config.HTTP.Services = make(map[string]interface{})
	config.TCP.Routers = make(map[string]interface{})
	config.TCP.Services = make(map[string]interface{})
	config.UDP = struct {
		Services map[string]interface{} `yaml:"services,omitempty"`
	}{
		Services: make(map[string]interface{}),
	}

	// Process middlewares
	if err := cg.processMiddlewares(&config); err != nil {
		return fmt.Errorf("failed to process middlewares: %w", err)
	}

	// Process services
	if err := cg.processServices(&config); err != nil {
		return fmt.Errorf("failed to process services: %w", err)
	}

	// Process HTTP resources with custom services
	if err := cg.processResourcesWithServices(&config); err != nil {
		return fmt.Errorf("failed to process resources with services: %w", err)
	}

	// Process TCP resources
	if err := cg.processTCPRouters(&config); err != nil {
		return fmt.Errorf("failed to process TCP resources: %w", err)
	}

	// Process the config to ensure all values are correctly preserved
	// This handles all middleware types and their specific requirements
	processedConfig := preserveTraefikValues(config)

	// Convert to YAML using a custom marshaler with string preservation
	yamlNode := &yaml.Node{}
	err := yamlNode.Encode(processedConfig)
	if err != nil {
		return fmt.Errorf("failed to encode config to YAML node: %w", err)
	}
	
	// Preserve string values, especially empty strings, during YAML encoding
	preserveStringsInYamlNode(yamlNode)
	
	// Marshal the processed node
	yamlData, err := yaml.Marshal(yamlNode)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML node: %w", err)
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

// preserveStringsInYamlNode ensures that string values, especially empty strings,
// are preserved correctly in the YAML node structure before marshaling
func preserveStringsInYamlNode(node *yaml.Node) {
	if node == nil {
		return
	}
	
	// Process node based on its kind
	switch node.Kind {
	case yaml.DocumentNode, yaml.SequenceNode:
		// Process all content/items
		for i := range node.Content {
			preserveStringsInYamlNode(node.Content[i])
		}
	
	case yaml.MappingNode:
		// Process all key-value pairs
		for i := 0; i < len(node.Content); i += 2 {
			// Get key and value
			keyNode := node.Content[i]
			valueNode := node.Content[i+1]
			
			// Process based on key content
			if keyNode.Value == "Server" || keyNode.Value == "X-Powered-By" || 
			   strings.HasPrefix(keyNode.Value, "X-") {
				// These are likely header fields where empty strings are important
				if valueNode.Kind == yaml.ScalarNode && valueNode.Value == "" {
					// Ensure empty strings are properly encoded
					valueNode.Style = yaml.DoubleQuotedStyle
				}
			}
			
			// Special handling for known fields that need exact string preservation
			if containsSpecialField(keyNode.Value) && valueNode.Kind == yaml.ScalarNode {
				// Use double quotes for these fields to ensure proper encoding
				valueNode.Style = yaml.DoubleQuotedStyle
			}
			
			// Continue recursion
			preserveStringsInYamlNode(keyNode)
			preserveStringsInYamlNode(valueNode)
		}
	
	case yaml.ScalarNode:
		// For scalar nodes (including strings), ensure empty strings are properly quoted
		if node.Value == "" {
			node.Style = yaml.DoubleQuotedStyle
		} else if len(node.Value) > 5 && isNumeric(node.Value) {
			// Force large numbers to be strings to avoid scientific notation
			node.Tag = "!!str"
		}
	}
}

// isNumeric checks if a string is numeric
func isNumeric(s string) bool {
	_, err := strconv.ParseInt(s, 10, 64)
	return err == nil
}

// containsSpecialField checks if a field name is one that needs special handling
// for correct string value preservation
func containsSpecialField(fieldName string) bool {
	specialFields := []string{
		"key", "token", "secret", "apiKey", "Key", "Token", "Secret", "Password",
		"regex", "replacement", "Regex", "path", "scheme", "url", "address", "Path",
		"prefix", "prefixes", "expression", "rule",
	}
	
	for _, field := range specialFields {
		if strings.Contains(fieldName, field) {
			return true
		}
	}
	
	return false
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

		// Process middleware config based on type
		switch typ {
		case "chain":
			// Special handling for chain middlewares
			processChainingMiddleware(middlewareConfig)
			
		case "headers":
			// Special handling for headers middleware (empty strings are important)
			processHeadersMiddleware(middlewareConfig)
			
		case "redirectRegex", "redirectScheme", "replacePath", "replacePathRegex", "stripPrefix", "stripPrefixRegex":
			// Path manipulation middlewares need special handling for regex and path values
			processPathMiddleware(middlewareConfig)
			
		case "basicAuth", "digestAuth", "forwardAuth":
			// Authentication middlewares often have URLs and tokens
			processAuthMiddleware(middlewareConfig, typ)
			
		case "inFlightReq", "rateLimit":
			// Request limiting middlewares have numeric values and IP rules
			processRateLimitingMiddleware(middlewareConfig, typ)
			
		case "ipWhiteList", "ipAllowList":
			// IP filtering middlewares need their CIDR ranges preserved exactly
			processIPFilteringMiddleware(middlewareConfig)
			
		case "plugin":
			// Plugin middlewares (CrowdSec, etc.) need special handling
			processPluginMiddleware(middlewareConfig)
			
		default:
			// General processing for other middleware types
			middlewareConfig = preserveTraefikValues(middlewareConfig).(map[string]interface{})
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

// processChainingMiddleware handles chain middleware special processing
func processChainingMiddleware(config map[string]any) {
	// Do not add any suffixes to middleware names in the chain
	if middlewares, ok := config["middlewares"].([]any); ok {
		for i, middleware := range middlewares {
			if middlewareStr, ok := middleware.(string); ok {
				// Keep middleware name as is, do not append "@file"
				middlewares[i] = middlewareStr
			}
		}
		config["middlewares"] = middlewares
	}

	// Process other chain configuration values
	preserveTraefikValues(config)
}

// processHeadersMiddleware handles the headers middleware special processing
func processHeadersMiddleware(config map[string]interface{}) {
	// Special handling for response headers which might contain empty strings
	if customResponseHeaders, ok := config["customResponseHeaders"].(map[string]interface{}); ok {
		for key, value := range customResponseHeaders {
			// Ensure empty strings are preserved exactly
			if strValue, ok := value.(string); ok {
				customResponseHeaders[key] = strValue
			}
		}
	}
	
	// Special handling for request headers which might contain empty strings
	if customRequestHeaders, ok := config["customRequestHeaders"].(map[string]interface{}); ok {
		for key, value := range customRequestHeaders {
			// Ensure empty strings are preserved exactly
			if strValue, ok := value.(string); ok {
				customRequestHeaders[key] = strValue
			}
		}
	}
	
	// Process header fields that are often quoted strings
	specialStringFields := []string{
		"customFrameOptionsValue", "contentSecurityPolicy", 
		"referrerPolicy", "permissionsPolicy",
	}
	
	for _, field := range specialStringFields {
		if value, ok := config[field].(string); ok {
			// Preserve string exactly, especially if it contains quotes
			config[field] = value
		}
	}
	
	// Process other header configuration values
	preserveTraefikValues(config)
}

// processPathMiddleware handles path manipulation middlewares
func processPathMiddleware(config map[string]interface{}) {
	// Special handling for regex patterns - these need exact preservation
	if regex, ok := config["regex"].(string); ok {
		// Preserve regex pattern exactly
		config["regex"] = regex
	} else if regexList, ok := config["regex"].([]interface{}); ok {
		// Handle regex arrays (like in stripPrefixRegex)
		for i, r := range regexList {
			if regexStr, ok := r.(string); ok {
				regexList[i] = regexStr
			}
		}
	}
	
	// Special handling for replacement patterns
	if replacement, ok := config["replacement"].(string); ok {
		// Preserve replacement pattern exactly
		config["replacement"] = replacement
	}
	
	// Special handling for path values
	if path, ok := config["path"].(string); ok {
		// Preserve path exactly
		config["path"] = path
	}
	
	// Special handling for prefixes arrays
	if prefixes, ok := config["prefixes"].([]interface{}); ok {
		for i, prefix := range prefixes {
			if prefixStr, ok := prefix.(string); ok {
				prefixes[i] = prefixStr
			}
		}
	}
	
	// Special handling for scheme
	if scheme, ok := config["scheme"].(string); ok {
		// Preserve scheme exactly
		config["scheme"] = scheme
	}
	
	// Process boolean options
	if forceSlash, ok := config["forceSlash"].(bool); ok {
		config["forceSlash"] = forceSlash
	}
	
	if permanent, ok := config["permanent"].(bool); ok {
		config["permanent"] = permanent
	}
	
	// Process other path manipulation configuration values
	preserveTraefikValues(config)
}

// processAuthMiddleware handles authentication middleware special processing
func processAuthMiddleware(config map[string]interface{}, middlewareType string) {
	// ForwardAuth middleware special handling
	if middlewareType == "forwardAuth" {
		if address, ok := config["address"].(string); ok {
			// Preserve address URL exactly
			config["address"] = address
		}
		
		// Process trust settings
		if trustForward, ok := config["trustForwardHeader"].(bool); ok {
			config["trustForwardHeader"] = trustForward
		}
		
		// Process headers array
		if headers, ok := config["authResponseHeaders"].([]interface{}); ok {
			for i, header := range headers {
				if headerStr, ok := header.(string); ok {
					headers[i] = headerStr
				}
			}
		}
	}
	
	// BasicAuth/DigestAuth middleware special handling
	if middlewareType == "basicAuth" || middlewareType == "digestAuth" {
		// Preserve exact format of users array
		if users, ok := config["users"].([]interface{}); ok {
			for i, user := range users {
				if userStr, ok := user.(string); ok {
					users[i] = userStr
				}
			}
		}
	}
	
	// Process other auth configuration values
	preserveTraefikValues(config)
}

// processRateLimitingMiddleware handles rate limiting middleware special processing
func processRateLimitingMiddleware(config map[string]interface{}, middlewareType string) {
	// Process numeric values
	if average, ok := config["average"].(float64); ok {
		// Convert to int if it's a whole number
		if average == float64(int(average)) {
			config["average"] = int(average)
		} else {
			config["average"] = average
		}
	}
	
	if burst, ok := config["burst"].(float64); ok {
		// Convert to int if it's a whole number
		if burst == float64(int(burst)) {
			config["burst"] = int(burst)
		} else {
			config["burst"] = burst
		}
	}
	
	if amount, ok := config["amount"].(float64); ok {
		// Convert to int if it's a whole number
		if amount == float64(int(amount)) {
			config["amount"] = int(amount)
		} else {
			config["amount"] = amount
		}
	}
	
	// Process sourceCriterion for inFlightReq
	if sourceCriterion, ok := config["sourceCriterion"].(map[string]interface{}); ok {
		// Process IP strategy
		if ipStrategy, ok := sourceCriterion["ipStrategy"].(map[string]interface{}); ok {
			// Process depth
			if depth, ok := ipStrategy["depth"].(float64); ok {
				ipStrategy["depth"] = int(depth)
			}
			
			// Process excluded IPs
			if excludedIPs, ok := ipStrategy["excludedIPs"].([]interface{}); ok {
				for i, ip := range excludedIPs {
					if ipStr, ok := ip.(string); ok {
						excludedIPs[i] = ipStr
					}
				}
			}
		}
		
		// Process requestHost boolean
		if requestHost, ok := sourceCriterion["requestHost"].(bool); ok {
			sourceCriterion["requestHost"] = requestHost
		}
	}
	
	// Process other rate limiting configuration values
	preserveTraefikValues(config)
}

// processIPFilteringMiddleware handles IP filtering middleware special processing
func processIPFilteringMiddleware(config map[string]interface{}) {
	// Process sourceRange IPs
	if sourceRange, ok := config["sourceRange"].([]interface{}); ok {
		for i, range_ := range sourceRange {
			if rangeStr, ok := range_.(string); ok {
				// Preserve IP CIDR notation exactly
				sourceRange[i] = rangeStr
			}
		}
	}
	
	// Process other IP filtering configuration values
	preserveTraefikValues(config)
}

// processPluginMiddleware handles plugin middleware special processing
func processPluginMiddleware(config map[string]interface{}) {
	// Process plugins (including CrowdSec)
	for _, pluginCfg := range config {
		if pluginConfig, ok := pluginCfg.(map[string]interface{}); ok {
			// Process special fields in plugin configurations
			
			// Process API keys and secrets - must be preserved exactly
			keyFields := []string{
				"crowdsecLapiKey", "apiKey", "token", "secret", "password", 
				"key", "accessKey", "secretKey", "captchaSiteKey", "captchaSecretKey",
			}
			
			for _, field := range keyFields {
				if val, exists := pluginConfig[field]; exists {
					if strVal, ok := val.(string); ok {
						// Ensure keys are preserved exactly as-is
						pluginConfig[field] = strVal
					}
				}
			}
			
			// Process boolean options
			boolFields := []string{
				"enabled", "failureBlock", "unreachableBlock", "insecureVerify",
				"allowLocalRequests", "logLocalRequests", "logAllowedRequests",
				"logApiRequests", "silentStartUp", "forceMonthlyUpdate",
				"allowUnknownCountries", "blackListMode", "addCountryHeader",
			}
			
			for _, field := range boolFields {
				for configKey, val := range pluginConfig {
					if strings.Contains(configKey, field) {
						if boolVal, ok := val.(bool); ok {
							pluginConfig[configKey] = boolVal
						}
					}
				}
			}
			
			// Process arrays
			arrayFields := []string{
				"forwardedHeadersTrustedIPs", "clientTrustedIPs", "countries",
			}
			
			for _, field := range arrayFields {
				for configKey, val := range pluginConfig {
					if strings.Contains(configKey, field) {
						if arrayVal, ok := val.([]interface{}); ok {
							for i, item := range arrayVal {
								if strItem, ok := item.(string); ok {
									arrayVal[i] = strItem
								}
							}
						}
					}
				}
			}
			
			// Process remaining fields
			preserveTraefikValues(pluginConfig)
		}
	}
}

// MiddlewareWithPriority represents a middleware with its priority value
type MiddlewareWithPriority struct {
    ID       string
    Priority int
}

// processServices fetches and processes all services for the configuration
func (cg *ConfigGenerator) processServices(config *TraefikConfig) error {
	// Fetch all services
	rows, err := cg.db.Query(`
		SELECT id, name, type, config
		FROM services
	`)
	if err != nil {
		return fmt.Errorf("failed to fetch services: %w", err)
	}
	defer rows.Close()

	// Setup service maps if not initialized
	if config.HTTP.Services == nil {
		config.HTTP.Services = make(map[string]interface{})
	}
	
	if config.TCP.Services == nil {
		config.TCP.Services = make(map[string]interface{})
	}
	
	if config.UDP.Services == nil {
		config.UDP.Services = make(map[string]interface{})
	}

	// Process services
	for rows.Next() {
		var id, name, typ, configStr string
		if err := rows.Scan(&id, &name, &typ, &configStr); err != nil {
			log.Printf("Failed to scan service row: %v", err)
			continue
		}

		// Parse service config
		var serviceConfig map[string]interface{}
		if err := json.Unmarshal([]byte(configStr), &serviceConfig); err != nil {
			log.Printf("Failed to parse service config for %s: %v", name, err)
			continue
		}

		// Process service config based on type
		serviceConfig = preserveTraefikValues(serviceConfig).(map[string]interface{})

		// Determine service protocol and add to appropriate section
		protocol := determineServiceProtocol(typ, serviceConfig)
		
		switch protocol {
		case "http":
			config.HTTP.Services[id] = map[string]interface{}{
				typ: serviceConfig,
			}
		case "tcp":
			config.TCP.Services[id] = map[string]interface{}{
				typ: serviceConfig,
			}
		case "udp":
			config.UDP.Services[id] = map[string]interface{}{
				typ: serviceConfig,
			}
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error during service rows iteration: %w", err)
	}

	return nil
}

// determineServiceProtocol determines if a service should be TCP, UDP, or HTTP based on configuration
func determineServiceProtocol(serviceType string, config map[string]interface{}) string {
	// Default to HTTP
	protocol := "http"
	
	// For loadBalancer, check server configuration
	if serviceType == "loadBalancer" {
		if servers, ok := config["servers"].([]interface{}); ok && len(servers) > 0 {
			for _, s := range servers {
				if server, ok := s.(map[string]interface{}); ok {
					// If server has address key, it's likely TCP or UDP
					if address, ok := server["address"].(string); ok && address != "" {
						// By default, assume TCP for address-based servers
						protocol = "tcp"
						
						// Check if this might be explicitly for UDP (based on naming convention)
						if strings.Contains(strings.ToLower(address), "udp") {
							protocol = "udp"
						}
						break
					}
					
					// If server has a URL, it's HTTP
					if _, ok := server["url"].(string); ok {
						protocol = "http"
						break
					}
				}
			}
		}
	}
	
	// For other service types, base it on the referenced services
	if serviceType == "weighted" || serviceType == "mirroring" || serviceType == "failover" {
		// For these services, we don't have enough information to determine the protocol
		// We could check the referenced services, but that would require additional DB lookups
		// For now, we'll keep it as HTTP by default
		protocol = "http"
	}
	
	return protocol
}

// updateResourceServices updates the service references in resource routers
func (cg *ConfigGenerator) updateResourceServices() error {
	// Get all active resources with their assigned services
	rows, err := cg.db.Query(`
		SELECT r.id, rs.service_id
		FROM resources r
		LEFT JOIN resource_services rs ON r.id = rs.resource_id
		WHERE r.status = 'active'
	`)
	if err != nil {
		return fmt.Errorf("failed to fetch resource services: %w", err)
	}
	defer rows.Close()

	// Map of resource IDs to service IDs
	resourceServices := make(map[string]string)

	for rows.Next() {
		var resourceID string
		var serviceID sql.NullString
		
		if err := rows.Scan(&resourceID, &serviceID); err != nil {
			log.Printf("Error scanning resource service: %v", err)
			continue
		}
		
		if serviceID.Valid {
			resourceServices[resourceID] = serviceID.String
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error during resource service rows iteration: %w", err)
	}

	// Nothing more to do here - the processResources function will use this information
	// when creating the router configurations
	
	return nil
}

// processResourcesWithServices processes resources with their assigned services
func (cg *ConfigGenerator) processResourcesWithServices(config *TraefikConfig) error {
	activeDSConfig, err := cg.configManager.GetActiveDataSourceConfig()
    if err != nil {
        log.Printf("Warning: Could not get active data source config in ConfigGenerator: %v. Defaulting provider logic.", err)
        activeDSConfig.Type = models.PangolinAPI // Default to Pangolin if config is unavailable
    }
    // Fetch all active resources with custom headers, router priority, source_type, and assigned services
    rows, err := cg.db.Query(`
        SELECT r.id, r.host, r.service_id, r.entrypoints, r.tls_domains,
               r.custom_headers, r.router_priority, r.source_type, 
               rm.middleware_id, rm.priority,
               rs.service_id as custom_service_id
        FROM resources r
        LEFT JOIN resource_middlewares rm ON r.id = rm.resource_id
        LEFT JOIN resource_services rs ON r.id = rs.resource_id
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
		SourceType    string // Added
		Entrypoints   string
		TLSDomains    string
		CustomHeaders string
		RouterPriority int
		CustomServiceID sql.NullString
	})

    for rows.Next() {
        var resourceID, host, serviceID, entrypoints, tlsDomains, customHeaders, sourceType string // Added sourceType
        var routerPriority sql.NullInt64
        var middlewareID sql.NullString
        var middlewarePriority sql.NullInt64
        var customServiceID sql.NullString

        if err := rows.Scan(&resourceID, &host, &serviceID, &entrypoints, &tlsDomains,
                           &customHeaders, &routerPriority, &sourceType, // Scan sourceType
                           &middlewareID, &middlewarePriority,
                           &customServiceID); err != nil {
            log.Printf("Failed to scan resource middleware: %v", err)
            continue
        }
		
		// Set default router priority if null
		priority := 100 // Default priority
		if routerPriority.Valid {
			priority = int(routerPriority.Int64)
		}
		
		// Store resource info and router priority
		resourceInfo[resourceID] = struct {
			Host          string
			ServiceID     string
			SourceType    string // Store sourceType
			Entrypoints   string
			TLSDomains    string
			CustomHeaders string
			RouterPriority int
			CustomServiceID sql.NullString
		}{
			Host:          host,
			ServiceID:     serviceID,
			SourceType:    sourceType, // Store sourceType
			Entrypoints:   entrypoints,
			TLSDomains:    tlsDomains,
			CustomHeaders: customHeaders,
			RouterPriority: priority,
			CustomServiceID: customServiceID,
		}
		
		if middlewareID.Valid {
			middleware := MiddlewareWithPriority{
				ID:       middlewareID.String,
				Priority: int(middlewarePriority.Int64),
			}
			resourceMiddlewares[resourceID] = append(resourceMiddlewares[resourceID], middleware)
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error during resource rows iteration: %w", err)
	}

	// Create routers for resources with custom middlewares and/or services
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
        processedEntrypoints := []string{"websecure"} // Default
        if info.Entrypoints != "" {
            rawEntrypoints := strings.Split(info.Entrypoints, ",")
            processedEntrypoints = make([]string, 0, len(rawEntrypoints))
            for _, ep := range rawEntrypoints {
                trimmed := strings.TrimSpace(ep)
                if trimmed != "" {
                    processedEntrypoints = append(processedEntrypoints, trimmed)
                }
            }
			// If after processing we have no valid entrypoints, use the default
            if len(processedEntrypoints) == 0 {
                processedEntrypoints = []string{"websecure"}
            }
        }
		
		
		// Process custom headers if present
        var customHeadersMiddleware string
        if info.CustomHeaders != "" && info.CustomHeaders != "{}" && info.CustomHeaders != "null" {
            var customHeadersMap map[string]string
            if err := json.Unmarshal([]byte(info.CustomHeaders), &customHeadersMap); err != nil {
                log.Printf("Failed to parse custom headers for resource %s: %v", resourceID, err)
            } else if len(customHeadersMap) > 0 {
                customHeadersMiddlewareID := fmt.Sprintf("%s-custom-headers", resourceID)
                processedHeaders := make(map[string]interface{})
                for k, v := range customHeadersMap {
                    processedHeaders[k] = v
                }
                config.HTTP.Middlewares[customHeadersMiddlewareID] = map[string]interface{}{
                    "headers": map[string]interface{}{
                        "customRequestHeaders": processedHeaders,
                    },
                }
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
		
        // Conditionally add "badger@http" only if in Pangolin mode
        if activeDSConfig.Type == models.PangolinAPI {
            if !stringSliceContains(middlewareIDs, "badger@http") {
                middlewareIDs = append(middlewareIDs, "badger@http")
            }
        }

		// Process middleware references to add provider suffixes
		for i, middlewareIDStr := range middlewareIDs {
            // Skip if already has a provider or is the dynamically generated custom header middleware (already suffixed)
            if strings.Contains(middlewareIDStr, "@") || middlewareIDStr == customHeadersMiddleware {
                continue
            }

            // Check if this middlewareIDStr matches an ID of a service defined in this config generation pass
            isServiceAsMiddleware := false
            if _, ok := config.HTTP.Services[middlewareIDStr]; ok {
                isServiceAsMiddleware = true
            } // Add checks for TCP/UDP if services can be middleware, though unlikely for HTTP router

            if isServiceAsMiddleware {
                // Services defined by this manager (and thus in config.HTTP.Services) are @file
                middlewareIDs[i] = fmt.Sprintf("%s@file", middlewareIDStr)
                log.Printf("Middleware %s for resource %s identified as service reference, using @file", middlewareIDStr, resourceID)
            } else {
                // Regular middlewares from the DB are considered @file
                middlewareIDs[i] = fmt.Sprintf("%s@file", middlewareIDStr)
            }
        }

		// Create a router with higher priority
		customRouterID := fmt.Sprintf("%s-auth", resourceID)
		
		// Determine which service to use
		var serviceReference string
        if info.CustomServiceID.Valid && info.CustomServiceID.String != "" {
            // Custom service assigned via Middleware Manager is always @file
            serviceReference = fmt.Sprintf("%s@file", info.CustomServiceID.String)
            log.Printf("Resource %s: Using custom service %s (provider: @file)", resourceID, serviceReference)
        } else {
            // No custom service, use the default service_id from the resource.
            // Determine its provider based on the resource's original source_type and the app's active data source.
            defaultProviderSuffix := "http" // Fallback or for Pangolin-originated resources in Pangolin mode
            if activeDSConfig.Type == models.TraefikAPI {
                if models.DataSourceType(info.SourceType) == models.TraefikAPI {
                    defaultProviderSuffix = "docker" // Resource from Traefik API, likely a Docker service
                }
                // If info.SourceType is PangolinAPI while app is in Traefik mode, still use http.
            }
            // If serviceID already contains a provider, use it as is.
            if strings.Contains(info.ServiceID, "@") {
                serviceReference = info.ServiceID
            } else {
                serviceReference = fmt.Sprintf("%s@%s", info.ServiceID, defaultProviderSuffix)
            }
            log.Printf("Resource %s: Using default service %s (resource source: %s, active source: %s)", resourceID, serviceReference, info.SourceType, activeDSConfig.Type)
        }

		// Basic router configuration - use the resource's router priority
		routerConfig := map[string]interface{}{
			"rule":        fmt.Sprintf("Host(`%s`)", info.Host),
			"service":     serviceReference,
			"entryPoints": processedEntrypoints,
			"middlewares": middlewareIDs,
			"priority":    info.RouterPriority, // Use the resource's router priority
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
    activeDSConfig, err := cg.configManager.GetActiveDataSourceConfig()
    if err != nil {
        log.Printf("Warning: Could not get active data source config in processTCPRouters: %v. Defaulting provider logic.", err)
        activeDSConfig.Type = models.PangolinAPI // Default
    }

    rows, err := cg.db.Query(`
        SELECT r.id, r.host, r.service_id, r.tcp_entrypoints, r.tcp_sni_rule, r.router_priority, r.source_type, 
               rs.service_id as custom_service_id
        FROM resources r
        LEFT JOIN resource_services rs ON r.id = rs.resource_id
        WHERE r.status = 'active' AND r.tcp_enabled = 1
    `)
    if err != nil {
        return fmt.Errorf("failed to fetch TCP resources: %w", err)
    }
    defer rows.Close()

    for rows.Next() {
        var id, host, serviceID, tcpEntrypoints, tcpSNIRule, resourceSourceType string
        var customServiceID sql.NullString
        var routerPriority sql.NullInt64

        if err := rows.Scan(&id, &host, &serviceID, &tcpEntrypoints, &tcpSNIRule, &routerPriority, &resourceSourceType, &customServiceID); err != nil {
            log.Printf("Failed to scan TCP resource: %v", err)
            continue
        }

        priority := 100
        if routerPriority.Valid {
            priority = int(routerPriority.Int64)
        }

        processedTCPEntrypoints := []string{"tcp"} // Default
        if tcpEntrypoints != "" {
            rawTCPEntrypoints := strings.Split(tcpEntrypoints, ",")
            processedTCPEntrypoints = make([]string, 0, len(rawTCPEntrypoints))
            for _, ep := range rawTCPEntrypoints {
                trimmed := strings.TrimSpace(ep)
                if trimmed != "" {
                    processedTCPEntrypoints = append(processedTCPEntrypoints, trimmed)
                }
            }
            if len(processedTCPEntrypoints) == 0 {
                processedTCPEntrypoints = []string{"tcp"}
            }
        }

        rule := fmt.Sprintf("HostSNI(`%s`)", host)
        if tcpSNIRule != "" {
            rule = tcpSNIRule
        }

        var tcpServiceReference string
        if customServiceID.Valid && customServiceID.String != "" {
            tcpServiceReference = fmt.Sprintf("%s@file", customServiceID.String)
            log.Printf("TCP Router %s: Using custom service %s (provider: @file)", id, tcpServiceReference)
        } else {
            defaultProviderSuffix := "http" // Fallback or Pangolin
            if activeDSConfig.Type == models.TraefikAPI {
                if models.DataSourceType(resourceSourceType) == models.TraefikAPI {
                     // For TCP, if service is from Docker, it's usually referenced by name directly by Traefik's Docker provider
                     // or if it's a loadbalancer of IPs, it has no specific provider for Traefik to auto-discover.
                     // If serviceID contains "@", assume it's already correct.
                    if !strings.Contains(serviceID, "@") {
                        // This implies the serviceID is a name Traefik's Docker provider will resolve.
                        defaultProviderSuffix = "docker" 
                    } else {
                        defaultProviderSuffix = "" // Keep existing provider
                    }
                }
            }
            if defaultProviderSuffix != "" && !strings.Contains(serviceID, "@") {
                tcpServiceReference = fmt.Sprintf("%s@%s", serviceID, defaultProviderSuffix)
            } else {
                tcpServiceReference = serviceID // Use as-is (already has provider or needs none for Traefik internal)
            }
             log.Printf("TCP Router %s: Using default service %s (resource source: %s, active source: %s)", id, tcpServiceReference, resourceSourceType, activeDSConfig.Type)
        }

        tcpRouterID := fmt.Sprintf("%s-tcp", id)
        config.TCP.Routers[tcpRouterID] = map[string]interface{}{
            "rule":        rule,
            "service":     tcpServiceReference,
            "entryPoints": processedTCPEntrypoints,
            "tls":         map[string]interface{}{}, // Enable TLS for SNI by default for TCP routers
            "priority":    priority,
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