package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"tdt-space/internal/platform"

	"github.com/tidwall/buntdb"
)

// ============================================================================
// StoreService — replaces electron-store + store.handlers.ts
// ============================================================================

// StoreService manages persistent key-value storage using BuntDB.
type StoreService struct {
	db *buntdb.DB
	mu sync.RWMutex
}

func NewStoreService() *StoreService {
	configDir := platform.GetConfigDir()
	dbPath := filepath.Join(configDir, "data.db")

	// Ensure config directory exists before opening database
	if err := os.MkdirAll(configDir, 0755); err != nil {
		log.Printf("[StoreService] WARNING: Failed to create config directory %s: %v", configDir, err)
	}

	// Attempt to open the database file
	db, err := buntdb.Open(dbPath)
	if err != nil {
		// Log the error with full path for debugging
		log.Printf("[StoreService] WARNING: Failed to open database file at %s: %v", dbPath, err)
		log.Printf("[StoreService] Falling back to in-memory storage - data will NOT persist!")

		// Fallback to in-memory if file fails
		db, _ = buntdb.Open(":memory:")
	} else {
		// Successfully opened file-based database
		log.Printf("[StoreService] Database initialized at %s", dbPath)
	}

	db.SetConfig(buntdb.Config{
		SyncPolicy:           buntdb.EverySecond,
		AutoShrinkDisabled:   false,
		AutoShrinkMinSize:    500 * 1024,
		AutoShrinkPercentage: 10,
	})

return &StoreService{db: db}
}

// GetDB returns the underlying BuntDB instance.
func (s *StoreService) GetDB() *buntdb.DB {
	return s.db
}

// GetValue retrieves a JSON-decoded value by key.
// Returns nil if key doesn't exist.
func (s *StoreService) GetValue(key string) interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result interface{}
	err := s.db.View(func(tx *buntdb.Tx) error {
		val, err := tx.Get(key)
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(val), &result)
	})
	if err != nil {
		return nil
	}
	return result
}

// SetValue stores a JSON-encoded value by key.
func (s *StoreService) SetValue(key string, value interface{}) Result {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.Marshal(value)
	if err != nil {
		return Result{Success: false, Error: fmt.Sprintf("marshal error: %v", err)}
	}

	err = s.db.Update(func(tx *buntdb.Tx) error {
		_, _, err := tx.Set(key, string(data), nil)
		return err
	})
	if err != nil {
		return Result{Success: false, Error: err.Error()}
	}
	return Result{Success: true}
}

// DeleteValue removes a key from the store.
func (s *StoreService) DeleteValue(key string) Result {
	s.mu.Lock()
	defer s.mu.Unlock()

	err := s.db.Update(func(tx *buntdb.Tx) error {
		_, err := tx.Delete(key)
		if err == buntdb.ErrNotFound {
			return nil
		}
		return err
	})
	if err != nil {
		return Result{Success: false, Error: err.Error()}
	}
	return Result{Success: true}
}

// GetByPrefix returns all key-value pairs with the given prefix.
func (s *StoreService) GetByPrefix(prefix string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]interface{})
	s.db.View(func(tx *buntdb.Tx) error {
		tx.AscendKeys(prefix+"*", func(key, val string) bool {
			var v interface{}
			if json.Unmarshal([]byte(val), &v) == nil {
				result[key[len(prefix):]] = v
			}
			return true
		})
		return nil
	})
	return result
}

// SetRaw sets a raw string value (used internally by other services).
func (s *StoreService) SetRaw(key, value string) error {
	return s.db.Update(func(tx *buntdb.Tx) error {
		_, _, err := tx.Set(key, value, nil)
		return err
	})
}

// GetRaw gets a raw string value (used internally by other services).
func (s *StoreService) GetRaw(key string) (string, error) {
	var val string
	err := s.db.View(func(tx *buntdb.Tx) error {
		var e error
		val, e = tx.Get(key)
		return e
	})
	return val, err
}

// DeleteByPrefix removes all keys with the given prefix.
func (s *StoreService) DeleteByPrefix(prefix string) error {
	var keys []string
	s.db.View(func(tx *buntdb.Tx) error {
		tx.AscendKeys(prefix+"*", func(key, _ string) bool {
			keys = append(keys, key)
			return true
		})
		return nil
	})

	return s.db.Update(func(tx *buntdb.Tx) error {
		for _, k := range keys {
			tx.Delete(k)
		}
		return nil
	})
}

// Close closes the BuntDB database.
func (s *StoreService) Close() {
	if s.db != nil {
		s.db.Close()
	}
}
