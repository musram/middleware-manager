package services

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "io"
    "io/ioutil"
    "log"
    "net/http"
    "strings"
    "time"

    "github.com/hhftechnology/middleware-manager/database"
    "github.com/hhftechnology/middleware-manager/models"
)

// ResourceWatcher watches for resources using configured data source
type ResourceWatcher struct {
    db              *database.DB
    fetcher         ResourceFetcher
    configManager   *ConfigManager
    stopChan        chan struct{}
    isRunning       bool
    httpClient      *http.Client
}

// NewResourceWatcher creates a new resource watcher
func NewResourceWatcher(db *database.DB, configManager *ConfigManager) (*ResourceWatcher, error) {
    // Get the active data source config
    dsConfig, err := configManager.GetActiveDataSourceConfig()
    if err != nil {
        return nil, fmt.Errorf("failed to get active data source config: %w", err)
    }
    
    // Create the fetcher
    fetcher, err := NewResourceFetcher(dsConfig)
    if err != nil {
        return nil, fmt.Errorf("failed to create resource fetcher: %w", err)
    }
    
    // Create HTTP client with timeout
    httpClient := &http.Client{
        Timeout: 10 * time.Second, // Set reasonable timeout
    }
    
    return &ResourceWatcher{
        db:             db,
        fetcher:        fetcher,
        configManager:  configManager,
        stopChan:       make(chan struct{}),
        isRunning:      false,
        httpClient:     httpClient,
    }, nil
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
            // Check if data source config has changed
            if err := rw.refreshFetcher(); err != nil {
                log.Printf("Failed to refresh resource fetcher: %v", err)
            }
            
            if err := rw.checkResources(); err != nil {
                log.Printf("Resource check failed: %v", err)
            }
        case <-rw.stopChan:
            log.Println("Resource watcher stopped")
            return
        }
    }
}

// refreshFetcher updates the fetcher if the data source config has changed
func (rw *ResourceWatcher) refreshFetcher() error {
    dsConfig, err := rw.configManager.GetActiveDataSourceConfig()
    if err != nil {
        return fmt.Errorf("failed to get data source config: %w", err)
    }
    
    // Create a new fetcher with the updated config
    fetcher, err := NewResourceFetcher(dsConfig)
    if err != nil {
        return fmt.Errorf("failed to create resource fetcher: %w", err)
    }
    
    // Update the fetcher
    rw.fetcher = fetcher
    return nil
}

// Stop stops the resource watcher
func (rw *ResourceWatcher) Stop() {
    if !rw.isRunning {
        return
    }
    
    close(rw.stopChan)
    rw.isRunning = false
}

// checkResources fetches resources from the configured data source and updates the database
func (rw *ResourceWatcher) checkResources() error {
    log.Println("Checking for resources using configured data source...")
    
    // Create a context with timeout for the operation
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    // Fetch resources using the configured fetcher
    resources, err := rw.fetcher.FetchResources(ctx)
    if err != nil {
        return fmt.Errorf("failed to fetch resources: %w", err)
    }

    // Get all existing resources from the database
    var existingResources []string
    rows, err := rw.db.Query("SELECT id FROM resources WHERE status = 'active'")
    if err != nil {
        return fmt.Errorf("failed to query existing resources: %w", err)
    }
    
    for rows.Next() {
        var id string
        if err := rows.Scan(&id); err != nil {
            log.Printf("Error scanning resource ID: %v", err)
            continue
        }
        existingResources = append(existingResources, id)
    }
    rows.Close()
    
    // Keep track of resources we find
    foundResources := make(map[string]bool)

    // Check if there are any resources
    if len(resources.Resources) == 0 {
        log.Println("No resources found in data source")
        // Mark all existing resources as disabled since there are no active resources
        for _, resourceID := range existingResources {
            log.Printf("No active resources, marking resource %s as disabled", resourceID)
            _, err := rw.db.Exec(
                "UPDATE resources SET status = 'disabled', updated_at = ? WHERE id = ?",
                time.Now(), resourceID,
            )
            if err != nil {
                log.Printf("Error marking resource as disabled: %v", err)
            }
        }
        return nil
    }

    // Process resources
    for _, resource := range resources.Resources {
        // Skip invalid resources
        if resource.Host == "" || resource.ServiceID == "" {
            continue
        }

        // Process resource
        if err := rw.updateOrCreateResource(resource); err != nil {
            log.Printf("Error processing resource %s: %v", resource.ID, err)
            // Continue processing other resources even if one fails
            continue
        }
        
        // Mark this resource as found
        foundResources[resource.ID] = true
    }
    
    // Mark resources as disabled if they no longer exist in the data source
    for _, resourceID := range existingResources {
        if !foundResources[resourceID] {
            log.Printf("Resource %s no longer exists, marking as disabled", resourceID)
            _, err := rw.db.Exec(
                "UPDATE resources SET status = 'disabled', updated_at = ? WHERE id = ?",
                time.Now(), resourceID,
            )
            if err != nil {
                log.Printf("Error marking resource as disabled: %v", err)
            }
        }
    }
    
    return nil
}

