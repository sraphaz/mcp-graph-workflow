package analyzer

// DepGraphResult holds graph-theoretical metrics for a module.
type DepGraphResult struct {
	CycleCount        int        `json:"cycleCount"`
	CyclesInvolved    [][]string `json:"cyclesInvolved"`
	FanIn             int        `json:"fanIn"`
	FanOut            int        `json:"fanOut"`
	FanRatio          float64    `json:"fanInOutRatio"`
	BidirectionalDeps int        `json:"bidirectionalDeps"`
	GraphCentrality   float64    `json:"graphCentrality"`
}

// AnalyzeDepGraph computes graph-theoretical metrics for a module.
func AnalyzeDepGraph(modName string, graph *ImportGraph, sccs [][]string, betweenness map[string]float64) DepGraphResult {
	node, ok := graph.Modules[modName]
	if !ok {
		return DepGraphResult{}
	}

	fanIn := len(node.Afferent)
	fanOut := len(node.Efferent)

	fanRatio := 0.0
	if fanOut > 0 {
		fanRatio = float64(fanIn) / float64(fanOut)
	} else if fanIn > 0 {
		fanRatio = float64(fanIn) // infinite ratio, cap at fanIn
	}

	// Count cycles involving this module
	var involvedCycles [][]string
	for _, scc := range sccs {
		for _, member := range scc {
			if member == modName {
				involvedCycles = append(involvedCycles, scc)
				break
			}
		}
	}

	// Count bidirectional dependencies
	bidir := 0
	for dep := range node.Efferent {
		if _, ok := node.Afferent[dep]; ok {
			bidir++
		}
	}

	centrality := 0.0
	if bc, ok := betweenness[modName]; ok {
		centrality = bc
	}

	return DepGraphResult{
		CycleCount:        len(involvedCycles),
		CyclesInvolved:    involvedCycles,
		FanIn:             fanIn,
		FanOut:            fanOut,
		FanRatio:          fanRatio,
		BidirectionalDeps: bidir,
		GraphCentrality:   centrality,
	}
}

// FindSCCs finds all strongly connected components using Tarjan's algorithm.
// Returns only SCCs with size > 1 (actual cycles).
func FindSCCs(graph *ImportGraph) [][]string {
	index := 0
	stack := make([]string, 0)
	onStack := make(map[string]bool)
	indices := make(map[string]int)
	lowlinks := make(map[string]int)
	var sccs [][]string

	var strongConnect func(v string)
	strongConnect = func(v string) {
		indices[v] = index
		lowlinks[v] = index
		index++
		stack = append(stack, v)
		onStack[v] = true

		// Consider successors
		for w := range graph.Edges[v] {
			if _, visited := indices[w]; !visited {
				strongConnect(w)
				if lowlinks[w] < lowlinks[v] {
					lowlinks[v] = lowlinks[w]
				}
			} else if onStack[w] {
				if indices[w] < lowlinks[v] {
					lowlinks[v] = indices[w]
				}
			}
		}

		// If v is a root node, pop the SCC
		if lowlinks[v] == indices[v] {
			var scc []string
			for {
				w := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				onStack[w] = false
				scc = append(scc, w)
				if w == v {
					break
				}
			}
			if len(scc) > 1 {
				sccs = append(sccs, scc)
			}
		}
	}

	for modName := range graph.Modules {
		if _, visited := indices[modName]; !visited {
			strongConnect(modName)
		}
	}

	return sccs
}

// ComputeBetweenness computes approximate betweenness centrality via BFS.
// For each pair (s,t), counts if shortest path from s to t passes through v.
func ComputeBetweenness(graph *ImportGraph) map[string]float64 {
	modules := graph.AllModuleNames()
	centrality := make(map[string]float64)

	for _, mod := range modules {
		centrality[mod] = 0
	}

	for _, source := range modules {
		// BFS from source
		dist := make(map[string]int)
		paths := make(map[string]int)    // number of shortest paths
		pred := make(map[string][]string) // predecessors on shortest paths

		dist[source] = 0
		paths[source] = 1
		queue := []string{source}
		var order []string

		for len(queue) > 0 {
			v := queue[0]
			queue = queue[1:]
			order = append(order, v)

			for w := range graph.Edges[v] {
				if _, seen := dist[w]; !seen {
					dist[w] = dist[v] + 1
					queue = append(queue, w)
				}
				if dist[w] == dist[v]+1 {
					paths[w] += paths[v]
					pred[w] = append(pred[w], v)
				}
			}
		}

		// Back-propagation of dependencies
		delta := make(map[string]float64)
		for i := len(order) - 1; i >= 0; i-- {
			w := order[i]
			for _, v := range pred[w] {
				if paths[w] > 0 {
					delta[v] += (float64(paths[v]) / float64(paths[w])) * (1.0 + delta[w])
				}
			}
			if w != source {
				centrality[w] += delta[w]
			}
		}
	}

	// Normalize by (n-1)(n-2)/2 for undirected approximation
	n := float64(len(modules))
	if n > 2 {
		norm := (n - 1) * (n - 2) / 2.0
		for k := range centrality {
			centrality[k] /= norm
		}
	}

	return centrality
}
