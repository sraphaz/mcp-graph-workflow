package growth

import (
	"sort"
	"strings"
	"time"
)

// ClassifyPath assigns a FileKind to a repo-relative path. Order
// matters: test detection happens before source detection so a
// `*.test.ts` under `src/core/` is counted as a test, not as source.
func ClassifyPath(path string) FileKind {
	if isExcludedDir(path) {
		return KindOther
	}
	switch {
	case strings.HasSuffix(path, ".test.ts"),
		strings.HasSuffix(path, ".spec.ts"),
		strings.HasSuffix(path, ".test.tsx"),
		strings.HasSuffix(path, ".spec.tsx"):
		return KindTest
	case strings.HasSuffix(path, ".ts"),
		strings.HasSuffix(path, ".tsx"):
		// Production TS under src/ (excluding dashboard build output).
		if strings.HasPrefix(path, "src/") && !strings.HasSuffix(path, ".d.ts") {
			return KindSource
		}
		return KindOther
	case strings.HasSuffix(path, ".md"):
		return KindDocs
	}
	return KindOther
}

func isExcludedDir(path string) bool {
	return strings.HasPrefix(path, "node_modules/") ||
		strings.Contains(path, "/node_modules/") ||
		strings.HasPrefix(path, "dist/") ||
		strings.Contains(path, "/dist/")
}

// ExtractCoreModule returns the immediate child directory under
// `src/core/` for paths like `src/core/<X>/...`. Returns "" for paths
// outside `src/core/`.
func ExtractCoreModule(path string) string {
	const prefix = "src/core/"
	if !strings.HasPrefix(path, prefix) {
		return ""
	}
	rest := path[len(prefix):]
	slash := strings.IndexByte(rest, '/')
	if slash < 0 {
		// File directly under src/core/, no module — skip.
		return ""
	}
	return rest[:slash]
}

// weekStart returns the Monday 00:00 UTC of the ISO week containing t.
func weekStart(t time.Time) time.Time {
	utc := t.UTC()
	// Go's Weekday: Sunday=0..Saturday=6. We want Monday-start.
	weekday := int(utc.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	delta := weekday - 1
	d := utc.AddDate(0, 0, -delta)
	return time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
}

// Aggregate folds a chronologically-ordered list of commits into a
// Report with per-week buckets, per-module rollups, and top hotspots.
//
// `commits` may arrive in either chronological order. Aggregate sorts
// internally by author time ascending so the cumulative LOC series is
// monotonic in time even if the caller forgot.
func Aggregate(commits []Commit) Report {
	sorted := make([]Commit, len(commits))
	copy(sorted, commits)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Author.Before(sorted[j].Author) })

	netByKind := map[FileKind]int{}
	totalNet := 0
	weekIndex := map[time.Time]*WeekBucket{}
	moduleIndex := map[string]*ModuleGrowth{}
	hotspotIndex := map[string]*FileHotspot{}

	for _, c := range sorted {
		ws := weekStart(c.Author)
		wb, ok := weekIndex[ws]
		if !ok {
			wb = &WeekBucket{WeekStart: ws, NetByKind: map[FileKind]int{}}
			weekIndex[ws] = wb
		}
		wb.Commits++

		for _, ch := range c.Changes {
			if ch.IsBinary {
				continue
			}
			net := ch.Added - ch.Deleted
			kind := ClassifyPath(ch.Path)
			netByKind[kind] += net
			totalNet += net
			wb.NetByKind[kind] += net

			// Module rollup — only source counts. Test/docs/other are
			// reported via NetByKind, not under module breakdowns.
			if kind == KindSource {
				if mod := ExtractCoreModule(ch.Path); mod != "" {
					mg, ok := moduleIndex[mod]
					if !ok {
						mg = &ModuleGrowth{Module: mod, FirstSeen: c.Author}
						moduleIndex[mod] = mg
					}
					mg.NetLOC += net
					mg.Commits++
					mg.LastSeen = c.Author
				}
			}

			// Hotspots — track every file regardless of kind so heavy
			// churn anywhere is visible.
			h, ok := hotspotIndex[ch.Path]
			if !ok {
				h = &FileHotspot{
					Path:   ch.Path,
					Module: ExtractCoreModule(ch.Path),
					Kind:   kind,
				}
				hotspotIndex[ch.Path] = h
			}
			h.NetLOC += net
			h.Touches++
			h.LastSeen = c.Author
		}
	}

	// Cumulative running total per week.
	weekStarts := make([]time.Time, 0, len(weekIndex))
	for ws := range weekIndex {
		weekStarts = append(weekStarts, ws)
	}
	sort.Slice(weekStarts, func(i, j int) bool { return weekStarts[i].Before(weekStarts[j]) })

	weeks := make([]WeekBucket, 0, len(weekStarts))
	cumulative := 0
	for _, ws := range weekStarts {
		wb := weekIndex[ws]
		weekNet := 0
		for _, v := range wb.NetByKind {
			weekNet += v
		}
		cumulative += weekNet
		wb.CumulativeNet = cumulative
		weeks = append(weeks, *wb)
	}

	modules := make([]ModuleGrowth, 0, len(moduleIndex))
	for _, m := range moduleIndex {
		modules = append(modules, *m)
	}
	sort.Slice(modules, func(i, j int) bool { return modules[i].NetLOC > modules[j].NetLOC })

	hotspots := make([]FileHotspot, 0, len(hotspotIndex))
	for _, h := range hotspotIndex {
		hotspots = append(hotspots, *h)
	}
	// Sort by Touches desc, tiebreak by NetLOC desc — files that change
	// often are hotter than files that grew once and stopped.
	sort.Slice(hotspots, func(i, j int) bool {
		if hotspots[i].Touches != hotspots[j].Touches {
			return hotspots[i].Touches > hotspots[j].Touches
		}
		return hotspots[i].NetLOC > hotspots[j].NetLOC
	})
	if len(hotspots) > 25 {
		hotspots = hotspots[:25]
	}

	netByKindStr := map[string]int{}
	for k, v := range netByKind {
		netByKindStr[k.String()] = v
	}

	testRatio := 0.0
	if src := netByKind[KindSource]; src > 0 {
		testRatio = float64(netByKind[KindTest]) / float64(src)
	}

	first, last := time.Time{}, time.Time{}
	if len(sorted) > 0 {
		first = sorted[0].Author
		last = sorted[len(sorted)-1].Author
	}

	return Report{
		Tool:         "feature-depth-analyzer",
		Mode:         "growth",
		GeneratedAt:  time.Now().UTC(),
		FirstCommit:  first,
		LastCommit:   last,
		TotalCommits: len(sorted),
		NetLOC:       totalNet,
		NetByKind:    netByKindStr,
		TestRatio:    testRatio,
		Weeks:        weeks,
		Modules:      modules,
		TopHotspots:  hotspots,
	}
}
