package services

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "strings"
    "time"

    "github.com/hhftechnology/middleware-manager/database"
    "github.com/hhftechnology/middleware-manager/models"
)

// ServiceWatcher watches for services using configured data source
type ServiceWatcher struct {
    db              *database.DB
    fetcher         ServiceFetcher
    configManager   *ConfigManager
    stopChan        chan struct{}
    isRunning       bool
}

// NewServiceWatcher creates a new service watcher
func NewServiceWatcher(db *database.DB, configManager *ConfigManager) (*ServiceWatcher, error) {
    // Get the active data source config
    dsConfig, err := configManager.GetActiveDataSourceConfig()
    if err != nil {
        return nil, fmt.Errorf("failed to get active data source config: %w", err)
    }
    
    // Create the fetcher
    fetcher, err := NewServiceFetcher(dsConfig)
    if err != nil {
        return nil, fmt.Errorf("failed to create service fetcher: %w", err)
    }
    
    return &ServiceWatcher{
        db:             db,
        fetcher:        fetcher,
        configManager:  configManager,
        stopChan:       make(chan struct{}),
        isRunning:      false,
    }, nil
}

// Start begins watching for services
func (sw *ServiceWatcher) Start(interval time.Duration) {
    if sw.isRunning {
        return
    }
    
    sw.isRunning = true
    log.Printf("Service watcher started, checking every %v", interval)

    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    // Do an initial check
    if err := sw.checkServices(); err != nil {
        log.Printf("Initial service check failed: %v", err)
    }

    for {
        select {
        case <-ticker.C:
            // Check if data source config has changed
            if err := sw.refreshFetcher(); err != nil {
                log.Printf("Failed to refresh service fetcher: %v", err)
            }
            
            if err := sw.checkServices(); err != nil {
                log.Printf("Service check failed: %v", err)
            }
        case <-sw.stopChan:
            log.Println("Service watcher stopped")
            return
        }
    }
}

// refreshFetcher updates the fetcher if the data source config has changed
func (sw *ServiceWatcher) refreshFetcher() error {
    dsConfig, err := sw.configManager.GetActiveDataSourceConfig()
    if err != nil {
        return fmt.Errorf("failed to get data source config: %w", err)
    }
    
    // Create a new fetcher with the updated config
    fetcher, err := NewServiceFetcher(dsConfig)
    if err != nil {
        return fmt.Errorf("failed to create service fetcher: %w", err)
    }
    
    // Update the fetcher
    sw.fetcher = fetcher
    return nil
}

// Stop stops the service watcher
func (sw *ServiceWatcher) Stop() {
    if !sw.isRunning {
        return
    }
    
    close(sw.stopChan)
    sw.isRunning = false
}

// checkServices fetches services from the configured data source and updates the database
func (sw *ServiceWatcher) checkServices() error {
    log.Println("Checking for services using configured data source...")
    
    // Create a context with timeout for the operation
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    // Fetch services using the configured fetcher
    services, err := sw.fetcher.FetchServices(ctx)
    if err != nil {
        return fmt.Errorf("failed to fetch services: %w", err)
    }

    // Get all existing services from the database
    var existingServices []string
    rows, err := sw.db.Query("SELECT id FROM services")
    if err != nil {
        return fmt.Errorf("failed to query existing services: %w", err)
    }
    
    for rows.Next() {
        var id string
        if err := rows.Scan(&id); err != nil {
            log.Printf("Error scanning service ID: %v", err)
            continue
        }
        existingServices = append(existingServices, id)
    }
    rows.Close()
    
    // Keep track of services we find
    foundServices := make(map[string]bool)

    // Check if there are any services
    if len(services.Services) == 0 {
        log.Println("No services found in data source")
        return nil
    }

    // Process services
    for _, service := range services.Services {
        // Skip invalid services
        if service.ID == "" || service.Type == "" {
            continue
        }

        // Process service
        if err := sw.updateOrCreateService(service); err != nil {
            log.Printf("Error processing service %s: %v", service.ID, err)
            // Continue processing other services even if one fails
            continue
        }
        
        // Mark this service as found
        foundServices[service.ID] = true
    }
    
    // Optionally, mark services as "inactive" if they no longer exist in the data source
    // This is commented out by default to avoid deleting user-created services
    /*
    for _, serviceID := range existingServices {
        if !foundServices[serviceID] {
            log.Printf("Service %s no longer exists in data source, consider marking as inactive", serviceID)
            // Optional: You could update a status field if you add one to the services table
            // _, err := sw.db.Exec("UPDATE services SET status = 'inactive' WHERE id = ?", serviceID)
        }
    }
    */
    
    return nil
}

