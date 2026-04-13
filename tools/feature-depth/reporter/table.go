package reporter

import (
	"feature-depth/scorer"
	"fmt"
	"sort"
	"strings"
)

// ANSI color codes
const (
	reset     = "\033[0m"
	bold      = "\033[1m"
	red       = "\033[31m"
	green     = "\033[32m"
	yellow    = "\033[33m"
	cyan      = "\033[36m"
	brightRed = "\033[91m"
	gray      = "\033[90m"
)

// WriteTable outputs a colored terminal table.
func WriteTable(report scorer.Report) {
	modules := report.Modules

	// Sort by precision score descending
	sort.Slice(modules, func(i, j int) bool {
		return modules[i].PrecisionScore > modules[j].PrecisionScore
	})

	// Header
	fmt.Printf("\n%s╔══════════════════════════════════════════════════════════════════════════════════════╗%s\n", bold, reset)
	fmt.Printf("%s║  FEATURE DEPTH ANALYZER v2.0 — 16 dimensions, 7 frameworks                        ║%s\n", bold, reset)
	fmt.Printf("%s╚══════════════════════════════════════════════════════════════════════════════════════╝%s\n\n", bold, reset)

	// Summary
	fmt.Printf("  Modules: %d | Avg Score: %.1f | ", report.Summary.TotalModules, report.Summary.AvgPrecisionScore)
	for _, g := range []string{"A", "B", "C", "D", "F"} {
		count := report.Summary.GradeDistribution[g]
		if count > 0 {
			fmt.Printf("%s%s:%d%s ", gradeColor(g), g, count, reset)
		}
	}
	fmt.Println()
	fmt.Printf("  Quadrants: ")
	for _, q := range []string{"MATURE", "MATURE_FRAGILE", "SPECIALIZED", "SHALLOW", "INCIPIENT", "INCIPIENT_OK"} {
		count := report.Summary.QuadrantDistribution[q]
		if count > 0 {
			fmt.Printf("%s%s:%d%s ", quadrantColor(q), q, count, reset)
		}
	}
	fmt.Println()

	// Column headers
	fmt.Printf("  %-18s %6s %7s %7s %6s %7s %5s  %-12s\n",
		"Module", "Files", "LOC", "Export", "Test%", "Score", "Grade", "Quadrant")
	fmt.Printf("  %s\n", strings.Repeat("─", 80))

	// Rows
	for _, m := range modules {
		testRatio := fmt.Sprintf("%.2fx", m.Analysis.Depth.TestBreadth)
		gradeStr := fmt.Sprintf("%s[%s]%s", gradeColor(m.Grade), m.Grade, reset)
		quadStr := fmt.Sprintf("%s%-12s%s", quadrantColor(m.Quadrant), m.Quadrant, reset)

		totalExports := m.Analysis.Breadth.ExportedFuncs + m.Analysis.Breadth.ExportedTypes + m.Analysis.Breadth.ExportedConsts

		warn := ""
		if m.Quadrant == scorer.QuadrantShallow {
			warn = fmt.Sprintf(" %s⚠%s", brightRed, reset)
		}

		fmt.Printf("  %-18s %6d %7d %7d %6s %7.1f %5s  %s%s\n",
			truncate(m.Name, 18),
			m.Analysis.Breadth.SourceFiles,
			m.Analysis.Breadth.TotalLOC,
			totalExports,
			testRatio,
			m.PrecisionScore,
			gradeStr,
			quadStr,
			warn,
		)
	}

	fmt.Printf("  %s\n", strings.Repeat("─", 80))

	// Shallow modules detail
	shallowModules := filterByQuadrant(modules, scorer.QuadrantShallow)
	if len(shallowModules) > 0 {
		fmt.Printf("\n  %s%s⚠  SHALLOW MODULES — Priority for deepening:%s\n\n", bold, brightRed, reset)
		for _, m := range shallowModules {
			fmt.Printf("  %s%-18s%s Score: %.1f | LOC: %d | Tests: %.2fx\n",
				red, m.Name, reset,
				m.PrecisionScore,
				m.Analysis.Breadth.TotalLOC,
				m.Analysis.Depth.TestBreadth,
			)
			for _, rec := range m.Recommendations {
				fmt.Printf("    %s→ %s%s\n", gray, rec, reset)
			}
			fmt.Println()
		}
	}

	// Fragile modules detail
	fragileModules := filterByQuadrant(modules, scorer.QuadrantMatureFragile)
	if len(fragileModules) > 0 {
		fmt.Printf("\n  %s%s⚡ MATURE_FRAGILE — Large modules with structural debt:%s\n\n", bold, yellow, reset)
		for _, m := range fragileModules {
			fmt.Printf("  %s%-18s%s Score: %.1f | Cycles: %d | LCOM4: %d | D: %.2f\n",
				yellow, m.Name, reset,
				m.PrecisionScore,
				m.Analysis.DepGraph.CycleCount,
				m.Analysis.LCOM.LCOM4,
				m.Analysis.Martin.Distance,
			)
			for _, rec := range m.Recommendations {
				fmt.Printf("    %s→ %s%s\n", gray, rec, reset)
			}
			fmt.Println()
		}
	}

	// Below threshold
	if report.Summary.BelowThreshold > 0 {
		fmt.Printf("  %s%d modules below threshold score of %d%s\n\n",
			yellow,
			report.Summary.BelowThreshold,
			50,
			reset,
		)
	}

	// ── Structural Health Detail Table ──
	WriteStructuralTable(modules)
}

