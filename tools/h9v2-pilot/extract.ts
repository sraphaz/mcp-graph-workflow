/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Extract files from an LLM response containing fenced code blocks preceded by
 * a filename. Tolerant to common formatting variations.
 */

export interface ExtractedFile {
  path: string;
  content: string;
}

const FENCE_RE = /^```(?:ts|typescript|js|javascript)?\s*\n([\s\S]*?)\n```/gm;
const FILENAME_LINE_RE = /^([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx))\s*:?\s*$/m;

/**
 * Parse an LLM response into files. Looks for patterns like:
 *
 *   calibration.ts
 *   ```ts
 *   export const x = 1;
 *   ```
 *
 * Also handles markdown-header style "## calibration.ts" and prose preambles.
 */
export function extractFiles(response: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const lines = response.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if this line mentions a filename
    const filenameMatch = extractFilename(line);
    if (filenameMatch) {
      // Look ahead for a fenced code block in the next few lines
      let j = i + 1;
      while (j < lines.length && j < i + 5 && !lines[j].startsWith("```")) j++;
      if (j < lines.length && lines[j].startsWith("```")) {
        // Collect content until closing fence
        const body: string[] = [];
        let k = j + 1;
        while (k < lines.length && !lines[k].startsWith("```")) {
          body.push(lines[k]);
          k++;
        }
        files.push({ path: filenameMatch, content: body.join("\n") });
        i = k + 1;
        continue;
      }
    }
    i++;
  }

  // Fallback: if no filename-prefixed blocks found, treat each code fence as an
  // unnamed file. If the first line inside the fence looks like a filename,
  // peel it off and use that as path. Otherwise name it "file-N.ts".
  if (files.length === 0) {
    let idx = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(FENCE_RE.source, "gm");
    while ((match = re.exec(response)) !== null) {
      idx++;
      const content = match[1];
      const firstLine = content.split(/\r?\n/)[0].trim();
      const fileLike = firstLine.match(/^([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx))\s*:?\s*$/);
      if (fileLike) {
        files.push({
          path: fileLike[1],
          content: content.split(/\r?\n/).slice(1).join("\n"),
        });
      } else {
        files.push({ path: `file-${idx}.ts`, content });
      }
    }
  }

  // Second pass: also check already-extracted files for filename-as-first-line
  // pattern (happens when the MAIN loop caught a fence but the filename was
  // inside it instead of on the line above).
  for (const f of files) {
    const firstLine = f.content.split(/\r?\n/)[0].trim();
    const fileLike = firstLine.match(/^([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx))\s*:?\s*$/);
    if (fileLike && f.path.startsWith("file-") && fileLike[1] !== f.path) {
      f.path = fileLike[1];
      f.content = f.content.split(/\r?\n/).slice(1).join("\n");
    }
  }

  return files;
}

function extractFilename(line: string): string | null {
  const trimmed = line.trim();
  // Markdown header
  const header = trimmed.match(/^#+\s+([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx))\s*:?\s*$/);
  if (header) return header[1];
  // Bare filename line
  const bare = trimmed.match(FILENAME_LINE_RE);
  if (bare) return bare[1];
  // Bold / file: prefix
  const filePrefix = trimmed.match(/^(?:\*\*)?[Ff]ile:\s+([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx))/);
  if (filePrefix) return filePrefix[1];
  return null;
}

/**
 * When a subtask is expected to REPLACE the file content (each iteration emits
 * full file), pick the last version of each filename.
 */
export function latestPerPath(files: ExtractedFile[]): ExtractedFile[] {
  const map = new Map<string, ExtractedFile>();
  for (const f of files) map.set(f.path, f);
  return [...map.values()];
}
