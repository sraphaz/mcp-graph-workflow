---
name: graph-encryption-manager
description: Local SQLite and backup encryption management with key rotation, integrity verification, and at-rest data protection
triggers:
  - graph-encryption-manager
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-encryption-manager

Local SQLite and backup encryption management that ensures all graph data is encrypted at rest, manages encryption keys with scheduled rotation, verifies data integrity after encryption operations, and maintains an auditable chain of custody for key material. This skill operates autonomously — monitoring encryption health, triggering key rotation on schedule, and self-healing when integrity checks fail.

## When to Use

- Automatically on a 90-day cadence for scheduled key rotation
- Before DEPLOY phase as a mandatory encryption integrity gate
- When a new SQLite database is created or migrated
- When backup files are generated (pre-HANDOFF or scheduled)
- Proactively when encryption health score drops below threshold during LISTENING phase
- When the user says "encrypt database", "rotate keys", "check encryption", or "backup security"

## Mandatory Flow

```
assess_encryption_state → generate_or_load_keys → encrypt_data_at_rest → verify_integrity → schedule_rotation → backup_encrypted → audit_log → write_memory
```

## Workflow

### Step 1: Assess Current Encryption State

Evaluate the current encryption posture of all data stores:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

Inventory all data files that require encryption:

| Data Store | Location | Contains | Encryption Required |
|---|---|---|---|
| Graph database | `workflow-graph/graph.db` | Execution graph, node metadata | Yes |
| Knowledge store | `workflow-graph/knowledge.db` | Memories, RAG embeddings | Yes |
| Code index | `workflow-graph/code-index.db` | Symbol data, relationships | Yes |
| Backup files | `workflow-graph/backups/` | Full database snapshots | Yes |
| Export files | `workflow-graph/exports/` | Mermaid, JSON exports | Conditional |

Check current encryption status:

```
Tool: mcp__mcp-graph__knowledge_stats
Params: {}
```

Record the encryption state of each store: encrypted (algorithm, key age), unencrypted, or unknown.

### Step 2: Key Generation and Management

Generate or load encryption keys using a hierarchical key structure:

| Key Type | Purpose | Algorithm | Rotation Period |
|---|---|---|---|
| Master Key (KEK) | Encrypts data encryption keys | AES-256-GCM | 365 days |
| Data Encryption Key (DEK) | Encrypts SQLite databases | AES-256-CBC | 90 days |
| Backup Key | Encrypts backup archives | AES-256-GCM | 90 days |
| HMAC Key | Integrity verification | HMAC-SHA256 | 90 days |

Key storage rules:
- Master key stored in OS keychain or encrypted file with restrictive permissions (0600)
- DEKs encrypted by master key (envelope encryption)
- Never store keys in the same directory as encrypted data
- Never commit keys to version control — verify `.gitignore` includes key paths

Key derivation for new keys:
```
PBKDF2(passphrase, salt, iterations=600000, keylen=32, digest=sha512)
```

### Step 3: Encrypt Data at Rest

Apply encryption to each data store using SQLCipher-compatible approach:

For SQLite databases:
1. Create a new encrypted database file
2. Copy all data from unencrypted source using `ATTACH DATABASE`
3. Verify row counts match between source and encrypted copy
4. Replace original with encrypted version
5. Securely delete the unencrypted original (overwrite + unlink)

For backup files:
1. Compress with gzip
2. Encrypt compressed archive with AES-256-GCM
3. Append HMAC tag for integrity verification
4. Store encrypted backup with metadata (timestamp, key version, algorithm)

Record encryption operation:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

### Step 4: Verify Encryption Integrity

Run integrity checks on all encrypted stores:

| Check | Method | Pass Criteria |
|---|---|---|
| Decryption test | Decrypt and read 1 row | Row content matches expected |
| HMAC verification | Recompute HMAC, compare | Tags match |
| Key validity | Attempt decrypt with current key | Succeeds without error |
| File permissions | Check filesystem permissions | 0600 for keys, 0640 for databases |
| No plaintext leak | Scan encrypted file for known plaintext patterns | Zero matches |
| Backup integrity | Decrypt and decompress backup | Valid SQLite database |

