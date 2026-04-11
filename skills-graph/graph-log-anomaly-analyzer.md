---
name: graph-log-anomaly-analyzer
description: NLP and ML-powered log anomaly analysis at scale that detects unusual log patterns, new error signatures, and behavioral deviations using clustering and sequence modeling
triggers:
  - graph-log-anomaly-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-log-anomaly-analyzer

NLP and ML-powered log anomaly analysis that operates at scale across millions of log lines. Uses log template extraction (Drain algorithm), clustering (DBSCAN), sequence modeling (n-gram analysis), and semantic similarity to detect unusual log patterns, new error signatures, volume anomalies, and behavioral deviations that traditional keyword matching and regex rules miss.

## When to Use

- When log volumes are too high for manual review and keyword-based alerts produce too much noise
- When new error types appear that do not match existing alert rules
- When investigating incidents and need to find unusual log patterns correlated with the failure window
- When onboarding new services that have no existing log alert rules
- When log patterns shift after deployments and need automated detection of behavioral changes
- When reducing alert fatigue from noisy log-based alerts

## Mandatory Flow

```
ingest(log stream) --> parse(extract templates) --> cluster(group similar logs) --> baseline(build normal model) --> detect(anomaly scoring) --> rag_context(historical patterns) --> correlate(cross-service) --> search(related incidents) --> metrics(anomaly stats) --> analyze(trends) --> write_memory
```

## Workflow

### Step 1: Log Ingestion and Preprocessing

Ingest logs from all sources and normalize into a consistent format for analysis.

```
Tool: mcp__mcp-graph__metrics (scope: "logs", timeRange: "1h")
```

Preprocessing pipeline:
1. **Format detection** -- identify structured (JSON) vs semi-structured (syslog) vs unstructured (free text)
2. **Field extraction** -- timestamp, severity, service, message, and any structured fields
3. **Timestamp normalization** -- convert all timestamps to UTC with nanosecond precision
4. **Deduplication** -- remove exact duplicates within a 1-second window (log shipping retries)
5. **Tokenization** -- split message text into tokens, replacing variables (IPs, UUIDs, paths, numbers) with placeholders

Variable replacement patterns:

| Pattern | Placeholder | Example |
|---------|-------------|---------|
| IP address | `<IP>` | `192.168.1.100` becomes `<IP>` |
| UUID | `<UUID>` | `a1b2c3d4-...` becomes `<UUID>` |
| Numeric | `<NUM>` | `Connection pool: 45/50` becomes `Connection pool: <NUM>/<NUM>` |
| File path | `<PATH>` | `/var/log/app.log` becomes `<PATH>` |
| Timestamp | `<TS>` | `2026-04-10T14:30:00Z` becomes `<TS>` |

### Step 2: Log Template Extraction

Extract log templates using the Drain algorithm to reduce millions of unique log lines to hundreds of templates.

Drain algorithm:
1. Parse log messages into token sequences
2. Group by message length and first N tokens
3. Build a parse tree where branches split on differing tokens
4. Leaf nodes are templates with variable positions marked as wildcards

Example template extraction:
- Input: `User john logged in from 10.0.0.1 at 2026-04-10T14:30:00Z`
- Input: `User alice logged in from 192.168.1.5 at 2026-04-10T14:31:00Z`
- Template: `User <*> logged in from <*> at <*>`

Template metrics:
- Template ID (hash of template string)
- Frequency (occurrences per time window)
- First seen / last seen timestamps
- Associated severity levels
- Source services

### Step 3: Cluster Analysis

Cluster log templates by semantic similarity to group related messages and identify emerging patterns.

Clustering approach:
1. **TF-IDF vectorization** -- convert templates to TF-IDF vectors
2. **Semantic embedding** -- optionally embed templates using a language model for deeper similarity
3. **DBSCAN clustering** -- density-based clustering that finds groups without specifying cluster count; outliers are flagged as potential anomalies

```
Tool: mcp__mcp-graph__search (query: "log template cluster <service>")
```

Cluster types:

| Cluster | Description | Anomaly Signal |
|---------|-------------|----------------|
| Normal operation | Expected log patterns (startup, health check, request handling) | None |
| Known errors | Previously seen error patterns with existing alerts | None (already monitored) |
| New error cluster | Error templates not seen in the last 7 days | High |
| Volume anomaly | Normal template but abnormal frequency | Medium |
| Orphan template | Template that does not cluster with any group | High |

### Step 4: Baseline Model Construction

Build a model of normal log behavior from historical data to distinguish anomalies from regular patterns.

