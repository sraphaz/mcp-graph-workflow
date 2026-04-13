package scanner

import (
	"bufio"
	"os"
	"strings"
)

// FileContent holds a file path and its content.
type FileContent struct {
	Path    string
	Content string
	LOC     int
}

// ReadFileContent reads a file and returns its content with LOC count.
func ReadFileContent(path string) (FileContent, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return FileContent{}, err
	}

	content := string(data)
	loc := countLOC(content)

	return FileContent{
		Path:    path,
		Content: content,
		LOC:     loc,
	}, nil
}

// ReadFilesContent reads multiple files and returns their content.
func ReadFilesContent(paths []string) []FileContent {
	var result []FileContent
	for _, p := range paths {
		fc, err := ReadFileContent(p)
		if err != nil {
			continue
		}
		result = append(result, fc)
	}
	return result
}

// countLOC counts non-blank, non-comment-only lines.
func countLOC(content string) int {
	scanner := bufio.NewScanner(strings.NewReader(content))
	count := 0
	inBlockComment := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if inBlockComment {
			if strings.Contains(line, "*/") {
				inBlockComment = false
			}
			continue
		}

		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "//") {
			continue
		}

		if strings.HasPrefix(line, "/*") {
			if !strings.Contains(line, "*/") {
				inBlockComment = true
			}
			continue
		}

		count++
	}
	return count
}

// TotalLOC sums the LOC of all FileContent entries.
func TotalLOC(files []FileContent) int {
	total := 0
	for _, f := range files {
		total += f.LOC
	}
	return total
}

// CombinedContent joins all file contents into one string.
func CombinedContent(files []FileContent) string {
	var sb strings.Builder
	for _, f := range files {
		sb.WriteString(f.Content)
		sb.WriteString("\n")
	}
	return sb.String()
}