// WriteStructuralTable prints the v2.0 structural metrics table.
func WriteStructuralTable(modules []scorer.ModuleScore) {
	fmt.Printf("\n  %sSTRUCTURAL HEALTH DETAIL (Martin + Shannon + LCOM4 + Halstead + Cognitive + Graph)%s\n", bold, reset)
	fmt.Printf("  %s\n", strings.Repeat("─", 100))
	fmt.Printf("  %-16s %5s %5s %5s %4s %4s %5s %7s %6s %5s %8s\n",
		"Module", "I", "A", "D", "Ca", "Ce", "LCOM4", "CogAvg", "Cycles", "H(imp)", "Zone")
	fmt.Printf("  %s\n", strings.Repeat("─", 100))

	for _, m := range modules {
		martin := m.Analysis.Martin
		cog := m.Analysis.Cognitive
		dg := m.Analysis.DepGraph
		ent := m.Analysis.Entropy
		lcom := m.Analysis.LCOM

		zoneColor := gray
		switch martin.Zone {
		case "pain":
			zoneColor = red
		case "useless":
			zoneColor = brightRed
		case "ideal":
			zoneColor = green
		}

		fmt.Printf("  %-16s %5.2f %5.2f %5.2f %4d %4d %5d %7.1f %6d %5.2f %s%-8s%s\n",
			truncate(m.Name, 16),
			martin.Instability,
			martin.Abstractness,
			martin.Distance,
			martin.Ca,
			martin.Ce,
			lcom.LCOM4,
			cog.AvgCognitive,
			dg.CycleCount,
			ent.ImportEntropy,
			zoneColor, martin.Zone, reset,
		)
	}
	fmt.Printf("  %s\n", strings.Repeat("─", 100))

	// Legend
	fmt.Printf("\n  %sLegend:%s I=Instability(0=stable) A=Abstractness D=Distance(0=ideal) Ca=Afferent Ce=Efferent\n", gray, reset)
	fmt.Printf("  %s        LCOM4=Cohesion(1=ideal) CogAvg=Cognitive/func Cycles=SCC H(imp)=ImportEntropy%s\n", gray, reset)
	fmt.Printf("  %s        Zone: %sideal%s %sbalanced%s %spain%s(concrete+stable) %suseless%s(abstract+unstable)%s\n\n",
		gray, green, gray, gray, gray, red, gray, brightRed, gray, reset)
}

func gradeColor(grade string) string {
	switch grade {
	case "A":
		return green
	case "B":
		return cyan
	case "C":
		return yellow
	case "D":
		return red
	case "F":
		return brightRed + bold
	default:
		return reset
	}
}

func quadrantColor(q string) string {
	switch q {
	case scorer.QuadrantMature:
		return green
	case scorer.QuadrantMatureFragile:
		return yellow
	case scorer.QuadrantSpecialized:
		return cyan
	case scorer.QuadrantShallow:
		return red
	case scorer.QuadrantIncipient:
		return gray
	case scorer.QuadrantIncipientOk:
		return cyan
	default:
		return reset
	}
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-1] + "…"
}

func filterByQuadrant(modules []scorer.ModuleScore, quadrant string) []scorer.ModuleScore {
	var result []scorer.ModuleScore
	for _, m := range modules {
		if m.Quadrant == quadrant {
			result = append(result, m)
		}
	}
	return result
}
