---
name: graph-audio-sentiment-analyzer
description: Voice sentiment and emotion analysis from audio recordings for team health and feedback processing
triggers:
  - graph-audio-sentiment-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-sentiment-analyzer

Analyzes audio recordings to detect sentiment, emotional tone, and engagement levels from voice characteristics. Results are indexed into the knowledge store and linked to graph nodes, enabling data-driven insights into team dynamics, customer feedback, and meeting effectiveness.

## When to Use

- When analyzing meeting recordings to gauge team morale and engagement levels
- When processing customer or stakeholder voice feedback to quantify sentiment
- When detecting frustration, confusion, or enthusiasm patterns in retrospective recordings
- When building emotional baselines for recurring meetings to track trends over time
- When voice sentiment data needs to be correlated with sprint velocity or task completion rates
- When identifying high-stress segments in recordings that may indicate blockers or risks

## Mandatory Flow

```
search(existing analyses) → analyze(audio_inventory) → extract_audio_features → classify_sentiment → write_memory(sentiment results) → rag_context(index findings) → analyze(implement_done)
```

## Workflow

### Step 1: Search for Existing Analyses

Check whether the audio file or meeting has already been analyzed to prevent duplicate processing and to establish historical baselines.

**Tool:** `mcp__mcp-graph__search`
- Query: audio file identifier, meeting date, or participant names
- Look for prior sentiment analyses to compare against
- Retrieve speaker profiles if previously identified

### Step 2: Audio Inventory and Preparation

Analyze the target audio file to determine its characteristics and validate it is suitable for sentiment analysis.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Verify audio quality is sufficient for reliable sentiment detection
- Check duration and segment count
- Identify number of speakers and their distribution

### Step 3: Feature Extraction

Extract acoustic features from the audio that correlate with emotional states:

- Pitch (F0) contour: rising pitch indicates questions or excitement, falling pitch indicates statements or fatigue
- Speech rate variability: faster speech may indicate enthusiasm or anxiety, slower may indicate thoughtfulness or disengagement
- Energy and loudness patterns: volume changes correlate with emphasis and engagement
- Pause analysis: frequent long pauses may indicate uncertainty or discomfort
- Spectral features: voice quality changes (breathiness, tension) indicate emotional arousal
- Jitter and shimmer: vocal instability measures that correlate with stress

### Step 4: Segment-Level Sentiment Classification

Classify each audio segment using a multi-dimensional sentiment model:

- **Valence**: positive to negative (happy, satisfied, neutral, frustrated, angry)
- **Arousal**: calm to excited (relaxed, engaged, animated, agitated)
- **Dominance**: submissive to dominant (hesitant, collaborative, assertive, commanding)
- Combine acoustic features with any available transcript for multimodal classification
- Generate confidence scores for each dimension per segment
- Aggregate per-speaker sentiment profiles

### Step 5: Trend and Pattern Detection

Analyze sentiment trajectories across the recording:

- Identify sentiment shifts (e.g., positive start degrading to frustration mid-meeting)
- Detect emotional peaks and valleys with timestamps
- Calculate engagement scores per speaker over time
- Flag segments where multiple speakers show negative sentiment simultaneously
- Compare against historical baselines if available

### Step 6: Correlate with Graph Context

Pull execution graph context to correlate sentiment patterns with project events.

**Tool:** `mcp__mcp-graph__rag_context`
- Query: meeting topics, sprint status, recent blockers
- Correlate negative sentiment spikes with specific discussion topics
- Link high-stress segments to blocked or overdue graph nodes

### Step 7: Persist Sentiment Results

Save the complete sentiment analysis to the knowledge store for longitudinal tracking.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `sentiment_analysis`
- Content: per-speaker sentiment profiles, trend data, flagged segments
- Tags: meeting date, participants, overall sentiment score, confidence

### Step 8: Generate Report and Finalize

Produce a structured sentiment report and mark the analysis as complete.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Validate: all segments classified, confidence thresholds met, results persisted

## Output Format

```json
{
  "sentiment_analysis": {
    "file": "retro-2026-04-10.wav",
    "duration_seconds": 2700,
    "overall_sentiment": {
      "valence": 0.62,
      "arousal": 0.55,
      "dominance": 0.48,
      "label": "moderately_positive"
    },
    "speakers": [
      {
        "id": "Speaker_1",
        "avg_valence": 0.71,
        "avg_arousal": 0.60,
        "engagement_score": 0.78,
        "speaking_time_pct": 35
      },
      {
        "id": "Speaker_2",
        "avg_valence": 0.45,
        "avg_arousal": 0.65,
        "engagement_score": 0.52,
        "speaking_time_pct": 28
      }
    ],
    "flagged_segments": [
      {
        "start": 1200,
        "end": 1380,
        "sentiment": "frustrated",
        "confidence": 0.88,
        "speakers": ["Speaker_2"],
        "topic_hint": "deployment blockers"
      }
    ],
    "trend": "stable_positive_with_mid_dip"
  },
  "graph_node_id": "node-sent-123",
  "knowledge_entry_id": "ke-sent-456"
}
```

## Anti-Patterns

- Do NOT classify sentiment from audio shorter than 10 seconds per segment; results are unreliable
- Do NOT treat sentiment scores as absolute truth; always include confidence intervals
- Do NOT analyze sentiment without considering cultural and linguistic context of speakers
- Do NOT store individual speaker sentiment data without anonymization options for privacy
- Do NOT skip baseline comparison when historical data is available for the same meeting type
- Do NOT conflate acoustic sentiment with semantic sentiment; combine both when transcripts are available
- Do NOT report sentiment findings without linking them to specific graph nodes or project context
