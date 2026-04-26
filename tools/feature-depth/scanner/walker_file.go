package scanner

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// importSourceRe captures relative imports of `core/<...>` source files
// from a test file under src/tests/. Forward-slash only — TS imports
// always use forward slashes regardless of OS.
//
// Captures the full path after `core/`, e.g. for the import
//   import { x } from "../core/rag/onnx-embeddings.js"
// the captured group is "rag/onnx-embeddings".
var importSourceRe = regexp.MustCompile(`from\s+['"](?:\.{1,3}/)+core/([\w][\w\-/]*?)\.(?:js|ts|tsx)['"]`)

// File represents a single discovered source file (non-test) with its
// content and adjacent test file association if any.
//
// File-level granularity is the answer to the per-module dilution
// problem: a 12-test addition to one file inside a 65-file module is
// invisible at module-aggregate level. AnalyzeFile (analyzer/file.go)
// consumes this struct.
type File struct {
	Path     string // absolute path
	RelPath  string // relative to baseDir, used as stable identifier
	Module   string // immediate parent directory name (e.g. "rag")
	Content  string
	LOC      int
	TestPath string // empty if no adjacent .test.ts / .spec.ts
	TestLOC  int    // 0 if TestPath empty
}

// DiscoverFiles walks corePath under baseDir and returns every source
// .ts file (excluding .test.ts, .spec.ts, .d.ts, and anything under
// node_modules or dist).
//
// Test association strategy (in priority order):
//  1. **Adjacent test** — `foo.ts` paired with `foo.test.ts` in the same
//     directory. Highest-confidence match.
//  2. **Global test→source map** — when testPath is non-empty, walks
//     the test directory and parses each test file's `import ... from
//     "../core/<sub>/<file>.js"` statements to find which source file
//     the test exercises. This is the layout this project uses
//     (tests under src/tests/, not colocated).
//
// Pass testPath="" to disable the global map (useful in unit tests
// with self-contained fixtures).
func DiscoverFiles(baseDir, corePath, testPath string) ([]File, error) {
	coreAbs := filepath.Join(baseDir, corePath)
	if _, err := os.Stat(coreAbs); err != nil {
		return nil, fmt.Errorf("DiscoverFiles: corePath %q under %q: %w", corePath, baseDir, err)
	}

	// Build the global test→source map first (cheap walk; reused below).
	// Keys are forward-slash RelPath strings, e.g.
	// "src/core/rag/onnx-embeddings.ts". Value is the absolute test path.
	globalTestMap := buildGlobalTestSourceMap(baseDir, corePath, testPath)

	var sources []string
	testIndex := make(map[string]string) // dir + base (no ext) -> test path

	err := filepath.WalkDir(coreAbs, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			name := d.Name()
			if name == "node_modules" || name == "dist" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".ts") && !strings.HasSuffix(path, ".tsx") {
			return nil
		}
		if strings.HasSuffix(path, ".d.ts") {
			return nil
		}
		isTest := strings.HasSuffix(path, ".test.ts") ||
			strings.HasSuffix(path, ".spec.ts") ||
			strings.HasSuffix(path, ".test.tsx") ||
			strings.HasSuffix(path, ".spec.tsx")
		if isTest {
			testIndex[testKey(path)] = path
			return nil
		}
		sources = append(sources, path)
		return nil
	})
	if err != nil {
		return nil, err
	}

	files := make([]File, 0, len(sources))
	for _, srcPath := range sources {
		rel, err := filepath.Rel(baseDir, srcPath)
		if err != nil {
			rel = srcPath
		}
		// filepath.Rel uses OS separator; normalize to forward slash so
		// RelPath is a stable, cross-platform identifier and the test
		// fixtures (which use forward-slash keys) match on every OS.
		rel = filepath.ToSlash(rel)
		fc, err := ReadFileContent(srcPath)
		if err != nil {
			continue
		}
		f := File{
			Path:    srcPath,
			RelPath: rel,
			Module:  filepath.Base(filepath.Dir(srcPath)),
			Content: fc.Content,
			LOC:     fc.LOC,
		}
		// Adjacent test takes precedence over global mapping.
		if adjPath, ok := testIndex[srcKey(srcPath)]; ok {
			if tc, err := ReadFileContent(adjPath); err == nil {
				f.TestPath = adjPath
				f.TestLOC = tc.LOC
			}
		} else if globalPath, ok := globalTestMap[rel]; ok {
			if tc, err := ReadFileContent(globalPath); err == nil {
				f.TestPath = globalPath
				f.TestLOC = tc.LOC
			}
		}
		files = append(files, f)
	}
	return files, nil
}

