package analyzer

import (
	"feature-depth/scanner"
	"regexp"
)

var (
	// Type safety patterns — mirrored from src/core/harness/type-coverage-scanner.ts
	anyTypeRe = regexp.MustCompile(`:\s*any\b`)
	asAnyRe   = regexp.MustCompile(`\bas\s+any\b`)

	// Error handling patterns
	typedErrorRe = regexp.MustCompile(`new\s+\w+Error\(`)
	rawErrorRe   = regexp.MustCompile(`new\s+Error\(`)
	tryCatchRe   = regexp.MustCompile(`\btry\s*\{`)
	catchBlockRe = regexp.MustCompile(`\bcatch\s*\(`)

	// Validation patterns (Zod)
	zodUsageRe    = regexp.MustCompile(`z\.\w+\(`)
	parseCallRe   = regexp.MustCompile(`\.parse\(`)
	safeParseRe   = regexp.MustCompile(`\.safeParse\(`)

	// Edge case handling
	guardClauseRe   = regexp.MustCompile(`if\s*\([^)]*\)\s*(return|throw)\b`)
	nullishCoalRe   = regexp.MustCompile(`\?\?`)
	optionalChainRe = regexp.MustCompile(`\?\.`)
	defaultBranchRe = regexp.MustCompile(`\bdefault\s*:`)

	// Function signatures for return type analysis
	funcSignatureRe = regexp.MustCompile(`(?m)(function\s+\w+|=>\s*\{|\w+\s*\([^)]*\)\s*[:{])`)
	explicitReturnRe = regexp.MustCompile(`\)\s*:\s*\w+`)
)

// AnalyzeDepth measures implementation precision of a module.
func AnalyzeDepth(mod scanner.Module, sourceContent string) DepthResult {
	sourceFiles := scanner.ReadFilesContent(mod.SourceFiles)
	testFiles := scanner.ReadFilesContent(mod.TestFiles)

	sourceLOC := scanner.TotalLOC(sourceFiles)
	testLOC := scanner.TotalLOC(testFiles)

	// Test density: test LOC / source LOC
	testDensity := 0.0
	if sourceLOC > 0 {
		testDensity = float64(testLOC) / float64(sourceLOC)
	}

	// Test breadth: test files / source files
	testBreadth := 0.0
	if len(mod.SourceFiles) > 0 {
		testBreadth = float64(len(mod.TestFiles)) / float64(len(mod.SourceFiles))
	}

	return DepthResult{
		TestDensity:        testDensity,
		TestBreadth:        testBreadth,
		ErrorHandlingScore: calcErrorHandling(sourceContent),
		TypeSafetyScore:    calcTypeSafety(sourceContent),
		ValidationCoverage: calcValidation(sourceContent),
		EdgeCaseHandling:   calcEdgeCases(sourceContent),
	}
}

// calcErrorHandling scores error handling quality (0-100).
// Typed errors (McpGraphError subclasses) score higher than raw Error.
func calcErrorHandling(content string) float64 {
	typed := float64(len(typedErrorRe.FindAllString(content, -1)))
	raw := float64(len(rawErrorRe.FindAllString(content, -1)))
	tryCatch := float64(len(tryCatchRe.FindAllString(content, -1)))
	catches := float64(len(catchBlockRe.FindAllString(content, -1)))

	totalErrors := typed + raw
	if totalErrors == 0 && tryCatch == 0 {
		return 50.0 // No error handling needed or present — neutral
	}

	// Score: ratio of typed errors
	typedRatio := 0.0
	if totalErrors > 0 {
		typedRatio = typed / totalErrors
	}

	// Catch coverage bonus
	catchBonus := 0.0
	if catches > 0 {
		catchBonus = 25.0
	}

	return clamp(typedRatio*75.0+catchBonus, 0, 100)
}

// calcTypeSafety scores type safety (0-100).
// Lower any usage = higher score.
func calcTypeSafety(content string) float64 {
	anyCount := len(anyTypeRe.FindAllString(content, -1)) + len(asAnyRe.FindAllString(content, -1))
	funcSigs := len(funcSignatureRe.FindAllString(content, -1))
	explicitReturns := len(explicitReturnRe.FindAllString(content, -1))

	if funcSigs == 0 {
		if anyCount == 0 {
			return 100.0
		}
		return 50.0
	}

	// Penalty for any usage: each `any` costs points
	anyPenalty := float64(anyCount) * 5.0
	if anyPenalty > 50.0 {
		anyPenalty = 50.0
	}

	// Return type coverage bonus
	returnRatio := float64(explicitReturns) / float64(funcSigs)
	if returnRatio > 1.0 {
		returnRatio = 1.0
	}

	return clamp(100.0-anyPenalty+returnRatio*20.0-20.0, 0, 100)
}

// calcValidation scores Zod/validation usage (0-100).
func calcValidation(content string) float64 {
	zodCalls := len(zodUsageRe.FindAllString(content, -1))
	parseCalls := len(parseCallRe.FindAllString(content, -1))
	safeParseCalls := len(safeParseRe.FindAllString(content, -1))

	totalValidation := zodCalls + parseCalls + safeParseCalls
	if totalValidation == 0 {
		return 0.0
	}

	// More validation = higher score, with diminishing returns
	score := float64(totalValidation) * 5.0
	return clamp(score, 0, 100)
}

// calcEdgeCases scores defensive programming (0-100).
func calcEdgeCases(content string) float64 {
	guards := float64(len(guardClauseRe.FindAllString(content, -1)))
	nullish := float64(len(nullishCoalRe.FindAllString(content, -1)))
	optional := float64(len(optionalChainRe.FindAllString(content, -1)))
	defaults := float64(len(defaultBranchRe.FindAllString(content, -1)))

	total := guards + nullish + optional + defaults
	if total == 0 {
		return 0.0
	}

	// Normalize by rough function count approximation
	funcCount := float64(len(funcSignatureRe.FindAllString(content, -1)))
	if funcCount == 0 {
		funcCount = 1
	}

	ratio := total / funcCount
	return clamp(ratio*30.0, 0, 100)
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
