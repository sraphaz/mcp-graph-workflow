package scorer

import "sort"

const (
	QuadrantMature         = "MATURE"
	QuadrantMatureFragile  = "MATURE_FRAGILE"
	QuadrantSpecialized    = "SPECIALIZED"
	QuadrantShallow        = "SHALLOW"
	QuadrantIncipient      = "INCIPIENT"
	QuadrantIncipientOk    = "INCIPIENT_OK"
)

// ClassifyQuadrants assigns quadrants to all modules based on median breadth/depth.
func ClassifyQuadrants(modules []ModuleScore) {
	if len(modules) == 0 {
		return
	}

	// Calculate medians
	breadths := make([]float64, len(modules))
	depths := make([]float64, len(modules))
	for i, m := range modules {
		breadths[i] = m.Analysis.Breadth.BreadthScore
		depths[i] = m.PrecisionScore
	}

	medianBreadth := median(breadths)
	medianDepth := median(depths)

	for i := range modules {
		b := modules[i].Analysis.Breadth.BreadthScore
		d := modules[i].PrecisionScore

		// Normalize for report
		if medianBreadth > 0 {
			modules[i].BreadthNorm = b / medianBreadth * 50.0
		}
		modules[i].DepthNorm = d

		highBreadth := b >= medianBreadth
		highDepth := d >= medianDepth

		switch {
		case highBreadth && highDepth:
			modules[i].Quadrant = QuadrantMature
		case !highBreadth && highDepth:
			modules[i].Quadrant = QuadrantSpecialized
		case highBreadth && !highDepth:
			modules[i].Quadrant = QuadrantShallow
		default:
			modules[i].Quadrant = QuadrantIncipient
		}
	}

	// Sub-quadrant refinement based on structural health
	// (Martin distance + LCOM + Graph cycles)
	for i := range modules {
		m := &modules[i]
		sh := structuralHealth(*m)

		if m.Quadrant == QuadrantMature && sh < 40 {
			m.Quadrant = QuadrantMatureFragile
		}
		if m.Quadrant == QuadrantIncipient && sh > 70 {
			m.Quadrant = QuadrantIncipientOk
		}
	}
}

// structuralHealth computes a composite score from Martin, LCOM, and Graph metrics.
func structuralHealth(m ModuleScore) float64 {
	martinScore := clampQ(100.0-m.Analysis.Martin.Distance*100.0, 0, 100)

	lcomScore := clampQ(100.0-float64(m.Analysis.LCOM.LCOM4-1)*25.0, 0, 100)

	graphScore := 100.0
	graphScore -= float64(m.Analysis.DepGraph.CycleCount) * 15.0
	graphScore -= float64(m.Analysis.DepGraph.BidirectionalDeps) * 10.0
	graphScore = clampQ(graphScore, 0, 100)

	return (martinScore + lcomScore + graphScore) / 3.0
}

func clampQ(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func median(values []float64) float64 {
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	n := len(sorted)
	if n == 0 {
		return 0
	}
	if n%2 == 0 {
		return (sorted[n/2-1] + sorted[n/2]) / 2.0
	}
	return sorted[n/2]
}
