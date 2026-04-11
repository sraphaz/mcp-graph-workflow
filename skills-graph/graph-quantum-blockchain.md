---
name: graph-quantum-blockchain
description: Quantum-blockchain integration — immutable task tracking, QAOA optimization, post-quantum security, ZK-proof audit trails, and smart contract analysis within the mcp-graph lifecycle
triggers:
  - graph-quantum-blockchain
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-quantum-blockchain

Integrates blockchain immutability and quantum computing optimization into the mcp-graph execution graph. Enables immutable task tracking, QAOA-based scheduling optimization, smart contract security analysis, ZK-proof audit trails, and post-quantum cryptographic assessment — all local-first using Hardhat/Ganache for blockchain simulation and Qiskit Aer/Pennylane for quantum circuit simulation.

## When to Use

- When immutable audit trails are needed for task completion and graph integrity
- When task scheduling optimization is required (QAOA combinatorial optimization)
- When smart contract security analysis is needed (reentrancy, frontrunning, gas profiling)
- When post-quantum cryptographic assessment is required (lattice-based, hash-based signatures)
- When ZK-proof verification is needed for privacy-preserving task validation
- When on-chain data analysis or fraud detection patterns are relevant
- The user says "quantum", "blockchain", "smart contract", "on-chain", "ZK proof", or "post-quantum"

## Mandatory Flow

```
context → rag_context → [local blockchain setup] → [quantum circuit design] → [smart contract analysis] → [post-quantum security] → analyze → write_memory
```

## Workflow

### Step 1: Load Context & Knowledge

Load existing architecture decisions and related knowledge before integration work:

```
Tool: mcp__mcp-graph__context
Params: nodeId: <current_task_id>, detail: "standard"
```

```
Tool: mcp__mcp-graph__rag_context
Params: query: "blockchain quantum security smart contract architecture", budget: 4000
```

Review returned context for:
- Existing blockchain or cryptographic patterns in the codebase
- Prior architecture decisions (ADRs) related to immutability or security
- Dependencies and integration points with `graph-security` and `graph-architecture`

### Step 2: Local Blockchain Environment (Deterministic-First)

Set up local blockchain simulation — no mainnet, no public testnets during development:

```bash
# Hardhat local node (preferred)
npx hardhat node

# Alternative: Ganache
npx ganache --deterministic --accounts 10
```

Verify deterministic-first principles:
- All transactions run against local simulator only
- Accounts use deterministic seed (reproducible across runs)
- No external RPC endpoints configured
- ethers.js connects to `http://127.0.0.1:8545` only

Key libraries (local-first, zero cloud dependency):
| Library | Purpose |
|---------|---------|
| `ethers.js` | Contract interaction, wallet simulation |
| `hardhat` | Local blockchain, contract compilation, testing |
| `@openzeppelin/contracts` | Audited contract templates |
| `solhint` | Solidity linter for security patterns |

### Step 3: Quantum Circuit Design (Simulator-First)

Design and run quantum circuits on local simulators — no cloud quantum hardware during development:

```bash
# Qiskit Aer (Python — local simulator)
python -c "from qiskit_aer import AerSimulator; print('Qiskit Aer ready')"

# Pennylane (Python — default.qubit local)
python -c "import pennylane as qml; dev = qml.device('default.qubit', wires=4); print('Pennylane ready')"
```

QAOA for task scheduling optimization:
1. Model task dependencies as a graph optimization problem (Max-Cut / QUBO)
2. Design QAOA ansatz with depth p=1..3 (start shallow)
3. Run on local simulator (Qiskit Aer `aer_simulator` or Pennylane `default.qubit`)
4. Compare quantum result against classical greedy baseline
5. Only adopt quantum solution if it improves scheduling by measurable margin

Quantum-inspired classical fallbacks:
- Simulated annealing for combinatorial optimization
- Tensor network methods for state simulation
- Variational classical circuits when qubit count exceeds simulator capacity

| Algorithm | Use Case | Simulator |
|-----------|----------|-----------|
| QAOA | Task scheduling, dependency optimization | Qiskit Aer |
| VQE | Resource allocation, cost minimization | Pennylane |
| Quantum Kernels | Anomaly detection in on-chain data | Pennylane |
| Grover-inspired | Search optimization in large graphs | Qiskit Aer |

### Step 4: Smart Contract Analysis

Analyze smart contract security patterns and vulnerabilities:

**Static analysis checklist:**

| Vulnerability | Detection Method | Severity |
|---------------|-----------------|----------|
| Reentrancy | Check external calls before state updates | Critical |
| Frontrunning | Check transaction ordering dependencies | High |
| Integer overflow | Verify SafeMath or Solidity >=0.8 | High |
| Access control | Verify `onlyOwner` / role-based modifiers | Critical |
| Unchecked return | Verify all `.call()` return values checked | Medium |
| Gas griefing | Profile loops and unbounded operations | Medium |
| Selfdestruct | Check for `selfdestruct` in dependencies | High |

