package services

import (
    "encoding/json"
    "fmt"
    "io/ioutil"
    "os"
    "path/filepath"
    "sync"
    
    "github.com/hhftechnology/middleware-manager/models"
)

// ConfigManager manages system configuration
type ConfigManager struct {
    configPath string
    config     models.SystemConfig
    mu         sync.RWMutex
}

// NewConfigManager creates a new config manager
func NewConfigManager(configPath string) (*ConfigManager, error) {
    cm := &ConfigManager{
        configPath: configPath,
    }
    
    if err := cm.loadConfig(); err != nil {
        return nil, err
    }
    
    return cm, nil
}

// loadConfig loads configuration from file
func (cm *ConfigManager) loadConfig() error {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    // Check if config file exists
    if _, err := os.Stat(cm.configPath); os.IsNotExist(err) {
        // Create default config
        cm.config = models.SystemConfig{
            ActiveDataSource: "pangolin",
            DataSources: map[string]models.DataSourceConfig{
                "pangolin": {
                    Type: models.PangolinAPI,
                    URL:  "http://pangolin:3001/api/v1",
                },
                "traefik": {
                    Type: models.TraefikAPI,
                    URL:  "http://traefik:8080",
                },
            },
        }
        
        // Save default config
        return cm.saveConfig()
    }
    
    // Read config file
    data, err := ioutil.ReadFile(cm.configPath)
    if err != nil {
        return fmt.Errorf("failed to read config file: %w", err)
    }
    
    // Parse config
    if err := json.Unmarshal(data, &cm.config); err != nil {
        return fmt.Errorf("failed to parse config: %w", err)
    }
    
    return nil
}

// saveConfig saves configuration to file
func (cm *ConfigManager) saveConfig() error {
    // Create directory if it doesn't exist
    dir := filepath.Dir(cm.configPath)
    if err := os.MkdirAll(dir, 0755); err != nil {
        return fmt.Errorf("failed to create config directory: %w", err)
    }
    
    // Marshal config to JSON
    data, err := json.MarshalIndent(cm.config, "", "  ")
    if err != nil {
        return fmt.Errorf("failed to marshal config: %w", err)
    }
    
    // Write config file
    if err := ioutil.WriteFile(cm.configPath, data, 0644); err != nil {
        return fmt.Errorf("failed to write config file: %w", err)
    }
    
    return nil
}

// GetActiveDataSourceConfig returns the active data source configuration
func (cm *ConfigManager) GetActiveDataSourceConfig() (models.DataSourceConfig, error) {
    cm.mu.RLock()
    defer cm.mu.RUnlock()
    
    dsName := cm.config.ActiveDataSource
    ds, ok := cm.config.DataSources[dsName]
    if !ok {
        return models.DataSourceConfig{}, fmt.Errorf("active data source not found: %s", dsName)
    }
    
    return ds, nil
}

// GetActiveSourceName returns the name of the active data source
func (cm *ConfigManager) GetActiveSourceName() string {
    cm.mu.RLock()
    defer cm.mu.RUnlock()
    
    return cm.config.ActiveDataSource
}

// SetActiveDataSource sets the active data source
func (cm *ConfigManager) SetActiveDataSource(name string) error {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    if _, ok := cm.config.DataSources[name]; !ok {
        return fmt.Errorf("data source not found: %s", name)
    }
    
    cm.config.ActiveDataSource = name
    return cm.saveConfig()
}

// GetDataSources returns all configured data sources
func (cm *ConfigManager) GetDataSources() map[string]models.DataSourceConfig {
    cm.mu.RLock()
    defer cm.mu.RUnlock()
    
    // Return a copy to prevent map mutation
    sources := make(map[string]models.DataSourceConfig)
    for k, v := range cm.config.DataSources {
        sources[k] = v
    }
    
    return sources
}

// UpdateDataSource updates a data source configuration
func (cm *ConfigManager) UpdateDataSource(name string, config models.DataSourceConfig) error {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    cm.config.DataSources[name] = config
    return cm.saveConfig()
}