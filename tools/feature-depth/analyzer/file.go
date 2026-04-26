package analyzer

import (
	"feature-depth/scanner"
)

// FileAnalysis is the per-file score breakdown returned by AnalyzeFile.
//
// File-level granularity reports a subset of the 16 module-level
// dimensions — only those that meaningfully apply to a single .ts
// file. Dimensions like Martin distance, LCOM4, entropy, and
// test-breadth are inherently multi-file metrics and are dropped here.
type FileAnalysis struct {
	RelPath  string
	Module   string
	LOC      int
	TestLOC  int
	HasTest  bool

	// Six dimensions kept at file granularity. All on a 0-100 scale
	// except TestDensity which is a normalized ratio in [0, 1].
	TestDensity        float64 // testLOC / sourceLOC, capped at 1.0
	ErrorHandling      float64
	TypeSafety         float64
	ValidationCoverage float64
	EdgeCaseHandling   float64

	// Composite score, 0-100. weighted sum of the dimensions above
	// (TestDensity scaled to 0-100 first).
	Score float64
}

// FileWeights are the per-file scoring weights. Must sum to 1.0.
type FileWeights struct {
	TestDensity        float64
	HasTest            float64
	ErrorHandling      float64
	TypeSafety         float64
	ValidationCoverage float64
	EdgeCaseHandling   float64
}

// DefaultFileWeights returns the per-file scoring weights.
//
// Calibration choices (sum = 1.0):
//   - TestDensity 0.30  — the dilution-fix is the core of the file-mode rationale,
//     so test-LOC ratio is the heaviest single signal.
//   - HasTest 0.15      — binary "did you write a test at all" gate.
//   - TypeSafety 0.20   — penalty for `any` is a strong code-quality marker.
//   - ErrorHandling 0.15
//   - ValidationCoverage 0.10
//   - EdgeCaseHandling 0.10
func DefaultFileWeights() FileWeights {
	return FileWeights{
		TestDensity:        0.30,
		HasTest:            0.15,
		ErrorHandling:      0.15,
		TypeSafety:         0.20,
		ValidationCoverage: 0.10,
		EdgeCaseHandling:   0.10,
	}
}

// AnalyzeFile scores a single source file using the same regex helpers
// the module-level analyzer uses (calcErrorHandling, calcTypeSafety,
// etc. defined in depth.go), but evaluates them against just that
// file's content. The result is fully independent of the file's
// surrounding module.
func AnalyzeFile(f scanner.File) FileAnalysis {
	hasTest := f.TestLOC > 0

	density := 0.0
	if f.LOC > 0 && f.TestLOC > 0 {
		density = float64(f.TestLOC) / float64(f.LOC)
		if density > 1.0 {
			density = 1.0
		}
	}

	errH := calcErrorHandling(f.Content)
	typeS := calcTypeSafety(f.Content)
	validation := calcValidation(f.Content)
	edges := calcEdgeCases(f.Content)

	w := DefaultFileWeights()
	hasTestScore := 0.0
	if hasTest {
		hasTestScore = 100.0
	}
	score := density*100.0*w.TestDensity +
		hasTestScore*w.HasTest +
		errH*w.ErrorHandling +
		typeS*w.TypeSafety +
		validation*w.ValidationCoverage +
		edges*w.EdgeCaseHandling

	return FileAnalysis{
		RelPath:            f.RelPath,
		Module:             f.Module,
		LOC:                f.LOC,
		TestLOC:            f.TestLOC,
		HasTest:            hasTest,
		TestDensity:        density,
		ErrorHandling:      errH,
		TypeSafety:         typeS,
		ValidationCoverage: validation,
		EdgeCaseHandling:   edges,
		Score:              clamp(score, 0, 100),
	}
}