Baseline dimensions:

| Dimension | Normal Model | Anomaly Detection |
|-----------|-------------|-------------------|
| Template frequency | Average occurrences per template per hour | Deviation > 3 sigma from rolling average |
| Template distribution | Relative proportion of each template | KL divergence from baseline distribution |
| Sequence patterns | Common template sequences (n-grams) | Unseen 3-gram sequences |
| Error ratio | Baseline error/total log ratio per service | Ratio exceeds baseline + 2 sigma |
| New templates | Rate of new template emergence | > 5 new templates in 1 hour (deployment side effect excluded) |

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 5: Anomaly Detection and Scoring

Score each log time window against the baseline model across all dimensions.

```
Tool: mcp__mcp-graph__metrics (scope: "log_anomalies")
```

Scoring per anomaly type:

| Anomaly Type | Score Calculation | Severity Mapping |
|--------------|-------------------|-----------------|
| Volume spike | Z-score of template count vs rolling average | >5 sigma = critical, >3 = high, >2 = medium |
| New template | Novelty score (1.0 for never-seen template) | Error template = critical, non-error = medium |
| Sequence anomaly | Probability of n-gram under the normal model | Log-prob < -5 = high, < -3 = medium |
| Distribution shift | KL divergence from baseline | KL > 0.5 = high, > 0.2 = medium |
| Error ratio spike | Deviation from baseline error ratio | >2x baseline = critical, >1.5x = high |

Ensemble score: weighted combination of individual scores, with higher weight on error-related anomalies.

### Step 6: Historical Pattern Matching

Query the knowledge store for similar log anomaly patterns from past incidents.

```
Tool: mcp__mcp-graph__rag_context (query: "log anomaly <template pattern> <service>")
```

```
Tool: mcp__mcp-graph__search (query: "log anomaly <anomaly type> <time window>")
```

Historical matching:
- Compare current anomaly templates to templates from past incident time windows
- Check if the anomaly pattern matches a known deployment artifact (expected temporary behavior)
- Look for recurring seasonal patterns (batch job logs, backup logs, maintenance windows)

If a historical match is found, annotate the anomaly with the previous resolution.

### Step 7: Cross-Service Correlation

Correlate log anomalies across services to identify incident-wide patterns.

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Correlation methods:
- **Temporal** -- log anomalies in multiple services within a 5-minute window
- **Causal** -- error in service A followed by errors in dependent services
- **Content** -- similar error messages or stack traces across services
- **Request ID** -- trace-correlated logs that span multiple services

Group correlated anomalies into a single incident cluster.

### Step 8: Record Analysis

Save the log anomaly analysis results and discovered patterns.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Log Anomaly Analysis — <date>"
  content: "<templates extracted, clusters formed, anomalies detected, severity distribution, historical matches, cross-service correlations, new patterns discovered>"
  tags: ["log-analysis", "anomaly-detection", "nlp", "aiops"]
```

## Output Format

```
Phase: LOG ANOMALY ANALYSIS
Time Range: <start> to <end>
Log Lines Processed: <N>
Templates Extracted: <N>

Anomalies Detected:
  Total: <N>
  Critical: <N>
  High: <N>
  Medium: <N>

Top Anomalies:
  1. <service> — <anomaly type> — <template snippet> — severity <score>
  2. <service> — <anomaly type> — <template snippet> — severity <score>
  3. <service> — <anomaly type> — <template snippet> — severity <score>

New Templates: <N> (never seen before)
Volume Anomalies: <N> templates with abnormal frequency
Sequence Anomalies: <N> unusual log sequences

Cross-Service Correlations: <N> incident clusters
Historical Matches: <N> patterns match known incidents

Saved to memory: "Log Anomaly Analysis — <date>"
```

## Anti-Patterns

- Do NOT apply regex rules to raw log lines at scale -- template extraction reduces the problem space by orders of magnitude
- Do NOT treat all new log templates as anomalies -- deployments naturally introduce new templates; correlate with deployment events before alerting
- Do NOT ignore log volume changes -- a sudden drop in log volume is as suspicious as a spike (service may be crashing before logging)
- Do NOT skip variable replacement in preprocessing -- without it, every unique request ID creates a unique template, defeating the purpose
- Do NOT use only keyword matching for error detection -- NLP-based semantic analysis catches errors described in novel ways
- Do NOT analyze logs from a single service in isolation -- cross-service correlation reveals incident patterns invisible at the service level
- Do NOT train baseline models on data from incident windows -- contaminated baselines normalize abnormal behavior
