package scorer

import (
	"feature-depth/analyzer"
	"feature-depth/config"
	"math"
)

// ModuleScore holds the final computed scores for a module.
type ModuleScore struct {
	Name           string                 `json:"name"`
	Analysis       analyzer.ModuleAnalysis `json:"analysis"`
	PrecisionScore float64                `json:"precisionScore"`
	Grade          string                 `json:"grade"`
	Quadrant       string                 `json:"quadrant"`
	BreadthNorm    float64                `json:"breadthNormalized"`
	DepthNorm      float64                `json:"depthNormalized"`
	Recommendations []string              `json:"recommendations"`
}

// Report holds the complete analysis report.
type Report struct {
	Metadata Metadata      `json:"metadata"`
	Summary  Summary       `json:"summary"`
	Modules  []ModuleScore `json:"modules"`
}

// Metadata holds report metadata.
type Metadata struct {
	Tool        string `json:"tool"`
	Version     string `json:"version"`
	Methodology string `json:"methodology"`
	AnalyzedAt  string `json:"analyzedAt"`
	TargetDir   string `json:"targetDir"`
}

// Summary holds aggregated stats.
type Summary struct {
	TotalModules        int            `json:"totalModules"`
	AvgPrecisionScore   float64        `json:"averagePrecisionScore"`
	GradeDistribution   map[string]int `json:"gradeDistribution"`
	QuadrantDistribution map[string]int `json:"quadrantDistribution"`
	BelowThreshold      int            `json:"belowThreshold"`
}

// ComputePrecision calculates the weighted precision score (0-100).
func ComputePrecision(a analyzer.ModuleAnalysis, cx analyzer.ComplexityResult, w config.Weights) float64 {
	d := a.Depth
	m := a.Maturity

	// Normalize test density (cap at 1.0 = 100%)
	testDensityNorm := clamp(d.TestDensity, 0, 1.0) * 100.0

	// Normalize test breadth (cap at 1.0)
	testBreadthNorm := clamp(d.TestBreadth, 0, 1.0) * 100.0

	// Complexity: inverse — lower avg complexity = better score
	// McCabe < 5 is ideal, > 15 is poor
	complexityScore := clamp(100.0-cx.AvgComplexity*8.0, 0, 100)

	// Integration test bonus
	integrationScore := 0.0
	if m.HasIntegrationTests {
		integrationScore = 100.0
	}

	// E2E bonus
	e2eScore := 0.0
	if m.HasE2ETests {
		e2eScore = 100.0
	}

	// Maturity composite
	maturityScore := analyzer.MaturityScore(m)

	// ── New v2.0 dimensions ──

	// Martin: lower distance from main sequence = better (D=0 ideal, D=1 worst)
	martinScore := clamp(100.0-a.Martin.Distance*100.0, 0, 100)

	// Shannon Entropy: higher balance = more evenly distributed dependencies
	entropyScore := 0.0
	if a.Entropy.ImportBalance > 0 || a.Entropy.ExportBalance > 0 {
		entropyScore = clamp((a.Entropy.ImportBalance+a.Entropy.ExportBalance)/2.0*100.0, 0, 100)
	} else {
		entropyScore = 50.0 // neutral for isolated modules
	}

	// LCOM4: 1 = ideal cohesion, each additional component = -25 points
	lcomScore := clamp(100.0-float64(a.LCOM.LCOM4-1)*25.0, 0, 100)

	// Halstead: inverse effort (log scale). Effort < 1000 = great, > 100000 = terrible
	halsteadScore := 50.0 // default
	if a.Halstead.Effort > 0 {
		halsteadScore = clamp(100.0-math.Log10(a.Halstead.Effort)*15.0, 0, 100)
	}

	// Cognitive Complexity: lower avg = better. < 5 = great, > 25 = terrible
	cognitiveScore := clamp(100.0-a.Cognitive.AvgCognitive*4.0, 0, 100)

	// Graph Health: penalize cycles and bidirectional dependencies
	graphScore := 100.0
	graphScore -= float64(a.DepGraph.CycleCount) * 15.0
	graphScore -= float64(a.DepGraph.BidirectionalDeps) * 10.0
	graphScore = clamp(graphScore, 0, 100)

	// ── Weighted sum (16 dimensions, total weight = 1.0) ──

	score := testDensityNorm*w.TestDensity +
		testBreadthNorm*w.TestBreadth +
		d.ErrorHandlingScore*w.ErrorHandling +
		d.TypeSafetyScore*w.TypeSafety +
		complexityScore*w.Complexity +
		d.ValidationCoverage*w.ValidationCoverage +
		d.EdgeCaseHandling*w.EdgeCaseHandling +
		integrationScore*w.IntegrationTests +
		e2eScore*w.E2ECoverage +
		maturityScore*w.MaturityComposite +
		martinScore*w.MartinDistance +
		entropyScore*w.EntropyBalance +
		lcomScore*w.CohesionLCOM +
		halsteadScore*w.HalsteadEffort +
		cognitiveScore*w.CognitiveComplexity +
		graphScore*w.GraphHealth

	return clamp(score, 0, 100)
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
