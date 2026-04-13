package reporter

import (
	"encoding/json"
	"feature-depth/scorer"
	"fmt"
	"os"
)

// WriteJSON outputs the report as formatted JSON.
func WriteJSON(report scorer.Report, outputPath string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal JSON: %w", err)
	}

	if outputPath == "" {
		_, err = os.Stdout.Write(data)
		fmt.Println()
		return err
	}

	return os.WriteFile(outputPath, data, 0644)
}
