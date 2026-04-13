package scanner

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Module represents a discovered core module with its source and test files.
type Module struct {
	Name        string
	Dir         string
	SourceFiles []string
	TestFiles   []string
	E2EFiles    []string
}

var importCoreRe = regexp.MustCompile(`from\s+['"]\.{1,3}/.*?core/(\w[\w-]*)`)

// DiscoverModules scans the core directory for modules and matches test files.
func DiscoverModules(baseDir, corePath, testPath, e2ePath string, filterModules []string) ([]Module, error) {
	coreAbs := filepath.Join(baseDir, corePath)
	entries, err := os.ReadDir(coreAbs)
	if err != nil {
		return nil, err
	}

	filterSet := make(map[string]bool)
	for _, m := range filterModules {
		filterSet[m] = true
	}

	// Build test-to-module mapping
	testMap := buildTestModuleMap(baseDir, testPath)
	e2eMap := buildE2EModuleMap(baseDir, e2ePath)

	var modules []Module
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if len(filterSet) > 0 && !filterSet[name] {
			continue
		}

		moduleDir := filepath.Join(coreAbs, name)
		sourceFiles := listTSFiles(moduleDir, false)

		mod := Module{
			Name:        name,
			Dir:         moduleDir,
			SourceFiles: sourceFiles,
			TestFiles:   testMap[name],
			E2EFiles:    e2eMap[name],
		}
		modules = append(modules, mod)
	}

	return modules, nil
}

// listTSFiles returns all .ts files in dir (non-recursive or recursive).
// If excludeTests is false, includes .test.ts files too.
func listTSFiles(dir string, includeTests bool) []string {
	var files []string
	_ = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".ts") && !strings.HasSuffix(path, ".tsx") {
			return nil
		}
		isTest := strings.HasSuffix(path, ".test.ts") || strings.HasSuffix(path, ".spec.ts")
		if isTest && !includeTests {
			return nil
		}
		if !isTest && includeTests {
			return nil
		}
		files = append(files, path)
		return nil
	})
	return files
}

// buildTestModuleMap reads all test files in testPath and maps them to core modules
// by scanning their import statements.
func buildTestModuleMap(baseDir, testPath string) map[string][]string {
	result := make(map[string][]string)
	testAbs := filepath.Join(baseDir, testPath)

	_ = filepath.WalkDir(testAbs, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".test.ts") && !strings.HasSuffix(path, ".spec.ts") {
			return nil
		}
		// Skip e2e directory — handled separately
		rel, _ := filepath.Rel(testAbs, path)
		if strings.HasPrefix(rel, "e2e") {
			return nil
		}

		modules := extractModulesFromImports(path)
		for _, mod := range modules {
			result[mod] = append(result[mod], path)
		}

		// Also try to match by filename pattern (e.g., "rag-pipeline.test.ts" -> check if any core module name is a prefix)
		base := filepath.Base(path)
		base = strings.TrimSuffix(base, ".test.ts")
		base = strings.TrimSuffix(base, ".spec.ts")
		// This is a secondary heuristic — imports take priority
		return nil
	})

	return result
}

// buildE2EModuleMap reads E2E test files and maps them to modules by content reference.
func buildE2EModuleMap(baseDir, e2ePath string) map[string][]string {
	result := make(map[string][]string)
	e2eAbs := filepath.Join(baseDir, e2ePath)

	_ = filepath.WalkDir(e2eAbs, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".spec.ts") && !strings.HasSuffix(path, ".test.ts") {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		contentStr := string(content)

		// Match modules referenced in the E2E file by path or keyword
		matches := importCoreRe.FindAllStringSubmatch(contentStr, -1)
		for _, m := range matches {
			if len(m) > 1 {
				result[m[1]] = append(result[m[1]], path)
			}
		}

		return nil
	})

	return result
}

// extractModulesFromImports reads a file and returns core module names found in imports.
func extractModulesFromImports(filePath string) []string {
	f, err := os.Open(filePath)
	if err != nil {
		return nil
	}
	defer f.Close()

	seen := make(map[string]bool)
	var modules []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		matches := importCoreRe.FindAllStringSubmatch(line, -1)
		for _, m := range matches {
			if len(m) > 1 && !seen[m[1]] {
				seen[m[1]] = true
				modules = append(modules, m[1])
			}
		}
	}
	return modules
}