// updateOrCreateService updates an existing service or creates a new one
// updateOrCreateService updates an existing service or creates a new one
func (sw *ServiceWatcher) updateOrCreateService(service models.Service) error {
    // Normalize service ID by removing additional provider suffixes
    normalizedID := getNormalizedServiceID(service.ID)
    
    // Check if service already exists using both original and normalized IDs
    var exists int
    var existingType, existingConfig string
    
    err := sw.db.QueryRow(
        "SELECT 1, type, config FROM services WHERE id = ? OR id LIKE ?", 
        service.ID, normalizedID+"@%",
    ).Scan(&exists, &existingType, &existingConfig)
    
    if err == nil {
        // Service exists, only update if it changed
        if shouldUpdateService(sw.db, service) {
            log.Printf("Updating existing service: %s (normalized from %s)", normalizedID, service.ID)
            return sw.updateService(service)
        }
        // Service exists and hasn't changed, skip update
        return nil
    } else if err != sql.ErrNoRows {
        // Unexpected error
        return fmt.Errorf("error checking if service exists: %w", err)
    }
    
    // Service doesn't exist, create it with normalized ID
    service.ID = normalizedID
    return sw.createService(service)
}

// getNormalizedServiceID removes redundant provider suffixes from service IDs
func getNormalizedServiceID(id string) string {
    // Remove any provider suffix but only if it's duplicated
    if strings.Contains(id, "@file@file") {
        // Handle double @file suffix
        if idx := strings.Index(id, "@file"); idx > 0 {
            return id[:idx] + "@file"
        }
    } else if idx := strings.Index(id, "@"); idx > 0 {
        // For other cases, just extract the base name
        return id[:idx]
    }
    return id
}

// shouldUpdateService determines if an existing service needs to be updated
func shouldUpdateService(db *database.DB, newService models.Service) bool {
    var existingType, existingConfig string
    
    err := db.QueryRow(
        "SELECT type, config FROM services WHERE id = ?", 
        newService.ID,
    ).Scan(&existingType, &existingConfig)
    
    if err != nil {
        // If there's an error, assume we should update
        log.Printf("Error checking existing service %s: %v", newService.ID, err)
        return true
    }
    
    // Check if the type has changed
    if existingType != newService.Type {
        return true
    }
    
    // Check if the configuration has changed
    // Parse both configs to compare them semantically
    var existingConfigMap map[string]interface{}
    var newConfigMap map[string]interface{}
    
    if err := json.Unmarshal([]byte(existingConfig), &existingConfigMap); err != nil {
        log.Printf("Error parsing existing config for %s: %v", newService.ID, err)
        return true
    }
    
    if err := json.Unmarshal([]byte(newService.Config), &newConfigMap); err != nil {
        log.Printf("Error parsing new config for %s: %v", newService.ID, err)
        return true
    }
    
    // Compare the configurations
    return configsAreDifferent(existingConfigMap, newConfigMap)
}

// configsAreDifferent compares two service configurations
func configsAreDifferent(config1, config2 map[string]interface{}) bool {
    // Check for key differences
    for key := range config1 {
        if _, exists := config2[key]; !exists {
            return true
        }
    }
    
    for key := range config2 {
        if _, exists := config1[key]; !exists {
            return true
        }
    }
    
    // Check server configurations
    servers1, hasServers1 := config1["servers"].([]interface{})
    servers2, hasServers2 := config2["servers"].([]interface{})
    
    if hasServers1 != hasServers2 {
        return true
    }
    
    if hasServers1 && hasServers2 {
        if len(servers1) != len(servers2) {
            return true
        }
        
        // Compare each server
        for i, server1 := range servers1 {
            server1Map, ok1 := server1.(map[string]interface{})
            server2Map, ok2 := servers2[i].(map[string]interface{})
            
            if !ok1 || !ok2 {
                return true
            }
            
            // Check URL/address fields
            url1, hasURL1 := server1Map["url"].(string)
            url2, hasURL2 := server2Map["url"].(string)
            
            if hasURL1 != hasURL2 || (hasURL1 && url1 != url2) {
                return true
            }
            
            addr1, hasAddr1 := server1Map["address"].(string)
            addr2, hasAddr2 := server2Map["address"].(string)
            
            if hasAddr1 != hasAddr2 || (hasAddr1 && addr1 != addr2) {
                return true
            }
        }
    }
    
    // For other service types, we would need to check specific fields
    // For simplicity, we'll consider them different if any common key has a different value
    for key, val1 := range config1 {
        if val2, exists := config2[key]; exists {
            // Skip servers as we've handled them above
            if key == "servers" {
                continue
            }
            
            // Handle primitive types
            switch v1 := val1.(type) {
            case string:
                v2, ok := val2.(string)
                if !ok || v1 != v2 {
                    return true
                }
            case float64:
                v2, ok := val2.(float64)
                if !ok || v1 != v2 {
                    return true
                }
            case bool:
                v2, ok := val2.(bool)
                if !ok || v1 != v2 {
                    return true
                }
            }
            
            // We don't do deep comparison of nested structures like healthCheck
            // If we need to be more precise, we could expand this function
        }
    }
    
    return false
}

