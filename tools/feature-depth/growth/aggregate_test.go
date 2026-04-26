package growth

import (
	"testing"
	"time"
)

func mustParseISO(t *testing.T, s string) time.Time {
	t.Helper()
	tt, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatal(err)
	}
	return tt
}

func TestClassifyPath(t *testing.T) {
	cases := []struct {
		path string
		want FileKind
	}{
		{"src/core/rag/onnx-embeddings.ts", KindSource},
		{"src/core/utils/errors.ts", KindSource},
		{"src/api/routes/foo.ts", KindSource},
		{"src/tests/onnx-embeddings.test.ts", KindTest},
		{"src/core/rag/onnx-embeddings.test.ts", KindTest},
		{"src/web/dashboard/src/foo.spec.ts", KindTest},
		{"docs/_internal/adr/0055-foo.md", KindDocs},
		{"README.md", KindDocs},
		{"package.json", KindOther},
		{"tools/feature-depth/main.go", KindOther},
		{"node_modules/x/y.ts", KindOther},   // explicitly excluded from source
		{"dist/foo.js", KindOther},           // build output
		{"src/web/dashboard/dist/foo.ts", KindOther},
	}
	for _, c := range cases {
		if got := ClassifyPath(c.path); got != c.want {
			t.Errorf("ClassifyPath(%q) = %v, want %v", c.path, got, c.want)
		}
	}
}

func TestExtractCoreModule(t *testing.T) {
	cases := []struct {
		path string
		want string
	}{
		{"src/core/rag/onnx-embeddings.ts", "rag"},
		{"src/core/utils/errors.ts", "utils"},
		{"src/core/rag/sub/x.ts", "rag"},
		{"src/api/routes/foo.ts", ""},
		{"docs/foo.md", ""},
		{"README.md", ""},
	}
	for _, c := range cases {
		if got := ExtractCoreModule(c.path); got != c.want {
			t.Errorf("ExtractCoreModule(%q) = %q, want %q", c.path, got, c.want)
		}
	}
}

func TestAggregate_NetLOCAndKindBreakdown(t *testing.T) {
	commits := []Commit{
		{
			Hash:   "a", Author: mustParseISO(t, "2026-03-09T01:00:00Z"),
			Changes: []FileChange{
				{Path: "src/core/rag/x.ts", Added: 100, Deleted: 0},
				{Path: "src/tests/x.test.ts", Added: 50, Deleted: 0},
				{Path: "README.md", Added: 20, Deleted: 0},
			},
		},
		{
			Hash:   "b", Author: mustParseISO(t, "2026-03-10T01:00:00Z"),
			Changes: []FileChange{
				{Path: "src/core/rag/x.ts", Added: 30, Deleted: 10},
			},
		},
	}
	r := Aggregate(commits)

	// Source net = 100 - 0 + 30 - 10 = 120
	if r.NetByKind["source"] != 120 {
		t.Errorf("source net = %d, want 120", r.NetByKind["source"])
	}
	if r.NetByKind["test"] != 50 {
		t.Errorf("test net = %d, want 50", r.NetByKind["test"])
	}
	if r.NetByKind["docs"] != 20 {
		t.Errorf("docs net = %d, want 20", r.NetByKind["docs"])
	}
	// total = 120 + 50 + 20 = 190
	if r.NetLOC != 190 {
		t.Errorf("NetLOC = %d, want 190", r.NetLOC)
	}
	// test/source ratio = 50/120
	want := 50.0 / 120.0
	if abs(r.TestRatio-want) > 1e-9 {
		t.Errorf("TestRatio = %v, want %v", r.TestRatio, want)
	}
	if r.TotalCommits != 2 {
		t.Errorf("TotalCommits = %d, want 2", r.TotalCommits)
	}
}

