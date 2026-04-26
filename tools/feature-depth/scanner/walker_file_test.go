package scanner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// makeFixture builds a minimal core/ tree under a temp dir for file-level discovery tests.
func makeFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	files := map[string]string{
		"src/core/rag/entity-store.ts":          "export const x = 1;\n",
		"src/core/rag/embedding-generator.ts":   "export const y = 2;\n",
		"src/core/rag/types.d.ts":               "export type A = string;\n",
		"src/core/handoff/handoff.ts":           "export const h = 3;\n",
		"src/core/handoff/handoff.test.ts":      "test('h', () => {});\n",
		"src/core/handoff/node_modules/x.ts":    "should be ignored\n",
		"src/core/parser/dist/parser.ts":        "should be ignored\n",
		"src/core/parser/parser.ts":             "export const p = 4;\n",
		"src/core/parser/parser.spec.ts":        "test('p', () => {});\n",
	}
	for rel, body := range files {
		full := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatalf("write fixture: %v", err)
		}
	}
	return root
}

func TestDiscoverFiles_ReturnsSourceFilesOnly(t *testing.T) {
	root := makeFixture(t)
	files, err := DiscoverFiles(root, "src/core", "")
	if err != nil {
		t.Fatalf("DiscoverFiles error: %v", err)
	}
	if len(files) != 4 {
		t.Fatalf("expected 4 source files (.ts non-test, non-d.ts, non-dist, non-node_modules), got %d: %v", len(files), pathsOf(files))
	}
	for _, f := range files {
		if strings.HasSuffix(f.Path, ".test.ts") || strings.HasSuffix(f.Path, ".spec.ts") {
			t.Errorf("test file leaked into source list: %s", f.Path)
		}
		if strings.HasSuffix(f.Path, ".d.ts") {
			t.Errorf("declaration file leaked: %s", f.Path)
		}
		if strings.Contains(f.Path, "node_modules") || strings.Contains(f.Path, "/dist/") {
			t.Errorf("excluded dir leaked: %s", f.Path)
		}
	}
}

func TestDiscoverFiles_PopulatesModule(t *testing.T) {
	root := makeFixture(t)
	files, _ := DiscoverFiles(root, "src/core", "")
	moduleByRel := map[string]string{}
	for _, f := range files {
		moduleByRel[f.RelPath] = f.Module
	}
	cases := map[string]string{
		"src/core/rag/entity-store.ts":        "rag",
		"src/core/rag/embedding-generator.ts": "rag",
		"src/core/handoff/handoff.ts":         "handoff",
		"src/core/parser/parser.ts":           "parser",
	}
	for rel, want := range cases {
		got, ok := moduleByRel[rel]
		if !ok {
			t.Errorf("expected file %q in result, missing", rel)
			continue
		}
		if got != want {
			t.Errorf("file %q: module = %q, want %q", rel, got, want)
		}
	}
}

func TestDiscoverFiles_AssociatesAdjacentTestFile(t *testing.T) {
	root := makeFixture(t)
	files, _ := DiscoverFiles(root, "src/core", "")
	byRel := map[string]File{}
	for _, f := range files {
		byRel[f.RelPath] = f
	}

	// handoff.ts has handoff.test.ts adjacent → must associate
	h := byRel["src/core/handoff/handoff.ts"]
	if h.TestPath == "" {
		t.Errorf("handoff.ts: TestPath empty, expected adjacent .test.ts")
	}
	if !strings.HasSuffix(h.TestPath, "handoff.test.ts") {
		t.Errorf("handoff.ts: TestPath = %q, want suffix handoff.test.ts", h.TestPath)
	}
	if h.TestLOC == 0 {
		t.Errorf("handoff.ts: TestLOC = 0, expected > 0")
	}

	// parser.ts has parser.spec.ts adjacent → must associate
	p := byRel["src/core/parser/parser.ts"]
	if p.TestPath == "" {
		t.Errorf("parser.ts: TestPath empty, expected adjacent .spec.ts")
	}

	// entity-store.ts has no adjacent test → TestPath empty, TestLOC 0
	e := byRel["src/core/rag/entity-store.ts"]
	if e.TestPath != "" {
		t.Errorf("entity-store.ts: TestPath = %q, want empty", e.TestPath)
	}
	if e.TestLOC != 0 {
		t.Errorf("entity-store.ts: TestLOC = %d, want 0", e.TestLOC)
	}
}

