package reporter

import (
	"encoding/json"
	"feature-depth/growth"
	"fmt"
	"os"
)

// WriteGrowthTable prints a compact ASCII summary of the growth report:
// totals, kind breakdown, weekly cumulative sparkline, top modules,
// top hotspots. Intended for terminal scan, not for parsing.
func WriteGrowthTable(r growth.Report) {
	fmt.Printf("\n=== Feature-Depth (project growth) ===\n")
	fmt.Printf("First commit:  %s\n", r.FirstCommit.Format("2006-01-02"))
	fmt.Printf("Last commit:   %s\n", r.LastCommit.Format("2006-01-02"))
	fmt.Printf("Total commits: %d\n", r.TotalCommits)
	fmt.Printf("Net LOC:       %d\n\n", r.NetLOC)

	fmt.Println("── LOC by kind ──")
	for _, k := range []string{"source", "test", "docs", "other"} {
		fmt.Printf("  %-7s %d\n", k, r.NetByKind[k])
	}
	fmt.Printf("  test/source ratio: %.2f\n\n", r.TestRatio)

	if len(r.Weeks) > 0 {
		fmt.Println("── Weekly cumulative LOC (sparkline) ──")
		writeSparkline(r.Weeks)
		fmt.Println()
	}

	if len(r.Modules) > 0 {
		fmt.Println("── Top modules by source net LOC ──")
		fmt.Printf("  %-6s %-8s %s\n", "loc", "commits", "module")
		fmt.Printf("  %-6s %-8s %s\n", "----", "-------", "------")
		for i, m := range r.Modules {
			if i >= 15 {
				break
			}
			fmt.Printf("  %-6d %-8d %s\n", m.NetLOC, m.Commits, m.Module)
		}
		fmt.Println()
	}

	if len(r.TopHotspots) > 0 {
		fmt.Println("── Top hotspots (most-touched files) ──")
		fmt.Printf("  %-8s %-6s %-7s %s\n", "touches", "loc", "kind", "path")
		fmt.Printf("  %-8s %-6s %-7s %s\n", "-------", "----", "----", "----")
		for i, h := range r.TopHotspots {
			if i >= 15 {
				break
			}
			fmt.Printf("  %-8d %-6d %-7s %s\n", h.Touches, h.NetLOC, h.Kind.String(), h.Path)
		}
		fmt.Println()
	}
}

// writeSparkline prints a simple ASCII bar for cumulative LOC at the
// end of each week, scaled to a fixed 40-char width. Useful for
// at-a-glance "is the curve linear, exponential, or plateauing?".
func writeSparkline(weeks []growth.WeekBucket) {
	maxC := 0
	for _, w := range weeks {
		if w.CumulativeNet > maxC {
			maxC = w.CumulativeNet
		}
	}
	if maxC <= 0 {
		return
	}
	const width = 40
	for _, w := range weeks {
		bars := w.CumulativeNet * width / maxC
		if bars < 0 {
			bars = 0
		}
		bar := ""
		for i := 0; i < bars; i++ {
			bar += "█"
		}
		fmt.Printf("  %s  %s  %d\n", w.WeekStart.Format("2006-01-02"), bar, w.CumulativeNet)
	}
}

// WriteGrowthJSON serializes the growth report.
func WriteGrowthJSON(r growth.Report, path string) error {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return err
	}
	if path == "" {
		_, err = os.Stdout.Write(append(data, '\n'))
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}
