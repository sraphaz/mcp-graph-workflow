package analyzer

import (
	"feature-depth/scanner"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	jsDocRe      = regexp.MustCompile(`(?s)/\*\*.*?\*/\s*export\s+`)
	exportLineRe = regexp.MustCompile(`(?m)^export\s+`)
	loggerErrorRe = regexp.MustCompile(`logger\.error\(`)
	loggerWarnRe  = regexp.MustCompile(`logger\.warn\(`)
)

// AnalyzeMaturity measures completeness indicators.
func AnalyzeMaturity(mod scanner.Module, sourceContent string) MaturityResult {
	// Barrel export: check for index.ts
	hasBarrel := false
	indexPath := filepath.Join(mod.Dir, "index.ts")
	if _, err := os.Stat(indexPath); err == nil {
		hasBarrel = true
	}

	// Integration tests: test files importing from 2+ different core modules
	hasIntegration := checkIntegrationTests(mod.TestFiles)

	// E2E tests
	hasE2E := len(mod.E2EFiles) > 0

	// JSDoc coverage: JSDoc blocks before exports / total exports
	jsDocCount := len(jsDocRe.FindAllString(sourceContent, -1))
	exportCount := len(exportLineRe.FindAllString(sourceContent, -1))
	jsDocCov := 0.0
	if exportCount > 0 {
		jsDocCov = float64(jsDocCount) / float64(exportCount) * 100.0
		if jsDocCov > 100.0 {
			jsDocCov = 100.0
		}
	}

	// Error path logging
	errorLogs := len(loggerErrorRe.FindAllString(sourceContent, -1))
	warnLogs := len(loggerWarnRe.FindAllString(sourceContent, -1))

	return MaturityResult{
		HasIntegrationTests: hasIntegration,
		HasE2ETests:         hasE2E,
		HasBarrelExport:     hasBarrel,
		JSDocCoverage:       jsDocCov,
		ErrorPathLogging:    errorLogs + warnLogs,
	}
}

// checkIntegrationTests checks if any test file imports from 2+ core modules.
func checkIntegrationTests(testFiles []string) bool {
	coreImportRe := regexp.MustCompile(`from\s+['"]\.{1,3}/.*?core/(\w[\w-]*)`)

	for _, tf := range testFiles {
		content, err := os.ReadFile(tf)
		if err != nil {
			continue
		}
		matches := coreImportRe.FindAllStringSubmatch(string(content), -1)
		modules := make(map[string]bool)
		for _, m := range matches {
			if len(m) > 1 {
				modules[m[1]] = true
			}
		}
		if len(modules) >= 2 {
			return true
		}
	}
	return false
}

// MaturityScore computes a composite maturity score (0-100) for use in precision scoring.
func MaturityScore(m MaturityResult) float64 {
	score := 0.0

	if m.HasBarrelExport {
		score += 20.0
	}

	score += m.JSDocCoverage * 0.4 // Up to 40 points

	if m.ErrorPathLogging > 0 {
		logScore := float64(m.ErrorPathLogging) * 5.0
		if logScore > 20.0 {
			logScore = 20.0
		}
		score += logScore
	}

	if m.HasIntegrationTests {
		score += 10.0
	}
	if m.HasE2ETests {
		score += 10.0
	}

	if score > 100.0 {
		score = 100.0
	}
	return score
}

// CombineContent reads all source files of a module and combines their content.
func CombineContent(files []string) string {
	var sb strings.Builder
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		sb.Write(data)
		sb.WriteString("\n")
	}
	return sb.String()
}
