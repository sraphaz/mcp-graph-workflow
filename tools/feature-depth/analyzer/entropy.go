package analyzer

import "math"

// EntropyResult holds Shannon Entropy metrics (Shannon, 1948).
// Measures dependency distribution balance using information theory.
type EntropyResult struct {
	ImportEntropy    float64 `json:"importEntropy"`
	ExportEntropy    float64 `json:"exportEntropy"`
	MaxImportEntropy float64 `json:"maxImportEntropy"`
	MaxExportEntropy float64 `json:"maxExportEntropy"`
	ImportBalance    float64 `json:"importBalance"` // H/Hmax (0-1)
	ExportBalance    float64 `json:"exportBalance"` // H/Hmax (0-1)
}

// AnalyzeEntropy computes Shannon entropy of import/export distributions.
// H = -Σ(p_i × log₂(p_i))
// Balance = H / Hmax where Hmax = log₂(n), n = unique dependencies.
// Low entropy = over-reliant on one dependency. High = balanced.
func AnalyzeEntropy(modName string, graph *ImportGraph) EntropyResult {
	node, ok := graph.Modules[modName]
	if !ok {
		return EntropyResult{}
	}

	// Import entropy: distribution of where this module's imports come from
	importH, importMax := computeEntropy(node.Efferent)

	// Export entropy: distribution of who consumes this module
	exportH, exportMax := computeEntropy(node.Afferent)

	importBalance := 0.0
	if importMax > 0 {
		importBalance = importH / importMax
	}

	exportBalance := 0.0
	if exportMax > 0 {
		exportBalance = exportH / exportMax
	}

	return EntropyResult{
		ImportEntropy:    importH,
		ExportEntropy:    exportH,
		MaxImportEntropy: importMax,
		MaxExportEntropy: exportMax,
		ImportBalance:    importBalance,
		ExportBalance:    exportBalance,
	}
}

// computeEntropy calculates Shannon entropy H and maximum entropy Hmax
// from a distribution map of counts.
func computeEntropy(distribution map[string]int) (H, Hmax float64) {
	if len(distribution) == 0 {
		return 0, 0
	}

	total := 0
	for _, count := range distribution {
		total += count
	}
	if total == 0 {
		return 0, 0
	}

	n := len(distribution)
	Hmax = math.Log2(float64(n))

	H = 0.0
	for _, count := range distribution {
		if count == 0 {
			continue
		}
		p := float64(count) / float64(total)
		H -= p * math.Log2(p)
	}

	return H, Hmax
}
