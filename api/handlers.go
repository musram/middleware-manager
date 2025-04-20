package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// APIError represents a standardized error response
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ResponseWithError sends a standardized error response
func ResponseWithError(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, APIError{
		Code:    statusCode,
		Message: message,
	})
}

// getMiddlewares returns all middleware configurations
func (s *Server) getMiddlewares(c *gin.Context) {
	middlewares, err := s.db.GetMiddlewares()
	if err != nil {
		log.Printf("Error fetching middlewares: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to fetch middlewares")
		return
	}
	c.JSON(http.StatusOK, middlewares)
}

// ensureEmptyStringsPreserved ensures empty strings are properly preserved in middleware configs
func ensureEmptyStringsPreserved(config map[string]interface{}) map[string]interface{} {
	if config == nil {
		return nil
	}

	// Process custom headers which commonly use empty strings
	if customResponseHeaders, ok := config["customResponseHeaders"].(map[string]interface{}); ok {
		for key, value := range customResponseHeaders {
			// Ensure nil or null values are converted to empty strings where appropriate
			if value == nil {
				customResponseHeaders[key] = ""
			}
		}
	}
	
	if customRequestHeaders, ok := config["customRequestHeaders"].(map[string]interface{}); ok {
		for key, value := range customRequestHeaders {
			if value == nil {
				customRequestHeaders[key] = ""
			}
		}
	}
	
	// Common header fields that might have empty strings
	headerFields := []string{
		"Server", "X-Powered-By", "customFrameOptionsValue", 
		"contentSecurityPolicy", "referrerPolicy", "permissionsPolicy",
	}
	
	for _, field := range headerFields {
		if value, exists := config[field]; exists && value == nil {
			config[field] = ""
		}
	}
	
	// Return the processed config
	return config
}