// buildGlobalTestSourceMap walks testPath under baseDir and parses each
// test file's imports to figure out which source file under corePath it
// targets. Returns a map keyed by the source file's forward-slash
// RelPath (e.g. "src/core/rag/onnx-embeddings.ts") with value = test
// file's absolute path.
//
// When a single test imports multiple source files, the *first* import
// wins as the test's "primary" target. This matches the convention
// where a test for `foo.ts` imports `foo.ts` first and may pull in
// helpers / errors / utils from sibling modules afterwards.
func buildGlobalTestSourceMap(baseDir, corePath, testPath string) map[string]string {
	result := make(map[string]string)
	if testPath == "" {
		return result
	}
	testAbs := filepath.Join(baseDir, testPath)
	if _, err := os.Stat(testAbs); err != nil {
		return result
	}

	_ = filepath.WalkDir(testAbs, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		isTest := strings.HasSuffix(path, ".test.ts") ||
			strings.HasSuffix(path, ".spec.ts") ||
			strings.HasSuffix(path, ".test.tsx") ||
			strings.HasSuffix(path, ".spec.tsx")
		if !isTest {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()

		// Two-pass over the file's imports:
		//   1. Prefer the import whose basename matches the test file's
		//      basename. `entity-store.test.ts` -> import that ends
		//      with `entity-store.js` is the canonical target, even if
		//      another import was listed first (alphabetical lint).
		//   2. Fall back to the first matching import if no basename
		//      match is found — keeps integration-suite-style tests
		//      attributed to *something* rather than orphaned.
		testBase := filepath.Base(path)
		for _, suf := range []string{".test.ts", ".spec.ts", ".test.tsx", ".spec.tsx"} {
			testBase = strings.TrimSuffix(testBase, suf)
		}

		var basenameMatch, firstMatch string
		s := bufio.NewScanner(f)
		for s.Scan() {
			m := importSourceRe.FindStringSubmatch(s.Text())
			if m == nil {
				continue
			}
			// m[1] is "rag/onnx-embeddings" — append corePath + ".ts".
			rel := filepath.ToSlash(filepath.Join(corePath, m[1]+".ts"))
			if firstMatch == "" {
				firstMatch = rel
			}
			// Match by basename of the imported source file.
			importedBase := filepath.Base(m[1])
			if importedBase == testBase {
				basenameMatch = rel
				break
			}
		}

		primaryKey := basenameMatch
		if primaryKey == "" {
			primaryKey = firstMatch
		}
		if primaryKey == "" {
			return nil
		}
		// Don't overwrite — first matching test for a given source wins.
		// Otherwise integration tests that pull in many sources would
		// clobber the focused unit test.
		if _, exists := result[primaryKey]; !exists {
			result[primaryKey] = path
		}
		return nil
	})
	return result
}

// srcKey returns the lookup key used to find the adjacent test file:
// the directory + the base name without the .ts/.tsx extension.
func srcKey(srcPath string) string {
	dir := filepath.Dir(srcPath)
	base := filepath.Base(srcPath)
	base = strings.TrimSuffix(base, ".tsx")
	base = strings.TrimSuffix(base, ".ts")
	return dir + "/" + base
}

// testKey returns the same key for a test file so the index lookup
// finds the matching source. e.g. handoff.test.ts -> dir + "handoff".
func testKey(testPath string) string {
	dir := filepath.Dir(testPath)
	base := filepath.Base(testPath)
	for _, suf := range []string{".test.ts", ".spec.ts", ".test.tsx", ".spec.tsx"} {
		base = strings.TrimSuffix(base, suf)
	}
	return dir + "/" + base
}
