package covreport

import (
	"os"
	"path/filepath"
	"testing"
)

func writeFixture(t *testing.T, body string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "coverage-final.json")
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

const sampleCoverage = `{
  "/abs/repo/src/core/foo.ts": {
    "path": "/abs/repo/src/core/foo.ts",
    "s": {"0": 1, "1": 1, "2": 1, "3": 1}
  },
  "/abs/repo/src/core/bar.ts": {
    "path": "/abs/repo/src/core/bar.ts",
    "s": {"0": 1, "1": 0, "2": 1, "3": 0}
  },
  "/abs/repo/src/core/cold.ts": {
    "path": "/abs/repo/src/core/cold.ts",
    "s": {"0": 0, "1": 0, "2": 0}
  }
}`

func TestLoadCoverage_ParsesIstanbulFormat(t *testing.T) {
	path := writeFixture(t, sampleCoverage)
	cov, err := LoadCoverage(path, "/abs/repo")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(cov) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(cov))
	}
}

func TestLoadCoverage_ComputesCoveragePercent(t *testing.T) {
	path := writeFixture(t, sampleCoverage)
	cov, _ := LoadCoverage(path, "/abs/repo")

	// foo: 4/4 hit = 100%
	if cov["src/core/foo.ts"] != 100.0 {
		t.Errorf("foo: %v, want 100", cov["src/core/foo.ts"])
	}
	// bar: 2/4 hit = 50%
	if cov["src/core/bar.ts"] != 50.0 {
		t.Errorf("bar: %v, want 50", cov["src/core/bar.ts"])
	}
	// cold: 0/3 hit = 0%
	if cov["src/core/cold.ts"] != 0.0 {
		t.Errorf("cold: %v, want 0", cov["src/core/cold.ts"])
	}
}

func TestLoadCoverage_KeysAreRelativeToBase(t *testing.T) {
	path := writeFixture(t, sampleCoverage)
	cov, _ := LoadCoverage(path, "/abs/repo")
	for k := range cov {
		if filepath.IsAbs(k) {
			t.Errorf("expected relative key, got abs: %s", k)
		}
	}
}

func TestLoadCoverage_HandlesMissingFile(t *testing.T) {
	cov, err := LoadCoverage("/nonexistent/path.json", "/repo")
	if err == nil {
		t.Error("expected error for missing path")
	}
	if cov != nil {
		t.Errorf("expected nil map on error, got %v", cov)
	}
}

func TestLoadCoverage_HandlesMalformedJSON(t *testing.T) {
	path := writeFixture(t, "{not valid json")
	_, err := LoadCoverage(path, "/repo")
	if err == nil {
		t.Error("expected error for malformed JSON")
	}
}

func TestLoadCoverage_EmptyStatementMapIsZeroPercent(t *testing.T) {
	path := writeFixture(t, `{"/abs/repo/src/empty.ts": {"path": "/abs/repo/src/empty.ts", "s": {}}}`)
	cov, _ := LoadCoverage(path, "/abs/repo")
	// File with no statements is treated as 0% (untestable signal,
	// not 100% which would falsely flag it as well-covered).
	if cov["src/empty.ts"] != 0.0 {
		t.Errorf("empty statement map: got %v, want 0", cov["src/empty.ts"])
	}
}

func TestLoadCoverage_SkipsEntriesOutsideBaseDir(t *testing.T) {
	path := writeFixture(t, `{
  "/abs/repo/src/foo.ts": {"path": "/abs/repo/src/foo.ts", "s": {"0": 1}},
  "/some/other/lib.ts": {"path": "/some/other/lib.ts", "s": {"0": 1}}
}`)
	cov, _ := LoadCoverage(path, "/abs/repo")
	if _, ok := cov["src/foo.ts"]; !ok {
		t.Error("expected src/foo.ts to be present")
	}
	if len(cov) != 1 {
		t.Errorf("expected 1 entry (out-of-base filtered), got %d", len(cov))
	}
}

func TestAutoDetect_FindsCoverageFinalJsonInRepo(t *testing.T) {
	root := t.TempDir()
	covDir := filepath.Join(root, "coverage")
	_ = os.Mkdir(covDir, 0o755)
	covPath := filepath.Join(covDir, "coverage-final.json")
	_ = os.WriteFile(covPath, []byte("{}"), 0o644)

	got := AutoDetectCoveragePath(root)
	if got != covPath {
		t.Errorf("got %q, want %q", got, covPath)
	}
}

func TestAutoDetect_ReturnsEmptyWhenAbsent(t *testing.T) {
	root := t.TempDir()
	got := AutoDetectCoveragePath(root)
	if got != "" {
		t.Errorf("expected empty string, got %q", got)
	}
}
