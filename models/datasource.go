package models

import "time"

// DataSourceType represents the type of data source
type DataSourceType string

const (
    PangolinAPI DataSourceType = "pangolin"
    TraefikAPI  DataSourceType = "traefik"
)

// DataSourceConfig represents configuration for a data source
type DataSourceConfig struct {
    Type      DataSourceType `json:"type"`
    URL       string         `json:"url"`
    BasicAuth struct {
        Username string `json:"username"`
        Password string `json:"password"`
    } `json:"basic_auth,omitempty"`
}

// SystemConfig represents the overall system configuration
type SystemConfig struct {
    ActiveDataSource string                     `json:"active_data_source"`
    DataSources      map[string]DataSourceConfig `json:"data_sources"`
}

// TraefikRouter represents a router configuration from Traefik API
type TraefikRouter struct {
    EntryPoints []string            `json:"entryPoints"`
    Middlewares []string            `json:"middlewares"`
    Service     string              `json:"service"`
    Rule        string              `json:"rule"`
    Priority    int                 `json:"priority"`
    TLS         TraefikTLSConfig    `json:"tls"`
    Status      string              `json:"status"`
    Name        string              `json:"name"`
    Provider    string              `json:"provider"`
}

// TraefikTLSConfig represents TLS configuration in Traefik
type TraefikTLSConfig struct {
    CertResolver string             `json:"certResolver"`
    Domains      []TraefikTLSDomain `json:"domains"`
}

// TraefikTLSDomain represents a domain in Traefik TLS config
type TraefikTLSDomain struct {
    Main  string   `json:"main"`
    Sans  []string `json:"sans"`
}

// ResourceCollection represents a collection of resources
type ResourceCollection struct {
    Resources []Resource `json:"resources"`
}

// Resource extends the existing resource model with source type
type Resource struct {
    ID             string    `json:"id"`
    Host           string    `json:"host"`
    ServiceID      string    `json:"service_id"`
    OrgID          string    `json:"org_id"`
    SiteID         string    `json:"site_id"`
    Status         string    `json:"status"`
    SourceType     string    `json:"source_type"`
    Entrypoints    string    `json:"entrypoints"`
    TLSDomains     string    `json:"tls_domains"`
    TCPEnabled     bool      `json:"tcp_enabled"`
    TCPEntrypoints string    `json:"tcp_entrypoints"`
    TCPSNIRule     string    `json:"tcp_sni_rule"`
    CustomHeaders  string    `json:"custom_headers"`
    RouterPriority int       `json:"router_priority"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
    Middlewares    string    `json:"middlewares,omitempty"`
}