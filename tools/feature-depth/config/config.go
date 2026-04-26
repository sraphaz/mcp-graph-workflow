package config

import (
	"flag"
	"strings"
)

// Config holds all CLI configuration for the analyzer.
type Config struct {
	Dir         string
	Output      string // "json", "table", "both"
	CorePath    string
	McpPath     string
	ApiPath     string
	TestPath    string
	E2EPath     string
	Threshold   int
	JSONOut     string
	Modules     []string // empty = all
	Granularity string   // "module" (default) or "file"
	Growth      bool     // when true, run growth-mode (git-history LOC analysis) instead of scoring
	Baseline    string   // optional path to a previous file-mode JSON for diff
}

// Weights for the precision score calculation.
// v2.0: 16 dimensions combining ISO/IEC 25010 + GQM + Martin + Shannon + LCOM4 + Halstead + SonarSource + Graph Theory.
type Weights struct {
	// Original 10 dimensions (v1 weights redistributed)
	TestDensity        float64
	TestBreadth        float64
	ErrorHandling      float64
	TypeSafety         float64
	Complexity         float64
	ValidationCoverage float64
	EdgeCaseHandling   float64
	IntegrationTests   float64
	E2ECoverage        float64
	MaturityComposite  float64
	// New 6 dimensions (v2)
	MartinDistance      float64 // Robert C. Martin — distance from main sequence
	EntropyBalance     float64 // Shannon — import/export distribution balance
	CohesionLCOM       float64 // Hitz & Montazeri — LCOM4 connected components
	HalsteadEffort     float64 // Halstead — inverse mental effort
	CognitiveComplexity float64 // SonarSource — nesting-aware complexity
	GraphHealth        float64 // Graph theory — cycles + bidirectional coupling
}

// DefaultWeights returns the default scoring weights (sum = 1.0).
func DefaultWeights() Weights {
	return Weights{
		TestDensity:         0.14,
		TestBreadth:         0.07,
		ErrorHandling:       0.10,
		TypeSafety:          0.10,
		Complexity:          0.07,
		ValidationCoverage:  0.07,
		EdgeCaseHandling:    0.04,
		IntegrationTests:    0.04,
		E2ECoverage:         0.04,
		MaturityComposite:   0.03,
		MartinDistance:       0.06,
		EntropyBalance:      0.04,
		CohesionLCOM:        0.06,
		HalsteadEffort:      0.04,
		CognitiveComplexity: 0.05,
		GraphHealth:         0.05,
	}
}

// ParseFlags parses CLI flags and returns a Config.
func ParseFlags() Config {
	dir := flag.String("dir", ".", "target project directory")
	output := flag.String("output", "both", "output format: json, table, or both")
	corePath := flag.String("core-path", "src/core", "relative path to core modules")
	mcpPath := flag.String("mcp-path", "src/mcp/tools", "relative path to MCP tools")
	apiPath := flag.String("api-path", "src/api/routes", "relative path to API routes")
	testPath := flag.String("test-path", "src/tests", "relative path to test files")
	e2ePath := flag.String("e2e-path", "src/tests/e2e", "relative path to E2E tests")
	threshold := flag.Int("threshold", 50, "minimum acceptable precision score")
	jsonOut := flag.String("json-out", "", "output file path for JSON report (empty = stdout)")
	modules := flag.String("modules", "", "comma-separated list of modules to analyze (empty = all)")
	granularity := flag.String("granularity", "module", "report granularity: module (default) or file")
	growthMode := flag.Bool("growth", false, "run project-growth analysis from git history instead of scoring")
	baseline := flag.String("baseline", "", "optional path to a previous file-mode JSON for delta comparison")

	flag.Parse()

	var moduleList []string
	if *modules != "" {
		for _, m := range strings.Split(*modules, ",") {
			m = strings.TrimSpace(m)
			if m != "" {
				moduleList = append(moduleList, m)
			}
		}
	}

	return Config{
		Dir:         *dir,
		Output:      *output,
		CorePath:    *corePath,
		McpPath:     *mcpPath,
		ApiPath:     *apiPath,
		TestPath:    *testPath,
		E2EPath:     *e2ePath,
		Threshold:   *threshold,
		JSONOut:     *jsonOut,
		Modules:     moduleList,
		Granularity: *granularity,
		Growth:      *growthMode,
		Baseline:    *baseline,
	}
}
