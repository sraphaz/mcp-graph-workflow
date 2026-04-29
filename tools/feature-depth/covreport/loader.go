// Package coverage parses Istanbul-format coverage reports (the v8 / vitest
// default output at coverage/coverage-final.json) and turns them into a
// map of repo-relative path → percent statements covered.
//
// This replaces the regex-based "test file exists, count its LOC" heuristic
// with real coverage data when available. analyzer/file.go consumes the
// resulting map and overrides TestDensity per file.
package covreport

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// IstanbulEntry is one file's coverage record in coverage-final.json.
// Only the `s` (statement-hit) map is consumed; we ignore `f`/`b` which
// give function/branch hit counts the file-level score does not need.
type IstanbulEntry struct {
	Path string         `json:"path"`
	S    map[string]int `json:"s"`
}

// LoadCoverage reads an Istanbul coverage-final.json at `path`, restricts
// to entries under `baseDir`, and returns map[relPath]percentCovered (0-100).
//
// Files whose absolute path falls outside baseDir are silently dropped —
// they are dependencies / node_modules / etc. and have no relPath inside
// the project.
func LoadCoverage(path, baseDir string) (map[string]float64, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("coverage: read %q: %w", path, err)
	}

	var entries map[string]IstanbulEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil, fmt.Errorf("coverage: parse %q: %w", path, err)
	}

	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		absBase = baseDir
	}

	out := make(map[string]float64, len(entries))
	for absPath, entry := range entries {
		// Some tools emit relative keys, some absolute. Use entry.Path if
		// present (more reliable), fall back to the map key.
		filePath := entry.Path
		if filePath == "" {
			filePath = absPath
		}

		// Restrict to entries inside the base directory.
		rel, err := filepath.Rel(absBase, filePath)
		if err != nil || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
			continue
		}
		rel = filepath.ToSlash(rel)

		total := len(entry.S)
		if total == 0 {
			out[rel] = 0.0
			continue
		}
		hit := 0
		for _, count := range entry.S {
			if count > 0 {
				hit++
			}
		}
		out[rel] = float64(hit) / float64(total) * 100.0
	}
	return out, nil
}

// AutoDetectCoveragePath returns `<root>/coverage/coverage-final.json` if it
// exists, otherwise empty string. Used to make the coverage integration
// zero-config — drop a coverage report in the conventional location and
// the next feature-depth run picks it up.
func AutoDetectCoveragePath(root string) string {
	candidate := filepath.Join(root, "coverage", "coverage-final.json")
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	return ""
}
