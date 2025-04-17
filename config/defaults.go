package config

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"

	"github.com/hhftechnology/middleware-manager/database"
	"gopkg.in/yaml.v3"
)

// DefaultMiddleware represents a default middleware template
type DefaultMiddleware struct {
	ID     string                 `yaml:"id"`
	Name   string                 `yaml:"name"`
	Type   string                 `yaml:"type"`
	Config map[string]interface{} `yaml:"config"`
}

// DefaultTemplates represents the structure of the templates.yaml file
type DefaultTemplates struct {
	Middlewares []DefaultMiddleware `yaml:"middlewares"`
}

// LoadDefaultTemplates loads the default middleware templates
func LoadDefaultTemplates(db *database.DB) error {
	// Determine the path to the templates file
	templatesFile := "config/templates.yaml"
	
	// Check if the file exists in the current directory
	if _, err := os.Stat(templatesFile); os.IsNotExist(err) {
		// Try to find it in different locations
		possiblePaths := []string{
			"/app/config/templates.yaml",  // Docker container path
			"templates.yaml",              // Current directory
		}
		
		found := false
		for _, path := range possiblePaths {
			if _, err := os.Stat(path); err == nil {
				templatesFile = path
				found = true
				break
			}
		}
		
		if !found {
			log.Printf("Warning: templates.yaml not found, skipping default templates")
			return nil
		}
	}
	
	// Read the templates file
	data, err := ioutil.ReadFile(templatesFile)
	if err != nil {
		return err
	}
	
	// Parse the YAML
	var templates DefaultTemplates
	if err := yaml.Unmarshal(data, &templates); err != nil {
		return err
	}
	
	// Add templates to the database if they don't exist
	for _, middleware := range templates.Middlewares {
		// Check if the middleware already exists
		var exists int
		err := db.QueryRow("SELECT 1 FROM middlewares WHERE id = ?", middleware.ID).Scan(&exists)
		if err == nil {
			// Middleware exists, skip
			continue
		}
		
		// Convert config to JSON string
		configJSON, err := json.Marshal(middleware.Config)
		if err != nil {
			log.Printf("Failed to marshal config for %s: %v", middleware.Name, err)
			continue
		}
		
		// Insert into database
		_, err = db.Exec(
			"INSERT INTO middlewares (id, name, type, config) VALUES (?, ?, ?, ?)",
			middleware.ID, middleware.Name, middleware.Type, string(configJSON),
		)
		
		if err != nil {
			log.Printf("Failed to insert middleware %s: %v", middleware.Name, err)
			continue
		}
		
		log.Printf("Added default middleware: %s", middleware.Name)
	}
	
	return nil
}

// EnsureConfigDirectory ensures the configuration directory exists
func EnsureConfigDirectory(path string) error {
	return os.MkdirAll(path, 0755)
}

