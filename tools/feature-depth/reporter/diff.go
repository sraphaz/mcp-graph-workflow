package reporter

import (
	"encoding/json"
	"feature-depth/analyzer"
	"fmt"
	"os"
	"sort"
)

// FileDelta is one row of a baseline-vs-current comparison.
type FileDelta struct {
	RelPath  string  `json:"path"`
	Module   string  `json:"module"`
	Before   float64 `json:"before"`
	After    float64 `json:"after"`
	Delta    float64 `json:"delta"`
	TestLocΔ int     `json:"testLocDelta"`
}

// LoadBaselineFiles reads a previously-written file-mode JSON report
// and returns the file array. Returns nil if path is empty (no
// baseline configured).
func LoadBaselineFiles(path string) ([]analyzer.FileAnalysis, error) {
	if path == "" {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read baseline %q: %w", path, err)
	}
	var report FileReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parse baseline %q: %w", path, err)
	}
	return report.Files, nil
}

// ComputeDeltas pairs current and baseline by RelPath and returns the
// deltas sorted by absolute change (largest movers first). Files
// present in only one set get a Before/After of 0 and are flagged
// implicitly by the missing side.
func ComputeDeltas(current, baseline []analyzer.FileAnalysis) []FileDelta {
	prior := map[string]analyzer.FileAnalysis{}
	for _, f := range baseline {
		prior[f.RelPath] = f
	}

	deltas := make([]FileDelta, 0, len(current))
	seen := map[string]bool{}

	for _, f := range current {
		seen[f.RelPath] = true
		b := prior[f.RelPath] // zero value if absent
		deltas = append(deltas, FileDelta{
			RelPath:  f.RelPath,
			Module:   f.Module,
			Before:   b.Score,
			After:    f.Score,
			Delta:    f.Score - b.Score,
			TestLocΔ: f.TestLOC - b.TestLOC,
		})
	}
	// Files removed since baseline → After=0, Delta=-Before.
	for _, b := range baseline {
		if seen[b.RelPath] {
			continue
		}
		deltas = append(deltas, FileDelta{
			RelPath:  b.RelPath,
			Module:   b.Module,
			Before:   b.Score,
			After:    0,
			Delta:    -b.Score,
			TestLocΔ: -b.TestLOC,
		})
	}

	sort.Slice(deltas, func(i, j int) bool {
		return absFloat(deltas[i].Delta) > absFloat(deltas[j].Delta)
	})
	return deltas
}

// WriteDeltaTable prints the top movers (positive and negative).
func WriteDeltaTable(deltas []FileDelta) {
	if len(deltas) == 0 {
		return
	}
	pos := []FileDelta{}
	neg := []FileDelta{}
	for _, d := range deltas {
		if d.Delta > 0.5 {
			pos = append(pos, d)
		} else if d.Delta < -0.5 {
			neg = append(neg, d)
		}
	}
	if len(pos) == 0 && len(neg) == 0 {
		fmt.Println("\n── DIFF vs baseline ──")
		fmt.Println("  No file moved more than 0.5 points.")
		return
	}

	fmt.Println("\n── DIFF vs baseline ──")
	if len(pos) > 0 {
		fmt.Println("\n  ↑ TOP IMPROVERS")
		printDeltaRows(pos[:min(15, len(pos))])
	}
	if len(neg) > 0 {
		fmt.Println("\n  ↓ TOP REGRESSIONS")
		printDeltaRows(neg[:min(15, len(neg))])
	}
}

func printDeltaRows(rows []FileDelta) {
	fmt.Printf("    %-8s %-7s %-7s %-7s %-50s %s\n", "Δ", "before", "after", "Δtest", "path", "module")
	fmt.Printf("    %-8s %-7s %-7s %-7s %-50s %s\n", "----", "------", "-----", "-----", "----", "------")
	for _, d := range rows {
		sign := ""
		if d.Delta > 0 {
			sign = "+"
		}
		testΔ := ""
		if d.TestLocΔ != 0 {
			if d.TestLocΔ > 0 {
				testΔ = fmt.Sprintf("+%d", d.TestLocΔ)
			} else {
				testΔ = fmt.Sprintf("%d", d.TestLocΔ)
			}
		}
		fmt.Printf("    %s%-7.1f %-7.1f %-7.1f %-7s %-50s %s\n",
			sign, d.Delta, d.Before, d.After, testΔ, truncatePath(d.RelPath, 50), d.Module)
	}
}

func absFloat(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
