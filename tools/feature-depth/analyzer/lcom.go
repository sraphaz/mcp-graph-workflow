package analyzer

import (
	"feature-depth/scanner"
	"path/filepath"
	"regexp"
	"strings"
)

// LCOMResult holds LCOM4 metrics (Hitz & Montazeri, 1995).
// LCOM4 = number of connected components in the function-call graph.
// 1 = ideal cohesion, >1 = module should potentially be split.
type LCOMResult struct {
	LCOM4         int     `json:"lcom4"`
	FunctionCount int     `json:"functionCount"`
	InternalEdges int     `json:"internalEdges"`
	SharedImports int     `json:"sharedImports"`
	CohesionRatio float64 `json:"cohesionRatio"` // 1/LCOM4
}

var funcCallRe = regexp.MustCompile(`\b(\w+)\s*\(`)

// AnalyzeLCOM computes LCOM4 via connected components of the function interaction graph.
// Nodes = functions in the module. Edges = function A calls B, or they share a local import.
func AnalyzeLCOM(sourceContent string, mod scanner.Module) LCOMResult {
	functions := ExtractFunctions(sourceContent)
	if len(functions) <= 1 {
		return LCOMResult{
			LCOM4:         1,
			FunctionCount: len(functions),
			CohesionRatio: 1.0,
		}
	}

	// Build function name set
	funcNames := make(map[string]int) // name -> index
	for i, fn := range functions {
		funcNames[fn.Name] = i
	}

	n := len(functions)

	// Union-Find
	parent := make([]int, n)
	rank := make([]int, n)
	for i := range parent {
		parent[i] = i
	}

	find := func(x int) int {
		for parent[x] != x {
			parent[x] = parent[parent[x]]
			x = parent[x]
		}
		return x
	}

	union := func(x, y int) {
		rx, ry := find(x), find(y)
		if rx == ry {
			return
		}
		if rank[rx] < rank[ry] {
			rx, ry = ry, rx
		}
		parent[ry] = rx
		if rank[rx] == rank[ry] {
			rank[rx]++
		}
	}

	internalEdges := 0

	// Edge type 1: function A calls function B
	for i, fn := range functions {
		calls := funcCallRe.FindAllStringSubmatch(fn.Body, -1)
		for _, call := range calls {
			if len(call) > 1 {
				calledName := call[1]
				if j, ok := funcNames[calledName]; ok && j != i {
					union(i, j)
					internalEdges++
				}
			}
		}
	}

	// Edge type 2: functions in files that share a local import
	sharedImports := 0
	fileImports := make(map[string][]string) // file base -> local imports
	for _, filePath := range mod.SourceFiles {
		base := strings.TrimSuffix(filepath.Base(filePath), ".ts")
		locals := ScanLocalImports(filePath)
		fileImports[base] = locals
	}

	// Functions sharing the same local import are connected
	importUsers := make(map[string][]int) // local import -> function indices using it
	for i, fn := range functions {
		// Heuristic: check if function body references files from local imports
		for _, locals := range fileImports {
			for _, local := range locals {
				if strings.Contains(fn.Body, local) {
					importUsers[local] = append(importUsers[local], i)
				}
			}
		}
	}

	for _, users := range importUsers {
		if len(users) > 1 {
			for k := 1; k < len(users); k++ {
				union(users[0], users[k])
				sharedImports++
			}
		}
	}

	// Count connected components
	components := make(map[int]bool)
	for i := 0; i < n; i++ {
		components[find(i)] = true
	}

	lcom4 := len(components)
	cohesion := 1.0 / float64(lcom4)

	return LCOMResult{
		LCOM4:         lcom4,
		FunctionCount: n,
		InternalEdges: internalEdges,
		SharedImports: sharedImports,
		CohesionRatio: cohesion,
	}
}
