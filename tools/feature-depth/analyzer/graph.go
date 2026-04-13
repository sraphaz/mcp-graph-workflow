package analyzer

import (
	"bufio"
	"feature-depth/scanner"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ImportGraph holds the complete inter-module dependency graph.
type ImportGraph struct {
	Modules map[string]*GraphModuleNode
	Edges   map[string]map[string]int // from -> to -> import count
}

// GraphModuleNode represents a module in the import graph.
type GraphModuleNode struct {
	Name     string
	Files    []string
	Afferent map[string]int // modules that import FROM this module (Ca detail)
	Efferent map[string]int // modules this module imports FROM (Ce detail)
}

// IntraModuleImport captures file-level imports within a module (for LCOM4).
type IntraModuleImport struct {
	FromFile string
	ToFile   string
}

var (
	// Captures inter-module imports via relative paths:
	//   from '../<module>/<file>.js'  (sibling module from within core/)
	//   from '../../core/<module>/<file>'  (from outside core/)
	relativeModuleRe = regexp.MustCompile(`from\s+['"]\.\.\/([\w-]+)\/`)
	coreImportRe     = regexp.MustCompile(`from\s+['"](?:\.\./)*core/([\w-]+)/`)
	// Captures intra-module imports: from './<file>'
	localImportRe = regexp.MustCompile(`from\s+['"]\.\/([\w-]+)`)
)

// BuildImportGraph scans all modules and builds the directed dependency graph.
// Must run before concurrent per-module analysis (Phase 1).
func BuildImportGraph(modules []scanner.Module, baseDir, corePath string) *ImportGraph {
	graph := &ImportGraph{
		Modules: make(map[string]*GraphModuleNode),
		Edges:   make(map[string]map[string]int),
	}

	// Initialize nodes
	for _, mod := range modules {
		graph.Modules[mod.Name] = &GraphModuleNode{
			Name:     mod.Name,
			Files:    mod.SourceFiles,
			Afferent: make(map[string]int),
			Efferent: make(map[string]int),
		}
		graph.Edges[mod.Name] = make(map[string]int)
	}

	// Scan all source files to build edges
	for _, mod := range modules {
		for _, filePath := range mod.SourceFiles {
			imports := scanFileImports(filePath)
			for _, targetModule := range imports {
				if targetModule == mod.Name {
					continue // skip self-imports for inter-module graph
				}
				if _, exists := graph.Modules[targetModule]; !exists {
					continue // skip non-core imports
				}
				graph.Edges[mod.Name][targetModule]++
				graph.Modules[mod.Name].Efferent[targetModule]++
				graph.Modules[targetModule].Afferent[mod.Name]++
			}
		}
	}

	// Also scan MCP tools and API routes as external consumers
	scanExternalConsumers(graph, baseDir, "src/mcp/tools")
	scanExternalConsumers(graph, baseDir, "src/api/routes")

	return graph
}

// scanFileImports extracts core module names from a file's import statements.
// Handles both patterns:
//   from '../<module>/<file>.js'  (relative sibling, used inside src/core/)
//   from '../../core/<module>/<file>'  (used from src/mcp/, src/api/)
func scanFileImports(filePath string) []string {
	f, err := os.Open(filePath)
	if err != nil {
		return nil
	}
	defer f.Close()

	seen := make(map[string]bool)
	var modules []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		// Pattern 1: ../module/file (relative sibling)
		for _, m := range relativeModuleRe.FindAllStringSubmatch(line, -1) {
			if len(m) > 1 && !seen[m[1]] {
				seen[m[1]] = true
				modules = append(modules, m[1])
			}
		}
		// Pattern 2: ../../core/module/file (from outside core)
		for _, m := range coreImportRe.FindAllStringSubmatch(line, -1) {
			if len(m) > 1 && !seen[m[1]] {
				seen[m[1]] = true
				modules = append(modules, m[1])
			}
		}
	}
	return modules
}

// ScanLocalImports extracts intra-module file imports (for LCOM4 analysis).
func ScanLocalImports(filePath string) []string {
	f, err := os.Open(filePath)
	if err != nil {
		return nil
	}
	defer f.Close()

	var locals []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		matches := localImportRe.FindAllStringSubmatch(line, -1)
		for _, m := range matches {
			if len(m) > 1 {
				locals = append(locals, m[1])
			}
		}
	}
	return locals
}

// scanExternalConsumers scans non-core directories for imports from core modules.
func scanExternalConsumers(graph *ImportGraph, baseDir, relPath string) {
	dir := filepath.Join(baseDir, relPath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".ts") {
			continue
		}
		filePath := filepath.Join(dir, entry.Name())
		imports := scanFileImports(filePath)
		for _, mod := range imports {
			if node, ok := graph.Modules[mod]; ok {
				node.Afferent["_external"]++
			}
		}
	}
}

// AfferentCount returns the number of unique modules importing from the given module.
func (g *ImportGraph) AfferentCount(modName string) int {
	node, ok := g.Modules[modName]
	if !ok {
		return 0
	}
	return len(node.Afferent)
}

// EfferentCount returns the number of unique modules the given module imports from.
func (g *ImportGraph) EfferentCount(modName string) int {
	node, ok := g.Modules[modName]
	if !ok {
		return 0
	}
	return len(node.Efferent)
}

// AllModuleNames returns all module names in the graph.
func (g *ImportGraph) AllModuleNames() []string {
	names := make([]string, 0, len(g.Modules))
	for name := range g.Modules {
		names = append(names, name)
	}
	return names
}
