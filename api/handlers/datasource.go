package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "github.com/hhftechnology/middleware-manager/models"
    "github.com/hhftechnology/middleware-manager/services"
)

// DataSourceHandler handles data source configuration requests
type DataSourceHandler struct {
    ConfigManager *services.ConfigManager
}

// NewDataSourceHandler creates a new data source handler
func NewDataSourceHandler(configManager *services.ConfigManager) *DataSourceHandler {
    return &DataSourceHandler{
        ConfigManager: configManager,
    }
}

// GetDataSources returns all configured data sources
func (h *DataSourceHandler) GetDataSources(c *gin.Context) {
    sources := h.ConfigManager.GetDataSources()
    activeSource := h.ConfigManager.GetActiveSourceName()
    
    c.JSON(http.StatusOK, gin.H{
        "active_source": activeSource,
        "sources":       sources,
    })
}

// GetActiveDataSource returns the active data source configuration
func (h *DataSourceHandler) GetActiveDataSource(c *gin.Context) {
    sourceConfig, err := h.ConfigManager.GetActiveDataSourceConfig()
    if err != nil {
        ResponseWithError(c, http.StatusInternalServerError, err.Error())
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "name":   h.ConfigManager.GetActiveSourceName(),
        "config": sourceConfig,
    })
}

// SetActiveDataSource sets the active data source
func (h *DataSourceHandler) SetActiveDataSource(c *gin.Context) {
    var request struct {
        Name string `json:"name" binding:"required"`
    }
    
    if err := c.ShouldBindJSON(&request); err != nil {
        ResponseWithError(c, http.StatusBadRequest, "Invalid request: "+err.Error())
        return
    }
    
    if err := h.ConfigManager.SetActiveDataSource(request.Name); err != nil {
        ResponseWithError(c, http.StatusBadRequest, err.Error())
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Data source updated successfully",
        "name":    request.Name,
    })
}

// UpdateDataSource updates a data source configuration
func (h *DataSourceHandler) UpdateDataSource(c *gin.Context) {
    name := c.Param("name")
    if name == "" {
        ResponseWithError(c, http.StatusBadRequest, "Data source name is required")
        return
    }
    
    var config models.DataSourceConfig
    if err := c.ShouldBindJSON(&config); err != nil {
        ResponseWithError(c, http.StatusBadRequest, "Invalid request: "+err.Error())
        return
    }
    
    if err := h.ConfigManager.UpdateDataSource(name, config); err != nil {
        ResponseWithError(c, http.StatusInternalServerError, err.Error())
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Data source updated successfully",
        "name":    name,
        "config":  config,
    })
}