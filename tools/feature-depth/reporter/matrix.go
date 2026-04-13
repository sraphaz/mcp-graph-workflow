package reporter

import (
	"feature-depth/scorer"
	"fmt"
	"strings"
)

const (
	matrixWidth  = 60
	matrixHeight = 20
)

// WriteMatrix renders an ASCII scatter plot of breadth vs depth.
func WriteMatrix(modules []scorer.ModuleScore) {
	if len(modules) == 0 {
		return
	}

	// Find max breadth for normalization
	maxBreadth := 0.0
	for _, m := range modules {
		if m.Analysis.Breadth.BreadthScore > maxBreadth {
			maxBreadth = m.Analysis.Breadth.BreadthScore
		}
	}
	if maxBreadth == 0 {
		maxBreadth = 1
	}

	// Create grid
	grid := make([][]string, matrixHeight+1)
	for i := range grid {
		grid[i] = make([]string, matrixWidth+1)
		for j := range grid[i] {
			grid[i][j] = " "
		}
	}

	// Place modules on grid
	for _, m := range modules {
		x := int(m.Analysis.Breadth.BreadthScore / maxBreadth * float64(matrixWidth))
		y := int(m.PrecisionScore / 100.0 * float64(matrixHeight))

		x = clampInt(x, 0, matrixWidth)
		y = clampInt(y, 0, matrixHeight)

		// Invert Y (0 at bottom)
		gridY := matrixHeight - y

		label := abbreviate(m.Name)
		color := quadrantColor(m.Quadrant)
		grid[gridY][x] = fmt.Sprintf("%s%s%s", color, label, reset)
	}

	// Render
	fmt.Printf("\n%s  FEATURE DEPTH MATRIX (Breadth → , Depth ↑)%s\n\n", bold, reset)

	midX := matrixWidth / 2
	midY := matrixHeight / 2

	for y := 0; y <= matrixHeight; y++ {
		// Y-axis label
		if y == 0 {
			fmt.Print("  100│")
		} else if y == midY {
			fmt.Print("   50│")
		} else if y == matrixHeight {
			fmt.Print("    0│")
		} else {
			fmt.Print("     │")
		}

		for x := 0; x <= matrixWidth; x++ {
			if y == midY && grid[y][x] == " " {
				fmt.Print("·")
			} else if x == midX && grid[y][x] == " " {
				fmt.Print("·")
			} else {
				fmt.Print(grid[y][x])
			}
		}

		// Quadrant labels
		if y == 2 {
			fmt.Printf("  %sSPECIALIZED%s    %sMATURE%s", cyan, reset, green, reset)
		}
		if y == matrixHeight-2 {
			fmt.Printf("  %sINCIPIENT%s      %sSHALLOW%s", gray, reset, red, reset)
		}

		fmt.Println()
	}

	fmt.Printf("     └%s┬%s┘\n", strings.Repeat("─", midX-1), strings.Repeat("─", matrixWidth-midX-1))
	fmt.Printf("     0%sBreadth%s100\n\n", strings.Repeat(" ", midX-4), strings.Repeat(" ", matrixWidth-midX-6))

	// Legend
	fmt.Printf("  Legend: %s■ MATURE%s  %s■ SPECIALIZED%s  %s■ SHALLOW%s  %s■ INCIPIENT%s\n\n",
		green, reset, cyan, reset, red, reset, gray, reset)
}

func abbreviate(name string) string {
	if len(name) <= 3 {
		return name
	}
	// Use first 3 chars
	return name[:3]
}

func clampInt(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
