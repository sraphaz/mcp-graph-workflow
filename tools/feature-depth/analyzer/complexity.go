package analyzer

import (
	"regexp"
	"strings"
)

var (
	// Function declaration patterns
	funcDeclRe = regexp.MustCompile(`(?:export\s+)?(?:async\s+)?function\s+(\w+)`)
	methodDeclRe = regexp.MustCompile(`(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{`)

	// Branching constructs for McCabe complexity
	ifRe       = regexp.MustCompile(`\bif\s*\(`)
	elseIfRe   = regexp.MustCompile(`\belse\s+if\s*\(`)
	forRe      = regexp.MustCompile(`\bfor\s*\(`)
	whileRe    = regexp.MustCompile(`\bwhile\s*\(`)
	doRe       = regexp.MustCompile(`\bdo\s*\{`)
	switchCaseRe = regexp.MustCompile(`\bcase\s+`)
	catchRe    = regexp.MustCompile(`\bcatch\s*\(`)
	logicalAndRe = regexp.MustCompile(`&&`)
	logicalOrRe  = regexp.MustCompile(`\|\|`)
	ternaryRe    = regexp.MustCompile(`\?\s*[^.?:]`)
)

// ComplexityResult holds aggregated complexity metrics for a module.
type ComplexityResult struct {
	AvgComplexity     float64
	MaxComplexity     int
	MaxComplexityFunc string
	FunctionCount     int
	TotalComplexity   int
}

// AnalyzeComplexity calculates McCabe cyclomatic complexity via regex heuristics.
func AnalyzeComplexity(content string) ComplexityResult {
	functions := ExtractFunctions(content)

	if len(functions) == 0 {
		return ComplexityResult{}
	}

	totalComplexity := 0
	maxComplexity := 0
	maxFunc := ""

	for _, fn := range functions {
		c := calculateComplexity(fn.Body)
		fn.Complexity = c
		totalComplexity += c

		if c > maxComplexity {
			maxComplexity = c
			maxFunc = fn.Name
		}
	}

	return ComplexityResult{
		AvgComplexity:     float64(totalComplexity) / float64(len(functions)),
		MaxComplexity:     maxComplexity,
		MaxComplexityFunc: maxFunc,
		FunctionCount:     len(functions),
		TotalComplexity:   totalComplexity,
	}
}

// ExtractFunctions finds function bodies using brace-depth tracking.
func ExtractFunctions(content string) []FunctionInfo {
	var result []FunctionInfo
	lines := strings.Split(content, "\n")

	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])

		// Check for function declarations
		var funcName string
		if matches := funcDeclRe.FindStringSubmatch(line); len(matches) > 1 {
			funcName = matches[1]
		}
		if funcName == "" {
			continue
		}

		// Find the opening brace
		braceIdx := strings.Index(lines[i], "{")
		if braceIdx == -1 {
			// Check next line
			if i+1 < len(lines) && strings.Contains(lines[i+1], "{") {
				i++
			} else {
				continue
			}
		}

		// Track brace depth to find function body
		depth := 0
		var bodyLines []string
		startLine := i

		for j := startLine; j < len(lines); j++ {
			bodyLines = append(bodyLines, lines[j])
			depth += strings.Count(lines[j], "{") - strings.Count(lines[j], "}")
			if depth <= 0 && j > startLine {
				break
			}
		}

		body := strings.Join(bodyLines, "\n")
		result = append(result, FunctionInfo{
			Name: funcName,
			Body: body,
		})
	}

	return result
}

// calculateComplexity computes McCabe cyclomatic complexity for a function body.
func calculateComplexity(body string) int {
	complexity := 1 // Base path

	complexity += len(ifRe.FindAllString(body, -1))
	// Don't double-count else-if (already counted as if)
	complexity += len(forRe.FindAllString(body, -1))
	complexity += len(whileRe.FindAllString(body, -1))
	complexity += len(doRe.FindAllString(body, -1))
	complexity += len(switchCaseRe.FindAllString(body, -1))
	complexity += len(catchRe.FindAllString(body, -1))
	complexity += len(logicalAndRe.FindAllString(body, -1))
	complexity += len(logicalOrRe.FindAllString(body, -1))
	complexity += len(ternaryRe.FindAllString(body, -1))

	return complexity
}
