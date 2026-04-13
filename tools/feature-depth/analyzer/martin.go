package analyzer

import "math"

// MartinResult holds Robert C. Martin's Package Metrics (2002).
type MartinResult struct {
	Ca          int     `json:"afferentCoupling"`
	Ce          int     `json:"efferentCoupling"`
	Instability float64 `json:"instability"`
	Abstractness float64 `json:"abstractness"`
	Distance    float64 `json:"distanceMainSequence"`
	Zone        string  `json:"zone"` // "ideal", "pain", "useless", "balanced"
}

// AnalyzeMartin computes Martin's Package Metrics for a module.
// Ca = afferent coupling (who depends on me)
// Ce = efferent coupling (who I depend on)
// I = Ce / (Ce + Ca) — instability
// A = abstract exports / total exports — abstractness
// D = |A + I - 1| — distance from main sequence
func AnalyzeMartin(modName string, graph *ImportGraph, breadth BreadthResult) MartinResult {
	ca := graph.AfferentCount(modName)
	ce := graph.EfferentCount(modName)

	// Instability: 0 = maximally stable, 1 = maximally unstable
	instability := 0.5 // default for isolated modules
	total := ca + ce
	if total > 0 {
		instability = float64(ce) / float64(total)
	}

	// Abstractness: ratio of types/interfaces to total exports
	totalExports := breadth.ExportedFuncs + breadth.ExportedTypes + breadth.ExportedConsts
	abstractness := 0.0
	if totalExports > 0 {
		abstractness = float64(breadth.ExportedTypes) / float64(totalExports)
	}

	// Distance from Main Sequence: ideal is A + I = 1 (the diagonal)
	distance := math.Abs(abstractness + instability - 1.0)

	// Zone classification
	zone := classifyZone(instability, abstractness, distance)

	return MartinResult{
		Ca:          ca,
		Ce:          ce,
		Instability: instability,
		Abstractness: abstractness,
		Distance:    distance,
		Zone:        zone,
	}
}

// classifyZone determines the architectural zone of a module.
// Based on Martin's "Clean Architecture" zones:
// - Zone of Pain: stable + concrete (hard to change, everything depends on it)
// - Zone of Uselessness: unstable + abstract (nobody uses these abstractions)
// - Ideal: close to the main sequence (A + I ≈ 1)
func classifyZone(instability, abstractness, distance float64) string {
	if distance < 0.3 {
		return "ideal"
	}
	// Zone of Pain: concrete (low A) and stable (low I)
	if abstractness < 0.2 && instability < 0.3 {
		return "pain"
	}
	// Zone of Uselessness: abstract (high A) and unstable (high I)
	if abstractness > 0.7 && instability > 0.7 {
		return "useless"
	}
	return "balanced"
}
