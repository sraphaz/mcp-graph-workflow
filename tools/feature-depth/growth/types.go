package growth

import "time"

// Commit is a single git commit with the per-file LOC deltas it carried.
//
// Filled by parser.go from `git log --numstat --pretty=format:%H|%aI`.
type Commit struct {
	Hash    string
	Author  time.Time
	Changes []FileChange
}

// FileChange is a single +/- pair for one path within a commit.
//
// Binary files (numstat reports `-\t-\t<path>`) get Added=0, Deleted=0
// and IsBinary=true so they can be filtered without losing the path.
type FileChange struct {
	Path     string
	Added    int
	Deleted  int
	IsBinary bool
}

// FileKind classifies a path for per-kind LOC aggregates.
//
// Source = production .ts/.tsx outside src/tests, dist, node_modules.
// Test   = .test.ts / .spec.ts (any location).
// Docs   = .md / docs/.
// Other  = everything else (configs, JSON, .go in tools/, etc).
type FileKind int

const (
	KindOther FileKind = iota
	KindSource
	KindTest
	KindDocs
)

func (k FileKind) String() string {
	switch k {
	case KindSource:
		return "source"
	case KindTest:
		return "test"
	case KindDocs:
		return "docs"
	default:
		return "other"
	}
}

// WeekBucket holds end-of-week cumulative LOC and per-week net delta.
//
// `WeekStart` is the Monday 00:00 UTC of the bucket. `CumulativeNet`
// is the running sum of (added - deleted) across all kinds up to that
// week. `NetByKind` is the delta per kind for THAT week alone.
type WeekBucket struct {
	WeekStart     time.Time
	NetByKind     map[FileKind]int
	CumulativeNet int // net LOC of repo at end of this week
	Commits       int
}

// ModuleGrowth tracks net LOC per src/core/<module> over the project.
type ModuleGrowth struct {
	Module   string
	NetLOC   int // sum of source net deltas (added - deleted)
	Commits  int // commits that touched this module
	FirstSeen time.Time
	LastSeen  time.Time
}

// FileHotspot is a per-file aggregate — surfaces files that churn a lot.
type FileHotspot struct {
	Path     string
	Module   string // src/core/<X>; empty for non-core
	Kind     FileKind
	NetLOC   int
	Touches  int // commits that modified this file
	LastSeen time.Time
}

// Report is the JSON-serializable shape of a growth-mode run.
type Report struct {
	Tool         string         `json:"tool"`
	Mode         string         `json:"mode"`
	GeneratedAt  time.Time      `json:"generatedAt"`
	FirstCommit  time.Time      `json:"firstCommit"`
	LastCommit   time.Time      `json:"lastCommit"`
	TotalCommits int            `json:"totalCommits"`
	NetLOC       int            `json:"netLoc"`     // current size = sum of all (added-deleted)
	NetByKind    map[string]int `json:"netByKind"`  // "source", "test", "docs", "other"
	TestRatio    float64        `json:"testRatio"`  // testNet / sourceNet (0 if sourceNet <= 0)
	Weeks        []WeekBucket   `json:"weeks"`
	Modules      []ModuleGrowth `json:"modules"`
	TopHotspots  []FileHotspot  `json:"topHotspots"`
}