// createMiddleware creates a new middleware configuration
func (s *Server) createMiddleware(c *gin.Context) {
	var middleware struct {
		Name   string                 `json:"name" binding:"required"`
		Type   string                 `json:"type" binding:"required"`
		Config map[string]interface{} `json:"config" binding:"required"`
	}

	if err := c.ShouldBindJSON(&middleware); err != nil {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Validate middleware type
	if !isValidMiddlewareType(middleware.Type) {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid middleware type: %s", middleware.Type))
		return
	}

	// Generate a unique ID
	id, err := generateID()
	if err != nil {
		log.Printf("Error generating ID: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to generate ID")
		return
	}

	// Ensure empty strings are properly preserved in config
	middleware.Config = ensureEmptyStringsPreserved(middleware.Config)

	// Convert config to JSON string
	configJSON, err := json.Marshal(middleware.Config)
	if err != nil {
		log.Printf("Error encoding config: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to encode config")
		return
	}

	// Insert into database using a transaction
	tx, err := s.db.Begin()
	if err != nil {
		log.Printf("Error beginning transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// If something goes wrong, rollback
	var txErr error
	defer func() {
		if txErr != nil {
			tx.Rollback()
			log.Printf("Transaction rolled back due to error: %v", txErr)
		}
	}()
	
	log.Printf("Attempting to insert middleware with ID=%s, name=%s, type=%s", 
		id, middleware.Name, middleware.Type)
	
	result, txErr := tx.Exec(
		"INSERT INTO middlewares (id, name, type, config) VALUES (?, ?, ?, ?)",
		id, middleware.Name, middleware.Type, string(configJSON),
	)
	
	if txErr != nil {
		log.Printf("Error inserting middleware: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to save middleware")
		return
	}
	
	rowsAffected, err := result.RowsAffected()
	if err == nil {
		log.Printf("Insert affected %d rows", rowsAffected)
	}
	
	// Commit the transaction
	if txErr = tx.Commit(); txErr != nil {
		log.Printf("Error committing transaction: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	log.Printf("Successfully created middleware %s (%s)", middleware.Name, id)
	c.JSON(http.StatusCreated, gin.H{
		"id":     id,
		"name":   middleware.Name,
		"type":   middleware.Type,
		"config": middleware.Config,
	})
}

// getMiddleware returns a specific middleware configuration
func (s *Server) getMiddleware(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		ResponseWithError(c, http.StatusBadRequest, "Middleware ID is required")
		return
	}

	middleware, err := s.db.GetMiddleware(id)
	if err != nil {
		if err.Error() == fmt.Sprintf("middleware not found: %s", id) {
			ResponseWithError(c, http.StatusNotFound, "Middleware not found")
			return
		}
		log.Printf("Error fetching middleware: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to fetch middleware")
		return
	}

	c.JSON(http.StatusOK, middleware)
}

// updateRouterPriority updates the router priority for a resource
func (s *Server) updateRouterPriority(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
        return
    }
    
    var input struct {
        RouterPriority int `json:"router_priority" binding:"required"`
    }
    
    if err := c.ShouldBindJSON(&input); err != nil {
        ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
        return
    }
    
    // Verify resource exists and is active
    var exists int
    var status string
    err := s.db.QueryRow("SELECT 1, status FROM resources WHERE id = ?", id).Scan(&exists, &status)
    if err == sql.ErrNoRows {
        ResponseWithError(c, http.StatusNotFound, "Resource not found")
        return
    } else if err != nil {
        log.Printf("Error checking resource existence: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // Don't allow updating disabled resources
    if status == "disabled" {
        ResponseWithError(c, http.StatusBadRequest, "Cannot update a disabled resource")
        return
    }
    
    // Update the resource within a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    var txErr error
    defer func() {
        if txErr != nil {
            tx.Rollback()
            log.Printf("Transaction rolled back due to error: %v", txErr)
        }
    }()
    
    log.Printf("Updating router priority for resource %s to %d", id, input.RouterPriority)
    
    result, txErr := tx.Exec(
        "UPDATE resources SET router_priority = ?, updated_at = ? WHERE id = ?",
        input.RouterPriority, time.Now(), id,
    )
    
    if txErr != nil {
        log.Printf("Error updating router priority: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Failed to update router priority")
        return
    }
    
    rowsAffected, err := result.RowsAffected()
    if err == nil {
        log.Printf("Update affected %d rows", rowsAffected)
    }
    
    // Commit the transaction
    if txErr = tx.Commit(); txErr != nil {
        log.Printf("Error committing transaction: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    log.Printf("Successfully updated router priority for resource %s", id)
    c.JSON(http.StatusOK, gin.H{
        "id": id,
        "router_priority": input.RouterPriority,
    })
}

// updateMiddleware updates a middleware configuration
func (s *Server) updateMiddleware(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		ResponseWithError(c, http.StatusBadRequest, "Middleware ID is required")
		return
	}

	var middleware struct {
		Name   string                 `json:"name" binding:"required"`
		Type   string                 `json:"type" binding:"required"`
		Config map[string]interface{} `json:"config" binding:"required"`
	}

	if err := c.ShouldBindJSON(&middleware); err != nil {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Validate middleware type
	if !isValidMiddlewareType(middleware.Type) {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid middleware type: %s", middleware.Type))
		return
	}

	// Check if middleware exists
	var exists int
	err := s.db.QueryRow("SELECT 1 FROM middlewares WHERE id = ?", id).Scan(&exists)
	if err == sql.ErrNoRows {
		ResponseWithError(c, http.StatusNotFound, "Middleware not found")
		return
	} else if err != nil {
		log.Printf("Error checking middleware existence: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	// Ensure empty strings are properly preserved in config
	middleware.Config = ensureEmptyStringsPreserved(middleware.Config)

	// Convert config to JSON string
	configJSON, err := json.Marshal(middleware.Config)
	if err != nil {
		log.Printf("Error encoding config: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to encode config")
		return
	}

	// Update in database using a transaction
	tx, err := s.db.Begin()
	if err != nil {
		log.Printf("Error beginning transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// If something goes wrong, rollback
	var txErr error
	defer func() {
		if txErr != nil {
			tx.Rollback()
			log.Printf("Transaction rolled back due to error: %v", txErr)
		}
	}()
	
	log.Printf("Attempting to update middleware %s with name=%s, type=%s", 
		id, middleware.Name, middleware.Type)
	
	result, txErr := tx.Exec(
		"UPDATE middlewares SET name = ?, type = ?, config = ?, updated_at = ? WHERE id = ?",
		middleware.Name, middleware.Type, string(configJSON), time.Now(), id,
	)
	
	if txErr != nil {
		log.Printf("Error updating middleware: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to update middleware")
		return
	}
	
	rowsAffected, err := result.RowsAffected()
	if err == nil {
		log.Printf("Update affected %d rows", rowsAffected)
		if rowsAffected == 0 {
			log.Printf("Warning: Update query succeeded but no rows were affected")
		}
	}
	
	// Commit the transaction
	if txErr = tx.Commit(); txErr != nil {
		log.Printf("Error committing transaction: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	// Double-check that the middleware was updated
	var updatedName string
	err = s.db.QueryRow("SELECT name FROM middlewares WHERE id = ?", id).Scan(&updatedName)
	if err != nil {
		log.Printf("Warning: Could not verify middleware update: %v", err)
	} else if updatedName != middleware.Name {
		log.Printf("Warning: Name mismatch after update. Expected '%s', got '%s'", middleware.Name, updatedName)
	} else {
		log.Printf("Successfully verified middleware update for %s", id)
	}

	// Return the updated middleware
	c.JSON(http.StatusOK, gin.H{
		"id":     id,
		"name":   middleware.Name,
		"type":   middleware.Type,
		"config": middleware.Config,
	})
}

// sanitizeMiddlewareConfig ensures proper formatting of duration values and strings
func sanitizeMiddlewareConfig(config map[string]interface{}) {
	// List of keys that should be treated as duration values
	durationKeys := map[string]bool{
		"checkPeriod":      true,
		"fallbackDuration": true,
		"recoveryDuration": true,
		"initialInterval":  true,
		"retryTimeout":     true,
		"gracePeriod":      true,
	}

	// Process the configuration recursively
	sanitizeConfigRecursive(config, durationKeys)
}

// sanitizeConfigRecursive processes config values recursively
func sanitizeConfigRecursive(data interface{}, durationKeys map[string]bool) {
	// Process based on data type
	switch v := data.(type) {
	case map[string]interface{}:
		// Process each key-value pair in the map
		for key, value := range v {
			// Handle different value types
			switch innerVal := value.(type) {
			case string:
				// Check if this is a duration field and ensure proper format
				if durationKeys[key] {
					// Check if the string has extra quotes
					if len(innerVal) > 2 && strings.HasPrefix(innerVal, "\"") && strings.HasSuffix(innerVal, "\"") {
						// Remove the extra quotes
						v[key] = strings.Trim(innerVal, "\"")
					}
				}
			case map[string]interface{}, []interface{}:
				// Recursively process nested structures
				sanitizeConfigRecursive(innerVal, durationKeys)
			}
		}
	case []interface{}:
		// Process each item in the array
		for i, item := range v {
			switch innerVal := item.(type) {
			case map[string]interface{}, []interface{}:
				// Recursively process nested structures
				sanitizeConfigRecursive(innerVal, durationKeys)
			case string:
				// Check if string has unnecessary quotes
				if len(innerVal) > 2 && strings.HasPrefix(innerVal, "\"") && strings.HasSuffix(innerVal, "\"") {
					v[i] = strings.Trim(innerVal, "\"")
				}
			}
		}
	}
}

// deleteMiddleware deletes a middleware configuration
func (s *Server) deleteMiddleware(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		ResponseWithError(c, http.StatusBadRequest, "Middleware ID is required")
		return
	}

	// Check for dependencies first
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM resource_middlewares WHERE middleware_id = ?", id).Scan(&count)
	if err != nil {
		log.Printf("Error checking middleware dependencies: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	if count > 0 {
		ResponseWithError(c, http.StatusConflict, fmt.Sprintf("Cannot delete middleware because it is used by %d resources", count))
		return
	}

	// Delete from database using a transaction
	tx, err := s.db.Begin()
	if err != nil {
		log.Printf("Error beginning transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// If something goes wrong, rollback
	var txErr error
	defer func() {
		if txErr != nil {
			tx.Rollback()
			log.Printf("Transaction rolled back due to error: %v", txErr)
		}
	}()
	
	log.Printf("Attempting to delete middleware %s", id)
	
	result, txErr := tx.Exec("DELETE FROM middlewares WHERE id = ?", id)
	if txErr != nil {
		log.Printf("Error deleting middleware: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to delete middleware")
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Error getting rows affected: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	if rowsAffected == 0 {
		ResponseWithError(c, http.StatusNotFound, "Middleware not found")
		return
	}
	
	log.Printf("Delete affected %d rows", rowsAffected)
	
	// Commit the transaction
	if txErr = tx.Commit(); txErr != nil {
		log.Printf("Error committing transaction: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	log.Printf("Successfully deleted middleware %s", id)
	c.JSON(http.StatusOK, gin.H{"message": "Middleware deleted successfully"})
}

// getResources returns all resources and their assigned middlewares
func (s *Server) getResources(c *gin.Context) {
	resources, err := s.db.GetResources()
	if err != nil {
		log.Printf("Error fetching resources: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to fetch resources")
		return
	}
	c.JSON(http.StatusOK, resources)
}

// getResource returns a specific resource
func (s *Server) getResource(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
		return
	}

	resource, err := s.db.GetResource(id)
	if err != nil {
		if err.Error() == fmt.Sprintf("resource not found: %s", id) {
			ResponseWithError(c, http.StatusNotFound, "Resource not found")
			return
		}
		log.Printf("Error fetching resource: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to fetch resource")
		return
	}

	c.JSON(http.StatusOK, resource)
}

// deleteResource deletes a resource from the database
func (s *Server) deleteResource(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
		return
	}

	// Check if resource exists and its status
	var status string
	err := s.db.QueryRow("SELECT status FROM resources WHERE id = ?", id).Scan(&status)
	if err == sql.ErrNoRows {
		ResponseWithError(c, http.StatusNotFound, "Resource not found")
		return
	} else if err != nil {
		log.Printf("Error checking resource existence: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	// Only allow deletion of disabled resources
	if status != "disabled" {
		ResponseWithError(c, http.StatusBadRequest, "Only disabled resources can be deleted")
		return
	}

	// Delete the resource using a transaction
	tx, err := s.db.Begin()
	if err != nil {
		log.Printf("Error beginning transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// If something goes wrong, rollback
	var txErr error
	defer func() {
		if txErr != nil {
			tx.Rollback()
			log.Printf("Transaction rolled back due to error: %v", txErr)
		}
	}()
	
	// First delete any middleware relationships
	log.Printf("Removing middleware relationships for resource %s", id)
	_, txErr = tx.Exec("DELETE FROM resource_middlewares WHERE resource_id = ?", id)
	if txErr != nil {
		log.Printf("Error removing resource middlewares: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to delete resource")
		return
	}
	
	// Then delete the resource
	log.Printf("Deleting resource %s", id)
	result, txErr := tx.Exec("DELETE FROM resources WHERE id = ?", id)
	if txErr != nil {
		log.Printf("Error deleting resource: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to delete resource")
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Error getting rows affected: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	if rowsAffected == 0 {
		ResponseWithError(c, http.StatusNotFound, "Resource not found")
		return
	}
	
	log.Printf("Delete affected %d rows", rowsAffected)
	
	// Commit the transaction
	if txErr = tx.Commit(); txErr != nil {
		log.Printf("Error committing transaction: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	log.Printf("Successfully deleted resource %s", id)
	c.JSON(http.StatusOK, gin.H{"message": "Resource deleted successfully"})
}

// assignMiddleware assigns a middleware to a resource
func (s *Server) assignMiddleware(c *gin.Context) {
	resourceID := c.Param("id")
	if resourceID == "" {
		ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
		return
	}

	var input struct {
		MiddlewareID string `json:"middleware_id" binding:"required"`
		Priority     int    `json:"priority"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Default priority is 100 if not specified
	if input.Priority <= 0 {
		input.Priority = 100
	}

	// Verify resource exists
	var exists int
	var status string
	err := s.db.QueryRow("SELECT 1, status FROM resources WHERE id = ?", resourceID).Scan(&exists, &status)
	if err == sql.ErrNoRows {
		ResponseWithError(c, http.StatusNotFound, "Resource not found")
		return
	} else if err != nil {
		log.Printf("Error checking resource existence: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// Don't allow attaching middlewares to disabled resources
	if status == "disabled" {
		ResponseWithError(c, http.StatusBadRequest, "Cannot assign middleware to a disabled resource")
		return
	}

	// Verify middleware exists
	err = s.db.QueryRow("SELECT 1 FROM middlewares WHERE id = ?", input.MiddlewareID).Scan(&exists)
	if err == sql.ErrNoRows {
		ResponseWithError(c, http.StatusNotFound, "Middleware not found")
		return
	} else if err != nil {
		log.Printf("Error checking middleware existence: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	// Insert or update the resource middleware relationship using a transaction
	tx, err := s.db.Begin()
	if err != nil {
		log.Printf("Error beginning transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// If something goes wrong, rollback
	var txErr error
	defer func() {
		if txErr != nil {
			tx.Rollback()
			log.Printf("Transaction rolled back due to error: %v", txErr)
		}
	}()
	
	// First delete any existing relationship
	log.Printf("Removing existing middleware relationship: resource=%s, middleware=%s",
		resourceID, input.MiddlewareID)
	_, txErr = tx.Exec(
		"DELETE FROM resource_middlewares WHERE resource_id = ? AND middleware_id = ?",
		resourceID, input.MiddlewareID,
	)
	if txErr != nil {
		log.Printf("Error removing existing relationship: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// Then insert the new relationship
	log.Printf("Creating new middleware relationship: resource=%s, middleware=%s, priority=%d",
		resourceID, input.MiddlewareID, input.Priority)
	result, txErr := tx.Exec(
		"INSERT INTO resource_middlewares (resource_id, middleware_id, priority) VALUES (?, ?, ?)",
		resourceID, input.MiddlewareID, input.Priority,
	)
	if txErr != nil {
		log.Printf("Error assigning middleware: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to assign middleware")
		return
	}
	
	rowsAffected, err := result.RowsAffected()
	if err == nil {
		log.Printf("Insert affected %d rows", rowsAffected)
	}
	
	// Commit the transaction
	if txErr = tx.Commit(); txErr != nil {
		log.Printf("Error committing transaction: %v", txErr)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	log.Printf("Successfully assigned middleware %s to resource %s with priority %d",
		input.MiddlewareID, resourceID, input.Priority)
	c.JSON(http.StatusOK, gin.H{
		"resource_id":   resourceID,
		"middleware_id": input.MiddlewareID,
		"priority":      input.Priority,
	})
}

// assignMultipleMiddlewares assigns multiple middlewares to a resource in one operation
func (s *Server) assignMultipleMiddlewares(c *gin.Context) {
    resourceID := c.Param("id")
    if resourceID == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
        return
    }

    var input struct {
        Middlewares []struct {
            MiddlewareID string `json:"middleware_id" binding:"required"`
            Priority     int    `json:"priority"`
        } `json:"middlewares" binding:"required"`
    }

    if err := c.ShouldBindJSON(&input); err != nil {
        ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
        return
    }

    // Verify resource exists and is active
    var exists int
    var status string
    err := s.db.QueryRow("SELECT 1, status FROM resources WHERE id = ?", resourceID).Scan(&exists, &status)
    if err == sql.ErrNoRows {
        ResponseWithError(c, http.StatusNotFound, "Resource not found")
        return
    } else if err != nil {
        log.Printf("Error checking resource existence: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // Don't allow attaching middlewares to disabled resources
    if status == "disabled" {
        ResponseWithError(c, http.StatusBadRequest, "Cannot assign middlewares to a disabled resource")
        return
    }

    // Start a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // If something goes wrong, rollback
    var txErr error
    defer func() {
        if txErr != nil {
            tx.Rollback()
            log.Printf("Transaction rolled back due to error: %v", txErr)
        }
    }()

    // Process each middleware
    successful := make([]map[string]interface{}, 0)
    log.Printf("Assigning %d middlewares to resource %s", len(input.Middlewares), resourceID)
    
    for _, mw := range input.Middlewares {
        // Default priority is 100 if not specified
        if mw.Priority <= 0 {
            mw.Priority = 100
        }

        // Verify middleware exists
        var middlewareExists int
        err := s.db.QueryRow("SELECT 1 FROM middlewares WHERE id = ?", mw.MiddlewareID).Scan(&middlewareExists)
        if err == sql.ErrNoRows {
            // Skip this middleware but don't fail the entire request
            log.Printf("Middleware %s not found, skipping", mw.MiddlewareID)
            continue
        } else if err != nil {
            log.Printf("Error checking middleware existence: %v", err)
            ResponseWithError(c, http.StatusInternalServerError, "Database error")
            return
        }

        // First delete any existing relationship
        log.Printf("Removing existing relationship: resource=%s, middleware=%s",
            resourceID, mw.MiddlewareID)
        _, txErr = tx.Exec(
            "DELETE FROM resource_middlewares WHERE resource_id = ? AND middleware_id = ?",
            resourceID, mw.MiddlewareID,
        )
        if txErr != nil {
            log.Printf("Error removing existing relationship: %v", txErr)
            ResponseWithError(c, http.StatusInternalServerError, "Database error")
            return
        }
        
        // Then insert the new relationship
        log.Printf("Creating new relationship: resource=%s, middleware=%s, priority=%d",
            resourceID, mw.MiddlewareID, mw.Priority)
        result, txErr := tx.Exec(
            "INSERT INTO resource_middlewares (resource_id, middleware_id, priority) VALUES (?, ?, ?)",
            resourceID, mw.MiddlewareID, mw.Priority,
        )
        if txErr != nil {
            log.Printf("Error assigning middleware: %v", txErr)
            ResponseWithError(c, http.StatusInternalServerError, "Failed to assign middleware")
            return
        }
        
        rowsAffected, err := result.RowsAffected()
        if err == nil && rowsAffected > 0 {
            log.Printf("Successfully assigned middleware %s with priority %d", 
                mw.MiddlewareID, mw.Priority)
            successful = append(successful, map[string]interface{}{
                "middleware_id": mw.MiddlewareID,
                "priority": mw.Priority,
            })
        } else {
            log.Printf("Warning: Insertion query succeeded but affected %d rows", rowsAffected)
        }
    }
    
    // Commit the transaction
    if txErr = tx.Commit(); txErr != nil {
        log.Printf("Error committing transaction: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }

    log.Printf("Successfully assigned %d middlewares to resource %s", len(successful), resourceID)
    c.JSON(http.StatusOK, gin.H{
        "resource_id": resourceID,
        "middlewares": successful,
    })
}

// removeMiddleware removes a middleware from a resource
func (s *Server) removeMiddleware(c *gin.Context) {
    resourceID := c.Param("id")
    middlewareID := c.Param("middlewareId")
    
    if resourceID == "" || middlewareID == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID and Middleware ID are required")
        return
    }

    log.Printf("Removing middleware %s from resource %s", middlewareID, resourceID)

    // Delete the relationship using a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // If something goes wrong, rollback
    var txErr error
    defer func() {
        if txErr != nil {
            tx.Rollback()
            log.Printf("Transaction rolled back due to error: %v", txErr)
        }
    }()
    
    result, txErr := tx.Exec(
        "DELETE FROM resource_middlewares WHERE resource_id = ? AND middleware_id = ?",
        resourceID, middlewareID,
    )
    
    if txErr != nil {
        log.Printf("Error removing middleware: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Failed to remove middleware")
        return
    }

    rowsAffected, err := result.RowsAffected()
    if err != nil {
        log.Printf("Error getting rows affected: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    if rowsAffected == 0 {
        log.Printf("No relationship found between resource %s and middleware %s", resourceID, middlewareID)
        ResponseWithError(c, http.StatusNotFound, "Resource middleware relationship not found")
        return
    }
    
    log.Printf("Delete affected %d rows", rowsAffected)
    
    // Commit the transaction
    if txErr = tx.Commit(); txErr != nil {
        log.Printf("Error committing transaction: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }

    log.Printf("Successfully removed middleware %s from resource %s", middlewareID, resourceID)
    c.JSON(http.StatusOK, gin.H{"message": "Middleware removed from resource successfully"})
}

// updateHTTPConfig updates the HTTP router entrypoints configuration
func (s *Server) updateHTTPConfig(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
        return
    }
    
    var input struct {
        Entrypoints string `json:"entrypoints"`
    }
    
    if err := c.ShouldBindJSON(&input); err != nil {
        ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
        return
    }
    
    // Verify resource exists and is active
    var exists int
    var status string
    err := s.db.QueryRow("SELECT 1, status FROM resources WHERE id = ?", id).Scan(&exists, &status)
    if err == sql.ErrNoRows {
        ResponseWithError(c, http.StatusNotFound, "Resource not found")
        return
    } else if err != nil {
        log.Printf("Error checking resource existence: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // Don't allow updating disabled resources
    if status == "disabled" {
        ResponseWithError(c, http.StatusBadRequest, "Cannot update a disabled resource")
        return
    }
    
    // Validate entrypoints - should be comma-separated list
    if input.Entrypoints == "" {
        input.Entrypoints = "websecure" // Default
    }
    
    // Update the resource within a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    var txErr error
    defer func() {
        if txErr != nil {
            tx.Rollback()
            log.Printf("Transaction rolled back due to error: %v", txErr)
        }
    }()
    
    log.Printf("Updating HTTP entrypoints for resource %s: %s", id, input.Entrypoints)
    
    result, txErr := tx.Exec(
        "UPDATE resources SET entrypoints = ?, updated_at = ? WHERE id = ?",
        input.Entrypoints, time.Now(), id,
    )
    
    if txErr != nil {
        log.Printf("Error updating resource entrypoints: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Failed to update resource")
        return
    }
    
    rowsAffected, err := result.RowsAffected()
    if err == nil {
        log.Printf("Update affected %d rows", rowsAffected)
        if rowsAffected == 0 {
            log.Printf("Warning: Update query succeeded but no rows were affected")
        }
    }
    
    // Commit the transaction
    if txErr = tx.Commit(); txErr != nil {
        log.Printf("Error committing transaction: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    log.Printf("Successfully updated HTTP entrypoints for resource %s", id)
    c.JSON(http.StatusOK, gin.H{
        "id": id,
        "entrypoints": input.Entrypoints,
    })
}

// updateTLSConfig updates the TLS certificate domains configuration
func (s *Server) updateTLSConfig(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
        return
    }
    
    var input struct {
        TLSDomains string `json:"tls_domains"`
    }
    
    if err := c.ShouldBindJSON(&input); err != nil {
        ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
        return
    }
    
    // Verify resource exists and is active
    var exists int
    var status string
    err := s.db.QueryRow("SELECT 1, status FROM resources WHERE id = ?", id).Scan(&exists, &status)
    if err == sql.ErrNoRows {
        ResponseWithError(c, http.StatusNotFound, "Resource not found")
        return
    } else if err != nil {
        log.Printf("Error checking resource existence: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // Don't allow updating disabled resources
    if status == "disabled" {
        ResponseWithError(c, http.StatusBadRequest, "Cannot update a disabled resource")
        return
    }
    
    // Update the resource within a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    var txErr error
    defer func() {
        if txErr != nil {
            tx.Rollback()
            log.Printf("Transaction rolled back due to error: %v", txErr)
        }
    }()
    
    log.Printf("Updating TLS domains for resource %s: %s", id, input.TLSDomains)
    
    result, txErr := tx.Exec(
        "UPDATE resources SET tls_domains = ?, updated_at = ? WHERE id = ?",
        input.TLSDomains, time.Now(), id,
    )
    
    if txErr != nil {
        log.Printf("Error updating TLS domains: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Failed to update TLS domains")
        return
    }
    
    rowsAffected, err := result.RowsAffected()
    if err == nil {
        log.Printf("Update affected %d rows", rowsAffected)
        if rowsAffected == 0 {
            log.Printf("Warning: Update query succeeded but no rows were affected")
        }
    }
    
    // Commit the transaction
    if txErr = tx.Commit(); txErr != nil {
        log.Printf("Error committing transaction: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    log.Printf("Successfully updated TLS domains for resource %s", id)
    c.JSON(http.StatusOK, gin.H{
        "id": id,
        "tls_domains": input.TLSDomains,
    })
}

// updateTCPConfig updates the TCP SNI router configuration
func (s *Server) updateTCPConfig(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
        return
    }
    
    var input struct {
        TCPEnabled     bool   `json:"tcp_enabled"`
        TCPEntrypoints string `json:"tcp_entrypoints"`
        TCPSNIRule     string `json:"tcp_sni_rule"`
    }
    
    if err := c.ShouldBindJSON(&input); err != nil {
        ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
        return
    }
    
    // Verify resource exists and is active
    var exists int
    var status string
    err := s.db.QueryRow("SELECT 1, status FROM resources WHERE id = ?", id).Scan(&exists, &status)
    if err == sql.ErrNoRows {
        ResponseWithError(c, http.StatusNotFound, "Resource not found")
        return
    } else if err != nil {
        log.Printf("Error checking resource existence: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // Don't allow updating disabled resources
    if status == "disabled" {
        ResponseWithError(c, http.StatusBadRequest, "Cannot update a disabled resource")
        return
    }
    
    // Validate TCP entrypoints if provided
    if input.TCPEntrypoints == "" {
        input.TCPEntrypoints = "tcp" // Default
    }
    
    // Validate SNI rule if provided
    if input.TCPSNIRule != "" {
        // Basic validation - ensure it contains HostSNI
        if !strings.Contains(input.TCPSNIRule, "HostSNI") {
            ResponseWithError(c, http.StatusBadRequest, "TCP SNI rule must contain HostSNI matcher")
            return
        }
    }
    
    // Convert boolean to integer for SQLite
    tcpEnabled := 0
    if input.TCPEnabled {
        tcpEnabled = 1
    }
    
    // Update the resource within a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    var txErr error
    defer func() {
        if txErr != nil {
            tx.Rollback()
            log.Printf("Transaction rolled back due to error: %v", txErr)
        }
    }()
    
    log.Printf("Updating TCP config for resource %s: enabled=%t, entrypoints=%s", 
        id, input.TCPEnabled, input.TCPEntrypoints)
    
    result, txErr := tx.Exec(
        "UPDATE resources SET tcp_enabled = ?, tcp_entrypoints = ?, tcp_sni_rule = ?, updated_at = ? WHERE id = ?",
        tcpEnabled, input.TCPEntrypoints, input.TCPSNIRule, time.Now(), id,
    )
    
    if txErr != nil {
        log.Printf("Error updating TCP config: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Failed to update TCP configuration")
        return
    }
    
    rowsAffected, err := result.RowsAffected()
    if err == nil {
        log.Printf("Update affected %d rows", rowsAffected)
        if rowsAffected == 0 {
            log.Printf("Warning: Update query succeeded but no rows were affected")
        }
    }
    
    // Commit the transaction
    if txErr = tx.Commit(); txErr != nil {
        log.Printf("Error committing transaction: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    log.Printf("Successfully updated TCP configuration for resource %s", id)
    c.JSON(http.StatusOK, gin.H{
        "id":              id,
        "tcp_enabled":     input.TCPEnabled,
        "tcp_entrypoints": input.TCPEntrypoints,
        "tcp_sni_rule":    input.TCPSNIRule,
    })
}

// updateHeadersConfig updates the custom headers configuration
func (s *Server) updateHeadersConfig(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID is required")
        return
    }
    
    var input struct {
        CustomHeaders map[string]string `json:"custom_headers" binding:"required"`
    }
    
    if err := c.ShouldBindJSON(&input); err != nil {
        ResponseWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
        return
    }
    
    // Verify resource exists and is active
    var exists int
    var status string
    err := s.db.QueryRow("SELECT 1, status FROM resources WHERE id = ?", id).Scan(&exists, &status)
    if err == sql.ErrNoRows {
        ResponseWithError(c, http.StatusNotFound, "Resource not found")
        return
    } else if err != nil {
        log.Printf("Error checking resource existence: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // Don't allow updating disabled resources
    if status == "disabled" {
        ResponseWithError(c, http.StatusBadRequest, "Cannot update a disabled resource")
        return
    }
    
    // Convert headers to JSON for storage
    headersJSON, err := json.Marshal(input.CustomHeaders)
    if err != nil {
        log.Printf("Error encoding headers: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Failed to encode headers")
        return
    }
    
    // Update the resource within a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    var txErr error
    defer func() {
        if txErr != nil {
            tx.Rollback()
            log.Printf("Transaction rolled back due to error: %v", txErr)
        }
    }()
    
    log.Printf("Updating custom headers for resource %s with %d headers", 
        id, len(input.CustomHeaders))
    
    result, txErr := tx.Exec(
        "UPDATE resources SET custom_headers = ?, updated_at = ? WHERE id = ?",
        string(headersJSON), time.Now(), id,
    )
    
    if txErr != nil {
        log.Printf("Error updating custom headers: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Failed to update custom headers")
        return
    }
    
    rowsAffected, err := result.RowsAffected()
    if err == nil {
        log.Printf("Update affected %d rows", rowsAffected)
        if rowsAffected == 0 {
            log.Printf("Warning: Update query succeeded but no rows were affected")
        }
    }
    
    // Commit the transaction
    if txErr = tx.Commit(); txErr != nil {
        log.Printf("Error committing transaction: %v", txErr)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // Verify the update by reading back the custom_headers
    var storedHeaders string
    verifyErr := s.db.QueryRow("SELECT custom_headers FROM resources WHERE id = ?", id).Scan(&storedHeaders)
    if verifyErr != nil {
        log.Printf("Warning: Could not verify headers update: %v", verifyErr)
    } else if storedHeaders == "" {
        log.Printf("Warning: Headers may be empty after update for resource %s", id)
    } else {
        log.Printf("Successfully verified headers update for resource %s", id)
    }
    
    log.Printf("Successfully updated custom headers for resource %s", id)
    c.JSON(http.StatusOK, gin.H{
        "id": id,
        "custom_headers": input.CustomHeaders,
    })
}

// generateID generates a random 16-character hex string
func generateID() (string, error) {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// isValidMiddlewareType checks if a middleware type is valid
func isValidMiddlewareType(typ string) bool {
	validTypes := map[string]bool{
        // Currently supported types
        "basicAuth":         true,
        "forwardAuth":       true,
        "ipWhiteList":       true,
        "rateLimit":         true,
        "headers":           true,
        "stripPrefix":       true,
        "addPrefix":         true,
        "redirectRegex":     true,
        "redirectScheme":    true,
        "chain":             true,
        "replacepathregex":  true,
        "replacePathRegex":  true, // Adding correct camelCase version
        "plugin":            true,
        // Additional middleware types from templates.yaml
        "digestAuth":        true,
        "ipAllowList":       true,
        "stripPrefixRegex":  true,
        "replacePath":       true,
        "compress":          true,
        "circuitBreaker":    true,
        "contentType":       true,
        "errors":            true,
        "grpcWeb":           true,
        "inFlightReq":       true,
        "passTLSClientCert": true,
        "retry":             true,
        "buffering":         true,
	}
	
	return validTypes[typ]
}