// createService creates a new service in the database
// createService creates a new service in the database
func (sw *ServiceWatcher) createService(service models.Service) error {
    // Validate service type
    if !models.IsValidServiceType(service.Type) {
        // Try to determine proper type if it's invalid
        if strings.Contains(strings.ToLower(service.Type), "load") || 
           strings.Contains(service.Config, "servers") {
            service.Type = string(models.LoadBalancerType)
        } else if strings.Contains(strings.ToLower(service.Type), "weight") {
            service.Type = string(models.WeightedType)
        } else if strings.Contains(strings.ToLower(service.Type), "mirror") {
            service.Type = string(models.MirroringType)
        } else if strings.Contains(strings.ToLower(service.Type), "fail") {
            service.Type = string(models.FailoverType)
        } else {
            // Default to LoadBalancer if we can't determine
            service.Type = string(models.LoadBalancerType)
        }
    }
    
    // Process the service configuration
    var configMap map[string]interface{}
    if err := json.Unmarshal([]byte(service.Config), &configMap); err != nil {
        log.Printf("Error parsing service config for %s: %v, using empty config", service.ID, err)
        configMap = make(map[string]interface{})
    }
    
    // Apply any service-specific processing
    configMap = models.ProcessServiceConfig(service.Type, configMap)
    
    // Convert processed config back to JSON
    configJSON, err := json.Marshal(configMap)
    if err != nil {
        log.Printf("Error marshaling processed config for %s: %v", service.ID, err)
        configJSON = []byte("{}")
    }
    
    // Create a reasonable name if none provided
    if service.Name == "" {
        service.Name = formatServiceName(service.ID)
    }
    
    // Make sure we're not adding @file if the ID already has a provider
    serviceID := service.ID
    if !strings.Contains(serviceID, "@") {
        serviceID = serviceID + "@file" // Only add @file if no provider exists
    }
    
    log.Printf("Creating new service: %s (original ID: %s)", serviceID, service.ID)
    
    // Insert the service
    _, err = sw.db.Exec(
        "INSERT INTO services (id, name, type, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        serviceID, service.Name, service.Type, string(configJSON), time.Now(), time.Now(),
    )
    
    if err != nil {
        return fmt.Errorf("failed to insert service %s: %w", service.ID, err)
    }
    
    log.Printf("Created new service: %s (%s)", service.Name, serviceID)
    return nil
}

// updateService updates an existing service in the database
func (sw *ServiceWatcher) updateService(service models.Service) error {
    // Get the existing service to preserve the name
    var existingName string
    err := sw.db.QueryRow("SELECT name FROM services WHERE id = ?", service.ID).Scan(&existingName)
    
    if err != nil {
        log.Printf("Error fetching existing service name for %s: %v, using provided name", service.ID, err)
    } else if existingName != "" {
        // Preserve existing name unless the new name is meaningful
        if service.Name == service.ID || service.Name == "" {
            service.Name = existingName
        }
    }
    
    // Process the service configuration
    var configMap map[string]interface{}
    if err := json.Unmarshal([]byte(service.Config), &configMap); err != nil {
        log.Printf("Error parsing service config for %s: %v, using empty config", service.ID, err)
        configMap = make(map[string]interface{})
    }
    
    // Apply any service-specific processing
    configMap = models.ProcessServiceConfig(service.Type, configMap)
    
    // Convert processed config back to JSON
    configJSON, err := json.Marshal(configMap)
    if err != nil {
        log.Printf("Error marshaling processed config for %s: %v", service.ID, err)
        configJSON = []byte("{}")
    }
    
    // Update the service
    _, err = sw.db.Exec(
        "UPDATE services SET name = ?, type = ?, config = ?, updated_at = ? WHERE id = ?",
        service.Name, service.Type, string(configJSON), time.Now(), service.ID,
    )
    
    if err != nil {
        return fmt.Errorf("failed to update service %s: %w", service.ID, err)
    }
    
    log.Printf("Updated existing service: %s (%s)", service.Name, service.ID)
    return nil
}

// formatServiceName creates a readable name from a service ID
func formatServiceName(id string) string {
    // Remove provider suffix if present
    name := id
    if idx := strings.Index(name, "@"); idx > 0 {
        name = name[:idx]
    }
    
    // Replace dashes and underscores with spaces
    name = strings.ReplaceAll(name, "-", " ")
    name = strings.ReplaceAll(name, "_", " ")
    
    // Capitalize words
    parts := strings.Fields(name)
    for i, part := range parts {
        if len(part) > 0 {
            parts[i] = strings.ToUpper(part[:1]) + part[1:]
        }
    }
    
    return strings.Join(parts, " ")
}