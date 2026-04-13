package analyzer

// ModuleAnalysis holds the complete analysis for a single core module.
type ModuleAnalysis struct {
	Name      string          `json:"name"`
	Breadth   BreadthResult   `json:"breadth"`
	Depth     DepthResult     `json:"depth"`
	Maturity  MaturityResult  `json:"maturity"`
	Martin    MartinResult    `json:"martin"`
	Entropy   EntropyResult   `json:"entropy"`
	LCOM      LCOMResult      `json:"lcom"`
	Halstead  HalsteadResult  `json:"halstead"`
	Cognitive CognitiveResult `json:"cognitive"`
	DepGraph  DepGraphResult  `json:"depGraph"`
}

// BreadthResult measures the surface area of a module.
type BreadthResult struct {
	SourceFiles    int     `json:"sourceFiles"`
	TotalLOC       int     `json:"totalLOC"`
	ExportedFuncs  int     `json:"exportedFunctions"`
	ExportedTypes  int     `json:"exportedTypes"`
	ExportedConsts int     `json:"exportedConstants"`
	McpToolRefs    int     `json:"mcpToolRefs"`
	ApiRouteRefs   int     `json:"apiRouteRefs"`
	BreadthScore   float64 `json:"breadthScore"`
}

// DepthResult measures the implementation precision of a module.
type DepthResult struct {
	TestDensity        float64 `json:"testDensity"`
	TestBreadth        float64 `json:"testBreadth"`
	ErrorHandlingScore float64 `json:"errorHandlingScore"`
	TypeSafetyScore    float64 `json:"typeSafetyScore"`
	AvgComplexity      float64 `json:"avgComplexity"`
	MaxComplexity      float64 `json:"maxComplexity"`
	MaxComplexityFunc  string  `json:"maxComplexityFunc"`
	ValidationCoverage float64 `json:"validationCoverage"`
	EdgeCaseHandling   float64 `json:"edgeCaseHandling"`
}

// MaturityResult measures the completeness indicators of a module.
type MaturityResult struct {
	HasIntegrationTests bool    `json:"hasIntegrationTests"`
	HasE2ETests         bool    `json:"hasE2ETests"`
	HasBarrelExport     bool    `json:"hasBarrelExport"`
	JSDocCoverage       float64 `json:"jsDocCoverage"`
	ErrorPathLogging    int     `json:"errorPathLogging"`
}

// FunctionInfo holds extracted function metadata for complexity analysis.
type FunctionInfo struct {
	Name       string
	Body       string
	Complexity int
}
