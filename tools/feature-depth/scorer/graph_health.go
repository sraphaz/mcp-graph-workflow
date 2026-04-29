package scorer

// graphHealthScore returns a 0-100 score for a module's structural
// graph health (cycles, bidirectional dependencies) amplified by its
// betweenness centrality.
//
// Rationale: a cycle in a leaf utility is a local nuisance; the same
// cycle in a hub module that 30 others depend on poisons the whole
// graph. The penalty therefore scales with the module's betweenness
// centrality (already computed via Brandes' algorithm in
// analyzer/depgraph.go but previously unused in scoring).
//
// Calibration: at centrality=0 the function reproduces the legacy
// formula exactly (100 - 15*cycles - 10*bidi) so existing baselines
// don't shift for leaf modules. At centrality=1 the per-issue penalty
// doubles. Values outside [0,1] are clamped — defensive, since
// betweenness is normalized in depgraph.go but the function is also
// callable from tests.
func graphHealthScore(cycleCount, bidirectionalDeps int, centrality float64) float64 {
	if centrality < 0 {
		centrality = 0
	}
	if centrality > 1 {
		centrality = 1
	}
	const centralityAmplifier = 1.0 // at centrality=1, penalty doubles
	multiplier := 1.0 + centrality*centralityAmplifier

	score := 100.0
	score -= float64(cycleCount) * 15.0 * multiplier
	score -= float64(bidirectionalDeps) * 10.0 * multiplier

	return clamp(score, 0, 100)
}
