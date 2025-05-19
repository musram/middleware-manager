package database

import (
    "fmt"
    "log"
    "strings"
)

// CleanupDuplicateServices removes service duplication from the database
func (db *DB) CleanupDuplicateServices() error {
    // Get all services
    rows, err := db.Query("SELECT id, name, type, config FROM services")
    if err != nil {
        return fmt.Errorf("failed to query services: %w", err)
    }
    defer rows.Close()
    
    // Map to track unique base names
    type serviceInfo struct {
        ID     string
        Config string
    }
    uniqueServices := make(map[string]serviceInfo)
    
    var servicesToDelete []string
    
    // Process each service
    for rows.Next() {
        var id, name, typ, configStr string
        if err := rows.Scan(&id, &name, &typ, &configStr); err != nil {
            return fmt.Errorf("failed to scan service: %w", err)
        }
        
        // Get base name (without any provider suffix)
        baseName := id
        if idx := strings.Index(id, "@"); idx > 0 {
            baseName = id[:idx]
        }
        
        // If we've already seen this base name, mark this as duplicate
        if existing, found := uniqueServices[baseName]; found {
            // Keep the one with fewer @ symbols (more "canonical")
            if strings.Count(existing.ID, "@") > strings.Count(id, "@") {
                // The new one is better, update the map and mark the old one for deletion
                servicesToDelete = append(servicesToDelete, existing.ID)
                uniqueServices[baseName] = serviceInfo{id, configStr}
            } else {
                // The existing one is better, mark this one for deletion
                servicesToDelete = append(servicesToDelete, id)
            }
        } else {
            // First time seeing this base name
            uniqueServices[baseName] = serviceInfo{id, configStr}
        }
    }
    
    // Delete duplicates in a transaction
    tx, err := db.Begin()
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    
    for _, id := range servicesToDelete {
        log.Printf("Deleting duplicate service: %s", id)
        if _, err := tx.Exec("DELETE FROM services WHERE id = ?", id); err != nil {
            tx.Rollback()
            return fmt.Errorf("failed to delete service %s: %w", id, err)
        }
    }
    
    if err := tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }
    
    log.Printf("Cleanup complete. Removed %d duplicate services", len(servicesToDelete))
    return nil
}