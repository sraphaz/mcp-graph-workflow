package cache

import (
	"os"
	"path/filepath"
	"testing"
)

func tempCachePath(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	return filepath.Join(dir, "cache.json")
}

func TestCache_RoundTrip(t *testing.T) {
	path := tempCachePath(t)
	c := NewCache(path, "v1")

	c.Put("abc123", []byte(`{"score":88}`))
	c.Put("def456", []byte(`{"score": 72}`))

	if err := c.Save(); err != nil {
		t.Fatalf("save: %v", err)
	}

	loaded := NewCache(path, "v1")
	if err := loaded.Load(); err != nil {
		t.Fatalf("load: %v", err)
	}

	got, ok := loaded.Get("abc123")
	if !ok {
		t.Fatal("expected abc123 in loaded cache")
	}
	if string(got) != `{"score":88}` {
		t.Errorf("entry mismatch: got %s", string(got))
	}
}

func TestCache_VersionMismatchInvalidates(t *testing.T) {
	path := tempCachePath(t)
	c := NewCache(path, "v1")
	c.Put("hash", []byte("payload"))
	_ = c.Save()

	// Load with a newer analyzer version → cache must be empty.
	v2 := NewCache(path, "v2")
	_ = v2.Load()
	if _, ok := v2.Get("hash"); ok {
		t.Error("expected v2 cache empty after v1 file")
	}
}

func TestCache_LoadMissingFileReturnsEmpty(t *testing.T) {
	c := NewCache("/nonexistent/path.json", "v1")
	if err := c.Load(); err != nil {
		t.Errorf("loading missing path should not error, got %v", err)
	}
	if _, ok := c.Get("anything"); ok {
		t.Error("expected empty cache")
	}
}

func TestCache_LoadCorruptedJSONReturnsEmpty(t *testing.T) {
	path := tempCachePath(t)
	_ = os.WriteFile(path, []byte("{not valid"), 0o644)

	c := NewCache(path, "v1")
	if err := c.Load(); err != nil {
		t.Errorf("corrupt cache should not error: %v", err)
	}
	if _, ok := c.Get("x"); ok {
		t.Error("expected empty cache after corrupt load")
	}
}

func TestCache_HitsAndMissesMetric(t *testing.T) {
	c := NewCache(tempCachePath(t), "v1")
	c.Put("a", []byte("1"))

	_, _ = c.Get("a")
	_, _ = c.Get("a")
	_, _ = c.Get("b")
	_, _ = c.Get("c")

	hits, misses := c.Stats()
	if hits != 2 {
		t.Errorf("hits = %d, want 2", hits)
	}
	if misses != 2 {
		t.Errorf("misses = %d, want 2", misses)
	}
}

func TestHashFileContent_Stable(t *testing.T) {
	a := HashFileContent("export const x = 1;\n")
	b := HashFileContent("export const x = 1;\n")
	if a != b {
		t.Error("same content → different hash")
	}
	if len(a) == 0 {
		t.Error("empty hash returned")
	}
}

func TestHashFileContent_DifferentForDifferentContent(t *testing.T) {
	a := HashFileContent("export const x = 1;\n")
	b := HashFileContent("export const x = 2;\n")
	if a == b {
		t.Error("different content → same hash")
	}
}
