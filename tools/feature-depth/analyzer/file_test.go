package analyzer

import (
	"feature-depth/scanner"
	"math"
	"testing"
)

func TestAnalyzeFile_ScoreInRange(t *testing.T) {
	f := scanner.File{
		RelPath: "src/core/x/foo.ts",
		Module:  "x",
		Content: "export function add(a: number, b: number): number { return a + b; }\n",
		LOC:     1,
	}
	r := AnalyzeFile(f)
	if r.Score < 0 || r.Score > 100 {
		t.Errorf("score out of [0,100]: got %v", r.Score)
	}
}

func TestAnalyzeFile_TestDensityZeroWhenNoAdjacentTest(t *testing.T) {
	f := scanner.File{
		RelPath: "x/foo.ts",
		Content: "export const x = 1;\n",
		LOC:     1,
		TestLOC: 0,
	}
	r := AnalyzeFile(f)
	if r.TestDensity != 0 {
		t.Errorf("TestDensity = %v, want 0", r.TestDensity)
	}
	if r.HasTest {
		t.Error("HasTest = true, want false")
	}
}

func TestAnalyzeFile_TestDensityCappedAtOne(t *testing.T) {
	f := scanner.File{
		RelPath: "x/foo.ts",
		Content: "export const x = 1;\n",
		LOC:     10,
		TestLOC: 50, // 5x ratio
	}
	r := AnalyzeFile(f)
	if r.TestDensity != 1.0 {
		t.Errorf("TestDensity = %v, want 1.0 (capped)", r.TestDensity)
	}
	if !r.HasTest {
		t.Error("HasTest = false, want true")
	}
}

func TestAnalyzeFile_TypeSafetyPenalizesAny(t *testing.T) {
	clean := scanner.File{Content: "function f(x: number): number { return x; }\n", LOC: 1}
	dirty := scanner.File{Content: "function f(x: any): any { return x as any; }\n", LOC: 1}
	rClean := AnalyzeFile(clean)
	rDirty := AnalyzeFile(dirty)
	if rDirty.TypeSafety >= rClean.TypeSafety {
		t.Errorf("TypeSafety: dirty (%v) should be < clean (%v)", rDirty.TypeSafety, rClean.TypeSafety)
	}
}

func TestAnalyzeFile_ScoreRisesWithAddedTests(t *testing.T) {
	// The whole point of file-level granularity: 12 deep tests in one
	// file must be visible. Same source file, different test LOC.
	src := "export function add(a: number, b: number): number { return a + b; }\nexport function sub(a: number, b: number): number { return a - b; }\n"
	noTest := scanner.File{Content: src, LOC: 2, TestLOC: 0}
	withTest := scanner.File{Content: src, LOC: 2, TestLOC: 24}
	rNoTest := AnalyzeFile(noTest)
	rWithTest := AnalyzeFile(withTest)
	if rWithTest.Score <= rNoTest.Score {
		t.Errorf("score should rise with adjacent tests: noTest=%v, withTest=%v", rNoTest.Score, rWithTest.Score)
	}
}

func TestFileWeightsSumToOne(t *testing.T) {
	w := DefaultFileWeights()
	sum := w.TestDensity + w.HasTest + w.ErrorHandling + w.TypeSafety + w.ValidationCoverage + w.EdgeCaseHandling
	if math.Abs(sum-1.0) > 1e-9 {
		t.Errorf("file weights sum = %v, want 1.0", sum)
	}
}
