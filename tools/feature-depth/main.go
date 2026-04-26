package main

import (
	"bytes"
	"feature-depth/analyzer"
	"feature-depth/config"
	"feature-depth/growth"
	"feature-depth/reporter"
	"feature-depth/scanner"
	"feature-depth/scorer"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"sync"
	"time"
)

func main() {
	cfg := config.ParseFlags()

	if cfg.Growth {
		runGrowth(cfg)
		return
	}
	if cfg.Granularity == "file" {
		runFileGranularity(cfg)
		return
	}
	if cfg.Granularity != "" && cfg.Granularity != "module" {
		fmt.Fprintf(os.Stderr, "Error: --granularity must be 'module' or 'file', got %q\n", cfg.Granularity)
		os.Exit(2)
	}

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

// runGrowth analyses the entire git history of cfg.Dir and emits a
// project-growth report (LOC over time, per-module breakdown, hotspot
// files). Reads `git log --numstat --pretty=format:%H|%aI` once.
//
// Rationale: architectural decisions get more empirical when the model
// can see how the codebase actually grew — which modules exploded,
// which stayed stable, when the test/source ratio cratered, where
// churn concentrates. Static snapshots miss the trajectory.
func runGrowth(cfg config.Config) {
	cmd := exec.Command("git", "-C", cfg.Dir, "log", "--reverse", "--numstat", "--pretty=format:%H|%aI")
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "git log failed: %v\n", err)
		os.Exit(1)
	}
	commits, err := growth.ParseGitLog(&stdout)
	if err != nil {
		fmt.Fprintf(os.Stderr, "parse git log: %v\n", err)
		os.Exit(1)
	}
	if len(commits) == 0 {
		fmt.Fprintln(os.Stderr, "No commits found.")
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "Analyzing %d commits...\n", len(commits))

	report := growth.Aggregate(commits)

	switch cfg.Output {
	case "json":
		if err := reporter.WriteGrowthJSON(report, cfg.JSONOut); err != nil {
			fmt.Fprintf(os.Stderr, "json: %v\n", err)
			os.Exit(1)
		}
	case "table":
		reporter.WriteGrowthTable(report)
	default:
		reporter.WriteGrowthTable(report)
		if cfg.JSONOut != "" {
			if err := reporter.WriteGrowthJSON(report, cfg.JSONOut); err != nil {
				fmt.Fprintf(os.Stderr, "json: %v\n", err)
				os.Exit(1)
			}
			fmt.Fprintf(os.Stderr, "\nGrowth JSON written to %s\n", cfg.JSONOut)
		}
	}
}

// runFileGranularity is the file-mode entry point. It walks core/, scores
// each .ts file independently using AnalyzeFile (analyzer/file.go), and
// emits a top/bottom table plus an "untested files" worklist. This is
// the answer to the per-module dilution problem: 12 deep tests in one
// file are visible here even when the surrounding module of 65 files
// barely budges.
func runFileGranularity(cfg config.Config) {
	files, err := scanner.DiscoverFiles(cfg.Dir, cfg.CorePath, cfg.TestPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error discovering files: %v\n", err)
		os.Exit(1)
	}
	if len(files) == 0 {
		fmt.Fprintf(os.Stderr, "No files found in %s/%s\n", cfg.Dir, cfg.CorePath)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "Analyzing %d files (granularity=file)...\n", len(files))

	results := make([]analyzer.FileAnalysis, len(files))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for i, f := range files {
		wg.Add(1)
		go func(idx int, file scanner.File) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			results[idx] = analyzer.AnalyzeFile(file)
		}(i, f)
	}
	wg.Wait()

	avg := 0.0
	for _, r := range results {
		avg += r.Score
	}
	if len(results) > 0 {
		avg /= float64(len(results))
	}

	report := reporter.FileReport{
		Tool:       "feature-depth-analyzer",
		Mode:       "file",
		TotalFiles: len(results),
		AvgScore:   avg,
		Files:      results,
	}

	switch cfg.Output {
	case "json":
		if err := reporter.WriteFileJSON(report, cfg.JSONOut); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing JSON: %v\n", err)
			os.Exit(1)
		}
	case "table":
		reporter.WriteFileTable(results)
	default: // "both"
		reporter.WriteFileTable(results)
		if cfg.JSONOut != "" {
			if err := reporter.WriteFileJSON(report, cfg.JSONOut); err != nil {
				fmt.Fprintf(os.Stderr, "Error writing JSON: %v\n", err)
				os.Exit(1)
			}
			fmt.Fprintf(os.Stderr, "\nFile JSON report written to %s\n", cfg.JSONOut)
		}
	}

	if cfg.Baseline != "" && cfg.Output != "json" {
		baseline, err := reporter.LoadBaselineFiles(cfg.Baseline)
		if err != nil {
			fmt.Fprintf(os.Stderr, "baseline: %v\n", err)
			os.Exit(1)
		}
		deltas := reporter.ComputeDeltas(results, baseline)
		reporter.WriteDeltaTable(deltas)
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
