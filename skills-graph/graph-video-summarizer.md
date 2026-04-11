---
name: graph-video-summarizer
description: Auto-summarize long videos with text highlights, visual chapters, and structured export
triggers:
  - graph-video-summarizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-summarizer

Auto-summarizes long video recordings into concise text summaries, visual highlights, and chapter markers. Produces structured summaries suitable for graph persistence, sprint reviews, stakeholder reports, and knowledge store enrichment via RAG indexing.

## When to Use

- When long meeting recordings or demo videos need concise summaries for stakeholders
- When you need chapter-based navigation markers for a video longer than 10 minutes
- When preparing sprint review artifacts that reference video content
- When extracting key decisions, highlights, and takeaways from recorded sessions
- When building a searchable video knowledge base with summary-level indexing
- When reducing cognitive load by providing text-first summaries before watching full video

## Mandatory Flow

```
rag_context → [video summarization pipeline] → analyze → export → write_memory
```

## Workflow

### Step 1: Load Existing Context

Retrieve knowledge related to the video topic, participants, or project area to inform summary generation with domain-specific understanding.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<task-node-id>", includeKnowledge: true, includeHistory: true })
```

### Step 2: Generate Transcript Base

If a transcript does not already exist, generate one using the transcription pipeline. The summary depends on a high-quality timestamped transcript as its primary input.

Reference the `graph-video-transcriber` skill for full transcription workflow.

### Step 3: Detect Chapter Boundaries

Identify natural topic transitions throughout the video:

- **Topic modeling**: Cluster transcript segments by semantic similarity
- **Visual cues**: Detect slide changes, screen transitions, and presenter switches
- **Audio cues**: Identify significant pauses, music, or tone shifts
- **Keyword density**: Track keyword frequency shifts that indicate topic changes

Produce a chapter list with start/end timestamps and proposed chapter titles.

### Step 4: Generate Layered Summaries

Create summaries at multiple granularity levels:

- **Executive summary**: 2-3 sentences covering the entire video
- **Chapter summaries**: 1-2 sentences per detected chapter
- **Key moments**: Timestamped highlights (decisions, action items, important statements)
- **Visual highlights**: Frames that best represent each chapter (slide content, diagrams, UI states)

### Step 5: Extract Structured Insights

Parse the summaries for actionable content:

- **Decisions made**: Architectural choices, feature priorities, scope changes
- **Action items**: Tasks assigned to people with deadlines
- **Questions raised**: Open items requiring follow-up
- **Risks identified**: Concerns or blockers mentioned during the recording

### Step 6: Validate Summary Quality

Run analysis to verify completeness and accuracy of the generated summary.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress", sprintId: "<current-sprint>" })
```

Verify that:
- All major topics from the transcript are represented in the summary
- Chapter boundaries align with actual topic shifts
- No critical decisions or action items were missed

### Step 7: Export Summary Artifacts

Generate exportable summary artifacts for sharing and review.

**Tool:** `mcp__mcp-graph__export`

```
export({ format: "mermaid", includeMetadata: true })
```

### Step 8: Persist Summary to Knowledge Store

Store the structured summary for future RAG retrieval and cross-referencing.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "video-summary",
  content: "<structured JSON with executive summary, chapters, highlights, action items>"
})
```

## Output Format

```json
{
  "summary_id": "vs-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 3600,
    "nodeId": "<task-node-id>"
  },
  "executive_summary": "Sprint 14 review covered dashboard performance improvements, RAG pipeline refactoring, and Q3 roadmap priorities. Three key decisions were made regarding caching strategy.",
  "chapters": [
    {
      "index": 1,
      "title": "Dashboard Performance Review",
      "start": "00:00:00",
      "end": "00:12:35",
      "summary": "Team reviewed load time improvements, now under 2s for main dashboard.",
      "key_frame": "frame-00-05-22.png"
    }
  ],
  "key_moments": [
    {
      "timestamp": "00:08:42",
      "type": "decision",
      "content": "Approved Redis caching for dashboard API responses",
      "speakers": ["Speaker_1", "Speaker_3"]
    }
  ],
  "action_items": [
    {
      "description": "Implement Redis cache layer for dashboard endpoints",
      "assignee": "Speaker_2",
      "deadline": "2026-04-17",
      "timestamp": "00:09:15"
    }
  ],
  "questions_open": [
    {
      "question": "Should we support offline dashboard mode?",
      "timestamp": "00:45:10",
      "raised_by": "Speaker_1"
    }
  ],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT summarize without first loading domain context via `rag_context` -- summaries need project awareness
- Do NOT generate summaries from video directly without a transcript base -- text-first approach ensures accuracy
- Do NOT produce a single flat summary for videos longer than 10 minutes -- use chapter-based structure
- Do NOT skip action item extraction -- untracked action items are the primary source of lost work
- Do NOT ignore visual content when summarizing -- slides and diagrams carry information not in speech
- Do NOT persist summaries without validation via `analyze` -- incomplete summaries degrade the knowledge store
- Do NOT treat chapter detection as purely time-based -- semantic boundaries produce better chapters than fixed intervals
