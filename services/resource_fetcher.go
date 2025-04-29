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
    // Handle Host pattern - the original implementation
    hostStart := "Host(`"
    if start := strings.Index(rule, hostStart); start != -1 {
        start += len(hostStart)
        if end := strings.Index(rule[start:], "`)"); end != -1 {
            return rule[start : start+end]
        }
    }
    
    // Handle HostRegexp pattern
    hostRegexpStart := "HostRegexp(`"
    if start := strings.Index(rule, hostRegexpStart); start != -1 {
        start += len(hostRegexpStart)
        if end := strings.Index(rule[start:], "`)"); end != -1 {
            // Extract the regexp pattern
            pattern := rule[start : start+end]
            // Handle patterns like .+ by returning a useful name
            if pattern == ".+" {
                return "any-host" // Placeholder for wildcard
            }
            // Handle more specific patterns
            return extractHostFromRegexp(pattern)
        }
    }
    
    // Handle legacy Host:example.com pattern (no backticks)
    legacyHostStart := "Host:"
    if start := strings.Index(rule, legacyHostStart); start != -1 {
        start += len(legacyHostStart)
        // Extract until space, comma, or end of string
        end := len(rule)
        for i, c := range rule[start:] {
            if c == ' ' || c == ',' || c == ')' {
                end = start + i
                break
            }
        }
        if start < end {
            return rule[start:end]
        }
    }
    
    // Try to extract from complex rules with && operators
    if strings.Contains(rule, "&&") {
        parts := strings.Split(rule, "&&")
        for _, part := range parts {
            part = strings.TrimSpace(part)
            if host := extractHostFromRule(part); host != "" {
                return host
            }
        }
    }
    
    return ""
}

// Helper function to extract hostname from regex patterns
func extractHostFromRegexp(pattern string) string {
    // Handle common pattern formats for subdomains
    if strings.Contains(pattern, ".development.hhf.technology") {
        // Extract subdomain part if possible
        parts := strings.Split(pattern, ".development.hhf.technology")
        // Clean up any regex special chars from subdomain
        subdomain := cleanupRegexChars(parts[0])
        return subdomain + ".development.hhf.technology"
    }
    
    // Handle other domain patterns
    if strings.Contains(pattern, ".") {
        // Attempt to extract a domain-like pattern
        return cleanupRegexChars(pattern)
    }
    
    // Fallback
    return cleanupRegexChars(pattern)
}

// Helper function to clean up regex characters for readability
func cleanupRegexChars(s string) string {
    // Replace common regex patterns with simpler representations
    replacements := []struct {
        from string
        to   string
    }{
        {`\d+`, "N"},             // digit sequences
        {`[0-9]+`, "N"},          // digit class sequences
        {`[a-z0-9]+`, "x"},       // alphanumeric lowercase class
        {`[a-zA-Z0-9]+`, "x"},    // alphanumeric class
        {`[a-z]+`, "x"},          // alpha lowercase class
        {`[A-Z]+`, "X"},          // alpha uppercase class
        {`[a-zA-Z]+`, "X"},       // alpha class
        {`\w+`, "x"},             // word char sequences
        {`[^/]+`, "x"},           // non-slash sequences
        {`.*`, "x"},              // any char sequences
        {`.+`, "x"},              // one or more any char
        {`^`, ""},                // start anchor
        {`$`, ""},                // end anchor
        {`\`, ""},                // escapes
        {`(`, ""},                // groups
        {`)`, ""},
        {`{`, ""},                // repetition
        {`}`, ""},
        {`[`, ""},                // character classes
        {`]`, ""},
        {`?`, ""},                // optional
        {`*`, ""},                // zero or more
        {`+`, ""},                // one or more
        {`|`, "-"},               // alternation
    }
    
    result := s
    for _, r := range replacements {
        result = strings.Replace(result, r.from, r.to, -1)
    }
    
    return result
}

// Helper function to extract hostname from HostSNI rule
func extractHostSNI(rule string) string {
    hostStart := "HostSNI(`"
    if start := strings.Index(rule, hostStart); start != -1 {
        start += len(hostStart)
        if end := strings.Index(rule[start:], "`)"); end != -1 {
            return rule[start : start+end]
        }
    }
    return ""
}

// Helper function to extract hostname pattern from HostSNIRegexp rule
func extractHostSNIRegexp(rule string) string {
    hostStart := "HostSNIRegexp(`"
    if start := strings.Index(rule, hostStart); start != -1 {
        start += len(hostStart)
        if end := strings.Index(rule[start:], "`)"); end != -1 {
            return extractHostFromRegexp(rule[start : start+end])
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
    // Call the function from the models package
    return models.JoinTLSDomains(domains)
}