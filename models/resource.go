package models

import (
	"time"
)

// Resource represents a Pangolin resource
type Resource struct {
	ID             string    `json:"id"`
	Host           string    `json:"host"`
	ServiceID      string    `json:"service_id"`
	OrgID          string    `json:"org_id"`
	SiteID         string    `json:"site_id"`
	Status         string    `json:"status"`
	
	// HTTP router configuration
	Entrypoints    string    `json:"entrypoints"`
	
	// TLS certificate configuration
	TLSDomains     string    `json:"tls_domains"`
	
	// TCP SNI routing configuration
	TCPEnabled     bool      `json:"tcp_enabled"`
	TCPEntrypoints string    `json:"tcp_entrypoints"`
	TCPSNIRule     string    `json:"tcp_sni_rule"`
	
	// Custom headers configuration
	CustomHeaders  string    `json:"custom_headers"`
	
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	
	// Middlewares is a list of associated middlewares, populated when needed
	Middlewares []ResourceMiddleware `json:"middlewares,omitempty"`
}

// PangolinResource represents the format of a resource from Pangolin API
type PangolinResource struct {
	ID     string `json:"id"`
	Host   string `json:"host"`
	OrgID  string `json:"org_id"`
	SiteID string `json:"site_id"`
}

// PangolinTraefikConfig represents the Traefik configuration from Pangolin API
type PangolinTraefikConfig struct {
	HTTP struct {
		Routers  map[string]PangolinRouter  `json:"routers"`
		Services map[string]PangolinService `json:"services"`
	} `json:"http"`
}

// PangolinRouter represents a router configuration from Pangolin API
type PangolinRouter struct {
	Rule        string   `json:"rule"`
	Service     string   `json:"service"`
	EntryPoints []string `json:"entryPoints"`
	Middlewares []string `json:"middlewares"`
	TLS         struct {
		CertResolver string `json:"certResolver"`
	} `json:"tls"`
}

// PangolinService represents a service configuration from Pangolin API
type PangolinService struct {
	LoadBalancer struct {
		Servers []struct {
			URL string `json:"url"`
		} `json:"servers"`
	} `json:"loadBalancer"`
}