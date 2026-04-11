---
name: graph-graph-ml-embedding
description: Graph Neural Network embeddings for improved GraphRAG retrieval, task clustering, semantic similarity, and dependency prediction
triggers:
  - graph-graph-ml-embedding
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-graph-ml-embedding

Graph ML embedding skill that generates dense vector representations of execution graph nodes using Graph Neural Networks (GNN). These embeddings capture both structural (topology) and semantic (content) information, enabling improved RAG retrieval, task clustering, similarity search, and missing dependency prediction.

## When to Use

- After importing a new PRD -- generate embeddings for all new nodes to enable semantic search
- During PLAN phase -- cluster similar tasks for sprint grouping and parallel execution
- When RAG retrieval quality degrades -- re-embed nodes with updated structural context
- Before dependency review -- predict missing edges using embedding similarity
- After significant graph restructuring -- re-compute embeddings to reflect new topology
- Proactively on `reindex_knowledge` -- update embeddings alongside knowledge index

## Mandatory Flow

```
extract node features --> build adjacency matrix --> train GNN encoder --> generate embeddings --> index embeddings --> cluster analysis --> similarity search --> predict missing edges --> write_memory
```

## Workflow

### Step 1: Extract Node Features

Build feature vectors combining textual and structural attributes:

```
Tool: mcp__mcp-graph__search (query: "*")
Tool: mcp__mcp-graph__rag_context (query: "all nodes", scope: "graph")
```

Per-node feature extraction:
| Feature Group | Features | Encoding |
|---------------|----------|----------|
| **Textual** | name, description, acceptance criteria | TF-IDF vectors (dim=128) |
| **Structural** | in_degree, out_degree, clustering coefficient | Numeric |
| **Temporal** | created_at, updated_at, cycle_time | Normalized timestamps |
| **Status** | current status, status history length | One-hot + numeric |
| **Type** | node_type (task, epic, milestone, etc.) | One-hot |
| **Knowledge** | RAG hit count, knowledge coverage score | Numeric |

Combine into initial node feature matrix `X` of shape `(N_nodes, D_features)`.

### Step 2: Build Adjacency Matrix

Construct the graph structure from edges:

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Build adjacency representations:
- **Adjacency matrix** `A`: sparse matrix of `depends_on`, `parent_of`, `blocks` edges
- **Edge type matrix**: encode different edge types (dependency, hierarchy, blocking)
- **Bidirectional edges**: add reverse edges with separate type for message passing
- **Self-loops**: add identity connections for GNN stability

Normalize adjacency using symmetric normalization: `A_hat = D^(-1/2) * (A + I) * D^(-1/2)`

### Step 3: Train GNN Encoder

Train a lightweight Graph Attention Network (GAT) locally:

**Architecture:**
```
Input(D_features) -> GAT Layer 1 (heads=4, dim=64) -> ReLU -> Dropout(0.2)
                  -> GAT Layer 2 (heads=2, dim=32) -> ReLU -> Dropout(0.2)
                  -> Linear(embedding_dim=64)
```

**Training objectives (multi-task):**
- **Link prediction**: predict whether an edge exists between two nodes (BCE loss)
- **Node classification**: predict node type from embedding (CE loss)
- **Contrastive loss**: similar nodes (same epic, same phase) closer than dissimilar ones

**Hyperparameters:**
- Learning rate: 1e-3, weight decay: 5e-4
- Epochs: 200 with early stopping (patience=20)
- Batch size: full graph (transductive setting)

Validate using 15% held-out edges for link prediction AUC.

### Step 4: Generate Embeddings

Run forward pass to generate embeddings for all nodes:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For each node, produce:
- **Embedding vector**: 64-dimensional dense vector capturing structural + semantic position
- **Attention weights**: which neighbors contributed most to this node's representation
- **Confidence**: reconstruction error as embedding quality indicator

