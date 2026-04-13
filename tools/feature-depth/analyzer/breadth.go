package analyzer

import (
	"feature-depth/scanner"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	exportFuncRe  = regexp.MustCompile(`(?m)^export\s+(async\s+)?function\s+(\w+)`)
	exportClassRe = regexp.MustCompile(`(?m)^export\s+(abstract\s+)?class\s+(\w+)`)
	exportTypeRe  = regexp.MustCompile(`(?m)^export\s+(type|interface|enum)\s+(\w+)`)
	exportConstRe = regexp.MustCompile(`(?m)^export\s+(const|let|var)\s+(\w+)`)
)

// AnalyzeBreadth measures the surface area of a module.
func AnalyzeBreadth(mod scanner.Module, sourceContent string, baseDir, mcpPath, apiPath string) BreadthResult {
	sourceLOC := 0
	for _, f := range scanner.ReadFilesContent(mod.SourceFiles) {
		sourceLOC += f.LOC
	}

	funcs := len(exportFuncRe.FindAllString(sourceContent, -1)) + len(exportClassRe.FindAllString(sourceContent, -1))
	types := len(exportTypeRe.FindAllString(sourceContent, -1))
	consts := len(exportConstRe.FindAllString(sourceContent, -1))

	mcpRefs := countCrossRefs(baseDir, mcpPath, mod.Name)
	apiRefs := countCrossRefs(baseDir, apiPath, mod.Name)

	totalExports := funcs + types + consts

	// Breadth score: weighted composite (normalized later by scorer)
	score := float64(len(mod.SourceFiles))*2.0 +
		float64(sourceLOC)*0.01 +
		float64(totalExports)*1.5 +
		float64(mcpRefs)*5.0 +
		float64(apiRefs)*5.0

	return BreadthResult{
		SourceFiles:    len(mod.SourceFiles),
		TotalLOC:       sourceLOC,
		ExportedFuncs:  funcs,
		ExportedTypes:  types,
		ExportedConsts: consts,
		McpToolRefs:    mcpRefs,
		ApiRouteRefs:   apiRefs,
		BreadthScore:   score,
	}
}

// countCrossRefs counts how many files in a directory import from a given core module.
func countCrossRefs(baseDir, relPath, moduleName string) int {
	dir := filepath.Join(baseDir, relPath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}

	pattern := "core/" + moduleName + "/"
	altPattern := "core/" + moduleName + "."
	count := 0

	for _, entry := range entries {
		if entry.IsDir() || (!strings.HasSuffix(entry.Name(), ".ts") && !strings.HasSuffix(entry.Name(), ".tsx")) {
			continue
		}
		content, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		contentStr := string(content)
		if strings.Contains(contentStr, pattern) || strings.Contains(contentStr, altPattern) {
			count++
		}
	}

	return count
}
