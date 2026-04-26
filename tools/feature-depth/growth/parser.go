package growth

import (
	"bufio"
	"io"
	"strconv"
	"strings"
	"time"
)

// ParseGitLog reads the output of
//
//	git log --numstat --pretty=format:%H|%aI
//
// and returns the parsed commits. The format is:
//
//	<sha>|<RFC3339-author-date>
//	<added>\t<deleted>\t<path>
//	<added>\t<deleted>\t<path>
//	<blank line>
//	<sha>|...
//
// Binary files appear as `-\t-\t<path>` and are kept with IsBinary=true.
//
// Empty input yields zero commits without error. Malformed lines are
// skipped silently (git log output evolves; we'd rather miss a row than
// crash in CI).
func ParseGitLog(r io.Reader) ([]Commit, error) {
	scanner := bufio.NewScanner(r)
	// `git log` lines can be very long with high-churn paths; bump the
	// scanner buffer beyond the 64KB default.
	scanner.Buffer(make([]byte, 1024*1024), 16*1024*1024)

	var commits []Commit
	var current *Commit

	flush := func() {
		if current != nil {
			commits = append(commits, *current)
			current = nil
		}
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		if pipe := strings.IndexByte(line, '|'); pipe > 0 && !strings.Contains(line, "\t") {
			flush()
			ts, err := time.Parse(time.RFC3339, line[pipe+1:])
			if err != nil {
				continue
			}
			current = &Commit{Hash: line[:pipe], Author: ts}
			continue
		}
		if current == nil {
			continue
		}
		fc, ok := parseNumstatLine(line)
		if !ok {
			continue
		}
		current.Changes = append(current.Changes, fc)
	}
	flush()

	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return commits, nil
}

func parseNumstatLine(line string) (FileChange, bool) {
	parts := strings.SplitN(line, "\t", 3)
	if len(parts) != 3 {
		return FileChange{}, false
	}
	path := parts[2]
	if path == "" {
		return FileChange{}, false
	}
	if parts[0] == "-" || parts[1] == "-" {
		return FileChange{Path: path, IsBinary: true}, true
	}
	added, err1 := strconv.Atoi(parts[0])
	deleted, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return FileChange{}, false
	}
	return FileChange{Path: path, Added: added, Deleted: deleted}, true
}
