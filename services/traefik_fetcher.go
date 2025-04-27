package services

import (
    "context"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "log"
    "net/http"
    "strings"
    "time"
    
    "github.com/hhftechnology/middleware-manager/models"
)

// TraefikFetcher fetches resources from Traefik API
type TraefikFetcher struct {
    config     models.DataSourceConfig
    httpClient *http.Client
}

// NewTraefikFetcher creates a new Traefik API fetcher
func NewTraefikFetcher(config models.DataSourceConfig) *TraefikFetcher {
    return &TraefikFetcher{
        config: config,
        httpClient: &http.Client{
            Timeout: 10 * time.Second,
        },
    }
}

// FetchResources fetches resources from Traefik API
func (f *TraefikFetcher) FetchResources(ctx context.Context) (*models.ResourceCollection, error) {
    // Create HTTP request with auth if needed
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.config.URL+"/api/http/routers", nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    
    // Add basic auth if configured
    if f.config.BasicAuth.Username != "" {
        req.SetBasicAuth(f.config.BasicAuth.Username, f.config.BasicAuth.Password)
    }
    
    // Execute request
    resp, err := f.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("HTTP request failed: %w", err)
    }
    defer resp.Body.Close()
    
    // Check status code
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
    }
    
    // Process response
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("failed to read response: %w", err)
    }
    
    // Parse the Traefik routers response
    var traefikRouters []models.TraefikRouter
    if err := json.Unmarshal(body, &traefikRouters); err != nil {
        return nil, fmt.Errorf("failed to parse JSON: %w", err)
    }
    
    // Convert Traefik routers to our internal model
    resources := &models.ResourceCollection{
        Resources: make([]models.Resource, 0, len(traefikRouters)),
    }
    
    for _, router := range traefikRouters {
        // Skip internal routers
        if router.Provider == "internal" {
            continue
        }
        
        // Skip routers without TLS (typically HTTP redirects)
        if router.TLS.CertResolver == "" {
            continue
        }
        
        // Extract host from rule
        host := extractHostFromRule(router.Rule)
        if host == "" {
            continue
        }
        
        resource := models.Resource{
            ID:             router.Name,
            Host:           host,
            ServiceID:      router.Service,
            Status:         "active",
            SourceType:     string(models.TraefikAPI),
            Entrypoints:    joinEntrypoints(router.EntryPoints),
            RouterPriority: router.Priority,
        }
        
        // Extract TLS domains if present
        if router.TLS.Domains != nil && len(router.TLS.Domains) > 0 {
            resource.TLSDomains = joinTLSDomains(router.TLS.Domains)
        }
        
        resources.Resources = append(resources.Resources, resource)
    }
    
    log.Printf("Fetched %d resources from Traefik API", len(resources.Resources))
    return resources, nil
}