// updateOrCreateResource updates an existing resource or creates a new one
// normalizeResourceID removes cascading auth suffixes and provider suffixes from resource IDs
func normalizeResourceID(id string) string {
    // First, remove any provider suffix (if present)
    baseName := id
    if idx := strings.Index(baseName, "@"); idx > 0 {
        baseName = baseName[:idx]
    }
    
    // Check if this is a router resource
    if !strings.Contains(baseName, "-router") {
        return baseName // Not a router resource, return without suffix processing
    }
    
    // Handle cascading auth patterns
    // Extract the base router pattern (e.g., "1-router" from "1-router-auth-auth-auth...")
    routerParts := strings.SplitN(baseName, "-router", 2)
    if len(routerParts) != 2 {
        return baseName // Unexpected format, return as is
    }
    
    // Check if we have auth suffixes
    suffixPart := routerParts[1]
    if strings.Contains(suffixPart, "-auth") {
        // Replace all cascading -auth suffixes with just one -auth
        // First, handle the case of -router-auth pattern
        if strings.HasPrefix(suffixPart, "-auth") {
            return routerParts[0] + "-router-auth"
        }
        
        // Handle cases like -router-redirect-auth with a single preserved redirect component
        redirectParts := strings.SplitN(suffixPart, "-auth", 2)
        if len(redirectParts) > 1 && redirectParts[0] != "" {
            return routerParts[0] + "-router" + redirectParts[0] + "-auth"
        }
    }
    
    // If no auth suffixes or couldn't parse properly, return the original base name
    return baseName
}

// updateOrCreateResource updates an existing resource or creates a new one

