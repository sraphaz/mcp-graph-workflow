// Package watch implements a polling-based file watcher used by
// feature-depth's --watch mode. Polling avoids pulling fsnotify (and
// its golang.org/x/sys transitive) for a tool that values minimal
// dependencies — a 1-2s lag in dev feedback is acceptable cost.
//
// SnapshotMTimes walks `root` once and returns a path → mtime map
// restricted to .ts / .tsx files, excluding node_modules / dist /
// .git / build artifacts. Diff returns the set of paths that were
// added, modified, or deleted between two snapshots. The watch
// driver itself lives in main.go: snapshot, sleep, snapshot, diff;
// when changed > 0 trigger a re-analysis (which the cache makes near
// instant for unchanged files).
package watch

import (
	"os"
	"path/filepath"
	"strings"
	"time"
)

var excludedDirs = map[string]bool{
	"node_modules": true,
	"dist":         true,
	".git":         true,
	".next":        true,
	"build":        true,
	"coverage":     true,
}

// SnapshotMTimes walks `root` and returns map[absPath]mtime for every
// .ts / .tsx file outside excluded directories.
func SnapshotMTimes(root string) (map[string]time.Time, error) {
	snap := make(map[string]time.Time)
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if excludedDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		name := d.Name()
		if !strings.HasSuffix(name, ".ts") && !strings.HasSuffix(name, ".tsx") {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		snap[path] = info.ModTime()
		return nil
	})
	return snap, err
}

// Diff returns the paths that changed between `old` and `now`:
// added (in now, not in old), modified (mtime advanced), or deleted
// (in old, not in now).
func Diff(old, now map[string]time.Time) []string {
	var changed []string
	for path, t := range now {
		prior, ok := old[path]
		if !ok || !prior.Equal(t) {
			changed = append(changed, path)
		}
	}
	for path := range old {
		if _, ok := now[path]; !ok {
			changed = append(changed, path)
		}
	}
	return changed
}
