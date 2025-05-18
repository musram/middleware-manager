package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil" // TODO: Replace ioutil with io and os packages for Go 1.16+ (Standard library evolution)
	"log"
	"net/http"
	"os"
	"io"
	"path/filepath" // For path cleaning
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3" // For YAML manipulation
)

// Plugin represents the structure of a plugin in the JSON file
// TODO: (Low priority) Consider adding a "provider" or "source" field if plugins can come from different repositories/hubs in the future. This would namespace imports if they aren't globally unique.
type Plugin struct {
	DisplayName string `json:"displayName"`
	Type        string `json:"type"` // TODO: (Validation) Validate if this is always "middleware" on the backend when processing, or if other types might be introduced later.
	IconPath    string `json:"iconPath"`
	Import      string `json:"import"`
	Summary     string `json:"summary"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"` // TODO: (Clarification) Clarify if this 'version' in plugins.json is the default version to install if the user doesn't specify one, or if it's the only version the UI should offer. The current install logic allows the user to override.
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
	// TODO: (Validation) Add validation for traefikStaticConfigPath during initialization to ensure it's a non-empty and perhaps a "reasonable" looking path string, though actual file existence is checked later.
	// TODO: (Validation) Add validation for pluginsJSONURL to ensure it's a valid URL format during initialization.
	return &PluginHandler{
		DB:                      db,
		TraefikStaticConfigPath: traefikStaticConfigPath,
		PluginsJSONURL:          pluginsJSONURL,
	}
}

// GetPlugins fetches the list of plugins from the configured JSON URL
func (h *PluginHandler) GetPlugins(c *gin.Context) {
	if h.PluginsJSONURL == "" {
		ResponseWithError(c, http.StatusInternalServerError, "Plugins JSON URL is not configured in Middleware Manager.")
		return
	}

	// TODO: (Performance) Consider adding caching for the plugins.json response to reduce external HTTP calls, with a reasonable cache duration (e.g., 5-15 minutes).
	resp, err := http.Get(h.PluginsJSONURL) // TODO: Consider using a shared HTTP client with timeout from the `main.go` or services package.
	if err != nil {
		LogError("fetching plugins JSON", err)
		ResponseWithError(c, http.StatusServiceUnavailable, "Failed to fetch plugins list from the configured external source.")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body) // TODO: Replace ioutil with io.ReadAll
		LogError("fetching plugins JSON status", fmt.Errorf("received status code %d. Body: %s", resp.StatusCode, string(bodyBytes)))
		ResponseWithError(c, http.StatusServiceUnavailable, fmt.Sprintf("Failed to fetch plugins list: External source returned status %d.", resp.StatusCode))
		return
	}

	body, err := ioutil.ReadAll(resp.Body) // TODO: Replace ioutil with io.ReadAll
	if err != nil {
		LogError("reading plugins JSON response body", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to read plugins list data from the external source.")
		return
	}

	var plugins []Plugin
	if err := json.Unmarshal(body, &plugins); err != nil {
		LogError("unmarshaling plugins JSON", fmt.Errorf("%w. Body received for unmarshaling: %s", err, string(body)))
		ResponseWithError(c, http.StatusInternalServerError, "Failed to parse plugins list data from the external source. Ensure it's valid JSON.")
		return
	}

	// TODO: (Enhancement) Optionally, augment plugin data here if needed. For example:
	//       - Check if a plugin is already listed in the local Traefik static config (this is complex as it requires parsing the YAML for every call).
	//       - Add a flag like `isInstalled` to each plugin object before sending to frontend. (This would require reading and parsing the traefik.yml here).
	c.JSON(http.StatusOK, plugins)
}

// InstallPluginBody defines the expected request body for installing a plugin
type InstallPluginBody struct {
	ModuleName string `json:"moduleName" binding:"required"`
	Version    string `json:"version,omitempty"`
}

