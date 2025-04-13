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
	templates := DefaultTemplates{
		Middlewares: []DefaultMiddleware{
			{
				ID:   "authelia",
				Name: "Authelia",
				Type: "forwardAuth",
				Config: map[string]interface{}{
					"address":            "http://authelia:9091/api/verify?rd=https://auth.yourdomain.com",
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