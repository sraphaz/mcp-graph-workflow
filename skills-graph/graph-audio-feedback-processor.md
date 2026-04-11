---
name: graph-audio-feedback-processor
description: Process voice feedback recordings into structured issues, improvements, and action nodes in the graph
triggers:
  - graph-audio-feedback-processor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-feedback-processor

Processes voice feedback recordings (user interviews, stakeholder reviews, retrospectives, support calls) into structured issues, improvement suggestions, and feature requests, automatically creating corresponding graph nodes for tracking and prioritization.

## When to Use

- When user interview recordings need to be converted into product feedback and feature requests
- When stakeholder review sessions produce verbal feedback that must be tracked as issues
- When retrospective voice notes contain improvement suggestions for the engineering process
- When support call recordings contain bug reports or enhancement requests
- When voice-based feedback needs to be categorized, deduplicated, and prioritized in the graph
- When building a feedback knowledge base for product decision support via RAG

## Mandatory Flow

```
search(existing feedback) → transcribe_feedback → classify_feedback → node(add issues/improvements) → write_memory(feedback record) → analyze(implement_done)
```

## Workflow

### Step 1: Search for Existing Feedback Context

Check the knowledge store for previously processed feedback to enable deduplication and trend detection.

**Tool:** `mcp__mcp-graph__search`
- Query: feedback topic, product area, reporter name
- Retrieve existing feedback nodes to identify duplicates or related items
- Load product area taxonomy for consistent categorization

### Step 2: Transcribe Feedback Recording

Convert the voice feedback to text with speaker attribution:

- Run speech-to-text with optimized settings for conversational audio
- Apply speaker diarization to separate interviewer from interviewee
- Generate timestamps for each feedback statement
- Mark emotionally charged segments (detected via prosody analysis)
- Handle interruptions and cross-talk gracefully

### Step 3: Feedback Classification and Extraction

Parse the transcript to identify and classify feedback items:

- **Bug reports**: descriptions of broken functionality or unexpected behavior
- **Feature requests**: suggestions for new capabilities or enhancements
- **Pain points**: expressions of frustration or difficulty with current workflows
- **Positive feedback**: praise or satisfaction with existing features
- **Process improvements**: suggestions for engineering or organizational changes
- Assign severity and priority based on speaker emphasis, repetition, and emotional intensity
- Tag each item with product area, component, and user persona

### Step 4: Deduplication and Aggregation

Compare extracted feedback items against existing graph nodes and prior feedback:

**Tool:** `mcp__mcp-graph__search`
- For each feedback item, search for semantically similar existing issues
- Merge duplicate feedback by incrementing occurrence count on existing nodes
- Identify feedback clusters (multiple users reporting the same issue) to elevate priority
- Flag novel feedback that represents previously unreported issues

### Step 5: Create Feedback Nodes

For unique, actionable feedback items, create graph nodes with full context.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task` (for bugs and feature requests) or `note` (for observations)
- Title: concise feedback summary
- Description: verbatim quote from transcript, speaker attribution, timestamp, severity assessment
- Tags: feedback type (bug, feature, pain_point), product area, source (interview, retro, support)
- Priority: derived from frequency, emotional intensity, and business impact

### Step 6: Analyze Feedback Patterns

Run analysis on the accumulated feedback to identify trends and systemic issues.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Identify most frequently mentioned product areas
- Detect sentiment trends across feedback sessions
- Highlight recurring themes that span multiple feedback sources
- Calculate feedback-to-resolution ratio for previously processed feedback

### Step 7: Persist Feedback Record

Save the complete feedback processing record to the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `feedback_processing`
- Content: all extracted items with classifications, deduplication results, trend analysis
- Tags: session date, feedback source type, participant count, items extracted
- Include raw transcript reference for future re-analysis

### Step 8: Finalize and Report

Complete the feedback processing task and generate a summary report.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Validate: all feedback items classified, actionable items have graph nodes, no orphan items
- Report: items created vs deduplicated, top themes, priority distribution

## Output Format

```json
{
  "feedback_processing": {
    "file": "user-interview-2026-04-10.wav",
    "duration_seconds": 1800,
    "participants": ["Interviewer", "User_A"],
    "transcript_word_count": 4500,
    "extracted_items": {
      "bugs": [
        {
          "summary": "Search results page shows stale data after filter change",
          "severity": "high",
          "quote": "Every time I change the filter, the old results stay there for like 5 seconds",
          "timestamp": "08:22",
          "created_node": "node-bug-201",
          "duplicate_of": null
        }
      ],
      "feature_requests": [
        {
          "summary": "Export dashboard data to CSV",
          "priority": "medium",
          "quote": "I really wish I could just download this as a spreadsheet",
          "timestamp": "14:55",
          "created_node": null,
          "duplicate_of": "node-feat-089"
        }
      ],
      "pain_points": [
        {
          "summary": "Navigation between project views requires too many clicks",
          "frequency": 3,
          "quote": "I keep having to go back to the main page and then drill down again",
          "timestamp": "22:10",
          "created_node": "node-ux-301"
        }
      ],
      "positive_feedback": [
        {
          "summary": "Graph visualization is intuitive and helpful",
          "quote": "The graph view is actually really cool, I can see everything at a glance",
          "timestamp": "05:30"
        }
      ]
    },
    "totals": {
      "items_extracted": 12,
      "nodes_created": 7,
      "duplicates_merged": 3,
      "positive_items": 2
    },
    "top_themes": ["search_performance", "export_capabilities", "navigation_ux"]
  },
  "graph_node_id": "node-feedback-456",
  "knowledge_entry_id": "ke-feedback-789"
}
```

## Anti-Patterns

- Do NOT create graph nodes for every feedback statement; filter for actionable and specific items
- Do NOT skip deduplication; duplicate feedback nodes fragment tracking and inflate backlog size
- Do NOT discard positive feedback; it informs what to preserve during refactoring
- Do NOT assign priority based solely on speaker volume or emotion; consider business impact and frequency
- Do NOT process feedback without recording the source and verbatim quote for traceability
- Do NOT ignore context from the interviewer's questions; they frame the feedback interpretation
- Do NOT treat all feedback equally; weight by user persona, account tier, or strategic alignment
