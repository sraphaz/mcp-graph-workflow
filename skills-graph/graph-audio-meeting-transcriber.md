---
name: graph-audio-meeting-transcriber
description: Full meeting transcription with automatic conversion to graph tasks, action items, and decision nodes
triggers:
  - graph-audio-meeting-transcriber
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-meeting-transcriber

Transcribes entire meeting recordings and automatically extracts actionable content (tasks, decisions, blockers, follow-ups) into execution graph nodes and edges. Bridges the gap between verbal discussions and structured project tracking, ensuring nothing decided in a meeting is lost.

## When to Use

- When meeting recordings need to be fully transcribed with speaker attribution and timestamps
- When action items, decisions, and blockers discussed in meetings must be captured as graph nodes
- When meeting outcomes need to be linked to existing sprint tasks via dependency edges
- When generating structured meeting minutes with cross-references to the execution graph
- When retrospective or planning meeting content needs to feed the knowledge store for RAG retrieval

## Mandatory Flow

```
search(meeting context) → transcribe_meeting → extract_action_items → node(add tasks) → edge(link dependencies) → write_memory(meeting record) → analyze(implement_done)
```

## Workflow

### Step 1: Gather Meeting Context

Search for related context before transcription to inform extraction: meeting agenda, sprint status, participant roles, and existing task nodes.

**Tool:** `mcp__mcp-graph__search`
- Query: meeting topic, date, sprint identifier, participant names
- Retrieve current sprint tasks to match discussed items against existing nodes
- Load agenda document if available for topic-guided segmentation

### Step 2: Full Meeting Transcription

Transcribe the entire recording with speaker diarization and timestamp alignment:

- Run speech-to-text on the full recording with speaker labels
- Apply language-specific models for multi-language meetings
- Generate word-level timestamps for precise segment alignment
- Mark low-confidence sections for potential manual review
- Segment transcript by speaker turns and topic boundaries

### Step 3: Action Item Extraction

Parse the transcript to identify actionable content using pattern matching and NLU:

- **Action items**: statements with verbs like "will do", "needs to", "should implement", "take care of"
- **Decisions**: consensus statements like "we agreed", "the decision is", "let's go with"
- **Blockers**: mentions of "blocked by", "waiting on", "can't proceed until"
- **Follow-ups**: "let's revisit", "circle back", "schedule a follow-up"
- **Questions**: unresolved questions that need answers before next steps
- Assign each extracted item to a speaker (owner) based on context and attribution

### Step 4: Match Against Existing Graph Nodes

Cross-reference extracted items with existing nodes in the execution graph:

**Tool:** `mcp__mcp-graph__search`
- For each action item, search for matching task nodes by title or description
- Identify items that correspond to existing tasks (status update) vs new tasks (creation needed)
- Flag items that reference tasks assigned to absent participants

### Step 5: Create New Task Nodes

For action items that do not match existing graph nodes, create new task nodes.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Title: concise action item description
- Description: full context from transcript including speaker attribution and timestamp
- Metadata: assignee (speaker), meeting date, priority (inferred from discussion urgency)
- Tags: meeting-generated, meeting date

### Step 6: Create Dependency Edges

Link newly created nodes to existing graph structure with appropriate dependency relationships.

**Tool:** `mcp__mcp-graph__edge`
- Connect action items to their parent epic or sprint node
- Link blockers to the tasks they block (blocker_type edge)
- Connect follow-ups to the decisions they reference
- Establish sequential dependencies between related action items

### Step 7: Generate Meeting Record

Compile the complete meeting record with transcript, extracted items, and graph linkages.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `meeting_record`
- Content: structured meeting minutes with sections for transcript summary, decisions, action items, blockers, and follow-ups
- Tags: meeting date, participants, sprint ID, node IDs created
- Include cross-references to all graph nodes created or updated

### Step 8: Analyze and Validate

Verify the meeting transcription and extraction are complete and accurate.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Validate: all action items have assigned owners, all new nodes linked to graph, no orphan extractions
- Check: decision nodes have sufficient context for future reference
- Verify: no duplicate nodes created for already-tracked tasks

## Output Format

```json
{
  "meeting_transcription": {
    "file": "sprint-planning-2026-04-10.wav",
    "duration_seconds": 3600,
    "participants": ["Alice", "Bob", "Charlie", "Dana"],
    "transcript_word_count": 9200,
    "speaker_segments": 145,
    "extractions": {
      "action_items": [
        {
          "text": "Implement the authentication middleware",
          "owner": "Bob",
          "priority": "high",
          "timestamp": "12:35",
          "matched_node": null,
          "created_node": "node-task-101"
        },
        {
          "text": "Update the API documentation for v2 endpoints",
          "owner": "Charlie",
          "priority": "medium",
          "timestamp": "28:10",
          "matched_node": "node-task-045",
          "created_node": null
        }
      ],
      "decisions": [
        {
          "text": "Use JWT tokens instead of session cookies for the API",
          "participants": ["Alice", "Bob"],
          "timestamp": "15:22",
          "created_node": "node-decision-001"
        }
      ],
      "blockers": [
        {
          "text": "Waiting on infrastructure team for staging environment access",
          "owner": "Dana",
          "blocks": ["node-task-032"],
          "timestamp": "45:10"
        }
      ],
      "follow_ups": [
        {
          "text": "Revisit caching strategy after load test results",
          "target_date": "2026-04-17",
          "timestamp": "52:00"
        }
      ]
    },
    "nodes_created": 4,
    "nodes_updated": 2,
    "edges_created": 6
  },
  "graph_node_id": "node-meeting-789",
  "knowledge_entry_id": "ke-meeting-012"
}
```

## Anti-Patterns

- Do NOT create duplicate task nodes for items that already exist in the graph; always search first
- Do NOT extract action items without assigning an owner; unassigned items are never completed
- Do NOT skip cross-referencing extracted items against the current sprint backlog
- Do NOT treat every statement as an action item; filter by explicit commitment language
- Do NOT generate meeting minutes without including timestamps for key decisions and actions
- Do NOT ignore low-confidence transcript segments; flag them rather than silently dropping content
- Do NOT create graph nodes without linking them to the parent meeting node or sprint structure
