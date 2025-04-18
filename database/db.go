package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// DB is a wrapper around sql.DB
type DB struct {
	*sql.DB
}

// InitDB initializes the database connection
func InitDB(dbPath string) (*DB, error) {
	// Create parent directory if it doesn't exist
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	// Open the database with pragmas for better reliability
	db, err := sql.Open("sqlite3", dbPath+"?_journal=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		db.Close() // Close the connection on failure
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Set connection limits
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	log.Printf("Connected to database at %s", dbPath)

	// Run migrations
	if err := runMigrations(db); err != nil {
		db.Close() // Close the connection on failure
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}
	
	// Run post-migration updates
	if err := runPostMigrationUpdates(db); err != nil {
		log.Printf("Warning: Error running post-migration updates: %v", err)
	}

	return &DB{db}, nil
}

// runMigrations executes the database migrations
func runMigrations(db *sql.DB) error {
	// Try to find migrations file in different locations
	migrationsFile := findMigrationsFile()
	if migrationsFile == "" {
		return fmt.Errorf("migrations file not found")
	}

	// Read migrations file
	migrations, err := ioutil.ReadFile(migrationsFile)
	if err != nil {
		return fmt.Errorf("failed to read migrations file: %w", err)
	}

	// Execute migrations in a transaction
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// If something goes wrong, rollback
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Execute migrations
	if _, err = tx.Exec(string(migrations)); err != nil {
		return fmt.Errorf("failed to execute migrations: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Println("Migrations completed successfully")
	return nil
}

// runPostMigrationUpdates handles migrations that SQLite can't do easily in schema migrations
func runPostMigrationUpdates(db *sql.DB) error {
	// Check if existing resources table is missing any of our columns
	// We'll check for the custom_headers column
	var hasCustomHeadersColumn bool
	err := db.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('resources') 
		WHERE name = 'custom_headers'
	`).Scan(&hasCustomHeadersColumn)
	
	if err != nil {
		return fmt.Errorf("failed to check if custom_headers column exists: %w", err)
	}
	
	// If the column doesn't exist, we need to add it to the existing table
	if !hasCustomHeadersColumn {
		log.Println("Adding custom_headers column to resources table")
		
		if _, err := db.Exec("ALTER TABLE resources ADD COLUMN custom_headers TEXT DEFAULT ''"); err != nil {
			return fmt.Errorf("failed to add custom_headers column: %w", err)
		}
		
		log.Println("Successfully added custom_headers column")
	}
	// Check for router_priority column
	var hasRouterPriorityColumn bool
	err = db.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('resources') 
		WHERE name = 'router_priority'
	`).Scan(&hasRouterPriorityColumn)

	if err != nil {
		return fmt.Errorf("failed to check if router_priority column exists: %w", err)
	}

	// If the column doesn't exist, add it
	if !hasRouterPriorityColumn {
		log.Println("Adding router_priority column to resources table")
		
		if _, err := db.Exec("ALTER TABLE resources ADD COLUMN router_priority INTEGER DEFAULT 100"); err != nil {
			return fmt.Errorf("failed to add router_priority column: %w", err)
		}
		
		log.Println("Successfully added router_priority column")
	}	
	// Check for entrypoints column as well (from previous migration)
	var hasEntrypointsColumn bool
	err = db.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('resources') 
		WHERE name = 'entrypoints'
	`).Scan(&hasEntrypointsColumn)
	
	if err != nil {
		return fmt.Errorf("failed to check if entrypoints column exists: %w", err)
	}
	
	// If the column doesn't exist, add the routing columns too
	if !hasEntrypointsColumn {
		log.Println("Adding routing configuration columns to resources table")
		
		// Add columns for HTTP routing
		if _, err := db.Exec("ALTER TABLE resources ADD COLUMN entrypoints TEXT DEFAULT 'websecure'"); err != nil {
			return fmt.Errorf("failed to add entrypoints column: %w", err)
		}
		
		// Add columns for TLS certificate configuration
		if _, err := db.Exec("ALTER TABLE resources ADD COLUMN tls_domains TEXT DEFAULT ''"); err != nil {
			return fmt.Errorf("failed to add tls_domains column: %w", err)
		}
		
		// Add columns for TCP SNI routing
		if _, err := db.Exec("ALTER TABLE resources ADD COLUMN tcp_enabled INTEGER DEFAULT 0"); err != nil {
			return fmt.Errorf("failed to add tcp_enabled column: %w", err)
		}
		
		if _, err := db.Exec("ALTER TABLE resources ADD COLUMN tcp_entrypoints TEXT DEFAULT 'tcp'"); err != nil {
			return fmt.Errorf("failed to add tcp_entrypoints column: %w", err)
		}
		
		if _, err := db.Exec("ALTER TABLE resources ADD COLUMN tcp_sni_rule TEXT DEFAULT ''"); err != nil {
			return fmt.Errorf("failed to add tcp_sni_rule column: %w", err)
		}
		
		log.Println("Successfully added all routing configuration columns")
	}
	
	return nil
}

// findMigrationsFile tries to find the migrations file in different locations
func findMigrationsFile() string {
	possiblePaths := []string{
		"database/migrations.sql",
		"migrations.sql",
		"/app/database/migrations.sql",
		"/app/migrations.sql",
	}

	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	return ""
}

// GetMiddlewares fetches all middleware definitions
func (db *DB) GetMiddlewares() ([]map[string]interface{}, error) {
	rows, err := db.Query("SELECT id, name, type, config FROM middlewares")
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var middlewares []map[string]interface{}
	for rows.Next() {
		var id, name, typ, configStr string
		if err := rows.Scan(&id, &name, &typ, &configStr); err != nil {
			return nil, fmt.Errorf("row scan failed: %w", err)
		}

		// Parse the config JSON
		var configMap map[string]interface{}
		if err := json.Unmarshal([]byte(configStr), &configMap); err != nil {
			// If we can't parse the JSON, just return it as a string
			middleware := map[string]interface{}{
				"id":     id,
				"name":   name,
				"type":   typ,
				"config": configStr,
			}
			middlewares = append(middlewares, middleware)
			continue
		}

		middleware := map[string]interface{}{
			"id":     id,
			"name":   name,
			"type":   typ,
			"config": configMap,
		}
		middlewares = append(middlewares, middleware)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return middlewares, nil
}

// GetResources fetches all resources
func (db *DB) GetResources() ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT r.id, r.host, r.service_id, r.org_id, r.site_id, r.status, 
		       r.entrypoints, r.tls_domains, r.tcp_enabled, r.tcp_entrypoints, r.tcp_sni_rule,
		       r.custom_headers,
		       GROUP_CONCAT(m.id || ':' || m.name || ':' || rm.priority, ',') as middlewares
		FROM resources r
		LEFT JOIN resource_middlewares rm ON r.id = rm.resource_id
		LEFT JOIN middlewares m ON rm.middleware_id = m.id
		GROUP BY r.id
	`)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var resources []map[string]interface{}
	for rows.Next() {
		var id, host, serviceID, orgID, siteID, status, entrypoints, tlsDomains, tcpEntrypoints, tcpSNIRule, customHeaders string
		var tcpEnabled int
		var middlewares sql.NullString
		if err := rows.Scan(&id, &host, &serviceID, &orgID, &siteID, &status, 
				   &entrypoints, &tlsDomains, &tcpEnabled, &tcpEntrypoints, &tcpSNIRule, 
				   &customHeaders, &middlewares); err != nil {
			return nil, fmt.Errorf("row scan failed: %w", err)
		}
		
		resource := map[string]interface{}{
			"id":              id,
			"host":            host,
			"service_id":      serviceID,
			"org_id":          orgID,
			"site_id":         siteID,
			"status":          status,
			"entrypoints":     entrypoints,
			"tls_domains":     tlsDomains,
			"tcp_enabled":     tcpEnabled > 0,
			"tcp_entrypoints": tcpEntrypoints,
			"tcp_sni_rule":    tcpSNIRule,
			"custom_headers":  customHeaders,
		}
		
		if middlewares.Valid {
			resource["middlewares"] = middlewares.String
		} else {
			resource["middlewares"] = ""
		}
		
		resources = append(resources, resource)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return resources, nil
}

// GetResource fetches a specific resource by ID
func (db *DB) GetResource(id string) (map[string]interface{}, error) {
	var host, serviceID, orgID, siteID, status, entrypoints, tlsDomains, tcpEntrypoints, tcpSNIRule, customHeaders string
	var tcpEnabled int
	var middlewares sql.NullString

	err := db.QueryRow(`
		SELECT r.host, r.service_id, r.org_id, r.site_id, r.status,
		       r.entrypoints, r.tls_domains, r.tcp_enabled, r.tcp_entrypoints, r.tcp_sni_rule,
		       r.custom_headers,
		       GROUP_CONCAT(m.id || ':' || m.name || ':' || rm.priority, ',') as middlewares
		FROM resources r
		LEFT JOIN resource_middlewares rm ON r.id = rm.resource_id
		LEFT JOIN middlewares m ON rm.middleware_id = m.id
		WHERE r.id = ?
		GROUP BY r.id
	`, id).Scan(&host, &serviceID, &orgID, &siteID, &status, 
		    &entrypoints, &tlsDomains, &tcpEnabled, &tcpEntrypoints, &tcpSNIRule, 
		    &customHeaders, &middlewares)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("resource not found: %s", id)
	} else if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}

	resource := map[string]interface{}{
		"id":              id,
		"host":            host,
		"service_id":      serviceID,
		"org_id":          orgID,
		"site_id":         siteID,
		"status":          status,
		"entrypoints":     entrypoints,
		"tls_domains":     tlsDomains,
		"tcp_enabled":     tcpEnabled > 0,
		"tcp_entrypoints": tcpEntrypoints,
		"tcp_sni_rule":    tcpSNIRule,
		"custom_headers":  customHeaders,
	}

	if middlewares.Valid {
		resource["middlewares"] = middlewares.String
	} else {
		resource["middlewares"] = ""
	}

	return resource, nil
}

// GetMiddleware fetches a specific middleware by ID
func (db *DB) GetMiddleware(id string) (map[string]interface{}, error) {
	var name, typ, configStr string

	err := db.QueryRow(
		"SELECT name, type, config FROM middlewares WHERE id = ?", id,
	).Scan(&name, &typ, &configStr)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("middleware not found: %s", id)
	} else if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}

	var configMap map[string]interface{}
	if err := json.Unmarshal([]byte(configStr), &configMap); err != nil {
		// If we can't parse the JSON, just return the string
		return map[string]interface{}{
			"id":     id,
			"name":   name,
			"type":   typ,
			"config": configStr,
		}, nil
	}

	return map[string]interface{}{
		"id":     id,
		"name":   name,
		"type":   typ,
		"config": configMap,
	}, nil
}