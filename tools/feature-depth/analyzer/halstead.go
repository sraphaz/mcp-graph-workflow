package analyzer

import (
	"math"
	"regexp"
	"unicode"
)

// HalsteadResult holds Halstead Software Science metrics (Halstead, 1977).
type HalsteadResult struct {
	DistinctOperators int     `json:"distinctOperators"` // n1
	DistinctOperands  int     `json:"distinctOperands"`  // n2
	TotalOperators    int     `json:"totalOperators"`    // N1
	TotalOperands     int     `json:"totalOperands"`     // N2
	Vocabulary        int     `json:"vocabulary"`        // n = n1 + n2
	Length            int     `json:"length"`            // N = N1 + N2
	Volume            float64 `json:"volume"`            // N × log₂(n)
	Difficulty        float64 `json:"difficulty"`        // (n1/2) × (N2/n2)
	Effort            float64 `json:"effort"`            // D × V
	TimeToUnderstand  float64 `json:"timeToUnderstandSec"` // E / 18
	BugsEstimate      float64 `json:"bugsEstimate"`      // V / 3000
}

var (
	blockCommentRe = regexp.MustCompile(`(?s)/\*.*?\*/`)
	lineCommentRe  = regexp.MustCompile(`//[^\n]*`)
	stringLitRe    = regexp.MustCompile(`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`)
	templateLitRe  = regexp.MustCompile("`[^`]*`")
	numberLitRe    = regexp.MustCompile(`\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b`)
)

// TypeScript keyword operators (control flow + type operators)
var keywordOperators = map[string]bool{
	"typeof": true, "instanceof": true, "new": true, "delete": true,
	"void": true, "in": true, "of": true, "return": true, "throw": true,
	"await": true, "yield": true, "async": true, "if": true, "else": true,
	"for": true, "while": true, "do": true, "switch": true, "case": true,
	"break": true, "continue": true, "try": true, "catch": true, "finally": true,
	"export": true, "import": true, "from": true, "as": true, "const": true,
	"let": true, "var": true, "function": true, "class": true, "extends": true,
	"implements": true, "interface": true, "type": true, "enum": true,
}

// Multi-char operators (ordered longest first for correct matching)
var multiCharOps = []string{
	"===", "!==", "=>", "??", "?.", "&&", "||", ">=", "<=", "==", "!=",
	"**", "+=", "-=", "*=", "/=", "++", "--", "...",
}

// Single-char operators
var singleCharOps = map[byte]bool{
	'+': true, '-': true, '*': true, '/': true, '%': true, '=': true,
	'<': true, '>': true, '!': true, '?': true, ':': true, '.': true,
	',': true, ';': true, '(': true, ')': true, '{': true, '}': true,
	'[': true, ']': true, '&': true, '|': true, '~': true, '^': true,
}

// AnalyzeHalstead computes Halstead Software Science metrics.
// V = N × log₂(n), D = (n1/2) × (N2/n2), E = D × V, T = E/18
func AnalyzeHalstead(content string) HalsteadResult {
	// Strip comments and strings
	cleaned := blockCommentRe.ReplaceAllString(content, " ")
	cleaned = lineCommentRe.ReplaceAllString(cleaned, " ")
	cleaned = templateLitRe.ReplaceAllString(cleaned, " __STR__ ")
	cleaned = stringLitRe.ReplaceAllString(cleaned, " __STR__ ")

	operators := make(map[string]int)
	operands := make(map[string]int)

	// Extract number literals as operands first
	numbers := numberLitRe.FindAllString(cleaned, -1)
	for _, num := range numbers {
		operands[num]++
	}
	cleaned = numberLitRe.ReplaceAllString(cleaned, " ")

	// Tokenize
	i := 0
	for i < len(cleaned) {
		// Skip whitespace
		if unicode.IsSpace(rune(cleaned[i])) {
			i++
			continue
		}

		// Check multi-char operators
		matched := false
		for _, op := range multiCharOps {
			if i+len(op) <= len(cleaned) && cleaned[i:i+len(op)] == op {
				operators[op]++
				i += len(op)
				matched = true
				break
			}
		}
		if matched {
			continue
		}

		// Check single-char operators
		if singleCharOps[cleaned[i]] {
			operators[string(cleaned[i])]++
			i++
			continue
		}

		// Identifier or keyword
		if isIdentStart(cleaned[i]) {
			j := i + 1
			for j < len(cleaned) && isIdentChar(cleaned[j]) {
				j++
			}
			word := cleaned[i:j]
			if keywordOperators[word] {
				operators[word]++
			} else if word == "true" || word == "false" || word == "null" || word == "undefined" || word == "__STR__" {
				operands[word]++
			} else {
				operands[word]++
			}
			i = j
			continue
		}

		i++
	}

	n1 := len(operators)
	n2 := len(operands)
	N1 := sumValues(operators)
	N2 := sumValues(operands)

	n := n1 + n2
	N := N1 + N2

	volume := 0.0
	if n > 0 {
		volume = float64(N) * math.Log2(float64(n))
	}

	difficulty := 0.0
	if n2 > 0 {
		difficulty = (float64(n1) / 2.0) * (float64(N2) / float64(n2))
	}

	effort := difficulty * volume
	timeToUnderstand := effort / 18.0
	bugs := volume / 3000.0

	return HalsteadResult{
		DistinctOperators: n1,
		DistinctOperands:  n2,
		TotalOperators:    N1,
		TotalOperands:     N2,
		Vocabulary:        n,
		Length:            N,
		Volume:            volume,
		Difficulty:        difficulty,
		Effort:            effort,
		TimeToUnderstand:  timeToUnderstand,
		BugsEstimate:      bugs,
	}
}

func isIdentStart(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || b == '_' || b == '$'
}

func isIdentChar(b byte) bool {
	return isIdentStart(b) || (b >= '0' && b <= '9')
}

func sumValues(m map[string]int) int {
	total := 0
	for _, v := range m {
		total += v
	}
	return total
}

