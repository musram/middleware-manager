package services

import (
    "context"
    "fmt"
    "strings"
    
    "github.com/hhftechnology/middleware-manager/models"
)

// ResourceFetcher defines the interface for fetching resources
type ResourceFetcher interface {
    FetchResources(ctx context.Context) (*models.ResourceCollection, error)
}

// ResourceFetcherFactory creates the appropriate resource fetcher based on type
func NewResourceFetcher(config models.DataSourceConfig) (ResourceFetcher, error) {
    switch config.Type {
    case models.PangolinAPI:
        return NewPangolinFetcher(config), nil
    case models.TraefikAPI:
        return NewTraefikFetcher(config), nil
    default:
        return nil, fmt.Errorf("unknown data source type: %s", config.Type)
    }
}

// Helper function to extract host from a Traefik rule
func extractHostFromRule(rule string) string {
    // Simple regex-free parser for Host(`example.com`) pattern
    hostStart := "Host(`"
    if start := strings.Index(rule, hostStart); start != -1 {
        start += len(hostStart)
        if end := strings.Index(rule[start:], "`)"); end != -1 {
            return rule[start : start+end]
        }
    }
    return ""
}

// Helper function to join entrypoints into a comma-separated string
func joinEntrypoints(entrypoints []string) string {
    return strings.Join(entrypoints, ",")
}

// Helper function to extract TLS domains into a comma-separated string
func joinTLSDomains(domains []models.TraefikTLSDomain) string {
    var result []string
    for _, domain := range domains {
        if domain.Main != "" {
            result = append(result, domain.Main)
        }
        result = append(result, domain.Sans...)
    }
    return strings.Join(result, ",")
}