func TestDiscoverFiles_PopulatesContentAndLOC(t *testing.T) {
	root := makeFixture(t)
	files, _ := DiscoverFiles(root, "src/core", "")
	for _, f := range files {
		if f.Content == "" {
			t.Errorf("file %q: empty content", f.RelPath)
		}
		if f.LOC <= 0 {
			t.Errorf("file %q: LOC = %d, want > 0", f.RelPath, f.LOC)
		}
	}
}

func TestDiscoverFiles_ErrorOnMissingCorePath(t *testing.T) {
	root := t.TempDir()
	_, err := DiscoverFiles(root, "nonexistent", "")
	if err == nil {
		t.Error("expected error for missing corePath, got nil")
	}
}

// makeRepoLayoutFixture mimics this project's structure: tests live in
// src/tests/ (NOT colocated with source). This is the layout the
// global test→source map exists to support.
func makeRepoLayoutFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	files := map[string]string{
		"src/core/rag/onnx-embeddings.ts":     "export function isOnnxAvailable() {}\n",
		"src/core/rag/embedding-generator.ts": "export class HashEmbeddingProvider {}\n",
		"src/core/utils/errors.ts":            "export class McpGraphError extends Error {}\n",
		// Global tests under src/tests/ — import the source via relative path
		"src/tests/onnx-embeddings.test.ts": "import { isOnnxAvailable } from '../core/rag/onnx-embeddings.js';\n" +
			"test('a', () => {});\ntest('b', () => {});\n",
		"src/tests/errors.test.ts": "import { McpGraphError } from '../core/utils/errors.js';\n" +
			"test('e', () => {});\n",
		// Nested test path imports two-up
		"src/tests/integration/embed.test.ts": "import { HashEmbeddingProvider } from '../../core/rag/embedding-generator.js';\n" +
			"test('h', () => {});\n",
	}
	for rel, body := range files {
		full := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatalf("write fixture: %v", err)
		}
	}
	return root
}

func TestDiscoverFiles_AssociatesGlobalTestPath(t *testing.T) {
	root := makeRepoLayoutFixture(t)
	files, err := DiscoverFiles(root, "src/core", "src/tests")
	if err != nil {
		t.Fatalf("DiscoverFiles error: %v", err)
	}
	byRel := map[string]File{}
	for _, f := range files {
		byRel[f.RelPath] = f
	}

	cases := []struct {
		src        string
		wantSuffix string
	}{
		{"src/core/rag/onnx-embeddings.ts", "onnx-embeddings.test.ts"},
		{"src/core/utils/errors.ts", "errors.test.ts"},
		{"src/core/rag/embedding-generator.ts", "embed.test.ts"},
	}
	for _, c := range cases {
		f, ok := byRel[c.src]
		if !ok {
			t.Errorf("%s: not in result", c.src)
			continue
		}
		if f.TestPath == "" {
			t.Errorf("%s: TestPath empty, expected match for %s", c.src, c.wantSuffix)
			continue
		}
		if !strings.HasSuffix(f.TestPath, c.wantSuffix) {
			t.Errorf("%s: TestPath = %s, want suffix %s", c.src, f.TestPath, c.wantSuffix)
		}
		if f.TestLOC == 0 {
			t.Errorf("%s: TestLOC = 0, want > 0", c.src)
		}
	}
}

