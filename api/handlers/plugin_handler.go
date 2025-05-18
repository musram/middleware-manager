package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil" // TODO: Replace ioutil with io and os packages for Go 1.16+
	"log"
	"net/http"
	"os"
	"path/filepath" // For path cleaning
	"strings"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3" // For YAML manipulation
)

// Plugin represents the structure of a plugin in the JSON file
// TODO: Consider adding a "provider" or "source" field if plugins can come from different repositories/hubs.
type Plugin struct {
	DisplayName string `json:"displayName"`
	Type        string `json:"type"` // TODO: Validate if this is always "middleware" or if other types are possible.
	IconPath    string `json:"iconPath"`
	Import      string `json:"import"`
	Summary     string `json:"summary"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"` // TODO: Clarify if this is the default version or the only supported version.
	TestedWith  string `json:"tested_with,omitempty"`
	Stars       int    `json:"stars,omitempty"`
	Homepage    string `json:"homepage,omitempty"`
	Docs        string `json:"docs,omitempty"`
}

// PluginHandler handles plugin-related requests
type PluginHandler struct {
	DB                      *sql.DB
	TraefikStaticConfigPath string // Path to traefik.yml or traefik_config.yml // TODO: Make this configurable via API and persist it.
	PluginsJSONURL          string // URL to the plugins.json file
}

