package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/hhftechnology/middleware-manager/database"
	"github.com/hhftechnology/middleware-manager/models"
)

// ResourceWatcher watches for resources in Pangolin
type ResourceWatcher struct {
	db            *database.DB
	pangolinAPI   string
	stopChan      chan struct{}
	isRunning     bool
	httpClient    *http.Client
}

// NewResourceWatcher creates a new resource watcher
func NewResourceWatcher(db *database.DB, pangolinAPI string) *ResourceWatcher {
	// Create HTTP client with timeout
	httpClient := &http.Client{
		Timeout: 10 * time.Second, // Set reasonable timeout
	}
	
	return &ResourceWatcher{
		db:          db,
		pangolinAPI: pangolinAPI,
		stopChan:    make(chan struct{}),
		isRunning:   false,
		httpClient:  httpClient,
	}
}

// Start begins watching for resources
func (rw *ResourceWatcher) Start(interval time.Duration) {
	if rw.isRunning {
		return
	}
	
	rw.isRunning = true
	log.Printf("Resource watcher started, checking every %v", interval)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Do an initial check
	if err := rw.checkResources(); err != nil {
		log.Printf("Initial resource check failed: %v", err)
	}

	for {
		select {
		case <-ticker.C:
			if err := rw.checkResources(); err != nil {
				log.Printf("Resource check failed: %v", err)
			}
		case <-rw.stopChan:
			log.Println("Resource watcher stopped")
			return
		}
	}
}

// Stop stops the resource watcher
func (rw *ResourceWatcher) Stop() {
	if !rw.isRunning {
		return
	}
	
	close(rw.stopChan)
	rw.isRunning = false
}

// checkResources fetches resources from Pangolin and updates the database
func (rw *ResourceWatcher) checkResources() error {
	log.Println("Checking for resources in Pangolin...")
	
	// Create a context with timeout for the operation
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	// Fetch Traefik configuration from Pangolin
	config, err := rw.fetchTraefikConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch Traefik config: %w", err)
	}

	// Process routers to find resources
	for routerID, router := range config.HTTP.Routers {
		// Skip non-SSL routers (usually HTTP redirects)
		if router.TLS.CertResolver == "" {
			continue
		}

		// Extract host from rule (e.g., "Host(`example.com`)")
		host := extractHostFromRule(router.Rule)
		if host == "" {
			continue
		}

		// Skip Pangolin's own routers
		if isSystemRouter(routerID) {
			continue
		}

		// Get or create the resource
		serviceID := router.Service
		
		if err := rw.updateOrCreateResource(routerID, host, serviceID); err != nil {
			log.Printf("Error processing resource %s: %v", routerID, err)
			// Continue processing other resources even if one fails
			continue
		}
	}
	
	return nil
}

// updateOrCreateResource updates an existing resource or creates a new one
func (rw *ResourceWatcher) updateOrCreateResource(resourceID, host, serviceID string) error {
	// Check if resource already exists
	var exists int
	err := rw.db.QueryRow("SELECT 1 FROM resources WHERE id = ?", resourceID).Scan(&exists)
	if err == nil {
		// Resource exists, update if needed
		_, err = rw.db.Exec(
			"UPDATE resources SET host = ?, service_id = ?, updated_at = ? WHERE id = ?",
			host, serviceID, time.Now(), resourceID,
		)
		if err != nil {
			return fmt.Errorf("failed to update resource %s: %w", resourceID, err)
		}
		return nil
	}

	// Create new resource (with placeholder org_id and site_id)
	_, err = rw.db.Exec(
		"INSERT INTO resources (id, host, service_id, org_id, site_id) VALUES (?, ?, ?, ?, ?)",
		resourceID, host, serviceID, "unknown", "unknown",
	)
	if err != nil {
		return fmt.Errorf("failed to create resource %s: %w", resourceID, err)
	}

	log.Printf("Added new resource: %s (%s)", host, resourceID)
	return nil
}

// fetchTraefikConfig fetches the Traefik configuration from Pangolin
func (rw *ResourceWatcher) fetchTraefikConfig(ctx context.Context) (*models.PangolinTraefikConfig, error) {
	// Build the URL
	url := fmt.Sprintf("%s/traefik-config", rw.pangolinAPI)
	
	// Create a request with context
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	// Make the request
	resp, err := rw.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP request returned status %d", resp.StatusCode)
	}

	// Read response body with a limit to prevent memory issues
	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024)) // 10MB limit
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse JSON
	var config models.PangolinTraefikConfig
	if err := json.Unmarshal(body, &config); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return &config, nil
}

// isSystemRouter checks if a router is a system router (to be skipped)
func isSystemRouter(routerID string) bool {
	systemPrefixes := []string{
		"api-router",
		"next-router",
		"ws-router",
	}
	
	for _, prefix := range systemPrefixes {
		if strings.Contains(routerID, prefix) {
			return true
		}
	}
	
	return false
}

// extractHostFromRule extracts the host from a Traefik rule
// Example: "Host(`example.com`) && PathPrefix(`/api`)" -> "example.com"
func extractHostFromRule(rule string) string {
	if !strings.Contains(rule, "Host(`") {
		return ""
	}

	parts := strings.Split(rule, "Host(`")
	if len(parts) < 2 {
		return ""
	}

	host := strings.Split(parts[1], "`)")
	if len(host) < 1 {
		return ""
	}

	return host[0]
}