// SaveTemplateFile saves the default templates file if it doesn't exist
func SaveTemplateFile(templatesDir string) error {
	templatesFile := filepath.Join(templatesDir, "templates.yaml")
	
	// Check if file already exists
	if _, err := os.Stat(templatesFile); err == nil {
		// File exists, skip
		return nil
	}
	
	// Create default templates
// Create default templates
templates := DefaultTemplates{
	Middlewares: []DefaultMiddleware{
		// Authentication middlewares
		{
			ID:   "authelia",
			Name: "Authelia",
			Type: "forwardAuth",
			Config: map[string]interface{}{
				"address":            "http://authelia:9091/api/authz/forward-auth",
				"trustForwardHeader": true,
				"authResponseHeaders": []string{
					"Remote-User",
					"Remote-Groups",
					"Remote-Name",
					"Remote-Email",
				},
			},
		},
		{
			ID:   "authentik",
			Name: "Authentik",
			Type: "forwardAuth",
			Config: map[string]interface{}{
				"address":            "http://authentik:9000/outpost.goauthentik.io/auth/traefik",
				"trustForwardHeader": true,
				"authResponseHeaders": []string{
					"X-authentik-username",
					"X-authentik-groups",
					"X-authentik-email",
					"X-authentik-name",
					"X-authentik-uid",
				},
			},
		},
		{
			ID:   "basic-auth",
			Name: "Basic Auth",
			Type: "basicAuth",
			Config: map[string]interface{}{
				"users": []string{
					"admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/",
				},
			},
		},
		{
			ID:   "digest-auth",
			Name: "Digest Auth",
			Type: "digestAuth",
			Config: map[string]interface{}{
				"users": []string{
					"test:traefik:a2688e031edb4be6a3797f3882655c05",
				},
			},
		},
		{
			ID:   "jwt-auth",
			Name: "JWT Authentication",
			Type: "forwardAuth",
			Config: map[string]interface{}{
				"address":            "http://jwt-auth:8080/verify",
				"trustForwardHeader": true,
				"authResponseHeaders": []string{
					"X-JWT-Sub",
					"X-JWT-Name",
					"X-JWT-Email",
				},
			},
		},
		
		// Security middlewares
		{
			ID:   "ip-whitelist",
			Name: "IP Whitelist",
			Type: "ipWhiteList",
			Config: map[string]interface{}{
				"sourceRange": []string{
					"127.0.0.1/32",
					"192.168.1.0/24",
					"10.0.0.0/8",
				},
			},
		},
		{
			ID:   "ip-allowlist",
			Name: "IP Allow List",
			Type: "ipAllowList",
			Config: map[string]interface{}{
				"sourceRange": []string{
					"127.0.0.1/32",
					"192.168.1.0/24",
					"10.0.0.0/8",
				},
			},
		},
		{
			ID:   "rate-limit",
			Name: "Rate Limit",
			Type: "rateLimit",
			Config: map[string]interface{}{
				"average": int(100),
				"burst":   int(50),
			},
		},
		{
			ID:   "headers-standard",
			Name: "Standard Security Headers",
			Type: "headers",
			Config: map[string]interface{}{
				"accessControlAllowMethods": []string{
					"GET",
					"OPTIONS",
					"PUT",
				},
				"browserXssFilter":        true,
				"contentTypeNosniff":      true,
				"customFrameOptionsValue": "\"SAMEORIGIN\"",
				"customResponseHeaders": map[string]string{
					"X-Forwarded-Proto": "\"https\"",
					"X-Robots-Tag":      "\"none,noarchive,nosnippet,notranslate,noimageindex\"",
					"server":            "",
				},
				"forceSTSHeader": true,
				"hostsProxyHeaders": []string{
					"X-Forwarded-Host",
				},
				"permissionsPolicy": "\"camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=()\"",
				"referrerPolicy":    "\"same-origin\"",
				"sslProxyHeaders": map[string]string{
					"X-Forwarded-Proto": "\"https\"",
				},
				"stsIncludeSubdomains": true,
				"stsPreload":           true,
				"stsSeconds":           int(63072000),
			},
		},
		{
			ID:   "in-flight-req",
			Name: "In-Flight Request Limiter",
			Type: "inFlightReq",
			Config: map[string]interface{}{
				"amount": int(10),
				"sourceCriterion": map[string]interface{}{
					"ipStrategy": map[string]interface{}{
						"depth": int(2),
						"excludedIPs": []string{
							"127.0.0.1/32",
						},
					},
				},
			},
		},
		{
			ID:   "pass-tls-cert",
			Name: "Pass TLS Client Certificate",
			Type: "passTLSClientCert",
			Config: map[string]interface{}{
				"pem": true,
			},
		},
		
		// Path manipulation middlewares
		{
			ID:   "add-prefix",
			Name: "Add Prefix",
			Type: "addPrefix",
			Config: map[string]interface{}{
				"prefix": "\"/api\"",
			},
		},
		{
			ID:   "strip-prefix",
			Name: "Strip Prefix",
			Type: "stripPrefix",
			Config: map[string]interface{}{
				"prefixes": []string{
					"/api",
					"/v1",
				},
				"forceSlash": true,
			},
		},
		{
			ID:   "strip-prefix-regex",
			Name: "Strip Prefix Regex",
			Type: "stripPrefixRegex",
			Config: map[string]interface{}{
				"regex": []string{
					"/foo/[a-z0-9]+/[0-9]+/",
				},
			},
		},
		{
			ID:   "replace-path",
			Name: "Replace Path",
			Type: "replacePath",
			Config: map[string]interface{}{
				"path": "\"/api\"",
			},
		},
		{
			ID:   "replace-path-regex",
			Name: "Replace Path Regex",
			Type: "replacePathRegex",
			Config: map[string]interface{}{
				"regex":       "\"^/foo/(.*)\"",
				"replacement": "\"/bar/$1\"",
			},
		},
		
		// Redirect middlewares
		{
			ID:   "redirect-regex",
			Name: "Redirect Regex",
			Type: "redirectRegex",
			Config: map[string]interface{}{
				"regex":       "\"^http://localhost/(.*)\"",
				"replacement": "\"https://example.com/${1}\"",
				"permanent":   true,
			},
		},
		{
			ID:   "redirect-scheme",
			Name: "Redirect to HTTPS",
			Type: "redirectScheme",
			Config: map[string]interface{}{
				"scheme":    "\"https\"",
				"port":      "\"443\"",
				"permanent": true,
			},
		},
		
		// Content processing middlewares
		{
			ID:   "compress",
			Name: "Compress Response",
			Type: "compress",
			Config: map[string]interface{}{
				"excludedContentTypes": []string{
					"text/event-stream",
				},
				"includedContentTypes": []string{
					"text/html",
					"text/plain",
					"application/json",
				},
				"minResponseBodyBytes": int(1024),
				"encodings": []string{
					"gzip",
					"br",
				},
			},
		},
		{
			ID:   "buffering",
			Name: "Request/Response Buffering",
			Type: "buffering",
			Config: map[string]interface{}{
				"maxRequestBodyBytes":  int(5000000),
				"memRequestBodyBytes":  int(2000000),
				"maxResponseBodyBytes": int(5000000),
				"memResponseBodyBytes": int(2000000),
				"retryExpression":      "\"IsNetworkError() && Attempts() < 2\"",
			},
		},
		{
			ID:   "content-type",
			Name: "Content Type Auto-Detector",
			Type: "contentType",
			Config: map[string]interface{}{},
		},
		
		// Error handling and reliability middlewares
		{
			ID:   "circuit-breaker",
			Name: "Circuit Breaker",
			Type: "circuitBreaker",
			Config: map[string]interface{}{
				"expression":        "\"NetworkErrorRatio() > 0.20 || ResponseCodeRatio(500, 600, 0, 600) > 0.25\"",
				"checkPeriod":       "\"10s\"",
				"fallbackDuration":  "\"30s\"",
				"recoveryDuration":  "\"60s\"",
				"responseCode":      int(503),
			},
		},
		{
			ID:   "retry",
			Name: "Retry Failed Requests",
			Type: "retry",
			Config: map[string]interface{}{
				"attempts":        int(3),
				"initialInterval": "\"100ms\"",
			},
		},
		{
			ID:   "error-pages",
			Name: "Custom Error Pages",
			Type: "errors",
			Config: map[string]interface{}{
				"status": []string{
					"500-599",
				},
				"service": "\"error-handler-service\"",
				"query":   "\"/{status}.html\"",
			},
		},
		{
			ID:   "grpc-web",
			Name: "gRPC Web",
			Type: "grpcWeb",
			Config: map[string]interface{}{
				"allowOrigins": []string{
					"*",
				},
			},
		},
		
		// Chain middlewares
		{
			ID:   "security-chain",
			Name: "Security Chain",
			Type: "chain",
			Config: map[string]interface{}{
				"middlewares": []string{
					"rate-limit",
					"ip-whitelist",
				},
			},
		},
		
		// Crowdsec plugin middleware with fixed number formatting
		{
			ID:   "crowdsec",
			Name: "Crowdsec",
			Type: "plugin",
			Config: map[string]interface{}{
				"crowdsec": map[string]interface{}{
					"enabled":                     true,
					"logLevel":                    "INFO",
					"updateIntervalSeconds":       int(15),
					"updateMaxFailure":            int(0),
					"defaultDecisionSeconds":      int(15),
					"httpTimeoutSeconds":          int(10),
					"crowdsecMode":                "live",
					"crowdsecAppsecEnabled":       true,
					"crowdsecAppsecHost":          "crowdsec:7422",
					"crowdsecAppsecFailureBlock":  true,
					"crowdsecAppsecUnreachableBlock": true,
					"crowdsecAppsecBodyLimit":     int(10485760),  // Use int instead of integer to avoid scientific notation
					"crowdsecLapiKey":             "PUT_YOUR_BOUNCER_KEY_HERE_OR_IT_WILL_NOT_WORK",
					"crowdsecLapiHost":            "crowdsec:8080",
					"crowdsecLapiScheme":          "http",
					"forwardedHeadersTrustedIPs": []string{
						"0.0.0.0/0",
					},
					"clientTrustedIPs": []string{
						"10.0.0.0/8",
						"172.16.0.0/12",
						"192.168.0.0/16",
					},
				},
			},
		},
		
		// Special use case middlewares
		{
			ID:   "nextcloud-dav",
			Name: "Nextcloud WebDAV Redirect",
			Type: "replacePathRegex",
			Config: map[string]interface{}{
				"regex":       "\"^/.well-known/ca(l|rd)dav\"",
				"replacement": "\"/remote.php/dav/\"",
			},
		},
		
		// Custom headers example with properly escaped quotes
		{
			ID:   "custom-headers-example",
			Name: "Custom Headers Example",
			Type: "headers",
			Config: map[string]interface{}{
				"customRequestHeaders": map[string]string{
					"X-Script-Name":        "\"test\"",
					"X-Custom-Value":       "\"value with spaces\"",
					"X-Custom-Request-Header": "",  // Remove header
				},
				"customResponseHeaders": map[string]string{
					"X-Custom-Response-Header": "\"value\"",
					"Server":                  "",  // Remove header
				},
			},
		},
	},
}
	
	// Convert to YAML
	data, err := yaml.Marshal(templates)
	if err != nil {
		return err
	}
	
	// Write to file
	return ioutil.WriteFile(templatesFile, data, 0644)
}