// NewPluginHandler creates a new plugin handler
func NewPluginHandler(db *sql.DB, traefikStaticConfigPath string, pluginsJSONURL string) *PluginHandler {
	// TODO: Add validation for traefikStaticConfigPath to ensure it's a reasonable path, though actual file existence is checked during install.
	// TODO: Add validation for pluginsJSONURL to ensure it's a valid URL format.
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

	// TODO: Consider adding caching for the plugins.json response to reduce external calls.
	resp, err := http.Get(h.PluginsJSONURL)
	if err != nil {
		LogError("fetching plugins JSON", err)
		ResponseWithError(c, http.StatusServiceUnavailable, "Failed to fetch plugins list from external source")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body) // TODO: Replace ioutil
		LogError("fetching plugins JSON status", fmt.Errorf("received status code %d. Body: %s", resp.StatusCode, string(bodyBytes)))
		ResponseWithError(c, http.StatusServiceUnavailable, fmt.Sprintf("Failed to fetch plugins list: External source returned status %d", resp.StatusCode))
		return
	}

	body, err := ioutil.ReadAll(resp.Body) // TODO: Replace ioutil
	if err != nil {
		LogError("reading plugins JSON response body", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to read plugins list data from external source")
		return
	}

	var plugins []Plugin
	if err := json.Unmarshal(body, &plugins); err != nil {
		LogError("unmarshaling plugins JSON", fmt.Errorf("%w. Body received: %s", err, string(body)))
		ResponseWithError(c, http.StatusInternalServerError, "Failed to parse plugins list data from external source")
		return
	}

	// TODO: Optionally, augment plugin data here if needed (e.g., check if already installed locally, though this is complex with static config).
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

	cleanPath := filepath.Clean(h.TraefikStaticConfigPath)
	// TODO: Add more robust validation for cleanPath to ensure it's within an allowed directory if security is a concern for where this file can be.
	// For now, filepath.Clean helps with ".." etc.
	// if !filepath.IsAbs(cleanPath) {
	// log.Printf("Warning: Traefik static config path '%s' is not absolute. This might be problematic depending on execution context.", cleanPath)
	// }


	yamlFile, err := ioutil.ReadFile(cleanPath) // TODO: Replace ioutil
	if err != nil {
		if os.IsNotExist(err) {
			ResponseWithError(c, http.StatusNotFound, fmt.Sprintf("Traefik static configuration file not found at the configured path: %s. Please verify the path in settings.", cleanPath))
		} else {
			LogError(fmt.Sprintf("reading traefik static config file %s", cleanPath), err)
			ResponseWithError(c, http.StatusInternalServerError, "Failed to read Traefik static configuration file.")
		}
		return
	}

	var traefikStaticConfig map[string]interface{}
	if err := yaml.Unmarshal(yamlFile, &traefikStaticConfig); err != nil {
		LogError("unmarshaling traefik static config YAML", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to parse Traefik static configuration (YAML format error).")
		return
	}

	// Ensure 'experimental' section exists or create it
	experimentalConfig, ok := traefikStaticConfig["experimental"].(map[string]interface{})
	if !ok {
		// It might exist but not as a map (highly unlikely for valid traefik.yml) or not exist at all
		if traefikStaticConfig["experimental"] != nil {
			ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration 'experimental' section has an unexpected format.")
			return
		}
		experimentalConfig = make(map[string]interface{})
		traefikStaticConfig["experimental"] = experimentalConfig
	}

	// Ensure 'plugins' section within 'experimental' exists or create it
	pluginsConfig, ok := experimentalConfig["plugins"].(map[string]interface{})
	if !ok {
		if experimentalConfig["plugins"] != nil {
			ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration 'plugins' section has an unexpected format.")
			return
		}
		pluginsConfig = make(map[string]interface{})
		experimentalConfig["plugins"] = pluginsConfig
	}

	pluginKey := getPluginKey(body.ModuleName)
	if pluginKey == "" { // Basic validation for pluginKey
		ResponseWithError(c, http.StatusBadRequest, "Invalid plugin module name, could not derive a key.")
		return
	}

	pluginEntry := map[string]interface{}{
		"moduleName": body.ModuleName,
	}
	if body.Version != "" {
		pluginEntry["version"] = body.Version
	}
	pluginsConfig[pluginKey] = pluginEntry
	// TODO: Consider checking if pluginKey already exists and if we should overwrite or error.
	// For now, it overwrites, which is usually fine for updates.

	updatedYaml, err := yaml.Marshal(traefikStaticConfig)
	if err != nil {
		LogError("marshaling updated traefik static config YAML", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to prepare updated Traefik configuration for saving.")
		return
	}

	// Backup the existing file before writing
	backupPath := cleanPath + ".bak." + time.Now().Format("20060102150405")
	if err := copyFile(cleanPath, backupPath); err != nil {
		LogInfo(fmt.Sprintf("Could not create backup of %s: %v. Proceeding without backup.", cleanPath, err))
		// Decide if this is a critical error. For now, we proceed.
	} else {
		LogInfo(fmt.Sprintf("Created backup of Traefik static config at %s", backupPath))
	}


	tempFile := cleanPath + ".tmp"
	if err := ioutil.WriteFile(tempFile, updatedYaml, 0644); err != nil { // TODO: Replace ioutil
		LogError(fmt.Sprintf("writing updated traefik static config to temp file %s", tempFile), err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to write updated Traefik configuration to a temporary file.")
		return
	}

	if err := os.Rename(tempFile, cleanPath); err != nil {
		LogError(fmt.Sprintf("renaming temp traefik static config file from %s to %s", tempFile, cleanPath), err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to finalize updated Traefik configuration file.")
		return
	}

	log.Printf("Successfully installed plugin '%s' (key: '%s') to %s", body.ModuleName, pluginKey, cleanPath)
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Plugin %s configured in %s. A Traefik restart is required to load the plugin.", body.ModuleName, filepath.Base(cleanPath))})
}

// getPluginKey extracts a simple key for the plugin map from the module name.
func getPluginKey(moduleName string) string {
	parts := strings.Split(moduleName, "/")
	if len(parts) > 0 {
		lastKeyPart := parts[len(parts)-1]
		// Further clean up if the last part contains version or other noise, e.g. "myplugin@v1.0.0" -> "myplugin"
		lastKeyPart = strings.Split(lastKeyPart, "@")[0]
		return strings.ToLower(lastKeyPart)
	}
	return strings.ToLower(strings.Split(moduleName, "@")[0]) // Fallback, also try to remove version
}


// GetTraefikStaticConfigPath returns the current Traefik static config path
func (h *PluginHandler) GetTraefikStaticConfigPath(c *gin.Context) {
	// TODO: This path should ideally be read from a persistent configuration, not just an in-memory struct field
	// if it's meant to be user-configurable via the API and survive restarts.
	// For now, it reflects the path the handler was initialized with.
	if h.TraefikStaticConfigPath == "" {
		c.JSON(http.StatusOK, gin.H{"path": "", "message": "Traefik static config path is not currently set in Middleware Manager."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"path": h.TraefikStaticConfigPath})
}

// UpdatePathBody defines the expected request body for updating the path
type UpdatePathBody struct {
	Path string `json:"path" binding:"required"`
}

// UpdateTraefikStaticConfigPath updates the Traefik static config path
func (h *PluginHandler) UpdateTraefikStaticConfigPath(c *gin.Context) {
	var body UpdatePathBody
	if err := c.ShouldBindJSON(&body); err != nil {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	cleanPath := filepath.Clean(body.Path)
	if cleanPath == "." || cleanPath == "/" { // Basic sanity check for path
		ResponseWithError(c, http.StatusBadRequest, "Invalid configuration path provided.")
		return
	}

	// TODO: PERSISTENCE: This is the critical part.
	// The path `h.TraefikStaticConfigPath` is currently an in-memory variable for the handler.
	// To make this change persistent across application restarts, this new path needs to be saved
	// into the application's main configuration file (e.g., the one managed by services.ConfigManager or an env var).
	// This typically involves:
	// 1. Reading the current main app config.
	// 2. Updating the specific field for TraefikStaticConfigPath.
	// 3. Writing the main app config back to disk.
	// 4. The application might need to be aware of this change, potentially re-initializing handlers or services
	//    that depend on this path if they don't read it dynamically.
	//
	// Example (conceptual, depends on how ConfigManager is structured):
	// currentAppConfig := h.ConfigManager.GetAppConfig() // Assuming such a method exists
	// currentAppConfig.TraefikStaticConfigPath = cleanPath
	// if err := h.ConfigManager.SaveAppConfig(currentAppConfig); err != nil {
	//    LogError("persisting traefik static config path", err)
	//    ResponseWithError(c, http.StatusInternalServerError, "Failed to persist Traefik static config path update.")
	//    return
	// }
	// After persisting, update the handler's in-memory path:
	h.TraefikStaticConfigPath = cleanPath
	log.Printf("Traefik static config path updated in memory to: %s. Persistence requires saving this to the main application configuration.", cleanPath)

	c.JSON(http.StatusOK, gin.H{"message": "Traefik static config path updated in memory for the current session. Ensure this change is made persistent in the application's startup configuration (e.g., environment variable or main config file) to survive restarts.", "path": cleanPath})
}

// copyFile copies a file from src to dst.
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("could not open source file %s: %w", src, err)
	}
	defer sourceFile.Close()

	destinationFile, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("could not create destination file %s: %w", dst, err)
	}
	defer destinationFile.Close()

	_, err = io.Copy(destinationFile, sourceFile) // io.Copy from stdlib "io"
	if err != nil {
		return fmt.Errorf("could not copy from %s to %s: %w", src, dst, err)
	}
	return destinationFile.Sync() // Ensure content is written to stable storage
}

// LogInfo is a helper for informational logging, could be expanded.
func LogInfo(message string) {
	log.Println("INFO:", message)
}