Embeddings capture:
- Nodes with similar roles in the graph are close in embedding space
- Dependent tasks share embedding neighborhoods
- Tasks in the same epic form natural clusters
- Isolated/anomalous nodes are far from cluster centers

### Step 5: Index Embeddings for RAG Enhancement

Integrate embeddings into the existing RAG pipeline:

```
Tool: mcp__mcp-graph__knowledge_stats
Tool: mcp__mcp-graph__rag_context (query: "test query", scope: "graph")
```

Enhancement strategy:
- Store embeddings in the knowledge store alongside existing TF-IDF vectors
- Hybrid retrieval: combine BM25 text score with embedding cosine similarity
- Scoring: `final_score = alpha * bm25_score + (1 - alpha) * cosine_similarity` where `alpha=0.6`
- Re-rank top-k results using embedding distance for improved precision

### Step 6: Cluster Analysis

Apply clustering to discover natural task groupings:

**Algorithm**: HDBSCAN (density-based, handles noise, no need to specify k)
- `min_cluster_size=3, min_samples=2`
- Distance metric: cosine distance in embedding space

Cluster interpretation:
| Cluster Property | Meaning |
|-----------------|---------|
| Tight cluster (low intra-distance) | Highly related tasks, good sprint candidates |
| Large cluster | Potential epic that needs decomposition |
| Noise points | Orphan tasks or unique work items |
| Cross-phase cluster | Tasks spanning phases -- review dependency structure |

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Report cluster composition: node types, phases, statuses, and epics per cluster.

### Step 7: Predict Missing Dependencies

Use embedding similarity to predict missing edges:

For all node pairs `(i, j)` without an existing edge:
- Compute `cosine_similarity(embedding_i, embedding_j)`
- If similarity > threshold (0.85) and nodes share an epic: flag as potential missing dependency
- Rank predictions by confidence (similarity score)

Present top-10 predicted missing edges for human review:
```
Tool: mcp__mcp-graph__node (action: "show", nodeId: <source>)
Tool: mcp__mcp-graph__node (action: "show", nodeId: <target>)
```

### Step 8: Persist Results

Save embeddings, clusters, and predictions:

```
Tool: mcp__mcp-graph__write_memory (title: "Graph ML Embeddings — <date>", content: <embedding stats, cluster summary, predicted edges, model metrics>)
```

Include: embedding dimensionality, training loss, link prediction AUC, cluster count, and top predicted missing edges.

## Output Format

```
Phase: GRAPH ML EMBEDDING
Nodes Embedded: <N> (dim=64)
Training: link_pred_AUC=<N>, node_class_acc=<N>%, epochs=<N>
Clusters Found: <N> (HDBSCAN, noise=<N> nodes)
  - Cluster 1: <N> nodes, primary type=<type>, phase=<phase>
  - Cluster 2: <N> nodes, primary type=<type>, phase=<phase>
RAG Enhancement: hybrid score improved retrieval precision by <N>%
Predicted Missing Edges: <N> candidates (confidence > 0.85)
  - <node_A> -> <node_B>: similarity=<N>
  - <node_C> -> <node_D>: similarity=<N>
Anomalous Embeddings: <N> nodes far from all cluster centers

Saved to memory: "Graph ML Embeddings — <date>"
```

## Anti-Patterns

- Do NOT generate embeddings without structural context -- text-only embeddings miss graph topology
- Do NOT use fixed k-means for clustering -- graph clusters vary in size and density, use HDBSCAN
- Do NOT skip edge type encoding -- `depends_on` and `parent_of` carry very different semantics
- Do NOT auto-create predicted edges -- always present predictions for human review first
- Do NOT retrain on every node addition -- batch re-embedding when >10% of nodes are new
- Do NOT ignore attention weights -- they explain why nodes are similar, critical for trust
- Do NOT use embeddings alone for RAG -- hybrid BM25 + embedding retrieval outperforms either alone
