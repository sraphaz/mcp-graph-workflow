package scorer

import (
	"math"
	"testing"
)

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

func TestGraphHealthScore_NoIssuesReturns100(t *testing.T) {
	got := graphHealthScore(0, 0, 0.0)
	if got != 100.0 {
		t.Errorf("clean module: got %v, want 100", got)
	}
}

func TestGraphHealthScore_BaselinePenaltiesUnaffectedByZeroCentrality(t *testing.T) {
	// Centrality = 0 must reproduce the legacy formula exactly:
	// 100 - 15*cycles - 10*bidi.
	cases := []struct {
		cycles, bidi int
		want         float64
	}{
		{1, 0, 85.0},
		{0, 1, 90.0},
		{2, 1, 60.0},  // 100 - 30 - 10
		{6, 0, 10.0},  // 100 - 90
		{10, 0, 0.0},  // clamped
	}
	for _, c := range cases {
		got := graphHealthScore(c.cycles, c.bidi, 0.0)
		if !almostEqual(got, c.want) {
			t.Errorf("cycles=%d bidi=%d centrality=0: got %v, want %v",
				c.cycles, c.bidi, got, c.want)
		}
	}
}

func TestGraphHealthScore_CentralityAmplifiesPenalty(t *testing.T) {
	// One cycle in a hub module hurts more than the same cycle in a leaf.
	leaf := graphHealthScore(1, 0, 0.0)
	mid := graphHealthScore(1, 0, 0.5)
	hub := graphHealthScore(1, 0, 1.0)

	if !(leaf > mid && mid > hub) {
		t.Errorf("centrality should amplify penalty: leaf=%v mid=%v hub=%v", leaf, mid, hub)
	}
}

func TestGraphHealthScore_CentralityNoEffectWhenClean(t *testing.T) {
	// A clean module stays at 100 regardless of centrality — high
	// centrality without problems is not a problem.
	for _, c := range []float64{0.0, 0.3, 0.7, 1.0} {
		got := graphHealthScore(0, 0, c)
		if got != 100.0 {
			t.Errorf("clean+centrality=%v: got %v, want 100", c, got)
		}
	}
}

func TestGraphHealthScore_ResultClamped(t *testing.T) {
	// Many cycles + max centrality must not produce a negative score.
	got := graphHealthScore(20, 5, 1.0)
	if got < 0 || got > 100 {
		t.Errorf("clamp violated: got %v", got)
	}
	if got != 0 {
		t.Errorf("expected floor at 0, got %v", got)
	}
}

func TestGraphHealthScore_CentralityClampedAt1(t *testing.T) {
	// Centrality > 1.0 (shouldn't happen but be defensive) doesn't keep
	// driving penalty further.
	atOne := graphHealthScore(1, 0, 1.0)
	above := graphHealthScore(1, 0, 1.7)
	if !almostEqual(atOne, above) {
		t.Errorf("centrality clamp at 1: atOne=%v above=%v", atOne, above)
	}
}