If any check fails, trigger the self-healing loop:
1. Attempt re-encryption with current key
2. If re-encryption fails, roll back to last verified backup
3. Generate new key and re-encrypt from backup
4. Log the failure event and root cause

### Step 5: Scheduled Key Rotation

Implement zero-downtime key rotation:

1. Generate new DEK using key derivation function
2. Encrypt new DEK with existing master key (envelope encryption)
3. Re-encrypt each database with new DEK:
   - Open database with old key
   - `PRAGMA rekey = '<new_key>'` (SQLCipher)
   - Verify integrity after rekey
4. Update key metadata (version, creation date, expiry date)
5. Securely destroy old DEK after successful rotation
6. Update rotation schedule timestamp

Rotation audit trail:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Key Rotation — <date>"
  content: "Rotated DEK v<old> → v<new>. Algorithm: AES-256-CBC. Databases re-encrypted: N. Integrity verified: all pass. Next rotation: <date+90d>."
  tags: ["encryption", "key-rotation", "security"]
```

### Step 6: Backup Encryption Pipeline

Ensure all backups are encrypted before storage:

1. Trigger database backup (WAL checkpoint first)
2. Compress the backup with gzip (level 9)
3. Generate a random IV for this backup
4. Encrypt: `AES-256-GCM(backup_key, IV, compressed_data)`
5. Compute integrity tag: `HMAC-SHA256(hmac_key, encrypted_data)`
6. Write metadata header: `{ version, algorithm, iv, key_version, timestamp, hmac }`
7. Store encrypted backup with `.enc` extension

Backup verification:
- Immediately after creation: decrypt and verify SQLite integrity (`PRAGMA integrity_check`)
- Weekly: randomly select one backup and perform full restore test
- Monthly: verify all backups can be decrypted with current keys

### Step 7: Audit Log and Compliance Report

Generate a comprehensive audit log of all encryption operations:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Encryption Audit — <date>"
  content: "<encryption coverage, key ages, rotation compliance, integrity check results, backup encryption status>"
  tags: ["encryption", "audit", "compliance", "security"]
```

Track compliance metrics:

| Metric | Target | Current |
|---|---|---|
| Encryption coverage | 100% of data stores | N% |
| Key age (DEK) | < 90 days | N days |
| Key age (Master) | < 365 days | N days |
| Integrity check pass rate | 100% | N% |
| Backup encryption coverage | 100% of backups | N% |
| Last rotation | < 90 days ago | N days ago |
| Permissions compliance | 100% of key files at 0600 | N% |

## Output Format

```
Phase: ENCRYPTION MANAGEMENT
Encryption Coverage: N/N data stores encrypted (Y%)

Key Status:
  Master Key (KEK): v<N>, age <N> days, expires <date>
  Data Encryption Key: v<N>, age <N> days, next rotation <date>
  Backup Key: v<N>, age <N> days, next rotation <date>
  HMAC Key: v<N>, age <N> days, next rotation <date>

Integrity Checks:
  Decryption Test: PASS/FAIL
  HMAC Verification: PASS/FAIL
  Key Validity: PASS/FAIL
  File Permissions: PASS/FAIL
  Plaintext Leak Scan: PASS/FAIL
  Backup Integrity: PASS/FAIL

Backups: N encrypted, N total (Y% coverage)
Rotation Compliance: ON SCHEDULE / OVERDUE by N days
Overall Encryption Grade: A-F

Saved to memory: "Encryption Audit — <date>"
```

## Anti-Patterns

- Do NOT store encryption keys alongside encrypted data — keys must be in a separate, access-controlled location
- Do NOT use weak algorithms (DES, 3DES, RC4, MD5 for HMAC) — always use AES-256 and SHA-256 minimum
- Do NOT skip integrity verification after encryption — silent corruption is worse than no encryption
- Do NOT leave unencrypted copies after migration — securely delete originals with overwrite
- Do NOT hardcode encryption keys or passphrases in source code — use environment variables or OS keychain
- Do NOT ignore key rotation schedules — expired keys increase the window of exposure if compromised
- Do NOT encrypt without testing decryption — an encrypted database you cannot decrypt is data loss
