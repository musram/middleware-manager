package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath" // For path cleaning
	"strings"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3" // For YAML manipulation
)

// Plugin represents the structure of a plugin in the JSON file
type Plugin struct {
	DisplayName string `json:"displayName"`
	Type        string `json:"type"`
	IconPath    string `json:"iconPath"`
	Import      string `json:"import"`
	Summary     string `json:"summary"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"`
	TestedWith  string `json:"tested_with,omitempty"`
	Stars       int    `json:"stars,omitempty"`
	Homepage    string `json:"homepage,omitempty"`
	Docs        string `json:"docs,omitempty"`
}

// PluginHandler handles plugin-related requests
type PluginHandler struct {
	DB                      *sql.DB
	TraefikStaticConfigPath string // Path to traefik.yml or traefik_config.yml
	PluginsJSONURL          string // URL to the plugins.json file
}

// NewPluginHandler creates a new plugin handler
func NewPluginHandler(db *sql.DB, traefikStaticConfigPath string, pluginsJSONURL string) *PluginHandler {
	return &PluginHandler{
		DB:                      db,
		TraefikStaticConfigPath: traefikStaticConfigPath,
		PluginsJSONURL:          pluginsJSONURL,
	}
}

// GetPlugins fetches the list of plugins from the configured JSON URL
func (h *PluginHandler) GetPlugins(c *gin.Context) {
	if h.PluginsJSONURL == "" {
		ResponseWithError(c, http.StatusInternalServerError, "Plugins JSON URL is not configured")
		return
	}

	resp, err := http.Get(h.PluginsJSONURL)
	if err != nil {
		LogError("fetching plugins JSON", err)
		ResponseWithError(c, http.StatusServiceUnavailable, "Failed to fetch plugins list")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		LogError("fetching plugins JSON status", fmt.Errorf("received status code %d", resp.StatusCode))
		ResponseWithError(c, http.StatusServiceUnavailable, fmt.Sprintf("Failed to fetch plugins list: Status %d", resp.StatusCode))
		return
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		LogError("reading plugins JSON response body", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to read plugins list data")
		return
	}

	var plugins []Plugin
	if err := json.Unmarshal(body, &plugins); err != nil {
		LogError("unmarshaling plugins JSON", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to parse plugins list")
		return
	}

	c.JSON(http.StatusOK, plugins)
}

// InstallPluginBody defines the expected request body for installing a plugin
type InstallPluginBody struct {
	ModuleName string `json:"moduleName" binding:"required"`
	Version    string `json:"version,omitempty"` // Version is often optional or latest
}

// InstallPlugin adds a plugin to the Traefik static configuration
func (h *PluginHandler) InstallPlugin(c *gin.Context) {
	var body InstallPluginBody
	if err := c.ShouldBindJSON(&body); err != nil {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	if h.TraefikStaticConfigPath == "" {
		ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration path is not set in Middleware Manager.")
		return
	}

	// Clean the path to prevent path traversal issues
	cleanPath := filepath.Clean(h.TraefikStaticConfigPath)
	if !filepath.IsAbs(cleanPath) { // Ensure it's an absolute path if expected
		// This check might need adjustment based on how the path is typically provided
		// For Docker, it's usually absolute within the container.
		// log.Printf("Warning: Traefik static config path '%s' is not absolute.", cleanPath)
	}


	// Read the Traefik static configuration file
	yamlFile, err := ioutil.ReadFile(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			ResponseWithError(c, http.StatusNotFound, fmt.Sprintf("Traefik static configuration file not found at: %s", cleanPath))
		} else {
			LogError(fmt.Sprintf("reading traefik static config file %s", cleanPath), err)
			ResponseWithError(c, http.StatusInternalServerError, "Failed to read Traefik static configuration")
		}
		return
	}

	var traefikStaticConfig map[string]interface{}
	if err := yaml.Unmarshal(yamlFile, &traefikStaticConfig); err != nil {
		LogError("unmarshaling traefik static config YAML", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to parse Traefik static configuration (YAML)")
		return
	}

	// Ensure 'experimental' and 'plugins' sections exist
	if _, ok := traefikStaticConfig["experimental"]; !ok {
		traefikStaticConfig["experimental"] = make(map[string]interface{})
	}
	experimentalConfig, ok := traefikStaticConfig["experimental"].(map[string]interface{})
	if !ok {
		ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration 'experimental' section is not a map")
		return
	}

	if _, ok := experimentalConfig["plugins"]; !ok {
		experimentalConfig["plugins"] = make(map[string]interface{})
	}
	pluginsConfig, ok := experimentalConfig["plugins"].(map[string]interface{})
	if !ok {
		ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration 'plugins' section is not a map")
		return
	}

	// Add or update the plugin configuration
	pluginKey := getPluginKey(body.ModuleName) // e.g., "statiq" from "[github.com/hhftechnology/statiq](https://www.google.com/url?sa=E&source=gmail&q=https://github.com/hhftechnology/statiq)"
	pluginEntry := map[string]interface{}{
		"moduleName": body.ModuleName,
	}
	if body.Version != "" {
		pluginEntry["version"] = body.Version
	}
	pluginsConfig[pluginKey] = pluginEntry

	// Marshal the updated configuration back to YAML
	updatedYaml, err := yaml.Marshal(traefikStaticConfig)
	if err != nil {
		LogError("marshaling updated traefik static config YAML", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to prepare updated Traefik configuration")
		return
	}

	// Write the updated configuration back to the file
	// It's good practice to write to a temporary file first, then rename, to avoid corruption
	tempFile := cleanPath + ".tmp"
	if err := ioutil.WriteFile(tempFile, updatedYaml, 0644); err != nil {
		LogError(fmt.Sprintf("writing updated traefik static config to temp file %s", tempFile), err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to write updated Traefik configuration (temp)")
		return
	}

	if err := os.Rename(tempFile, cleanPath); err != nil {
		LogError(fmt.Sprintf("renaming temp traefik static config file from %s to %s", tempFile, cleanPath), err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to finalize updated Traefik configuration")
		return
	}

	log.Printf("Successfully installed plugin '%s' to %s", body.ModuleName, cleanPath)
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Plugin %s configured. Restart Traefik to apply changes.", body.ModuleName)})
}

// getPluginKey extracts a simple key for the plugin map from the module name.
// For example, "[github.com/user/myplugin](https://github.com/user/myplugin)" becomes "myplugin".
func getPluginKey(moduleName string) string {
	parts := strings.Split(moduleName, "/")
	if len(parts) > 0 {
		return strings.ToLower(parts[len(parts)-1])
	}
	return strings.ToLower(moduleName) // Fallback
}


// GetTraefikStaticConfigPath returns the current Traefik static config path
func (h *PluginHandler) GetTraefikStaticConfigPath(c *gin.Context) {
    if h.TraefikStaticConfigPath == "" {
        c.JSON(http.StatusOK, gin.H{"path": "", "message": "Traefik static config path not set."})
        return
    }
    c.JSON(http.StatusOK, gin.H{"path": h.TraefikStaticConfigPath})
}

// UpdateTraefikStaticConfigPath updates the Traefik static config path (in-memory for now)
// For persistence, this should update a config file or database and restart/reinitialize relevant services.
type UpdatePathBody struct {
    Path string `json:"path" binding:"required"`
}
func (h *PluginHandler) UpdateTraefikStaticConfigPath(c *gin.Context) {
    var body UpdatePathBody
    if err := c.ShouldBindJSON(&body); err != nil {
        ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
        return
    }

    cleanPath := filepath.Clean(body.Path)
    // Add more validation as needed (e.g., check if it's a valid-looking path)

    // For this example, we're updating it in memory.
    // In a real application, you'd persist this change (e.g., to config.json)
    // and potentially notify other parts of the application.
    // This change will only persist until the application restarts unless saved to disk.
    h.TraefikStaticConfigPath = cleanPath
    log.Printf("Traefik static config path updated to: %s (Note: This change is in-memory and will be lost on restart unless persisted)", cleanPath)


	// TODO: Persist this change to a configuration file (e.g., config.json)
	// This requires modifying the ConfigManager or adding a new service to handle app config persistence.
	// For example:
	// err := config.UpdateApplicationSetting("TRAEFIK_STATIC_CONFIG_PATH", cleanPath)
	// if err != nil {
	//    LogError("persisting traefik static config path", err)
	//    ResponseWithError(c, http.StatusInternalServerError, "Failed to persist Traefik static config path update")
	//    return
	// }


    c.JSON(http.StatusOK, gin.H{"message": "Traefik static config path updated in memory. For persistence, this needs to be saved to a config file.", "path": cleanPath})
}