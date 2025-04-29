package database

import (
  "database/sql"
  "fmt"
  "log"
)

// TxFn represents a function that uses a transaction
type TxFn func(*sql.Tx) error

// WithTransaction wraps a function with a transaction
func (db *DB) WithTransaction(fn TxFn) error {
  tx, err := db.Begin()
  if err != nil {
    return fmt.Errorf("failed to begin transaction: %w", err)
  }
  
  defer func() {
    if p := recover(); p != nil {
      // Ensure rollback on panic
      log.Printf("Recovered from panic in transaction: %v", p)
      tx.Rollback()
      panic(p) // Re-throw panic after rollback
    }
  }()
  
  if err := fn(tx); err != nil {
    if rbErr := tx.Rollback(); rbErr != nil {
      log.Printf("Warning: Rollback failed: %v (original error: %v)", rbErr, err)
      return fmt.Errorf("rollback failed: %v (original error: %w)", rbErr, err)
    }
    log.Printf("Transaction rolled back due to error: %v", err)
    return err
  }
  
  if err := tx.Commit(); err != nil {
    log.Printf("Error committing transaction: %v", err)
    return fmt.Errorf("commit failed: %w", err)
  }
  
  return nil
}

// QueryRow executes a query that returns a single row and scans the result into the provided destination
func (db *DB) QueryRowSafe(query string, dest interface{}, args ...interface{}) error {
  row := db.QueryRow(query, args...)
  if err := row.Scan(dest); err != nil {
    if err == sql.ErrNoRows {
      return ErrNotFound
    }
    return fmt.Errorf("scan failed: %w", err)
  }
  return nil
}

// ExecSafe executes a statement and returns the result summary
func (db *DB) ExecSafe(query string, args ...interface{}) (sql.Result, error) {
  result, err := db.Exec(query, args...)
  if err != nil {
    return nil, fmt.Errorf("exec failed: %w", err)
  }
  return result, nil
}

// CustomError types for database operations
var (
  ErrNotFound = fmt.Errorf("record not found")
  ErrDuplicate = fmt.Errorf("duplicate record")
  ErrConstraint = fmt.Errorf("constraint violation")
)

// ExecTx executes a statement within a transaction and returns the result
func ExecTx(tx *sql.Tx, query string, args ...interface{}) (sql.Result, error) {
  result, err := tx.Exec(query, args...)
  if err != nil {
    return nil, fmt.Errorf("exec in transaction failed: %w", err)
  }
  return result, nil
}

// GetRowsAffected is a helper to get rows affected from a result
func GetRowsAffected(result sql.Result) (int64, error) {
  affected, err := result.RowsAffected()
  if err != nil {
    return 0, fmt.Errorf("failed to get rows affected: %w", err)
  }
  return affected, nil
}

// GetLastInsertID is a helper to get last insert ID from a result
func GetLastInsertID(result sql.Result) (int64, error) {
  id, err := result.LastInsertId()
  if err != nil {
    return 0, fmt.Errorf("failed to get last insert ID: %w", err)
  }
  return id, nil
}

