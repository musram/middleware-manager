package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()
	
	_, err = tx.Exec(
		"INSERT INTO middlewares (id, name, type, config) VALUES (?, ?, ?, ?)",
		id, middleware.Name, middleware.Type, string(configJSON),
	)
	
	if err != nil {
		log.Printf("Error inserting middleware: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to save middleware")
		return
	}
	
	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

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
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()
	
	_, err = tx.Exec(
		"UPDATE middlewares SET name = ?, type = ?, config = ?, updated_at = ? WHERE id = ?",
		middleware.Name, middleware.Type, string(configJSON), time.Now(), id,
	)
	
	if err != nil {
		log.Printf("Error updating middleware: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to update middleware")
		return
	}
	
	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":     id,
		"name":   middleware.Name,
		"type":   middleware.Type,
		"config": middleware.Config,
	})
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
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()
	
	result, err := tx.Exec("DELETE FROM middlewares WHERE id = ?", id)
	if err != nil {
		log.Printf("Error deleting middleware: %v", err)
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
	
	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

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
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()
	
	// First delete any middleware relationships
	_, err = tx.Exec("DELETE FROM resource_middlewares WHERE resource_id = ?", id)
	if err != nil {
		log.Printf("Error removing resource middlewares: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to delete resource")
		return
	}
	
	// Then delete the resource
	result, err := tx.Exec("DELETE FROM resources WHERE id = ?", id)
	if err != nil {
		log.Printf("Error deleting resource: %v", err)
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
	
	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

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
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()
	
	// First delete any existing relationship
	_, err = tx.Exec(
		"DELETE FROM resource_middlewares WHERE resource_id = ? AND middleware_id = ?",
		resourceID, input.MiddlewareID,
	)
	if err != nil {
		log.Printf("Error removing existing relationship: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}
	
	// Then insert the new relationship
	_, err = tx.Exec(
		"INSERT INTO resource_middlewares (resource_id, middleware_id, priority) VALUES (?, ?, ?)",
		resourceID, input.MiddlewareID, input.Priority,
	)
	if err != nil {
		log.Printf("Error assigning middleware: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Failed to assign middleware")
		return
	}
	
	// Commit the transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		ResponseWithError(c, http.StatusInternalServerError, "Database error")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"resource_id":   resourceID,
		"middleware_id": input.MiddlewareID,
		"priority":      input.Priority,
	})
}

// removeMiddleware removes a middleware from a resource
// removeMiddleware removes a middleware from a resource
func (s *Server) removeMiddleware(c *gin.Context) {
    // Updated to use "id" parameter instead of "resourceId" to match route definition
    resourceID := c.Param("id")
    middlewareID := c.Param("middlewareId")
    
    if resourceID == "" || middlewareID == "" {
        ResponseWithError(c, http.StatusBadRequest, "Resource ID and Middleware ID are required")
        return
    }

    // Delete the relationship using a transaction
    tx, err := s.db.Begin()
    if err != nil {
        log.Printf("Error beginning transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }
    
    // If something goes wrong, rollback
    defer func() {
        if err != nil {
            tx.Rollback()
        }
    }()
    
    result, err := tx.Exec(
        "DELETE FROM resource_middlewares WHERE resource_id = ? AND middleware_id = ?",
        resourceID, middlewareID,
    )
    
    if err != nil {
        log.Printf("Error removing middleware: %v", err)
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
        ResponseWithError(c, http.StatusNotFound, "Resource middleware relationship not found")
        return
    }
    
    // Commit the transaction
    if err = tx.Commit(); err != nil {
        log.Printf("Error committing transaction: %v", err)
        ResponseWithError(c, http.StatusInternalServerError, "Database error")
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Middleware removed from resource successfully"})
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
		"basicAuth":      true,
		"forwardAuth":    true,
		"ipWhiteList":    true,
		"rateLimit":      true,
		"headers":        true,
		"stripPrefix":    true,
		"addPrefix":      true,
		"redirectRegex":  true,
		"redirectScheme": true,
		"chain":          true,
	}
	
	return validTypes[typ]
}