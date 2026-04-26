package growth

import (
	"strings"
	"testing"
)

const sampleGitLog = `f9a234d|2026-04-26T12:52:26-03:00
9	0	.gitignore
22	3	README.md
2	0	docs/_internal/RESEARCH.md

abc1234|2026-04-25T10:00:00-03:00
50	5	src/core/rag/onnx-embeddings.ts
30	0	src/tests/onnx-embeddings.test.ts

def5678|2026-04-24T14:30:00-03:00
-	-	assets/logo.png
12	8	src/core/utils/errors.ts
`

func TestParseGitLog_ExtractsCommits(t *testing.T) {
	commits, err := ParseGitLog(strings.NewReader(sampleGitLog))
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(commits) != 3 {
		t.Fatalf("expected 3 commits, got %d", len(commits))
	}
	if commits[0].Hash != "f9a234d" {
		t.Errorf("commit[0].Hash = %q, want f9a234d", commits[0].Hash)
	}
	if commits[1].Hash != "abc1234" {
		t.Errorf("commit[1].Hash = %q, want abc1234", commits[1].Hash)
	}
}

func TestParseGitLog_ParsesNumstat(t *testing.T) {
	commits, _ := ParseGitLog(strings.NewReader(sampleGitLog))
	c := commits[1] // abc1234 — onnx-embeddings
	if len(c.Changes) != 2 {
		t.Fatalf("expected 2 changes, got %d", len(c.Changes))
	}
	if c.Changes[0].Path != "src/core/rag/onnx-embeddings.ts" {
		t.Errorf("path = %q", c.Changes[0].Path)
	}
	if c.Changes[0].Added != 50 || c.Changes[0].Deleted != 5 {
		t.Errorf("added/deleted = %d/%d, want 50/5", c.Changes[0].Added, c.Changes[0].Deleted)
	}
}

func TestParseGitLog_FlagsBinaryFiles(t *testing.T) {
	commits, _ := ParseGitLog(strings.NewReader(sampleGitLog))
	c := commits[2] // def5678 — has logo.png binary
	if len(c.Changes) != 2 {
		t.Fatalf("expected 2 changes (binary kept with IsBinary), got %d", len(c.Changes))
	}
	bin := c.Changes[0]
	if bin.Path != "assets/logo.png" {
		t.Errorf("expected logo.png first, got %q", bin.Path)
	}
	if !bin.IsBinary {
		t.Error("expected IsBinary=true for logo.png")
	}
	if bin.Added != 0 || bin.Deleted != 0 {
		t.Errorf("binary added/deleted = %d/%d, want 0/0", bin.Added, bin.Deleted)
	}
}

func TestParseGitLog_HandlesEmptyInput(t *testing.T) {
	commits, err := ParseGitLog(strings.NewReader(""))
	if err != nil {
		t.Errorf("empty input should not error: %v", err)
	}
	if len(commits) != 0 {
		t.Errorf("empty input → %d commits, want 0", len(commits))
	}
}