```bash
# Solhint security rules
npx solhint 'contracts/**/*.sol' --config .solhint.json

# Hardhat gas reporter
npx hardhat test --reporter gas
```

For each finding, create a task node:
```
Tool: mcp__mcp-graph__node
Params: action: "add", name: "Fix <vulnerability> in <contract>", type: "task", priority: "high"
```

### Step 5: On-Chain Data Integration & ZK-Proof Verification

**Immutable task tracking:**
- Hash task completion data (nodeId, status, timestamp, test results)
- Store hash on local blockchain as immutable audit record
- Link on-chain transaction hash back to graph node via metadata

**ZK-Proof audit trails:**
- Design ZK circuits (circom/snarkjs) for privacy-preserving task validation
- Prove task completion without revealing implementation details
- Verify proofs on local blockchain via Solidity verifier contract

```bash
# Compile ZK circuit (circom)
circom circuits/task-completion.circom --r1cs --wasm --sym

# Generate proof (snarkjs)
snarkjs groth16 prove circuit.zkey witness.wtf proof.json public.json

# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json
```

**Fraud detection patterns:**
- Monitor transaction graphs for anomalous patterns (circular transfers, wash trading)
- Apply quantum kernel methods for enhanced anomaly detection
- Flag suspicious patterns for manual review

### Step 6: Post-Quantum Security Assessment

Evaluate cryptographic primitives against quantum threats (cross-reference with `/graph-security`):

| Category | Classical | Post-Quantum Alternative | NIST Status |
|----------|-----------|-------------------------|-------------|
| Key exchange | ECDH | CRYSTALS-Kyber (ML-KEM) | Standardized |
| Signatures | ECDSA | CRYSTALS-Dilithium (ML-DSA) | Standardized |
| Signatures | RSA | FALCON, SPHINCS+ (SLH-DSA) | Standardized |
| Hash-based | SHA-256 | SHA-3, SHAKE | Quantum-resistant |
| ZK-Proofs | Groth16 | Lattice-based ZK | Research |

Assessment steps:
1. Inventory all cryptographic primitives in the project
2. Flag algorithms vulnerable to Shor's algorithm (RSA, ECDSA, ECDH)
3. Flag algorithms vulnerable to Grover's algorithm (symmetric keys < 256-bit)
4. Recommend post-quantum migration path for each finding
5. Verify hash functions use >= 256-bit output (quantum-resistant against Grover)

### Step 7: Report & Memory

Save integration results and create follow-up tasks:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Quantum-Blockchain Integration — <date>"
  content: "<integration score, findings, recommendations, security assessment>"
  tags: ["quantum", "blockchain", "security", "zk-proof", "post-quantum"]
```

Create follow-up task nodes for unresolved findings:
```
Tool: mcp__mcp-graph__node
Params: action: "add", name: "<finding description>", type: "task", priority: "<severity>"
```

Link follow-up tasks to parent epic:
```
Tool: mcp__mcp-graph__edge
Params: from: "<epic_id>", to: "<task_id>", type: "has_child"
```

## Integration with Existing Skills

| Skill | Integration Point |
|-------|-------------------|
| `/graph-security` | Post-quantum assessment feeds into OWASP/STRIDE; secrets scan catches private keys |
| `/graph-implement` | TDD for smart contracts (Hardhat tests) and quantum circuits |
| `/graph-architecture` | ADR nodes for blockchain/quantum design decisions |
| `/graph-deploy` | Contract deployment verification on testnet/mainnet |
| `/graph-tests` | Test pyramid includes contract unit tests, ZK-proof verification |
| `/graph-performance` | Gas profiling, quantum circuit depth optimization |

## Output Format

```
Phase: QUANTUM-BLOCKCHAIN INTEGRATION
Blockchain: <network> (local), <N> contracts analyzed, <N> vulnerabilities found
Quantum: <simulator> (<N> qubits, <N> circuits designed)
QAOA Optimization: <task_scheduling_improvement>% vs classical baseline
Smart Contracts: <N> analyzed, <N> findings (C critical, H high, M medium)
ZK-Proofs: <N> circuits designed, <N> proofs verified
Post-Quantum Security: <N>/<M> primitives quantum-resistant
On-Chain Audit: <N> task hashes recorded
Recommendations: <N> action items created as graph nodes

Saved to memory: "Quantum-Blockchain Integration — <date>"
```

## Anti-Patterns

- Do NOT connect to mainnet or public testnets during development — use Hardhat/Ganache local simulators only
- Do NOT use real quantum hardware for initial development — use Qiskit Aer or Pennylane default.qubit
- Do NOT deploy smart contracts without full TDD coverage — follow `/graph-implement` discipline
- Do NOT skip post-quantum security assessment — classical ECDSA/RSA will be vulnerable to quantum attacks
- Do NOT store private keys or mnemonics in source code — reference `/graph-security` secrets scan
- Do NOT optimize quantum circuits prematurely — verify correctness on simulator first, optimize second
- Do NOT use blockchain as a general-purpose database — use for immutable audit trails and verification only
- Do NOT ignore gas costs in smart contract design — profile with Hardhat gas reporter before deployment