// updateOrCreateResource updates an existing resource or creates a new one
func (rw *ResourceWatcher) updateOrCreateResource(resource models.Resource) error {
    // Normalize the resource ID to handle cascading auth suffixes
    normalizedID := normalizeResourceID(resource.ID)
    
    // For logging purposes, keep track if we normalized the ID
    originalID := resource.ID
    wasNormalized := normalizedID != originalID
    
    // Check if resource already exists with either the original or normalized ID
    var exists int
    var status string
    var entrypoints, tlsDomains, tcpEntrypoints, tcpSNIRule, customHeaders string
    var tcpEnabled int
    var routerPriority sql.NullInt64
    
    // First try exact match with the original ID
    err := rw.db.QueryRow(`
        SELECT 1, status, entrypoints, tls_domains, tcp_enabled, tcp_entrypoints, tcp_sni_rule, 
               custom_headers, router_priority
        FROM resources WHERE id = ?
    `, resource.ID).Scan(&exists, &status, &entrypoints, &tlsDomains, &tcpEnabled, 
                       &tcpEntrypoints, &tcpSNIRule, &customHeaders, &routerPriority)
    
    // If exact match not found and ID was normalized, try with pattern matching
    if err == sql.ErrNoRows && wasNormalized {
        // Try to find any resource that matches the normalized pattern with potential suffixes
        // Use LIKE query with escape for special characters in the ID
        normalizedPattern := normalizedID + "%"
        if strings.Contains(normalizedID, "-router") {
            // For router resources, specifically match auth suffix pattern
            normalizedPattern = strings.Replace(normalizedID, "-router", "-router%", 1)
        }
        
        err = rw.db.QueryRow(`
            SELECT 1, status, entrypoints, tls_domains, tcp_enabled, tcp_entrypoints, tcp_sni_rule, 
                   custom_headers, router_priority
            FROM resources WHERE id LIKE ? LIMIT 1
        `, normalizedPattern).Scan(&exists, &status, &entrypoints, &tlsDomains, &tcpEnabled, 
                                &tcpEntrypoints, &tcpSNIRule, &customHeaders, &routerPriority)
        
        // If found via pattern match, log it for debugging
        if err == nil {
            log.Printf("Found resource via pattern matching: %s matches normalized pattern %s", 
                     resource.ID, normalizedPattern)
        }
    }
    
    if err == nil {
        // Resource exists, update essential fields but preserve custom configuration
        // If we found a match via normalization, use the normalized ID for the update
        updateID := resource.ID
        if wasNormalized {
            // Use the normalized ID for the update to prevent future duplication
            updateID = normalizedID
            log.Printf("Updating with normalized ID: %s (was %s)", normalizedID, originalID)
        }
        
        _, err = rw.db.Exec(
            "UPDATE resources SET id = ?, host = ?, service_id = ?, status = 'active', source_type = ?, updated_at = ? WHERE id LIKE ?",
            updateID, resource.Host, resource.ServiceID, resource.SourceType, time.Now(), 
            // Use pattern matching for the WHERE clause to catch all variations
            strings.Replace(normalizedID, "-router", "-router%", 1),
        )
        if err != nil {
            return fmt.Errorf("failed to update resource %s: %w", resource.ID, err)
        }
        
        if status == "disabled" {
            log.Printf("Resource %s was disabled but is now active again", updateID)
        }
        
        return nil
    }

    // Handle default values for new resources
    if resource.Entrypoints == "" {
        resource.Entrypoints = "websecure"
    }
    
    if resource.OrgID == "" {
        resource.OrgID = "unknown"
    }
    
    if resource.SiteID == "" {
        resource.SiteID = "unknown"
    }
    
    tcpEnabledValue := 0
    if resource.TCPEnabled {
        tcpEnabledValue = 1
    }
    
    // Use default router priority if not set
    if resource.RouterPriority == 0 {
        resource.RouterPriority = 100 // Default priority
    }
    
    // For new resources, always use the normalized ID to prevent duplication
    if wasNormalized {
        log.Printf("Creating new resource with normalized ID: %s (was %s)", normalizedID, originalID)
        resource.ID = normalizedID
    }
    
    // Create new resource with default configuration
    _, err = rw.db.Exec(`
        INSERT INTO resources (
            id, host, service_id, org_id, site_id, status, source_type,
            entrypoints, tls_domains, tcp_enabled, tcp_entrypoints, tcp_sni_rule,
            custom_headers, router_priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, resource.ID, resource.Host, resource.ServiceID, resource.OrgID, resource.SiteID,
       resource.SourceType, resource.Entrypoints, resource.TLSDomains, tcpEnabledValue,
       resource.TCPEntrypoints, resource.TCPSNIRule, resource.CustomHeaders, 
       resource.RouterPriority, time.Now(), time.Now())
    
    if err != nil {
        return fmt.Errorf("failed to create resource %s: %w", resource.ID, err)
    }

    log.Printf("Added new resource: %s (%s)", resource.Host, resource.ID)
    return nil
}
// fetchTraefikConfig fetches the Traefik configuration from the data source
// This method is kept for backward compatibility with the original implementation
func (rw *ResourceWatcher) fetchTraefikConfig(ctx context.Context) (*models.PangolinTraefikConfig, error) {
    // Get the active data source config
    dsConfig, err := rw.configManager.GetActiveDataSourceConfig()
    if err != nil {
        return nil, fmt.Errorf("failed to get data source config: %w", err)
    }
    
    // Build the URL based on data source type
    var url string
    if dsConfig.Type == models.PangolinAPI {
        url = fmt.Sprintf("%s/traefik-config", dsConfig.URL)
    } else {
        return nil, fmt.Errorf("unsupported data source type for this operation: %s", dsConfig.Type)
    }
    
    // Create a request with context
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    
    // Add basic auth if configured
    if dsConfig.BasicAuth.Username != "" {
        req.SetBasicAuth(dsConfig.BasicAuth.Username, dsConfig.BasicAuth.Password)
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
    body, err := ioutil.ReadAll(io.LimitReader(resp.Body, 10*1024*1024)) // 10MB limit
    if err != nil {
        return nil, fmt.Errorf("failed to read response body: %w", err)
    }

    // Parse JSON
    var config models.PangolinTraefikConfig
    if err := json.Unmarshal(body, &config); err != nil {
        return nil, fmt.Errorf("failed to parse JSON: %w", err)
    }

    // Initialize empty maps if they're nil to prevent nil pointer dereferences
    if config.HTTP.Routers == nil {
        config.HTTP.Routers = make(map[string]models.PangolinRouter)
    }
    if config.HTTP.Services == nil {
        config.HTTP.Services = make(map[string]models.PangolinService)
    }

    return &config, nil
}

// isSystemRouterForResourceWatcher checks if a router is a system router (to be skipped)
// This is renamed to prevent collision with the function in pangolin_fetcher.go
func isSystemRouterForResourceWatcher(routerID string) bool {
    systemPrefixes := []string{
        "api-router",
        "next-router",
        "ws-router",
        "dashboard",
        "api@internal",
        "acme-http",
    }
    
    for _, prefix := range systemPrefixes {
        if strings.Contains(routerID, prefix) {
            return true
        }
    }
    
    return false
}