func TestAggregate_ModuleRollup(t *testing.T) {
	commits := []Commit{
		{
			Hash: "a", Author: mustParseISO(t, "2026-03-09T01:00:00Z"),
			Changes: []FileChange{
				{Path: "src/core/rag/x.ts", Added: 100, Deleted: 0},
				{Path: "src/core/rag/y.ts", Added: 50, Deleted: 0},
				{Path: "src/core/utils/errors.ts", Added: 20, Deleted: 0},
			},
		},
	}
	r := Aggregate(commits)
	mods := map[string]int{}
	for _, m := range r.Modules {
		mods[m.Module] = m.NetLOC
	}
	if mods["rag"] != 150 {
		t.Errorf("rag NetLOC = %d, want 150", mods["rag"])
	}
	if mods["utils"] != 20 {
		t.Errorf("utils NetLOC = %d, want 20", mods["utils"])
	}
}

func TestAggregate_WeeklyBuckets(t *testing.T) {
	commits := []Commit{
		{Hash: "a", Author: mustParseISO(t, "2026-03-09T01:00:00Z"), Changes: []FileChange{{Path: "src/core/rag/x.ts", Added: 100}}}, // week of 2026-03-09 (Mon)
		{Hash: "b", Author: mustParseISO(t, "2026-03-12T01:00:00Z"), Changes: []FileChange{{Path: "src/core/rag/x.ts", Added: 50}}},  // same week
		{Hash: "c", Author: mustParseISO(t, "2026-03-16T01:00:00Z"), Changes: []FileChange{{Path: "src/core/rag/x.ts", Added: 30}}},  // next week
	}
	r := Aggregate(commits)
	if len(r.Weeks) != 2 {
		t.Fatalf("expected 2 weeks, got %d", len(r.Weeks))
	}
	// Week 1: 100 + 50 = 150 source, cumulative 150
	if r.Weeks[0].NetByKind[KindSource] != 150 {
		t.Errorf("week[0] source = %d, want 150", r.Weeks[0].NetByKind[KindSource])
	}
	if r.Weeks[0].CumulativeNet != 150 {
		t.Errorf("week[0] cumulative = %d, want 150", r.Weeks[0].CumulativeNet)
	}
	// Week 2: 30 source, cumulative 180
	if r.Weeks[1].NetByKind[KindSource] != 30 {
		t.Errorf("week[1] source = %d, want 30", r.Weeks[1].NetByKind[KindSource])
	}
	if r.Weeks[1].CumulativeNet != 180 {
		t.Errorf("week[1] cumulative = %d, want 180", r.Weeks[1].CumulativeNet)
	}
}

func TestAggregate_TopHotspots(t *testing.T) {
	commits := []Commit{
		{Hash: "a", Author: mustParseISO(t, "2026-03-09T01:00:00Z"), Changes: []FileChange{{Path: "src/core/rag/hot.ts", Added: 100}}},
		{Hash: "b", Author: mustParseISO(t, "2026-03-10T01:00:00Z"), Changes: []FileChange{{Path: "src/core/rag/hot.ts", Added: 50, Deleted: 10}}},
		{Hash: "c", Author: mustParseISO(t, "2026-03-11T01:00:00Z"), Changes: []FileChange{{Path: "src/core/rag/hot.ts", Added: 30, Deleted: 5}}},
		{Hash: "d", Author: mustParseISO(t, "2026-03-12T01:00:00Z"), Changes: []FileChange{{Path: "src/core/utils/cold.ts", Added: 20}}},
	}
	r := Aggregate(commits)
	if len(r.TopHotspots) == 0 {
		t.Fatal("expected at least 1 hotspot")
	}
	hot := r.TopHotspots[0]
	if hot.Path != "src/core/rag/hot.ts" {
		t.Errorf("top hotspot = %q, want hot.ts", hot.Path)
	}
	if hot.Touches != 3 {
		t.Errorf("hot.Touches = %d, want 3", hot.Touches)
	}
	if hot.NetLOC != 100+(50-10)+(30-5) {
		t.Errorf("hot.NetLOC = %d, want %d", hot.NetLOC, 100+(50-10)+(30-5))
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
