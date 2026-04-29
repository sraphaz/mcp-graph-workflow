package watch

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSnapshotMTimes_CapturesAllTsFiles(t *testing.T) {
	root := t.TempDir()
	files := []string{"src/foo.ts", "src/bar.tsx", "src/baz.ts"}
	for _, f := range files {
		full := filepath.Join(root, f)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		_ = os.WriteFile(full, []byte("x"), 0o644)
	}

	snap, err := SnapshotMTimes(root)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(snap) != 3 {
		t.Errorf("expected 3 files, got %d", len(snap))
	}
}

func TestSnapshotMTimes_SkipsExcludedDirs(t *testing.T) {
	root := t.TempDir()
	cases := map[string]string{
		"src/keep.ts":              "ok",
		"node_modules/lib.ts":      "skip",
		"dist/output.ts":           "skip",
		".git/HEAD":                "skip",
		"src/web/dashboard/dist/x.ts": "skip",
	}
	for f, body := range cases {
		full := filepath.Join(root, f)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		_ = os.WriteFile(full, []byte(body), 0o644)
	}
	snap, _ := SnapshotMTimes(root)
	for path := range snap {
		if filepath.Base(filepath.Dir(path)) == "node_modules" ||
			filepath.Base(filepath.Dir(path)) == "dist" ||
			filepath.Base(filepath.Dir(path)) == ".git" {
			t.Errorf("excluded dir leaked: %s", path)
		}
	}
}

func TestSnapshotMTimes_OnlyTypeScriptFiles(t *testing.T) {
	root := t.TempDir()
	files := map[string]string{
		"src/foo.ts":  "ts",
		"src/bar.go":  "go",
		"src/baz.md":  "md",
		"src/qux.tsx": "tsx",
	}
	for f, body := range files {
		full := filepath.Join(root, f)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		_ = os.WriteFile(full, []byte(body), 0o644)
	}
	snap, _ := SnapshotMTimes(root)
	if len(snap) != 2 { // foo.ts + qux.tsx
		t.Errorf("expected 2 ts/tsx files, got %d", len(snap))
	}
}

func TestDiff_DetectsAddedAndModified(t *testing.T) {
	t1 := time.Now()
	t2 := t1.Add(time.Second)

	old := map[string]time.Time{
		"a.ts": t1,
		"b.ts": t1,
	}
	now := map[string]time.Time{
		"a.ts": t2, // modified
		"b.ts": t1, // unchanged
		"c.ts": t1, // added
	}

	changed := Diff(old, now)
	if len(changed) != 2 {
		t.Fatalf("expected 2 changed (a + c), got %d: %v", len(changed), changed)
	}
	set := map[string]bool{}
	for _, p := range changed {
		set[p] = true
	}
	if !set["a.ts"] || !set["c.ts"] {
		t.Errorf("expected a.ts and c.ts in changes, got %v", changed)
	}
}

func TestDiff_DetectsDeleted(t *testing.T) {
	t1 := time.Now()
	old := map[string]time.Time{"a.ts": t1, "b.ts": t1}
	now := map[string]time.Time{"a.ts": t1}

	changed := Diff(old, now)
	if len(changed) != 1 || changed[0] != "b.ts" {
		t.Errorf("expected [b.ts] (deleted), got %v", changed)
	}
}

func TestDiff_NoChangesReturnsEmpty(t *testing.T) {
	t1 := time.Now()
	snap := map[string]time.Time{"a.ts": t1, "b.ts": t1}
	if len(Diff(snap, snap)) != 0 {
		t.Error("expected no changes for identical snapshots")
	}
}
