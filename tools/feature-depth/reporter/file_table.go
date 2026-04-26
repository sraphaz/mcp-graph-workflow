package reporter

import (
	"encoding/json"
	"feature-depth/analyzer"
	"fmt"
	"os"
	"sort"
)

// FileReport is the JSON-serializable shape of a file-granularity run.
type FileReport struct {
	Tool        string                  `json:"tool"`
	Mode        string                  `json:"mode"`
	TotalFiles  int                     `json:"totalFiles"`
	AvgScore    float64                 `json:"avgScore"`
	Files       []analyzer.FileAnalysis `json:"files"`
}

// WriteFileTable prints a compact table — top 20 by score, bottom 20,
// and the top 10 untested files (no adjacent .test.ts) so the user can
// see exactly which files moved and which still need attention.
func WriteFileTable(files []analyzer.FileAnalysis) {
	if len(files) == 0 {
		fmt.Println("No files analyzed.")
		return
	}

	sorted := make([]analyzer.FileAnalysis, len(files))
	copy(sorted, files)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Score > sorted[j].Score })

	avg := 0.0
	for _, f := range files {
		avg += f.Score
	}
	avg /= float64(len(files))

	fmt.Printf("\n=== Feature-Depth (file granularity) ===\n")
	fmt.Printf("Files analyzed: %d   |   Avg score: %.2f\n\n", len(files), avg)

	fmt.Println("── TOP 20 (highest score) ──")
	printRows(sorted[:min(20, len(sorted))])

	fmt.Println("\n── BOTTOM 20 (lowest score, prime targets) ──")
	bottom := sorted[max(0, len(sorted)-20):]
	// reverse for ascending display (worst first)
	rev := make([]analyzer.FileAnalysis, len(bottom))
	for i, f := range bottom {
		rev[len(bottom)-1-i] = f
	}
	printRows(rev)

	// Untested files (HasTest=false), ordered by LOC descending — large
	// untested files are higher-leverage targets than tiny ones.
	untested := make([]analyzer.FileAnalysis, 0)
	for _, f := range files {
		if !f.HasTest {
			untested = append(untested, f)
		}
	}
	sort.Slice(untested, func(i, j int) bool { return untested[i].LOC > untested[j].LOC })

	if len(untested) > 0 {
		fmt.Println("\n── TOP 10 UNTESTED (largest files, no adjacent test) ──")
		printRows(untested[:min(10, len(untested))])
	}

	WriteFileModuleRollup(files)
}

// ModuleRollup is the per-module aggregate of file-level scores.
// Comparing this against module-mode scores surfaces calibration
// drift: if file-mode rollup says rag=72 but module-mode says rag=58,
// one of the two scoring weights is off. Both should converge.
type ModuleRollup struct {
	Module   string  `json:"module"`
	Files    int     `json:"files"`
	AvgScore float64 `json:"avgScore"`
	TotalLOC int     `json:"totalLoc"`
	TestLOC  int     `json:"testLoc"`
	Tested   int     `json:"tested"`   // files with a test
	Untested int     `json:"untested"` // files without a test
}

// WriteFileModuleRollup groups file-level scores by module and prints
// a comparison table. Module-mode scores are NOT in this report —
// run --granularity=module separately and eyeball the deltas.
func WriteFileModuleRollup(files []analyzer.FileAnalysis) {
	type acc struct {
		files, totalLOC, testLOC, tested int
		sumScore                         float64
	}
	by := map[string]*acc{}
	for _, f := range files {
		a, ok := by[f.Module]
		if !ok {
			a = &acc{}
			by[f.Module] = a
		}
		a.files++
		a.totalLOC += f.LOC
		a.testLOC += f.TestLOC
		if f.HasTest {
			a.tested++
		}
		a.sumScore += f.Score
	}

	rollups := make([]ModuleRollup, 0, len(by))
	for mod, a := range by {
		avg := 0.0
		if a.files > 0 {
			avg = a.sumScore / float64(a.files)
		}
		rollups = append(rollups, ModuleRollup{
			Module:   mod,
			Files:    a.files,
			AvgScore: avg,
			TotalLOC: a.totalLOC,
			TestLOC:  a.testLOC,
			Tested:   a.tested,
			Untested: a.files - a.tested,
		})
	}
	sort.Slice(rollups, func(i, j int) bool { return rollups[i].AvgScore > rollups[j].AvgScore })

	fmt.Println("\n── MODULE ROLLUP (file-level avg, ranked) ──")
	fmt.Printf("  %-7s %-6s %-7s %-7s %-8s %s\n", "avg", "files", "loc", "testLoc", "tested", "module")
	fmt.Printf("  %-7s %-6s %-7s %-7s %-8s %s\n", "-----", "----", "----", "------", "------", "------")
	for _, r := range rollups {
		fmt.Printf("  %-7.1f %-6d %-7d %-7d %-2d/%-5d %s\n",
			r.AvgScore, r.Files, r.TotalLOC, r.TestLOC, r.Tested, r.Files, r.Module)
	}
}

func printRows(rows []analyzer.FileAnalysis) {
	fmt.Printf("  %-6s %-6s %-6s %-50s %s\n", "score", "loc", "test", "path", "module")
	fmt.Printf("  %-6s %-6s %-6s %-50s %s\n", "-----", "----", "----", "----", "------")
	for _, f := range rows {
		test := "-"
		if f.HasTest {
			test = fmt.Sprintf("%d", f.TestLOC)
		}
		fmt.Printf("  %-6.1f %-6d %-6s %-50s %s\n", f.Score, f.LOC, test, truncatePath(f.RelPath, 50), f.Module)
	}
}

// WriteFileJSON serializes the file-granularity report to either a
// file (if path is non-empty) or stdout.
func WriteFileJSON(report FileReport, path string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if path == "" {
		_, err = os.Stdout.Write(append(data, '\n'))
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

func truncatePath(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return "…" + s[len(s)-n+1:]
}