// InstallPlugin adds a plugin to the Traefik static configuration
func (h *PluginHandler) InstallPlugin(c *gin.Context) {
	var body InstallPluginBody
	if err := c.ShouldBindJSON(&body); err != nil {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	if h.TraefikStaticConfigPath == "" {
		ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration file path is not configured in Middleware Manager. Please set it in settings.")
		return
	}

	cleanPath := filepath.Clean(h.TraefikStaticConfigPath)
	// TODO: (Security) Add more robust validation for `cleanPath`.
	//       Ensure it's an expected filename (e.g., ends with .yml or .yaml).
	//       Consider restricting write access to a specific directory if this path can be set arbitrarily by users with admin access.
	// if !filepath.IsAbs(cleanPath) {
	// log.Printf("Warning: Traefik static config path '%s' is not absolute. This might be problematic depending on execution context.", cleanPath)
	// }

	// Read the Traefik static configuration file
	// TODO: (Concurrency) Add a file lock (e.g., using flock or a mutex specific to file operations) to prevent race conditions if multiple install requests come at nearly the same time.
	yamlFile, err := ioutil.ReadFile(cleanPath) // TODO: Replace ioutil with os.ReadFile
	if err != nil {
		if os.IsNotExist(err) {
			ResponseWithError(c, http.StatusNotFound, fmt.Sprintf("Traefik static configuration file not found at the configured path: %s. Please verify the path in settings.", cleanPath))
		} else {
			LogError(fmt.Sprintf("reading traefik static config file %s", cleanPath), err)
			ResponseWithError(c, http.StatusInternalServerError, "Failed to read Traefik static configuration file. Check permissions and path.")
		}
		return
	}

	var traefikStaticConfig map[string]interface{}
	if err := yaml.Unmarshal(yamlFile, &traefikStaticConfig); err != nil {
		LogError("unmarshaling traefik static config YAML", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to parse Traefik static configuration (YAML format error). Ensure the file is valid YAML.")
		return
	}

	// Ensure 'experimental' section exists or create it
	experimentalSection, ok := traefikStaticConfig["experimental"].(map[string]interface{})
	if !ok {
		if traefikStaticConfig["experimental"] != nil { // It exists but not as a map
			ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration 'experimental' section has an unexpected format (should be a map).")
			return
		}
		experimentalSection = make(map[string]interface{})
		traefikStaticConfig["experimental"] = experimentalSection
	}

	// Ensure 'plugins' section within 'experimental' exists or create it
	pluginsConfig, ok := experimentalSection["plugins"].(map[string]interface{})
	if !ok {
		if experimentalSection["plugins"] != nil { // It exists but not as a map
			ResponseWithError(c, http.StatusInternalServerError, "Traefik static configuration 'plugins' section (under 'experimental') has an unexpected format (should be a map).")
			return
		}
		pluginsConfig = make(map[string]interface{})
		experimentalSection["plugins"] = pluginsConfig
	}

	pluginKey := getPluginKey(body.ModuleName)
	if pluginKey == "" {
		ResponseWithError(c, http.StatusBadRequest, "Invalid plugin module name; could not derive a configuration key.")
		return
	}

	pluginEntry := map[string]interface{}{
		"moduleName": body.ModuleName,
	}
	if body.Version != "" {
		pluginEntry["version"] = body.Version
	}

	// TODO: (User Experience) Check if pluginKey already exists.
	//       If it does, confirm with the user if they want to update/overwrite it, or provide a different message.
	//       Currently, it just overwrites.
	// existingEntry, alreadyExists := pluginsConfig[pluginKey]
	// if alreadyExists {
	//     log.Printf("Plugin with key '%s' already exists. Overwriting.", pluginKey)
	//     // Could compare existingEntry with pluginEntry and inform user if it's an update vs. same config.
	// }

	pluginsConfig[pluginKey] = pluginEntry

	updatedYaml, err := yaml.Marshal(traefikStaticConfig)
	if err != nil {
		LogError("marshaling updated traefik static config YAML", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to prepare updated Traefik configuration for saving.")
		return
	}

	// Backup the existing file before writing
	backupPath := cleanPath + ".bak." + time.Now().Format("20060102150405") // More standard timestamp
	if err := copyFile(cleanPath, backupPath); err != nil {
		// Log as warning, proceed with write attempt but inform user if backup failed
		LogInfo(fmt.Sprintf("Warning: Could not create backup of %s to %s: %v. Proceeding with writing the main file.", cleanPath, backupPath, err))
	} else {
		LogInfo(fmt.Sprintf("Created backup of Traefik static config at %s", backupPath))
	}

	tempFile := cleanPath + ".tmp" // Use a more common temp file extension
	if err := ioutil.WriteFile(tempFile, updatedYaml, 0644); err != nil { // TODO: Replace ioutil with os.WriteFile
		LogError(fmt.Sprintf("writing updated traefik static config to temp file %s", tempFile), err)
		_ = os.Remove(tempFile) // Attempt to clean up temp file on error
		ResponseWithError(c, http.StatusInternalServerError, "Failed to write updated Traefik configuration to a temporary file.")
		return
	}

	if err := os.Rename(tempFile, cleanPath); err != nil {
		LogError(fmt.Sprintf("renaming temp traefik static config file from %s to %s", tempFile, cleanPath), err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to finalize updated Traefik configuration file. Check file permissions and if a temporary file '.tmp' exists.")
		return
	}

	log.Printf("Successfully installed plugin '%s' (key: '%s') to %s", body.ModuleName, pluginKey, cleanPath)
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Plugin %s configured in %s. A Traefik restart is required to load the plugin.", body.ModuleName, filepath.Base(cleanPath))})
}

// getPluginKey extracts a simple key for the plugin map from the module name.
func getPluginKey(moduleName string) string {
	if moduleName == "" {
		return ""
	}
	parts := strings.Split(moduleName, "/")
	if len(parts) > 0 {
		lastKeyPart := parts[len(parts)-1]
		// Further clean up if the last part contains version or other noise, e.g. "myplugin@v1.0.0" -> "myplugin"
		// Also remove common suffixes like .git or -plugin
		lastKeyPart = strings.Split(lastKeyPart, "@")[0]
		lastKeyPart = strings.TrimSuffix(lastKeyPart, ".git")
		lastKeyPart = strings.TrimSuffix(lastKeyPart, "-plugin")
		return strings.ToLower(lastKeyPart)
	}
	// Fallback, also try to remove version and common suffixes
	key := strings.Split(moduleName, "@")[0]
	key = strings.TrimSuffix(key, ".git")
	key = strings.TrimSuffix(key, "-plugin")
	return strings.ToLower(key)
}

// GetTraefikStaticConfigPath returns the current Traefik static config path
func (h *PluginHandler) GetTraefikStaticConfigPath(c *gin.Context) {
	// TODO: (Consistency) This path should ideally be read from the same persistent configuration
	//       that `UpdateTraefikStaticConfigPath` would update.
	//       Currently, it reflects the path the handler was initialized with via `main.go`.
	if h.TraefikStaticConfigPath == "" {
		c.JSON(http.StatusOK, gin.H{"path": "", "message": "Traefik static config path is not currently set in Middleware Manager's environment configuration."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"path": h.TraefikStaticConfigPath})
}

// UpdatePathBody defines the expected request body for updating the path
type UpdatePathBody struct {
	Path string `json:"path" binding:"required"`
}

// UpdateTraefikStaticConfigPath updates the Traefik static config path (in-memory for the handler)
func (h *PluginHandler) UpdateTraefikStaticConfigPath(c *gin.Context) {
	var body UpdatePathBody
	if err := c.ShouldBindJSON(&body); err != nil {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	cleanPath := filepath.Clean(body.Path)
	if cleanPath == "" || cleanPath == "." || cleanPath == "/" || strings.HasSuffix(cleanPath, "/") {
		ResponseWithError(c, http.StatusBadRequest, "Invalid configuration path provided. Path cannot be empty, root, relative, or end with a slash.")
		return
	}
	// TODO: (Validation) Add more robust path validation.
	//       - Check for invalid characters.
	//       - Check if it's an absolute path, as Traefik usually needs absolute paths for its config file unless run from a specific working directory.

	// CRITICAL TODO: PERSISTENCE OF TRAEFIK_STATIC_CONFIG_PATH
	// The current implementation updates `h.TraefikStaticConfigPath` which is an in-memory variable for this specific handler instance.
	// This change WILL BE LOST when the Middleware Manager application restarts.
	// To make this persistent, the new `cleanPath` needs to be saved to the application's main configuration mechanism.
	// This usually means:
	// 1. Modifying `services.ConfigManager` to have methods to Get and Set this specific application-level setting.
	// 2. The `ConfigManager` would then read/write this to `config/config.json` (alongside datasource configs) or a dedicated app settings file.
	// 3. When Middleware Manager starts, `main.go` should load this persisted path from `ConfigManager` and pass it to `NewPluginHandler`.
	//
	// For now, this handler only updates its local copy. The UI message correctly reflects this limitation.
	oldPath := h.TraefikStaticConfigPath
	h.TraefikStaticConfigPath = cleanPath
	log.Printf("Traefik static config path updated in memory for this session from '%s' to: '%s'. This change is NOT persistent across application restarts without further implementation.", oldPath, cleanPath)

	c.JSON(http.StatusOK, gin.H{"message": "Traefik static config path updated for the current session. For this change to persist across restarts, you must update the TRAEFIK_STATIC_CONFIG_PATH environment variable for the Middleware Manager container.", "path": cleanPath})
}

// copyFile copies a file from src to dst.
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("could not open source file %s: %w", src, err)
	}
	defer sourceFile.Close()

	destinationFile, err := os.Create(dst) // Creates or truncates.
	if err != nil {
		return fmt.Errorf("could not create destination file %s: %w", dst, err)
	}
	defer destinationFile.Close()

	_, err = io.Copy(destinationFile, sourceFile) // io.Copy from stdlib "io"
	if err != nil {
		return fmt.Errorf("could not copy content from %s to %s: %w", src, dst, err)
	}
	// Ensure content is written to stable storage.
	return destinationFile.Sync()
}

// LogInfo is a helper for informational logging.
func LogInfo(message string) {
	log.Println("INFO:", message)
}

// TODO: (Refactor) ResponseWithError and LogError are common utilities.
//       Consider moving them to a shared package if they are used by other handlers as well,
//       or ensure they are consistently defined/used. (They are in common.go, so this is fine).