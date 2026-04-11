---
name: graph-video-meeting-processor
description: Meeting video processing into transcript, extracted tasks, action items, and graph nodes
triggers:
  - graph-video-meeting-processor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-meeting-processor

Processes meeting video recordings into structured output: full transcript, extracted action items, decisions, task nodes, and dependency edges. Directly integrates with the execution graph by creating task nodes and edges from meeting content, closing the loop between discussions and tracked work.

## When to Use

- When a sprint planning, retro, or review meeting was recorded and needs structured extraction
- When action items from meetings must be tracked as graph nodes with dependencies
- When decisions made in meetings need to be persisted as knowledge for future reference
- When you need to identify who committed to what during a recorded meeting
- When converting verbal agreements and plans into executable task graph structure
- When building a searchable archive of meeting decisions and outcomes

## Mandatory Flow

```
search → [meeting processing pipeline] → node → edge → analyze → write_memory
```

## Workflow

### Step 1: Search for Meeting Context

Locate existing graph nodes related to the meeting agenda, sprint, or project area.

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "<meeting topic or sprint identifier>", limit: 15 })
```

### Step 2: Generate Meeting Transcript

Produce a full timestamped transcript with speaker diarization. This is the foundation for all downstream extraction.

Key requirements:
- **Speaker identification**: Assign consistent speaker labels throughout
- **Timestamp precision**: Minimum 1-second granularity for action item attribution
- **Agenda alignment**: Map transcript sections to meeting agenda items if available

### Step 3: Extract Action Items

Parse the transcript for explicit and implicit action items:

- **Explicit commitments**: "I will...", "Let me take that...", "I'll handle..."
- **Assignments**: "Can you...?", "[Name] should...", "Let's assign this to..."
- **Deadlines**: "By Friday", "Before next sprint", "End of day"
- **Follow-ups**: "Let's revisit...", "We need to check...", "I'll get back to you on..."
- **Blockers identified**: "We're blocked on...", "This depends on...", "We can't proceed until..."

Each action item gets: assignee, description, deadline (if mentioned), priority (inferred), and source timestamp.

### Step 4: Extract Decisions

Identify decisions made during the meeting:

- **Architecture decisions**: Technology choices, design patterns, service boundaries
- **Scope decisions**: Feature inclusions/exclusions, MVP definitions
- **Process decisions**: Workflow changes, team structure, meeting cadence
- **Priority decisions**: Reordering of backlog, sprint scope adjustments

Each decision gets: description, rationale (if stated), participants involved, and timestamp.

### Step 5: Create Task Nodes

Convert extracted action items into graph task nodes.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "<action item description>", type: "task", status: "ready", metadata: { assignee: "<speaker>", source: "meeting-<date>", deadline: "<extracted-deadline>" } })
```

Create nodes for each action item that represents a trackable unit of work.

### Step 6: Create Dependency Edges

Link the newly created task nodes with appropriate dependency edges.

**Tool:** `mcp__mcp-graph__edge`

```
edge({ action: "add", from: "<blocker-node-id>", to: "<dependent-node-id>", type: "depends_on" })
```

Establish edges based on:
- Explicitly stated dependencies from the meeting
- Inferred ordering from discussion flow
- Links to existing graph nodes that were referenced during the meeting

### Step 7: Run Analysis and Validation

Validate the extracted data against the current graph state.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress", sprintId: "<current-sprint>" })
```

Verify:
- All action items have been converted to graph nodes
- Dependencies are consistent (no circular references)
- Assignees match known team members
- No duplicate nodes were created for existing tasks

### Step 8: Persist Meeting Summary

Store the complete meeting processing results in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "meeting-processing",
  content: "<structured JSON with transcript summary, action items, decisions, created nodes>"
})
```

## Output Format

```json
{
  "meeting_id": "mtg-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 2700,
    "date": "2026-04-10",
    "type": "sprint_planning"
  },
  "participants": [
    { "label": "Speaker_1", "identified_as": "Diego", "speaking_time_pct": 35 },
    { "label": "Speaker_2", "identified_as": "Ana", "speaking_time_pct": 28 }
  ],
  "action_items": [
    {
      "id": "ai-001",
      "description": "Implement Redis cache layer for dashboard API",
      "assignee": "Speaker_2",
      "deadline": "2026-04-17",
      "priority": "high",
      "source_timestamp": "00:12:45",
      "created_node_id": "node-abc-123"
    }
  ],
  "decisions": [
    {
      "id": "dec-001",
      "description": "Use Redis over Memcached for caching layer",
      "rationale": "Better data structure support and persistence options",
      "participants": ["Speaker_1", "Speaker_2"],
      "timestamp": "00:11:30"
    }
  ],
  "nodes_created": 5,
  "edges_created": 3,
  "topics_covered": ["dashboard performance", "caching strategy", "Q3 roadmap"],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT process meeting video without searching for existing related nodes first -- duplicates waste graph space
- Do NOT create task nodes without explicit action item extraction -- vague meeting notes are not trackable tasks
- Do NOT skip dependency edge creation -- isolated task nodes miss the relationships discussed in the meeting
- Do NOT persist decisions without rationale -- context-free decisions become meaningless within weeks
- Do NOT ignore implicit action items -- "we should probably..." and "someone needs to..." are commitments too
- Do NOT create nodes without running `analyze` to check for duplicates and circular dependencies
- Do NOT treat all meeting content as equally important -- prioritize action items and decisions over general discussion
