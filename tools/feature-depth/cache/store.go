// Package cache provides a content-addressed JSON cache for file-level
// analyses, keyed by SHA-256 of file content + analyzer version.
//
// Motivation: feature-depth re-walking 593 .ts files per run costs
// ~2-3s. With a content cache, re-runs after touching only a handful
// of files become near-instant. The cache is invalidated automatically
// when the analyzer version bumps (semantic: any change to scoring
// logic should bump this).
//
// JSON-backed instead of SQLite to avoid pulling cgo/sqlite as a
// dependency. The cache file is small (~500KB for 593 entries) and
// rewritten atomically on Save().
package cache

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Cache is a content-addressed read-through cache. Safe for concurrent
// reads; Put + Save must be serialized by the caller (the analyzer
// pipeline is single-threaded at the cache layer).
type Cache struct {
	path    string
	version string
	entries map[string]json.RawMessage
	hits    int
	misses  int
	mu      sync.RWMutex
}

type cacheFile struct {
	Version string                     `json:"version"`
	Entries map[string]json.RawMessage `json:"entries"`
}

// NewCache returns an empty cache pointed at `path`. Call Load() to
// populate from disk; the constructor itself does no I/O so it stays
// safe to call inside hot loops with --no-cache.
func NewCache(path, version string) *Cache {
	return &Cache{
		path:    path,
		version: version,
		entries: make(map[string]json.RawMessage),
	}
}

// Load reads the cache file from disk. Missing file or version
// mismatch yields an empty cache without error — both are normal:
// first run, or analyzer logic was updated.
func (c *Cache) Load() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	raw, err := os.ReadFile(c.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // first run
		}
		return err
	}

	var file cacheFile
	if err := json.Unmarshal(raw, &file); err != nil {
		// Corrupted cache — drop it silently.
		return nil
	}
	if file.Version != c.version {
		// Analyzer version drift — entries are invalid.
		return nil
	}
	if file.Entries != nil {
		c.entries = file.Entries
	}
	return nil
}

// Save persists the cache atomically (write to temp, then rename).
func (c *Cache) Save() error {
	c.mu.RLock()
	file := cacheFile{Version: c.version, Entries: c.entries}
	c.mu.RUnlock()

	data, err := json.Marshal(file)
	if err != nil {
		return err
	}

	dir := filepath.Dir(c.path)
	if dir != "." {
		_ = os.MkdirAll(dir, 0o755)
	}

	tmp := c.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, c.path)
}

// Get returns the cached payload for `hash`, plus a hit/miss flag.
// Updates internal hit/miss counters for telemetry.
func (c *Cache) Get(hash string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	raw, ok := c.entries[hash]
	if ok {
		c.hits++
		return []byte(raw), true
	}
	c.misses++
	return nil, false
}

// Put inserts or replaces an entry.
func (c *Cache) Put(hash string, payload []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Copy the bytes — caller may mutate them.
	cp := make(json.RawMessage, len(payload))
	copy(cp, payload)
	c.entries[hash] = cp
}

// Stats returns (hits, misses) since the cache was instantiated.
func (c *Cache) Stats() (int, int) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hits, c.misses
}

// Size returns the number of cached entries.
func (c *Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

// HashFileContent returns a stable SHA-256 hex digest of the input.
// Used as the cache key; identical content across files / runs
// resolves to the same entry.
func HashFileContent(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:])
}
