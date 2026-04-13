package main

import (
	"feature-depth/analyzer"
	"feature-depth/config"
	"feature-depth/reporter"
	"feature-depth/scanner"
	"feature-depth/scorer"
	"fmt"
	"os"
	"sort"
	"sync"
	"time"
)

func main() {
	cfg := config.ParseFlags()
	weights := config.DefaultWeights()

	// Discover modules
	modules, err := scanner.DiscoverModules(cfg.Dir, cfg.CorePath, cfg.TestPath, cfg.E2EPath, cfg.Modules)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error discovering modules: %v\n", err)
		os.Exit(1)
	}

	if len(modules) == 0 {
		fmt.Fprintf(os.Stderr, "No modules found in %s/%s\n", cfg.Dir, cfg.CorePath)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Analyzing %d modules (v2.0 — 16 dimensions)...\n", len(modules))

	// ── Phase 1: Build shared import graph (sequential) ──
	fmt.Fprintf(os.Stderr, "  Phase 1: Building import graph...\n")
	importGraph := analyzer.BuildImportGraph(modules, cfg.Dir, cfg.CorePath)
	sccs := analyzer.FindSCCs(importGraph)
	betweenness := analyzer.ComputeBetweenness(importGraph)

	totalCycles := 0
	for _, scc := range sccs {
		totalCycles += len(scc)
	}
	fmt.Fprintf(os.Stderr, "  Import graph: %d modules, %d SCCs (cycles), betweenness computed\n",
		len(importGraph.Modules), len(sccs))

	// ── Phase 2: Analyze modules concurrently ──
	fmt.Fprintf(os.Stderr, "  Phase 2: Analyzing modules concurrently...\n")
	results := make([]scorer.ModuleScore, len(modules))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)

	for i, mod := range modules {
		wg.Add(1)
		go func(idx int, m scanner.Module) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			results[idx] = analyzeModule(m, cfg, weights, importGraph, sccs, betweenness)
		}(i, mod)
	}
	wg.Wait()

	// Classify quadrants (needs all modules)
	scorer.ClassifyQuadrants(results)

	// Generate recommendations
	reporter.GenerateRecommendations(results)

	// Sort by precision score descending
	sort.Slice(results, func(i, j int) bool {
		return results[i].PrecisionScore > results[j].PrecisionScore
	})

	// Build report
	report := buildReport(results, cfg)

	// Output
	switch cfg.Output {
	case "json":
		if err := reporter.WriteJSON(report, cfg.JSONOut); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing JSON: %v\n", err)
			os.Exit(1)
		}
	case "table":
		reporter.WriteTable(report)
		reporter.WriteMatrix(report.Modules)
	default: // "both"
		reporter.WriteTable(report)
		reporter.WriteMatrix(report.Modules)
		if cfg.JSONOut != "" {
			if err := reporter.WriteJSON(report, cfg.JSONOut); err != nil {
				fmt.Fprintf(os.Stderr, "Error writing JSON: %v\n", err)
				os.Exit(1)
			}
			fmt.Fprintf(os.Stderr, "\nJSON report written to %s\n", cfg.JSONOut)
		}
	}
}

func analyzeModule(mod scanner.Module, cfg config.Config, weights config.Weights,
	graph *analyzer.ImportGraph, sccs [][]string, betweenness map[string]float64) scorer.ModuleScore {

	sourceContent := analyzer.CombineContent(mod.SourceFiles)

	// ── Original v1 analyzers ──
	breadth := analyzer.AnalyzeBreadth(mod, sourceContent, cfg.Dir, cfg.McpPath, cfg.ApiPath)
	depth := analyzer.AnalyzeDepth(mod, sourceContent)
	cx := analyzer.AnalyzeComplexity(sourceContent)
	maturity := analyzer.AnalyzeMaturity(mod, sourceContent)

	// Merge McCabe complexity into depth
	depth.AvgComplexity = cx.AvgComplexity
	depth.MaxComplexity = float64(cx.MaxComplexity)
	depth.MaxComplexityFunc = cx.MaxComplexityFunc

	// ── New v2 analyzers (read-only graph access) ──
	martin := analyzer.AnalyzeMartin(mod.Name, graph, breadth)
	entropy := analyzer.AnalyzeEntropy(mod.Name, graph)
	lcom := analyzer.AnalyzeLCOM(sourceContent, mod)
	halstead := analyzer.AnalyzeHalstead(sourceContent)
	cognitive := analyzer.AnalyzeCognitive(sourceContent)
	depGraph := analyzer.AnalyzeDepGraph(mod.Name, graph, sccs, betweenness)

	analysis := analyzer.ModuleAnalysis{
		Name:      mod.Name,
		Breadth:   breadth,
		Depth:     depth,
		Maturity:  maturity,
		Martin:    martin,
		Entropy:   entropy,
		LCOM:      lcom,
		Halstead:  halstead,
		Cognitive: cognitive,
		DepGraph:  depGraph,
	}

	precision := scorer.ComputePrecision(analysis, cx, weights)
	grade := scorer.Grade(precision)

	return scorer.ModuleScore{
		Name:           mod.Name,
		Analysis:       analysis,
		PrecisionScore: precision,
		Grade:          grade,
	}
}

func buildReport(modules []scorer.ModuleScore, cfg config.Config) scorer.Report {
	grades := make(map[string]int)
	quadrants := make(map[string]int)
	totalScore := 0.0
	belowThreshold := 0

	for _, m := range modules {
		grades[m.Grade]++
		quadrants[m.Quadrant]++
		totalScore += m.PrecisionScore
		if m.PrecisionScore < float64(cfg.Threshold) {
			belowThreshold++
		}
	}

	avg := 0.0
	if len(modules) > 0 {
		avg = totalScore / float64(len(modules))
	}

	return scorer.Report{
		Metadata: scorer.Metadata{
			Tool:        "feature-depth-analyzer",
			Version:     "2.0.0",
			Methodology: "ISO/IEC 25010 + GQM (Basili 1994) + McCabe + Martin Package Metrics (2002) + Shannon Entropy (1948) + LCOM4 (Hitz & Montazeri 1995) + Halstead (1977) + SonarSource Cognitive (2017) + Tarjan SCC + Betweenness Centrality",
			AnalyzedAt:  time.Now().UTC().Format(time.RFC3339),
			TargetDir:   cfg.Dir,
		},
		Summary: scorer.Summary{
			TotalModules:         len(modules),
			AvgPrecisionScore:    avg,
			GradeDistribution:    grades,
			QuadrantDistribution: quadrants,
			BelowThreshold:       belowThreshold,
		},
		Modules: modules,
	}
}
