package reporter

import (
	"feature-depth/scorer"
	"fmt"
)

// GenerateRecommendations produces actionable recommendations for each module.
func GenerateRecommendations(modules []scorer.ModuleScore) {
	for i := range modules {
		m := &modules[i]
		var recs []string

		d := m.Analysis.Depth
		mat := m.Analysis.Maturity
		b := m.Analysis.Breadth

		// Test coverage
		if d.TestBreadth < 0.3 {
			recs = append(recs, fmt.Sprintf(
				"Critical: Test breadth is %.2fx (target >= 0.30). Add unit tests — %d source files have minimal test coverage.",
				d.TestBreadth, b.SourceFiles))
		} else if d.TestBreadth < 0.5 {
			recs = append(recs, fmt.Sprintf(
				"Improve: Test breadth is %.2fx (target >= 0.50). Add tests for uncovered source files.",
				d.TestBreadth))
		}

		if d.TestDensity < 0.2 {
			recs = append(recs, fmt.Sprintf(
				"Critical: Test density is %.2f (target >= 0.30). Tests are superficial — add deeper assertions.",
				d.TestDensity))
		}

		// Type safety
		if d.TypeSafetyScore < 50 {
			recs = append(recs, fmt.Sprintf(
				"Reduce `any` usage. Type safety score: %.0f/100. Replace `any` with proper types.",
				d.TypeSafetyScore))
		}

		// Error handling
		if d.ErrorHandlingScore < 40 {
			recs = append(recs, fmt.Sprintf(
				"Improve error handling (score: %.0f). Use typed errors from utils/errors.ts instead of raw Error.",
				d.ErrorHandlingScore))
		}

		// Validation
		if d.ValidationCoverage < 20 && b.McpToolRefs > 0 {
			recs = append(recs, fmt.Sprintf(
				"Add Zod validation at boundaries. This module is referenced by %d MCP tools but has low validation coverage (%.0f%%).",
				b.McpToolRefs, d.ValidationCoverage))
		}

		// Complexity
		if d.MaxComplexity > 15 {
			recs = append(recs, fmt.Sprintf(
				"Refactor complex function '%s' (complexity: %.0f, threshold: 15). Extract sub-functions.",
				d.MaxComplexityFunc, d.MaxComplexity))
		}

		// Maturity
		if !mat.HasBarrelExport && b.SourceFiles > 3 {
			recs = append(recs, "Add barrel export (index.ts) to consolidate public API surface.")
		}

		if mat.JSDocCoverage < 30 && b.ExportedFuncs > 5 {
			recs = append(recs, fmt.Sprintf(
				"Add JSDoc to exported functions. Coverage: %.0f%% (target >= 50%%).",
				mat.JSDocCoverage))
		}

		if !mat.HasIntegrationTests && b.McpToolRefs > 0 {
			recs = append(recs, "Add integration tests — this module has MCP tool references but no cross-module tests.")
		}

		if !mat.HasE2ETests && b.ApiRouteRefs > 0 {
			recs = append(recs, "Add E2E tests — this module has API route references but no end-to-end coverage.")
		}

		// Edge cases
		if d.EdgeCaseHandling < 20 {
			recs = append(recs, "Improve defensive programming: add guard clauses, nullish coalescing, and default branches.")
		}

		// ── v2.0 structural recommendations ──

		martin := m.Analysis.Martin
		lcom := m.Analysis.LCOM
		cog := m.Analysis.Cognitive
		hal := m.Analysis.Halstead
		dg := m.Analysis.DepGraph
		ent := m.Analysis.Entropy

		// Martin: Zone of Pain
		if martin.Zone == "pain" {
			recs = append(recs, fmt.Sprintf(
				"Zone of Pain (Martin): stable (I=%.2f) but concrete (A=%.2f). Extract interfaces to allow extension without modification.",
				martin.Instability, martin.Abstractness))
		}

		// Martin: high distance from main sequence
		if martin.Distance > 0.5 {
			recs = append(recs, fmt.Sprintf(
				"High distance from Main Sequence (D=%.2f). Rebalance: if concrete, add abstractions; if abstract, add implementations.",
				martin.Distance))
		}

		// Dependency cycles
		if dg.CycleCount > 0 {
			recs = append(recs, fmt.Sprintf(
				"Break %d dependency cycle(s). Extract shared types/interfaces into a common module to decouple.",
				dg.CycleCount))
		}

		// Bidirectional coupling
		if dg.BidirectionalDeps > 2 {
			recs = append(recs, fmt.Sprintf(
				"High bidirectional coupling (%d mutual imports). Apply Dependency Inversion Principle.",
				dg.BidirectionalDeps))
		}

		// LCOM4: low cohesion
		if lcom.LCOM4 > 2 {
			recs = append(recs, fmt.Sprintf(
				"Low cohesion (LCOM4=%d): %d disconnected function groups. Consider splitting into %d focused modules.",
				lcom.LCOM4, lcom.LCOM4, lcom.LCOM4))
		}

		// Cognitive complexity
		if cog.MaxCognitive > 20 {
			recs = append(recs, fmt.Sprintf(
				"High cognitive complexity in '%s' (score: %d, threshold: 15). Flatten nesting, extract helpers.",
				cog.MaxCognitiveFunc, cog.MaxCognitive))
		}

		// Halstead time-to-understand
		if hal.TimeToUnderstand > 3600 {
			recs = append(recs, fmt.Sprintf(
				"Halstead: %.0f min to understand (target < 60 min). Estimated %.1f bugs. Simplify or decompose.",
				hal.TimeToUnderstand/60, hal.BugsEstimate))
		}

		// Entropy imbalance
		if ent.ImportBalance < 0.3 && martin.Ce > 3 {
			recs = append(recs, fmt.Sprintf(
				"Import concentration too high (entropy balance: %.2f). Over-reliant on one dependency. Distribute concerns.",
				ent.ImportBalance))
		}

		// Limit to top 7
		if len(recs) > 7 {
			recs = recs[:7]
		}

		m.Recommendations = recs
	}
}
