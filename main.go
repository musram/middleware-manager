package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/hhftechnology/middleware-manager/api"
	"github.com/hhftechnology/middleware-manager/config"
	"github.com/hhftechnology/middleware-manager/database"
	"github.com/hhftechnology/middleware-manager/services"
)

// Configuration represents the application configuration
type Configuration struct {
	PangolinAPIURL   string
	TraefikAPIURL    string
	TraefikConfDir   string
	DBPath           string
	Port             string
	UIPath           string
	ConfigDir        string
	CheckInterval    time.Duration
	GenerateInterval time.Duration
	Debug            bool
	AllowCORS        bool
	CORSOrigin       string
	ActiveDataSource string
}

// DiscoverTraefikAPI attempts to discover the Traefik API by trying common URLs
func DiscoverTraefikAPI() (string, error) {
	client := &http.Client{
		Timeout: 2 * time.Second, // Short timeout for discovery
	}

	// Common URLs to try
	urls := []string{
		"http://host.docker.internal:8080",
		"http://localhost:8080",
		"http://127.0.0.1:8080",
		"http://traefik:8080",
	}

	for _, url := range urls {
		testURL := url + "/api/version"
		resp, err := client.Get(testURL)
		if err == nil && resp.StatusCode == http.StatusOK {
			resp.Body.Close()
			log.Printf("Discovered Traefik API at %s", url)
			return url, nil
		}
		if resp != nil {
			resp.Body.Close()
		}
	}

	return "", nil // Return empty string without error to allow fallbacks
}

func main() {
	log.Println("Starting Middleware Manager...")

	// Parse command line flags
	var debug bool
	flag.BoolVar(&debug, "debug", false, "Enable debug mode")
	flag.Parse()

	// Load configuration
	cfg := loadConfiguration(debug)

	// Try to discover Traefik API URL if not set in environment
	if os.Getenv("TRAEFIK_API_URL") == "" {
		if discoveredURL, err := DiscoverTraefikAPI(); err == nil && discoveredURL != "" {
			log.Printf("Auto-discovered Traefik API URL: %s", discoveredURL)
			cfg.TraefikAPIURL = discoveredURL
		}
	}

	// Initialize database
	db, err := database.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()
	
	// Ensure config directory exists
	configDir := cfg.ConfigDir
	if err := config.EnsureConfigDirectory(configDir); err != nil {
		log.Printf("Warning: Failed to create config directory: %v", err)
	}
	
	// Save default templates file if it doesn't exist
	if err := config.SaveTemplateFile(configDir); err != nil {
		log.Printf("Warning: Failed to save default templates: %v", err)
	}
	
	// Load default middleware templates
	if err := config.LoadDefaultTemplates(db); err != nil {
		log.Printf("Warning: Failed to load default templates: %v", err)
	}

	// Initialize config manager
	configManager, err := services.NewConfigManager(filepath.Join(configDir, "config.json"))
	if err != nil {
		log.Fatalf("Failed to initialize config manager: %v", err)
	}

	// Ensure default data sources are configured with potentially discovered URL
	configManager.EnsureDefaultDataSources(cfg.PangolinAPIURL, cfg.TraefikAPIURL)

	// Create stop channel for graceful shutdown
	stopChan := make(chan struct{})
	
	// Start resource watcher with config manager
	resourceWatcher, err := services.NewResourceWatcher(db, configManager)
	if err != nil {
		log.Fatalf("Failed to create resource watcher: %v", err)
	}
	go resourceWatcher.Start(cfg.CheckInterval)

	// Start configuration generator
	configGenerator := services.NewConfigGenerator(db, cfg.TraefikConfDir)
	go configGenerator.Start(cfg.GenerateInterval)

	// Start API server
	serverConfig := api.ServerConfig{
		Port:       cfg.Port,
		UIPath:     cfg.UIPath,
		Debug:      cfg.Debug,
		AllowCORS:  cfg.AllowCORS,
		CORSOrigin: cfg.CORSOrigin,
	}
	
	server := api.NewServer(db.DB, serverConfig, configManager)
	go func() {
		if err := server.Start(); err != nil {
			log.Printf("Server error: %v", err)
			close(stopChan)
		}
	}()

	// Wait for shutdown signal or server error
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)
	
	select {
	case <-signalChan:
		log.Println("Received shutdown signal")
	case <-stopChan:
		log.Println("Received stop signal from server")
	}

	// Graceful shutdown
	log.Println("Shutting down...")
	resourceWatcher.Stop()
	configGenerator.Stop()
	server.Stop()
	log.Println("Middleware Manager stopped")
}

// loadConfiguration loads configuration from environment variables
func loadConfiguration(debug bool) Configuration {
	// Default check interval is 30 seconds
	checkInterval := 30 * time.Second
	if intervalStr := getEnv("CHECK_INTERVAL_SECONDS", "30"); intervalStr != "" {
		if interval, err := strconv.Atoi(intervalStr); err == nil && interval > 0 {
			checkInterval = time.Duration(interval) * time.Second
		}
	}
	
	// Default generate interval is 10 seconds
	generateInterval := 10 * time.Second
	if intervalStr := getEnv("GENERATE_INTERVAL_SECONDS", "10"); intervalStr != "" {
		if interval, err := strconv.Atoi(intervalStr); err == nil && interval > 0 {
			generateInterval = time.Duration(interval) * time.Second
		}
	}
	
	// Allow CORS if specified
	allowCORS := false
	if corsStr := getEnv("ALLOW_CORS", "false"); corsStr != "" {
		allowCORS = strings.ToLower(corsStr) == "true"
	}
	
	// Override debug mode from environment if specified
	if debugStr := getEnv("DEBUG", ""); debugStr != "" {
		debug = strings.ToLower(debugStr) == "true"
	}
	
	return Configuration{
		PangolinAPIURL:   getEnv("PANGOLIN_API_URL", "http://pangolin:3001/api/v1"),
		// Changed to use host.docker.internal as first default to better support Docker environments
		TraefikAPIURL:    getEnv("TRAEFIK_API_URL", "http://host.docker.internal:8080"),
		TraefikConfDir:   getEnv("TRAEFIK_CONF_DIR", "/conf"),
		DBPath:           getEnv("DB_PATH", "/data/middleware.db"),
		Port:             getEnv("PORT", "3456"),
		UIPath:           getEnv("UI_PATH", "/app/ui/build"),
		ConfigDir:        getEnv("CONFIG_DIR", "/app/config"),
		ActiveDataSource: getEnv("ACTIVE_DATA_SOURCE", "pangolin"),
		CheckInterval:    checkInterval,
		GenerateInterval: generateInterval,
		Debug:            debug,
		AllowCORS:        allowCORS,
		CORSOrigin:       getEnv("CORS_ORIGIN", ""),
	}
}

// getEnv gets an environment variable or returns a default value
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}