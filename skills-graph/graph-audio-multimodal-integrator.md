---
name: graph-audio-multimodal-integrator
description: Audio, text, and image fusion for enriched RAG knowledge synthesis and cross-modal context assembly
triggers:
  - graph-audio-multimodal-integrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-multimodal-integrator

Fuses audio content with text documents and visual artifacts (diagrams, screenshots, whiteboard photos) into a unified knowledge representation. Enables cross-modal RAG queries where audio context enriches text retrieval and vice versa, producing comprehensive knowledge entries that capture the full information landscape of a project.

## When to Use

- When meeting recordings need to be correlated with shared screen content, slides, or documents
- When audio explanations of architecture diagrams need to be linked to the visual artifacts
- When building a multimodal knowledge base that supports queries across audio, text, and image content
- When whiteboard session recordings need to merge spoken discussion with captured board photos
- When enriching RAG retrieval with cross-modal context for more complete answers
- When project documentation spans multiple modalities that should be queryable as a unified whole

## Mandatory Flow

```
rag_context(existing knowledge) → analyze(modality inventory) → align_modalities → fuse_representations → knowledge_stats(index health) → write_memory(fused knowledge) → analyze(implement_done)
```

## Workflow

### Step 1: Load Existing Knowledge Context

Query the RAG pipeline for existing knowledge entries related to the content being integrated. This establishes the baseline and identifies gaps that multimodal fusion can fill.

**Tool:** `mcp__mcp-graph__rag_context`
- Query: topic keywords, project area, date range
- Retrieve existing text, audio, and image knowledge entries
- Identify modality gaps (e.g., audio exists but no transcript, diagram exists but no explanation)

### Step 2: Modality Inventory and Analysis

Catalog all available content across modalities and assess their alignment potential.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- List all audio files, text documents, and image artifacts for the target topic
- Determine temporal alignment opportunities (audio timestamp to slide number, recording to document edit time)
- Assess content overlap and complementarity across modalities
- Identify the primary modality (richest content source) and supporting modalities

### Step 3: Temporal and Semantic Alignment

Align content across modalities using temporal, semantic, and structural cues:

- **Temporal alignment**: match audio timestamps to screen share timeline, slide transitions, or document edit history
- **Semantic alignment**: use keyword extraction from transcripts to link audio segments to text sections and image descriptions
- **Structural alignment**: map presentation structure (slides, sections) to audio segments discussing each topic
- **Reference alignment**: detect spoken references to visual content ("as you can see in the diagram", "on this slide")
- Generate an alignment matrix mapping each audio segment to corresponding text and image artifacts

### Step 4: Cross-Modal Feature Extraction

Extract unified features from each modality for fusion:

- **Audio**: transcript text, speaker embeddings, sentiment scores, topic labels, emphasis markers
- **Text**: key phrases, entity mentions, section headings, code references, decision statements
- **Image**: OCR text from diagrams and whiteboards, object labels, layout structure, color annotations
- Normalize all features into a common embedding space for retrieval compatibility
- Handle missing modalities gracefully by using available modalities to infer absent information

### Step 5: Knowledge Fusion

Merge aligned and extracted features into unified knowledge entries:

- Create composite knowledge entries that combine transcript, document text, and image descriptions
- Resolve conflicts between modalities (e.g., spoken correction overrides written text)
- Preserve provenance: tag each piece of information with its source modality and timestamp
- Generate cross-modal summaries that synthesize information from all available sources
- Build a cross-reference index linking related content across modalities

### Step 6: Verify Knowledge Index Health

Check the knowledge store indexing health after adding multimodal content.

**Tool:** `mcp__mcp-graph__knowledge_stats`
- Verify new entries are indexed and searchable
- Check embedding coverage for all fused entries
- Validate cross-modal links are bidirectional and consistent
- Monitor index size growth and fragmentation

### Step 7: Persist Fused Knowledge

Save the unified multimodal knowledge entries to the store for RAG retrieval.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `multimodal_knowledge`
- Content: fused knowledge entry with cross-modal references, alignment data, and provenance tags
- Tags: modalities included, topic, fusion method, confidence, source artifacts
- Include the alignment matrix for debugging and refinement

### Step 8: Validate and Complete

Verify the multimodal integration produced coherent, retrievable knowledge.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Validate: all modalities represented in fused entries, cross-references intact, RAG queries return multimodal results
- Test: run sample queries that should return cross-modal content and verify completeness

## Output Format

```json
{
  "multimodal_integration": {
    "topic": "Authentication Architecture Review",
    "sources": {
      "audio": {
        "file": "arch-review-2026-04-10.wav",
        "duration_seconds": 2700,
        "segments_aligned": 24
      },
      "text": {
        "files": ["auth-design-doc.md", "api-spec.yaml"],
        "sections_aligned": 12
      },
      "images": {
        "files": ["auth-flow-diagram.png", "whiteboard-photo-01.jpg"],
        "regions_aligned": 8
      }
    },
    "alignment_matrix": {
      "audio_to_text": 18,
      "audio_to_image": 8,
      "text_to_image": 6,
      "three_way_aligned": 5
    },
    "fused_entries": [
      {
        "id": "fk-001",
        "topic": "OAuth2 flow selection",
        "audio_ref": { "start": 120, "end": 300, "speaker": "Alice" },
        "text_ref": { "file": "auth-design-doc.md", "section": "3.2" },
        "image_ref": { "file": "auth-flow-diagram.png", "region": "center" },
        "summary": "Team decided on Authorization Code flow with PKCE for SPA clients, as shown in the flow diagram and documented in section 3.2",
        "confidence": 0.91
      }
    ],
    "total_fused_entries": 15,
    "modality_coverage": {
      "audio_only": 6,
      "text_only": 3,
      "image_only": 1,
      "multi_modal": 15
    }
  },
  "knowledge_entries_created": 15,
  "knowledge_entry_id": "ke-multi-345"
}
```

## Anti-Patterns

- Do NOT fuse content from different topics or meetings into a single knowledge entry; maintain topic boundaries
- Do NOT assume temporal alignment is always correct; validate with semantic similarity checks
- Do NOT discard single-modality content that has no cross-modal match; index it independently
- Do NOT overweight one modality over others without justification; spoken corrections should override written text, but audio noise should not override clean documents
- Do NOT create circular cross-references between fused entries; use a directed acyclic reference structure
- Do NOT skip provenance tagging; every piece of fused information must trace back to its source modality
- Do NOT index raw image bytes into the knowledge store; extract text and structural descriptions instead
