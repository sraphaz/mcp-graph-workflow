package analyzer

import (
	"regexp"
	"strings"
)

// CognitiveResult holds SonarSource Cognitive Complexity metrics (2017).
// Unlike McCabe, cognitive complexity penalizes nesting depth.
type CognitiveResult struct {
	TotalCognitive   int     `json:"totalCognitiveComplexity"`
	AvgCognitive     float64 `json:"avgCognitiveComplexity"`
	MaxCognitive     int     `json:"maxCognitiveComplexity"`
	MaxCognitiveFunc string  `json:"maxCognitiveFunc"`
	FunctionCount    int     `json:"functionCount"`
}

var (
	cogIfRe     = regexp.MustCompile(`\bif\s*\(`)
	cogElseIfRe = regexp.MustCompile(`\belse\s+if\s*\(`)
	cogElseRe   = regexp.MustCompile(`\belse\s*\{`)
	cogForRe    = regexp.MustCompile(`\bfor\s*\(`)
	cogWhileRe  = regexp.MustCompile(`\bwhile\s*\(`)
	cogDoRe     = regexp.MustCompile(`\bdo\s*\{`)
	cogCatchRe  = regexp.MustCompile(`\bcatch\s*\(`)
	cogSwitchRe = regexp.MustCompile(`\bswitch\s*\(`)
	cogAndRe    = regexp.MustCompile(`&&`)
	cogOrRe     = regexp.MustCompile(`\|\|`)
	cogNullRe   = regexp.MustCompile(`\?\?`)
	cogTernRe   = regexp.MustCompile(`\?\s*[^.?:]`)
)

// AnalyzeCognitive computes SonarSource Cognitive Complexity for all functions.
// Rules:
// - +1 base increment for: if, else if, for, while, do, catch, switch, &&, ||, ??, ternary
// - +nesting_level for structural constructs inside nested blocks
// - else: +1 base only, NO nesting penalty
func AnalyzeCognitive(content string) CognitiveResult {
	functions := ExtractFunctions(content)
	if len(functions) == 0 {
		return CognitiveResult{}
	}

	totalCognitive := 0
	maxCognitive := 0
	maxFunc := ""

	for _, fn := range functions {
		c := calculateCognitive(fn.Body)
		totalCognitive += c
		if c > maxCognitive {
			maxCognitive = c
			maxFunc = fn.Name
		}
	}

	return CognitiveResult{
		TotalCognitive:   totalCognitive,
		AvgCognitive:     float64(totalCognitive) / float64(len(functions)),
		MaxCognitive:     maxCognitive,
		MaxCognitiveFunc: maxFunc,
		FunctionCount:    len(functions),
	}
}

// calculateCognitive computes cognitive complexity for a single function body.
func calculateCognitive(body string) int {
	complexity := 0
	lines := strings.Split(body, "\n")

	// Track nesting depth via brace counting
	nestingDepth := 0
	// We start inside the function body, so initial depth accounts for the function's own braces
	baseDepth := 0
	foundBase := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if !foundBase {
			if strings.Contains(line, "{") {
				baseDepth = 1
				foundBase = true
			}
			continue
		}

		currentNesting := nestingDepth

		// Structural constructs: +1 base + nesting penalty
		if cogElseIfRe.MatchString(trimmed) {
			complexity += 1 + currentNesting
		} else if cogIfRe.MatchString(trimmed) {
			complexity += 1 + currentNesting
		}

		if cogForRe.MatchString(trimmed) {
			complexity += 1 + currentNesting
		}
		if cogWhileRe.MatchString(trimmed) {
			complexity += 1 + currentNesting
		}
		if cogDoRe.MatchString(trimmed) {
			complexity += 1 + currentNesting
		}
		if cogCatchRe.MatchString(trimmed) {
			complexity += 1 + currentNesting
		}
		if cogSwitchRe.MatchString(trimmed) {
			complexity += 1 + currentNesting
		}

		// else: +1 base only, NO nesting penalty
		if cogElseRe.MatchString(trimmed) && !cogElseIfRe.MatchString(trimmed) {
			complexity += 1
		}

		// Logical operators: +1 base only (no nesting penalty per SonarSource)
		complexity += len(cogAndRe.FindAllString(trimmed, -1))
		complexity += len(cogOrRe.FindAllString(trimmed, -1))
		complexity += len(cogNullRe.FindAllString(trimmed, -1))
		complexity += len(cogTernRe.FindAllString(trimmed, -1))

		// Update nesting depth
		opens := strings.Count(line, "{")
		closes := strings.Count(line, "}")
		nestingDepth += opens - closes
		if nestingDepth < 0 {
			nestingDepth = 0
		}
	}

	_ = baseDepth // used for tracking
	return complexity
}