func TestDiscoverFiles_BasenameMatchBeatsFirstImport(t *testing.T) {
	// Common pitfall: a test for `entity-store.ts` that imports its
	// errors helper FIRST (alphabetical-import lint) would, under
	// "first-import-wins", get attributed to errors.ts. The basename
	// match must override that — `entity-store.test.ts` belongs to
	// `entity-store.ts`, not to whatever it imports first.
	root := t.TempDir()
	files := map[string]string{
		"src/core/rag/entity-store.ts":          "export class EntityStore {}\n",
		"src/core/utils/errors.ts":              "export class FooError extends Error {}\n",
		"src/tests/entity-store.test.ts": "" +
			// alphabetical: errors imported BEFORE entity-store
			"import { FooError } from '../core/utils/errors.js';\n" +
			"import { EntityStore } from '../core/rag/entity-store.js';\n" +
			"test('e1', () => {});\ntest('e2', () => {});\n",
	}
	for rel, body := range files {
		full := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		_ = os.WriteFile(full, []byte(body), 0o644)
	}

	result, err := DiscoverFiles(root, "src/core", "src/tests")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	byRel := map[string]File{}
	for _, f := range result {
		byRel[f.RelPath] = f
	}

	es := byRel["src/core/rag/entity-store.ts"]
	if !strings.HasSuffix(es.TestPath, "entity-store.test.ts") {
		t.Errorf("entity-store.ts: TestPath = %s, want entity-store.test.ts", es.TestPath)
	}

	// errors.ts must NOT have stolen the entity-store test
	er := byRel["src/core/utils/errors.ts"]
	if er.TestPath != "" {
		t.Errorf("errors.ts: TestPath = %s, want empty (test belongs to entity-store)", er.TestPath)
	}
}

func TestDiscoverFiles_FallsBackToFirstImportWhenNoBasenameMatch(t *testing.T) {
	// Test file basename does not match any imported source basename.
	// Fall back to first-import-wins so the test isn't orphaned.
	root := t.TempDir()
	files := map[string]string{
		"src/core/rag/entity-store.ts":  "export class EntityStore {}\n",
		"src/tests/integration-suite.test.ts": "" +
			"import { EntityStore } from '../core/rag/entity-store.js';\n" +
			"test('i', () => {});\n",
	}
	for rel, body := range files {
		full := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		_ = os.WriteFile(full, []byte(body), 0o644)
	}
	result, _ := DiscoverFiles(root, "src/core", "src/tests")
	if len(result) != 1 {
		t.Fatalf("expected 1, got %d", len(result))
	}
	if !strings.HasSuffix(result[0].TestPath, "integration-suite.test.ts") {
		t.Errorf("expected first-import fallback to attribute integration-suite to entity-store, got %s", result[0].TestPath)
	}
}

func TestDiscoverFiles_GlobalMapDoesNotOverrideAdjacent(t *testing.T) {
	// When both adjacent and global tests exist, adjacent wins
	// (closer to the code, more likely the canonical test).
	root := t.TempDir()
	files := map[string]string{
		"src/core/x/foo.ts":          "export const f = 1;\n",
		"src/core/x/foo.test.ts":     "test('adjacent', () => {});\n", // adjacent
		"src/tests/foo.test.ts":      "import { f } from '../core/x/foo.js';\ntest('global', () => {});\n",
	}
	for rel, body := range files {
		full := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(full), 0o755)
		_ = os.WriteFile(full, []byte(body), 0o644)
	}

	result, err := DiscoverFiles(root, "src/core", "src/tests")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 source file, got %d", len(result))
	}
	if !strings.HasSuffix(result[0].TestPath, filepath.Join("x", "foo.test.ts")) {
		t.Errorf("expected adjacent test to win, got TestPath = %s", result[0].TestPath)
	}
}

func pathsOf(fs []File) []string {
	ps := make([]string, 0, len(fs))
	for _, f := range fs {
		ps = append(ps, f.RelPath)
	}
	return ps
}
