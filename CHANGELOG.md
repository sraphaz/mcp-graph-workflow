# Changelog

## [13.18.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.18.1...mcp-graph-v13.18.2) (2026-05-13)


### Bug Fixes

* **ci:** force-add provenance OTS files past gitignore ([506dd2d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/506dd2d3708020938034520da88c8bf5e95e0200))
* **tests:** remove redundant browser-pilot smoke test failing in CI ([3fe040a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3fe040a680555c3d9c302cd666691ecd54bdcaf0))

## [13.18.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.18.0...mcp-graph-v13.18.1) (2026-05-13)


### Bug Fixes

* **ci:** accept .sh.off as valid hook-disabled state in claude-settings-hooks test ([af35b2b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/af35b2b24b7b845ba5fc50596eba80df9d3b0f78))
* **ci:** migrate logger singleton → createLogger, wire browser-tests route, fix metrics ([127ee0d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/127ee0da083d35c22196741a91b01292abf1604f))
* **ci:** remove deleted modules from taxonomy, raise maestro-loop timing budget ([911bb3a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/911bb3a106815629635ca947525a295a93106fa9))
* **ci:** remove stale file reference from cross-platform-paths allowlist ([04d477f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/04d477f8198ca55d317eb3cb84f2b08d4bac35e7))
* **tests:** unique runId in empirical-model-hint seed, raise health timeout ([2217267](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2217267fc31481a9f7d137cf4cffc8dc9a324e1b))

## [13.18.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.17.0...mcp-graph-v13.18.0) (2026-05-12)


### Features

* **obs-90:** Story 9 AC — mount GET /api/v1/health in createApiRouter ([#406](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/406)) ([9526056](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9526056da4d3cc150f39831afe364fc07bfaa903))


### Bug Fixes

* **ci:** add missing migrations, wire observability/model-hub routes, fix npm audit ([#409](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/409)) ([1b971a7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1b971a7a6f7699b48bfe25499570606a3cc24800))
* **mcp:** resolve TS type mismatch in shadowBranch (start-task + finish-task) ([#408](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/408)) ([45ce855](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/45ce85562c92170620be720e8b5d96734f86da05))

## [13.17.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.16.0...mcp-graph-v13.17.0) (2026-05-12)


### Features

* **obs-90:** Story 8 AC — 0 empty catches + 0 raw throws in src/core/ ([#404](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/404)) ([eb65233](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/eb652332bfcf649cd57efc95f6a24d4b0b8eeaec))

## [13.16.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.15.5...mcp-graph-v13.16.0) (2026-05-12)


### Features

* **scripts:** add findRawThrows + audit:throws CLI for Story 8 ([#402](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/402)) ([c444b0e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c444b0e1d167854932a944a6df79863d4518b3ba))

## [13.15.5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.15.4...mcp-graph-v13.15.5) (2026-05-12)


### Bug Fixes

* **core:** replace empty catch blocks with void _err to satisfy audit-catches gate ([#390](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/390)) ([42cc725](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/42cc7252a002942e6f09271234b12d74218e6323))

## [13.15.4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.15.3...mcp-graph-v13.15.4) (2026-05-12)


### Bug Fixes

* **analyze:** add hasSourceFiles pre-check for feature_depth mode ([#399](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/399)) ([afe613a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/afe613aa921aecf9e6b325e010657b890ac61682))

## [13.15.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.15.2...mcp-graph-v13.15.3) (2026-05-12)


### Bug Fixes

* **dashboard:** add vite-env.d.ts to fix TS6 CSS module errors (TS2882) ([#397](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/397)) ([5a4d610](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5a4d6104fd87167907c43d478e3b1de784f67a79))

## [13.15.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.15.1...mcp-graph-v13.15.2) (2026-05-12)


### Bug Fixes

* **B21:** validate graph?limit query param -- reject invalid values with 400 ([#395](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/395)) ([895a1e8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/895a1e8a8dbf55c65ff05f0c94dfccfb91f3b94c))

## [13.15.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.15.0...mcp-graph-v13.15.1) (2026-05-12)


### Bug Fixes

* **api:** malformed JSON body returns HTML 400 instead of JSON 400 (B19) ([#393](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/393)) ([f7ef6f5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f7ef6f51ecbd07294a04e6f4e564aa240684b7a8))

## [13.15.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.14.0...mcp-graph-v13.15.0) (2026-05-11)


### Features

* **mcp:** Task 2.1 — rewrite browser_harness to atomic CDP primitives ([#391](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/391)) ([bd0973e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bd0973e3da8a92eac66c94ac6b7fa84360e67af2))


### Bug Fixes

* **pipeline:** stabilize dashboard build + remove tools/cli from release-please ([#387](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/387)) ([417ba08](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/417ba086c50b27468c434a24e4a7cd152757f6c0))
* **release:** remove trailing comma in release-please-config.json ([66fdab6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/66fdab6dd22ecd18babc427ae424cbdbe61ef5e5))

## [13.14.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.13.0...mcp-graph-v13.14.0) (2026-05-11)


### Features

* **atomic-files:** central registry with duplicate_file_id guard (Task 2.1) ([#372](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/372)) ([c5e7d48](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c5e7d4817fe3067fdfee191a117e4bbd9ea26570))
* **atomic-files:** markdown writer with managed block markers (Task 1.2) ([#361](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/361)) ([b1191aa](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b1191aaf26860d883c603e50373e22b90bb04ab9))
* **browser-tests:** REST router /api/browser-tests/* (Task 1.1) ([#373](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/373)) ([21edc6f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/21edc6fd1df566ef4486520a573a48e20af4b79a))
* **browser-tests:** SSE coalescing + EventCoalescer (Task 1.2) ([#374](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/374)) ([01853f5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/01853f59cbb99a279877a825f9d2339c2d1b17f0))
* **browser-tests:** use-browser-tests hook (Task 2.1) ([#375](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/375)) ([4611ce1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4611ce1689c6f4c2a3db501de54f77c9c05fe4bb))
* **dashboard:** Task 1.2 — delete gitnexus-tab (dead tab from audit) ([#381](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/381)) ([85eef3c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/85eef3ced9abcac390432fa200cc199ad0a34f35))
* **embed:** add embed() to OpenAICompatibleAdapter (Task 1.2) ([#368](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/368)) ([276e840](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/276e84077964354562362668329bdae96311160d))
* **embeddings:** add embeddingModels field to openai-compatible config schema (Task 1.3) ([#364](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/364)) ([bcd882c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bcd882c5906093963d3292c775f7f17b6babd050))
* **epic:** browser-harness MCP rewrite + policy-engine + self-healing ([#385](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/385)) ([9aea1b1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9aea1b19084720c3cef0c1edc253987fd1e7c5e4))
* **excision:** Epic — Excisão do stack LLM (Tasks 1.1–1.4) ([#384](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/384)) ([0437668](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/04376686c8e3eb598bee8a28b569812b75365d52))
* **local-hub:** add "local-hub" to ProviderNameSchema (Task 3.1) ([#365](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/365)) ([ec36d7f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ec36d7f2e71edbc36b5699291b670d7a25b23508))
* **local-hub:** LocalHubAdapter wraps OpenAI-compat protocol with BackendUnreachable (Task 3.2) ([#366](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/366)) ([48e3309](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/48e3309039d15f96fff44dfd0b6957789173f8fe))
* **model-hub:** OpenAI-compat HTTP router ([3bc3ba0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3bc3ba0ada691688c2f9fd154b7858d290adce4c))
* **model-hub:** OpenAI-compat HTTP router (Task 1.2) ([#342](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/342)) ([3bc3ba0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3bc3ba0ada691688c2f9fd154b7858d290adce4c))
* **model-hub:** register model-hub.config.json as atomic file (Task 5.1) ([#367](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/367)) ([3c8dbb8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3c8dbb8bb93c84a413e1ea226a560b1b7d949a87))
* **playwright:** passed→artifact promoter — spec.ts + recipe.json + manifest (Task 1.3) ([#371](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/371)) ([f2c0696](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f2c06961be966a9c8273050ecd21545a1228f9bc))
* **playwright:** recipe → spec.ts generator with zero mcp-graph deps (Task 1.2) ([#370](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/370)) ([f1f1e08](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f1f1e08366189c6a858074addb4bc0a8d974000f))
* **policy-engine:** Task 1.1 — PolicySignals/PolicyConfig/RouteDecision types ([#383](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/383)) ([a16acc7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a16acc71bf80f51c26208558061b7bfeced32ce3))
* **recipe:** Zod schema for recipe.json with evidence-required steps (Task 1.1) ([#369](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/369)) ([b46baea](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b46baea2774eeba4fdbb49d18bac44d32077732b))
* **self-healing:** Tasks 1.1 + 1.2 — FailureSignal schema + failure_signals migration ([#382](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/382)) ([fb9a304](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fb9a3045ab61bebbbb4d55591419f47c03b4a101))
* **sentrux:** register in IntegrationOrchestrator + scan_complete event (Task 1.1) ([#376](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/376)) ([f385b1c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f385b1c80fc51877c31d45bc30ca93d0d4fb3d1a))
* **sentrux:** Task 1.2 — presence detection with soft-fail ([#377](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/377)) ([71eecd1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/71eecd171dc9d567610f84b5e8668656add6398e))
* **sentrux:** Task 1.3 — wire 4 MCP tools via adapter with Zod schemas ([#378](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/378)) ([da5b359](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/da5b3596077b66323c277fe4bbcb7bab15eb448f))
* **sentrux:** Task 2.5 — replace feature-depth gate with Sentrux advisory ([#379](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/379)) ([220b6d3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/220b6d39f71f54b1148f3ae95c28207b974c8c1a))
* **story10:** AgentMonitor trail/now/next components + API endpoints ([#386](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/386)) ([63f185e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/63f185e5d59e89c67842563c883102df8352d153))
* **streaming-sse:** generateStream() in OpenAICompatibleAdapter (Task 1.1) ([#363](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/363)) ([10cbe51](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/10cbe512a4480ffc16f94c23b4b4c7f685f8b9d6))
* **streaming-sse:** Task 1.2 — SSE mock fixtures for adapter tests ([#380](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/380)) ([e72cba1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e72cba1bce7a68065c656cd5297d9cc23306664f))

## [13.13.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.12.0...mcp-graph-v13.13.0) (2026-05-09)


### Features

* **atomic-files:** types + interface — AtomicFile, AtomicFileMode, WriteResult (Task 1.1) ([#359](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/359)) ([d21f2b5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d21f2b5a94467bb1444d0f7e1be8c7d222abbeeb))
* **sentrux:** violations catalog — 0 real violations, 3 false positives (Task 0.4) ([#358](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/358)) ([17af200](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/17af2003ee200080cbfc43e09f766347a6d0728a))

## [13.12.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.11.0...mcp-graph-v13.12.0) (2026-05-09)


### Features

* **browser-harness:** Task 4.1 — BrowserTestNode schema + migration v90 ([#355](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/355)) ([5f8556a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5f8556ac400fd4efd54379430e7c3fdd04987e36))
* **sentrux:** starter rules.toml with layer conventions (Task 0.3) ([#357](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/357)) ([e222d85](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e222d85b01ddb7737373bedcc0534d71322b7efe))

## [13.11.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.10.0...mcp-graph-v13.11.0) (2026-05-09)


### Features

* **event-store:** Task 1.2 — EventWriter buffered flush + circuit breaker ([#352](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/352)) ([da9f344](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/da9f3445d92102261b8dd19bf81411b405cb78c9))
* **event-store:** Task 1.3 — Query API + migration v89 ([#354](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/354)) ([0ef4f75](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0ef4f7566fd64d94b4a09d4813ab3606e0cf2c67))

## [13.10.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.9.0...mcp-graph-v13.10.0) (2026-05-09)


### Features

* **credential-pool:** Task 1.2 — CredentialPool round-robin + circuit breaker ([#349](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/349)) ([d176eea](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d176eea257707f024d1e0a26accf5c106ffe2bfa))
* **event-store:** Task 1.1 — Zod schema + migration v88 for events table ([#351](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/351)) ([d47152d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d47152da85e8b13f5ad42f1301fadc22b6e34ee3))

## [13.9.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.8.0...mcp-graph-v13.9.0) (2026-05-09)


### Features

* **credential-pool:** Task 1.1 — Zod schema CredentialPoolEntry ([#348](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/348)) ([f94fafc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f94fafce37f3fb40531bc051b8ada2b9d14e70c8))
* **domain-skills:** aggregateBySite() — pure skill candidate aggregator ([#346](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/346)) ([8788a15](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8788a155488baead13cd37168d2bd34ff53c03c7))

## [13.8.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.7.0...mcp-graph-v13.8.0) (2026-05-09)


### Features

* **embeddings:** extend ProviderAdapter with optional embed() + Zod schemas ([#343](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/343)) ([d29d56b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d29d56bf9d656736168bcb36bab1f8e0fc7ba808))
* **vendor-scan:** pure walkVendor() function — Task 1.1 ([#345](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/345)) ([a6e60d6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a6e60d6e3cb913f99eef990c7cb54b78a71b227f))

## [13.7.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.6.0...mcp-graph-v13.7.0) (2026-05-09)


### Features

* **agent-explode-view:** GET /agents/now + useAgentState hook ([#341](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/341)) ([888b7a0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/888b7a0db38581a145d53dd212ef646792265f5d))
* **model-hub:** Zod config schema + LocalBackendAdapter interface ([#339](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/339)) ([f6fe8fc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f6fe8fc259725e25de1c6f2d935d2d83cfbc9436))

## [13.6.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.5.0...mcp-graph-v13.6.0) (2026-05-09)


### Features

* **dashboard:** tab audit script + inventory (Task 1.1) ([#338](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/338)) ([bf501e3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bf501e3c0066b05ba28b1fe73de3ff828c841e52))
* **model-hub:** vLLM HTTP adapter — health + streaming (Task 1.1) ([#336](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/336)) ([c9ac66e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c9ac66ecd221ab67d59513e649cc368f52bbab69))

## [13.5.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.4.0...mcp-graph-v13.5.0) (2026-05-08)


### Features

* **help:** add version topic + ECS error context + logger.event ([#321](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/321)) ([eb8d141](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/eb8d1417f26f468495ace36c4044075f06855509))
* **obs-90:** observability epic — layer tagging, ECS shape, client logger, logs UI ([#334](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/334)) ([917fe8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/917fe8c23c9f0014a3aff3215368ff7ab3cc4b68))

## [13.4.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.3.4...mcp-graph-v13.4.0) (2026-05-03)


### Features

* **observability:** logs/ingest endpoint + layer tagging + LogLayer schema ([#319](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/319)) ([4b74acb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4b74acbf4bb8b9b98c0967623152648d9980e5a3))

## [13.3.4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.3.3...mcp-graph-v13.3.4) (2026-05-03)


### Bug Fixes

* **bug-hunt:** batch 3 — close v13.3.1 hunt epic (B19/B23/B24/B29/B30/B31 + 8 hunt closures) ([#317](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/317)) ([f36c696](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f36c696320517df326985c1d3f6e2f822f0ece55))

## [13.3.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.3.2...mcp-graph-v13.3.3) (2026-05-03)


### Bug Fixes

* **bug-hunt:** batch 2 — import + stats UX (B12, B13, B14, B15) ([#311](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/311)) ([ed1d88b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ed1d88b1241b656274ef509c0268e670f3946e7e))

## [13.3.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.3.1...mcp-graph-v13.3.2) (2026-05-02)


### Bug Fixes

* **cli:** bug-hunt batch 1 — corrupt DB friendly error, port collision, harness scan noise ([#308](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/308)) ([8ced33c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8ced33c227f1f04d25b3d4dd3c5347a5349fbb17))
* **release:** v13.3.1 papercuts — serverInfo version, git stderr, lint ([#307](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/307)) ([6c68c72](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6c68c727dd56e81e060968e9922ea0dd7b0c2e40))

## [13.3.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.3.0...mcp-graph-v13.3.1) (2026-05-02)


### Bug Fixes

* **hooks:** restore block-dangerous-git.sh; unwire from settings instead ([#305](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/305)) ([33a8255](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/33a8255b62c2259df8935e4efe9e42aa16e3eb2d))

## [13.3.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.2.1...mcp-graph-v13.3.0) (2026-05-02)


### Features

* **constitution:** karpathy-baseline built-in + 2 DoD checks (simplicity, surgical) ([#291](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/291)) ([bf1ca2c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bf1ca2cf0223928b90ab6d9ba1fb2f422743ce4c))


### Bug Fixes

* **harness:** distribute violation cap fairly across dimensions ([#298](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/298)) ([c61e5fb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c61e5fbe02ae7ba4c791b9499e4db964f73740d9))

## [13.2.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.2.0...mcp-graph-v13.2.1) (2026-04-30)


### Bug Fixes

* pipeline issues — pdf-parse v2 migration + shell-handler test stability ([#296](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/296)) ([b490f35](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b490f3531bda92a1002b57fca68680c819dc08e3))

## [13.2.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.1.0...mcp-graph-v13.2.0) (2026-04-30)


### Features

* **browser-harness:** event-driven watchdogs ([#289](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/289)) ([d814506](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d814506b1200ea231b9dd0cea517af265880514b))
* extracta completion — close 3 residual integration lacunas ([#293](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/293)) ([6fa651f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6fa651f36dc297fa9d0dc60e618b7c908b1fdbb2))
* **llm:** session budget + soft-cap auto-fallback ([#288](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/288)) ([36468ac](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/36468ac993c11aff3d72e332bfefdf0540c4dc8a))
* **skills:** browser auto-skill proposer + 3 domain knowledge files (ml, systems, crypto) ([#290](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/290)) ([003baa6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/003baa6fa24ee0c7a85cf720782083dcd8288793))
* wire extracta watchdogs + browser-skill auto-proposer ([#292](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/292)) ([5a40d22](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5a40d22e821c9cd845078cb9e34c934209379ade))

## [13.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v13.0.0...mcp-graph-v13.1.0) (2026-04-30)


### Features

* extracta sweep PR1 — evolution audit + platform-aware skills + 4 ported skills ([#287](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/287)) ([c18d63a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c18d63a2d4435725560e0f9a945a93693387bf07))

## [13.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v12.1.3...mcp-graph-v13.0.0) (2026-04-29)


### Features

* release v13.0.0 with self-hosting régua + auto-merge + agent monitor ([1bbb560](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1bbb5604edf83f65aba4bc0dec9ceae62bb21f0f))
* **release:** v13 — self-hosting régua + auto-merge cycle + agent monitor ([4c22f8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4c22f8cfdb69da3cedb3ab4793941899d8e7f67d))

## [12.1.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v12.1.2...mcp-graph-v12.1.3) (2026-04-29)


### Bug Fixes

* **ci:** allowlist Claude + bot pattern in CLA check ([1c2fca5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1c2fca5324b360a5e74af61425d8e24b05567fe3))
* **ci:** CLA allowlist — lowercase 'claude' (GitHub login is case-sensitive) ([6e7e19c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6e7e19c598ea8c1c0454e57d5f237dba30e88331))

## [12.1.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v12.1.1...mcp-graph-v12.1.2) (2026-04-26)


### Bug Fixes

* **build:** fail copy-grammars if zero wasm files bundled ([#268](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/268)) ([c9a8c4d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c9a8c4de5f32c44f84dfed25f035a10b9baea4d8))

## [12.1.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v12.1.0...mcp-graph-v12.1.1) (2026-04-26)


### Bug Fixes

* **vercel:** no-op install/build + .vercelignore (unblock landing deploy) ([#262](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/262)) ([8f887df](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8f887df3b2670516501130b386aa73abb35ead81))

## [12.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v12.0.0...mcp-graph-v12.1.0) (2026-04-26)


### Features

* **release:** release-monitor skill + always-on scan check ([#264](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/264)) ([4be9020](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4be90201d233d455344c0f4ad7c218d3d491d4c7))

## [12.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v11.0.0...mcp-graph-v12.0.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* `@mcp-graph-workflow/cli` is no longer published as a separate npm package. Anyone who depended on `@mcp-graph-workflow/cli@beta` directly should switch to `@mcp-graph-workflow/mcp-graph@>=12`. The bundle that used to be at `node_modules/@mcp-graph-workflow/cli/dist/cli.mjs` now ships at `node_modules/@mcp-graph-workflow/mcp-graph/dist/v11-cli.mjs`.

### Features

* v12 unification + launch landing + AISE reframe + Vercel deploy ([#257](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/257)) ([9ff85df](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9ff85df42e9fd467f61f338a5bbaff125e3706e2))


### Bug Fixes

* **release:** drop dashboard npm ci step from publish job ([#258](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/258)) ([29536ad](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/29536ad7d806cca9da5ca595bba7b4a4b6fce007))

## [13.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v12.0.0...mcp-graph-v13.0.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* `@mcp-graph-workflow/cli` is no longer published as a separate npm package. Anyone who depended on `@mcp-graph-workflow/cli@beta` directly should switch to `@mcp-graph-workflow/mcp-graph@>=12`. The bundle that used to be at `node_modules/@mcp-graph-workflow/cli/dist/cli.mjs` now ships at `node_modules/@mcp-graph-workflow/mcp-graph/dist/v11-cli.mjs`.
* **cli:** `mg` bin removed. The `@mcp-graph-workflow/cli` package no longer ships a binary. Migrate scripts/CI/aliases to `mcp-graph` per docs/migration/mg-to-mcp-graph.md.
* mcp-graph v10.0.0 is licensed under AGPL-3.0-or-later. Running a modified mcp-graph as a network service (MCP server, REST API, integration orchestrator) for third parties now obliges you to make the corresponding source available to those users under AGPL, per section 13 of the license. Organizations that cannot adopt AGPL can obtain a commercial license — see COMMERCIAL.md.
* v8.0.0 release — tool consolidation, spec-driven development, NLP engine, analytics API
* Old tool names (rag_context, reindex_knowledge, knowledge_stats, knowledge_feedback, export_knowledge, siebel_*, davinci_*) are removed. Use the consolidated tool with action parameter instead.
* v7.0 consolidation — remove deprecated tools, add unified gate and graph health

### Features

* Add community rebuild trigger, v7 benchmark, and graph sync ([109f27c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/109f27c21b4a7ea387fa0ad6585fdd46301f80c6))
* Add dashboard UX overhaul, hybrid RAG scoring, and harness engineering ([93ea238](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/93ea238c113ec9dbd07fb164f386683dbd25de27))
* add design tokens, UI components, and performance utilities ([274e9b2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/274e9b2afc64167ae96ea933190fc77bca982c88))
* add feature-depth analyzer v2.0 — 7 mathematical frameworks for depth analysis ([ea2e12c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ea2e12c433f7fc3881baefa213fe88f3de7ab4cf))
* add import_graph MCP tool for collaborative graph merging ([704c066](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/704c066d76b64412a02e35e38e98c8712147c972))
* add IR canonical representation and declarative rule engine (sprint-2, tasks 4.1+4.2) ([d8c15bc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d8c15bc8c52e08299900946aa2a5371ff0bbd034))
* add journey MCP tool and RAG knowledge indexer ([3e97e3b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3e97e3b86aac3f746baf01e0c864f36cf933aaa1))
* add Journey tab for website screen mapping with React Flow ([febb26f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/febb26fb0d4bcfcbc37f8bbf173471d90d30c2d6))
* add journey tests (store + API completeness) and update docs ([d6a3fd9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d6a3fd96af40033d02417391274809feca75c7d0))
* add Knowledge Graph entity extraction and graph-based RAG retrieval ([2a1569f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2a1569f38f24920131b819f17e241673902fb80d))
* add knowledge quality engine with scoring, decay, and usage tracking (Phases 1-2) ([ca3e1ff](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ca3e1ff9d6f284828801dcc7dcd565460d204ec7))
* add multi-language parsers and translation memory (sprint-3, 6 tasks) ([40ca907](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/40ca9071689fccd98b3af32ae364af503c7566ac))
* add red Beta badge to Journey tab in navigation ([4c72c94](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4c72c9419003cf0655ad20357e5ea913702367d2))
* add Siebel CRM 15 integration with SIF parser, Composer automation, and 6 MCP tools ([26cfb92](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/26cfb9254bcdd269b6dfe4bcceda89701d6eb78b))
* add SIF generation pipeline with RAG context, dashboard Siebel tab (Beta), and 4 new API endpoints ([8904a0c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8904a0cdf0ee98116248ba14adf42c12bc0af729))
* add Swagger/WSDL parser, DOC/DOCX parser, and import docs MCP tool (Phase 3B) ([20e4dcc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/20e4dccb29c19a3ae46f3bb5c04d8f5c6eadc5fb))
* add validators, repair loop, and translation pipeline (sprint-2, tasks 4.3+4.4+4.5) ([ad01ee7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ad01ee734796672ce997650f254e12a703eaef22))
* **analyzer:** economy simulation — gold inflow/outflow inflation detector ([4c049af](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4c049af03166ec4916ea3518f660073c3532159b))
* **analyzer:** Sprint 5 — game-specific analyzers for complex projects ([7ca1f44](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7ca1f4481d1270bc8be64129831f28d7a389fb14))
* **api:** Autonomy REST API + E2E pipeline integration test ([1f2bbe7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1f2bbe79c084ab781076273aeec1bea8841be202))
* **api:** Autonomy REST API + E2E pipeline integration test ([eb8b578](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/eb8b5783343040d9b8d9218dd8d47740f2f57dd0))
* auto-capture knowledge from AI decisions, validations, and code analysis (Phase 3) ([c9bf449](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c9bf449fd835c1a4520ef361dcd0b2570c8f561c))
* auto-promote epics + cascade status propagation ([a01d246](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a01d24665377aedb4e5a257c3f6cd61ac678db5c))
* Backend audit wave 2 — 9 fixes across translation, MCP, dashboard, parser ([#102](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/102)) ([1e95875](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1e9587515eca8ce99df9d17403f6192bd7e8a805))
* Backend audit wave 3 — language parsers, detection, large files, dashboard ([#104](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/104)) ([b21403f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b21403f867af61c4edf13d0ec4a9b96fd8f7d3da))
* **capability-gate:** per-task-type granularity (H12-tests v4 confirmed) ([#245](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/245)) ([e963a06](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e963a06f4cd131e5236c4efaea555dd275858f4a))
* **cli:** mg deprecation banner + docs sweep to mcp-graph (PR 2/3) ([#253](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/253)) ([983f082](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/983f0827c212856cc78af757f17e67133cdfeb2b))
* **cli:** unified mcp-graph bin — drop mg, ship v12.0 (PR 3/3) ([#254](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/254)) ([4d5fb1b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4d5fb1b41b250b4420d8ec186223b30d76ebf048))
* **cli:** unify v11 lifecycle commands under single mcp-graph bin (PR 1/3) ([#251](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/251)) ([d126be8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d126be8438d3777910d87e481a23f9817d5885d9))
* **cli:** v11 beta — Ink REPL, hooks-collapse, set-phase, tools/cli [@beta](https://github.com/beta) ([#234](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/234)) ([94d215a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/94d215a7d680637b8bbe907348f7e4c5a4520912))
* close RAG indexing gaps — graph nodes, code symbols, skills, clone, import ([ab4d4f2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ab4d4f229a596ec60bb76595b3aa5e2f51c81ab9))
* **code-graph:** multi-language support with tree-sitter + FTS5 rebuild fix ([dd14d65](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dd14d652900407662f52b9899d26fe2869e69530))
* **code-graph:** periodic reindex with git hash staleness + RAG sync ([9e29fd6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9e29fd69d5718e6c9a49d014f2eb5081f90ad2b3))
* **code-intelligence:** full multi-language support for Code Graph ([c6a1b3e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c6a1b3ecc440a5761ee0a723a2a361c64a46c1e8))
* **code:** improve ts-analyzer resilience and init-project robustness ([05973dc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/05973dc99d585c26cccb6db20808edc0d0f18196))
* column toggle in node table — hide/show columns with localStorage ([8b2f8c7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8b2f8c717eae00cf20ef401433566715a5084049))
* content-type-aware smart chunking for RAG pipeline (Phase 4) ([931b5c5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/931b5c5d34747f5807aa53d0eb7ee6ffb01dbf4f))
* context-hub superpowers — token economy, intelligence, maintenance ([916fc3a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/916fc3a8ae79fdcc1211a62c2ebe6d4835ebc893))
* **core:** AC scoring, testFiles, task templates, velocity by category ([afd1685](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/afd1685f2be3c9bbdd0b327567b6f9ce1c4dc5e3))
* **core:** Phase A Quality Sentinel — Contract Engine + TDD Gate + Citations ([904ef5b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/904ef5bb5bac908b6e34633bcc8ab346e2c21d00))
* **core:** Phase A Quality Sentinel — Contract Engine + TDD Gate + Citations ([e280188](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e2801882f71002fde120b5790470fd534a6f6002))
* **core:** Phase A Quality Sentinel — Invariants + Test Discovery + Provenance ([195fda2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/195fda2755e79d287ec61e62f1b232ac0d8c7f08))
* **core:** Phase A Quality Sentinel — Invariants + Test Discovery + Provenance ([b02dff2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b02dff2a79d35b606f21396ed4c8944b42c4bbd6))
* **core:** Phase B Token Optimizer + Phase C Adaptive Intelligence ([8ee1609](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8ee160966ab86bca931b1094f71d5dd1dcd18465))
* **core:** Phase B Token Optimizer + Phase C Adaptive Intelligence ([577666f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/577666f90638911ba6bf7456bc29261ceed7ffbe))
* **core:** Phase C complete — Self-Healing Planner (MAPE-K IBM 2003) ([40f882e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/40f882e497e0e9efda3bb921a1992006ea69a1df))
* **core:** Phase C complete — Self-Healing Planner (MAPE-K IBM 2003) ([518d045](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/518d04519f415aa53606396fd8193f9a78543bf7))
* **core:** Phase C Synthetic Data + Phase D Autonomy Foundation ([abf7092](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/abf709241f13a42643f5143db945b0dbc9f3cba5))
* **core:** Phase C Synthetic Data + Phase D Autonomy Foundation ([2968df5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2968df58fc8667ca4e56fc6e66dd40db6aebc955))
* **core:** Phase C Synthetic Data + Phase D Autonomy Foundation ([b3f8cad](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b3f8cadd5f0b117ceb5058f64b634f2050fd10a4))
* **core:** Phase C Synthetic Data + Phase D Autonomy Foundation ([80b1b0e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/80b1b0e4d84642d437c1d4a97ed5e0206db93f26))
* **core:** Phase D Autonomous Loop — Autopilot + Confidence + Bridge ([24a3352](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/24a335204111b796045528e10b5fce43d4b7579a))
* **core:** Phase D Autonomous Loop — Autopilot + Confidence + Bridge ([3d9bd6c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3d9bd6c3f0e25bf2dd9340f0ef58337f96979940))
* **core:** Phase D Autonomous Loop — Graph Rollback + Shadow Branching ([98baeaf](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/98baeafe181e417b6e341daeeb9fd708d51ee78c))
* **core:** Phase D Autonomous Loop — Graph Rollback + Shadow Branching ([9affd67](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9affd678acbec069f2e2a4aead9233fbb557b638))
* **core:** PRD diff tracking + task templates ([9053f7f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9053f7fc36c94a9ced1711fc211f63936b33b819))
* **core:** Sprint 1 — P0 core fixes for complex projects ([e49a448](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e49a44897d76e7245a481a51c9b4300b5e63fe27))
* **core:** Sprint 2 — P1 precision, analysis & bug fixes ([74f8dce](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/74f8dce483b9e2aec0eea5d0e0a4381d58e81848))
* **core:** Sprint 3 — P2 export formats, changelog & AC coverage ([9a11b86](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9a11b86d4acab95e5dc7edd8562342fc14966394))
* **core:** Sprint 6 — state diagram export + 5 remaining game analyzers ([4191aea](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4191aea41beeba73dca6d6da10c7b3093a9fb849))
* **core:** Wire last 2 islands — RecoveryOrchestrator + AutopilotRecoveryBridge ([94da569](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/94da5690134aab93fb2c5973df47d2f1d1e1ac0a))
* **core:** Wire last 2 islands — RecoveryOrchestrator + AutopilotRecoveryBridge ([fb138c0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fb138c03c88168afbba4aaeaf5aecccd7f18e5e4))
* cross-source knowledge linking via shared nodeId and tags (Phase 5) ([bd556fc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bd556fc45f07e774b8ba466ce5b3a75bf14104a7))
* dashboard perf sprint 2 — node detail API, viewport culling, virtualization ([e686f53](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e686f530a63fbe08e270dfe5f745500945dccb6a))
* **dashboard:** add colors/styles for 10 new node types + 3 edge relations ([9caf21d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9caf21db7715970c553fe8a032bacfac6b093970))
* **dashboard:** add skills management UI, context budget tab, and modals ([a2bbff2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a2bbff2735e2fb70a2a00010361a6cf249199353))
* **dashboard:** Add Skills tab with token estimation ([e24db2d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e24db2d28878a9babec84de27e1e74081b7fb89f))
* **dashboard:** API client + types for translation — 7 methods, 8 interfaces ([219f857](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/219f857fb2db7a8ed67fc2a23dac320583cbef97))
* **dashboard:** Autopilot tab + Contract violations + Autonomy API + E2E ([89f9743](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/89f97436d8a66f4b6d58f4bdccd270d999cea4db))
* **dashboard:** Autopilot tab + Contract violations + Autonomy API + E2E ([2c60a7e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2c60a7e40a294d6282b36fc4033bc8b4e1eea4e9))
* **dashboard:** Languages tab UI — 2-phase translation workflow ([7295cef](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7295cefc33cd029dac5831671a370a3cdbc2978b))
* **dashboard:** LSP tab — language server status, symbol explorer, diagnostics ([bd1a745](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bd1a74540c17c3e391560bf7e637bac6f284c9ff))
* **dashboard:** LSP tab — language server status, symbol explorer, diagnostics ([e907576](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e9075766ac43ac13491e41e03415053040bacb31))
* **dashboard:** redesign with sidebar navigation, modern UI, and responsive layout ([4e086b5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4e086b5338e313c5be97df4254bf2d7d5ca3a3b3))
* **dashboard:** register Languages tab — sidebar + lazy load + placeholder component ([8aabad6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8aabad631ed780ede1831491cbbba1d8481458c0))
* **dashboard:** translation hooks — useTranslation (2-phase workflow) + useTranslationHistory ([7926c8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7926c8c4d6b7aad2cbb9494d826c35f43bcc820c))
* **davinci:** add DaVinci JS to PingAccess/PingFederate Java plugin converter ([4a86c21](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4a86c2140f228e8ad9fdb9351884d997ddb27bd2))
* **deploy:** add DEPLOY as 9th lifecycle phase + CI/CD pipeline infrastructure ([32c1876](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/32c1876961a5535980a43c205839dbf56ec3cd08))
* **docs:** update lifecycle phases and mandatory execution rule in documentation ([cc21edd](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cc21eddcecf4e90b395ea6603193e6a55edcaad5))
* **dream:** add DreamMode — REM-inspired knowledge consolidation engine ([5ccd128](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5ccd128d61ad00121c1588082065d7dca4f82e61))
* enhance UniversalGenerator with top-level construct filtering and parameter transformation ([d719e07](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d719e0780d55c2259e5f40ab21c659590bfd9092))
* **events:** translation event types — job_created, analyzed, finalized, error ([31aa0b9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/31aa0b9daeb7d26373dbd57477348dffe58e59e5))
* Grade AAA+ Phase 1 — ONNX embeddings, hybrid search, multi-agent foundations (7/18 tasks) ([ebce520](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ebce520d1e63c1d6b071118fad7f6aadaff5aef2))
* Grade AAA+ Phase 1 Sprint 2 — decision fitness, community RAG, API pagination, BM25+ ([b6182f3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b6182f33264df04f8c8cc8e14385c305bdfbf29b))
* **graph:** fix hierarchy and relationships in PRD import and graph operations ([d9837f5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d9837f5b159408866fd1b12cf77956dfa03c69b3))
* Harness Engineering v4 — Deterministic Remediation Engine + Full Feedback Loop ([857f077](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/857f077cda871d2ff412d115bc957acc41bddb44))
* **hermes:** integrate 10 hermes-agent features — security, cost, context, sessions, orchestration ([0c30a71](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0c30a71d1eb160a1d8f3f2543cce72112cdbf497))
* implement cache layer optimization (sprint-1-cache, 9 tasks) ([8ee4a44](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8ee4a44634f0e7a7b470573e59224a75d93b95af))
* implement end-to-end RAG architecture with 8 new pipeline modules ([6185ce9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6185ce9f74bc3b6860140177e0e549b1c22b3e3d))
* incremental embedding updates and multi-strategy retrieval (Phases 6-7) ([5095cea](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5095ceaa04bb9845782dc89b24dc580f330532f7))
* integrate Knowledge Graph entity indexing into all MCP tools and data sources ([49c12d0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/49c12d03dc38bef53cac0861f0d2ce028f0c3a28))
* integrate quality gates into finish_task pipeline ([24a8622](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/24a8622bd0316916578acdd92d6f618a7db290a9))
* integrate RAG pipeline modules into production code path ([e6cf376](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e6cf376788afb36d0cc82502b71274ee3998e0aa))
* knowledge feedback loop and enhanced MCP tools (Phase 8) ([f8b1572](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f8b15724faca7a7a749598eda740577e6e8202a0))
* **knowledge:** Knowledge Package export/import for team collaboration ([#107](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/107)) ([42097a4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/42097a4c893388d2c84fee20b0a06eb942ac6365))
* **language-convert:** Language Convert v2 — full project conversion, deterministic indicator, knowledge tab ([454b913](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/454b9139718cec3001e0f958baebfd0e5f2d9dd9))
* **language-convert:** React Flow graph + expandable Knowledge entries ([01d6a16](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/01d6a165275752ad23a897eec2ae38cc41f88567))
* **lifecycle:** tool prerequisites enforcement — mandatory tool gates per phase ([fd08bfe](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fd08bfee00570de69eb1cf3b7d1023a2cf985b09))
* **lsp:** auto-detect and check LSP language server dependencies ([091126e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/091126ef8216f960c4fd4d2a5471bd877b0fb2b5))
* **lsp:** edit applier — atomic workspace edits with rollback, code-intelligence write ops ([eadf5ef](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/eadf5ef096fa91f78e3b57de4bf64d113c08cf06))
* **lsp:** LSP/CodeGraph fixes, performance, bundled language server ([1dc54be](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1dc54be03e709854ed136ff2efa0bfe865fcffcc))
* **lsp:** Multi-language LSP integration ([fdf433a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fdf433a13090fdfa66f0f5d2a0331d045d19fc73))
* **lsp:** Multi-language LSP integration — code intelligence via Language Server Protocol ([f8ec2ea](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f8ec2ea05f8cd34c182313acafe1c9866b5e2b8d))
* **lsp:** rename UI, warm-up, auto-refresh status ([0f6e1c5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0f6e1c507f20debab83aaa8bb064445fe77c3783))
* **mcp:** code intelligence auto-enforcement wrapper — strict/advisory/off modes ([3e304e6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3e304e68eeeaebd75b7c963b5151b176e8478a27))
* **mcp:** daemon_status tool for runtime observability ([#187](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/187)) ([56936ef](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/56936ef32214195490faae01279329a86b08ffee))
* merge import_graph MCP tool for collaborative graph merging ([a8ae6ab](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a8ae6ab552e54ed72e89be8b8dc8c1cd49b08f02))
* merge Knowledge Graph entity extraction and graph-based RAG retrieval ([5fbba79](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5fbba792d27f615cd008fc9eb87c90b676427b1f))
* merge RAG architecture with 8 new pipeline modules ([c63a338](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c63a3384c00a8281404468796a6271746ad743e2))
* model router — task readiness score + auto-decompose + skill hints ([#183](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/183)) ([042bf39](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/042bf39c393669ec0e10a6bad8ebba8763a22bd1))
* multi-agent observability, store resilience, and dashboard insights ([0a348b9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0a348b95bff4f9cbad30778c1c42c1607307cad7))
* multi-strategy retrieval with RRF fusion and source diversity (Phase 6) ([31d69a6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/31d69a69bccffdce20da1d8af6b5b12ee6bd7186))
* Multi-Terminal Orchestrator — teamTask mode for parallel agent coordination ([bc13ecb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bc13ecb0925d81047a95f806e91d8fec1e4b3589))
* multi-terminal orchestrator Phase 2+3 — event bridge, orphan detector, heartbeat ([d6f866c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d6f866c1622b4957f15302d94dd15e92461d42ef))
* NLP engine quality — unified tokenizer, stemming, fuzzy search ([a676507](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a6765073809a65317440df50b4f596e76c6cac1c))
* **observability:** LangWatch-inspired deterministic agent foundation ([99e25c4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/99e25c489166eed70d40895466db5e35f5855737))
* Overview dashboard tab — KPI cards, health gauge, quick actions ([368b3d8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/368b3d824fff57cfa5ac15f81713163579801a90))
* **perf:** cache layer optimization — SQLite PRAGMAs, eliminate N+1 queries, fix LRU, extend RAG cache ([263316b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/263316b51dbab108e191c2409429079d84dc0154))
* **pipeline:** Wire autopilot + adaptive budget + pruning + citations ([50439bc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/50439bc457e0fae1f2f9ee39dd17d86f6dd0e3dd))
* **pipeline:** Wire autopilot + adaptive budget + pruning + citations ([ee352f2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ee352f26f55fae8a65a42997f4fc64a161903e73))
* **pipeline:** Wire Phase C+D modules into live pipeline ([02ccdb8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/02ccdb81cd63a8a4428507240fddcc3fd3a1dabd))
* **pipeline:** Wire Phase C+D modules into live pipeline ([947b87c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/947b87c6183fb404b756f6b7cea89b86b600fd0f))
* **pipeline:** Wire runTestGate into finish_task — DORA Shift-Left live ([c86169b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c86169b197cc010a6c1636109618ec280f0ef5a1))
* **pipeline:** Wire runTestGate into finish_task — DORA Shift-Left live ([708bc47](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/708bc47b1a1d063b07b3e1a20cb4606e69e2ac48))
* **pipeline:** Wire shadow branching into start_task + finish_task ([b589079](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b58907938e1ddb507a2a5400456581cf21d229f0))
* **pipeline:** Wire shadow branching into start_task + finish_task ([5aa264e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5aa264e65172630690fe3324b33f43ba9e0f5847))
* **pipeline:** Wire TaskPrefetcher — CPU pipeline pattern for context ([99ff58c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/99ff58ce243ec73b4e6d6659045bd199c2588640))
* **pipeline:** Wire TaskPrefetcher — CPU pipeline pattern for context ([1164769](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1164769894d7124b07ccf3af82472ae1528c3f28))
* quality gates — 4 analyze modes for automated security, quality, tests, observability ([41b3a44](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/41b3a4492944f27cec14fb3de7a38b930e3c3456))
* relicense from MIT to AGPL-3.0-or-later + dual commercial (v10.0.0) ([#194](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/194)) ([2b21bc5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2b21bc59bc07f24ad3af07465cda846af5900dce))
* **sandbox:** Wave-12 sandbox build foundation (schemas + architecture + fallback) ([#191](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/191)) ([d7ef28d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d7ef28dd616b2bd9472f9d2bde02362266e836a8))
* **schema:** Sprint 4 — expand node types + edge relations for game projects ([7ccc601](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7ccc60181f7a1973e11dce241063b61869d7c1d6))
* self-learning knowledge synthesizer for pattern detection (Phase 5B) ([ca2e42b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ca2e42b4c9137c36cba43f874888c347d1a50c2c))
* **siebel:** batch import via directory param in siebel_import_sif MCP tool ([bfebc70](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bfebc708f719049b702e5c58bfdce317b4f2394a))
* **siebel:** Sprint 1 Foundation — expand SIF parser + 6 new core modules ([5b39b51](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5b39b516a2a3882c3efd32024808498a8c608e54))
* **siebel:** Sprint 2 Intelligence — eScript indexing, WSDL knowledge, health check ([70f5527](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/70f552799789307b419f061ac83d4a6b4ef66454))
* **siebel:** Sprint 3 Analysis + Knowledge — 7 new analysis modules ([f559eb8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f559eb8aeb5401e8e9d3024f96d81b5131cab431))
* **siebel:** Sprint 4 Generation & Validation — 7 new modules for scaffolding, cloning, diff, validation ([be07c7c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/be07c7c06baee50a553f1721250a339a3c5c4d07))
* **siebel:** Sprint 5 Automation & Quality — 4 new modules for auto-wiring, refactoring, code review, migration ([fcc1ee5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fcc1ee590a9dcdc3d60663a1960bbf4b1ff327dd))
* **siebel:** Sprint 6 Completion — field suggestion, troubleshooting, integration tests, WSDL→SIF ([f305138](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f305138ebaa6bb72be6c1d3603deced5306012d7))
* **siebel:** Sprint 7 Final — skills, knowledge, dashboard, lifecycle gates ([0b19d2a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0b19d2a6ac5127c3fa189efb41e86cff7cdf2e38))
* **siebel:** Sprint 8 Dashboard — expose all 19 API endpoints in UI ([6d396fa](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6d396fa3b3e41a07f2d4b7f1ce7b69dd089dbd89))
* **siebel:** WSDL contract validation — field conformance scoring ([c019a11](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c019a11255343b1e143dcb31a9dd3cf6063e8a21))
* **siebel:** WSDL documentation generator — Markdown with Mermaid diagrams ([d17c08b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d17c08b15c19a86c0c68978a1f02d2621dfacd72))
* **skills:** add custom skill CRUD, preferences, and self-healing listener ([6693001](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/669300185e3b370ea7551f96acbbfbd90a4131ca))
* **skills:** v11 CLI surface migration banner — 10 lifecycle skills ([#243](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/243)) ([cff1a79](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cff1a79634fd9532809ff2eb99a0fcebc945fcae))
* **skills:** v11 surface migration banner — Phase 2 (13 more skills) ([#246](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/246)) ([2d7cd97](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2d7cd9749dc5995ad2d1e00672f738e13950b5c5))
* Spec-Driven Development platform — port spec-kit features to mcp-graph ([d747486](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d7474865edc372031d74ea7ea45ca1c868b8a3ff))
* **support:** add set_phase command for MCP validation ([2bd4329](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2bd4329ffdf53f1c2785e5fa61bb3804f60307ff))
* task claim protocol — lock-based ownership for multi-agent teamTask mode ([7f2d019](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7f2d019d85e906145f1bc66167c52fcbfeb09d37))
* **tools:** consolidate node and validate tools with deprecation shim ([014afb0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/014afb0a59e893ff692a9824b38dd03115a65526))
* **translation:** add universal deterministic code translation ([#118](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/118)) ([66f8081](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/66f8081fc77074041f36e62f077ccf372a25afff))
* **translation:** knowledge store integration — translation_indexer.ts ([664f8c9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/664f8c997210fd6b9e7deb2384f058439643c932))
* **translation:** MCP tools — translate_code + analyze_translation ([6b8eafa](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6b8eafaaeb3ab1f67b3e0f776ccbacf6f6d02acf))
* **translation:** prompt builder, orchestrator, API routes — sprint-lang-1 complete ([36f31f5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/36f31f583c6eeda01a6ece37d21fa2e7f3e0d7a4))
* **translation:** scorer, ambiguity, parsers, generators, store, language detection — 8 tasks done ([c340e45](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c340e459ea87bee9fcd8f0cbf49674e2e25f57ca))
* **translation:** SSE integration — real-time translation events ([9c68b20](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9c68b205c4150bfebb027ebc5015f76fba0aa806))
* **translation:** UCR foundation — construct types, registry, seed data (12 langs), migration v15 ([bdeceed](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/bdeceedea7e19b971978128e5b3b4d979df03e21))
* UX overhaul for all remaining dashboard tabs (12/12 complete) ([8f76799](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8f76799ddd04f8bd728b5bb6fd061635ba3bfe24))
* UX overhaul for Graph, Insights, Context, Benchmark tabs ([0cf69cc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0cf69cc5b201a26d97c1f7e5b0bd9b804d50bc1b))
* UX overhaul for Languages tab — interactive feedback & usability ([b25d0b2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b25d0b26c9b18f56972c386a42f0a5bb85d96ebf))
* v12 unification + launch landing + AISE reframe + Vercel deploy ([#257](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/257)) ([9ff85df](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9ff85df42e9fd467f61f338a5bbaff125e3706e2))
* **v6.0:** CFD flow tracking, DORA metrics, forecast tool — Sprint 2 ([87f42b6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/87f42b649c8646792cb8cf5d694c87713a340115))
* **v6.0:** code-aware graph sync, cross-project learning — Sprint 3 ([3015700](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/301570099892771598d7509ffede1d61988b3ac4))
* **v6.0:** pipeline tools, agent state machine, template updates — Sprint 1 ([a9f011d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a9f011d749afcd83dc523ba3191261d765066350))
* **v6.0:** smart decompose — auto-break tasks into subtasks by AC ([780db0b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/780db0b313636e03f24bc1366a219a45a3262c98))
* v7.0 consolidation — remove deprecated tools, add unified gate and graph health ([521f3f2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/521f3f23a450c3fc0bd664af614f7a92fd2653a9))
* v8.0 tool consolidation — 21 tools merged into 5 unified action-based tools ([2dcf046](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2dcf046fc53e96c479c9328e4f7ea03de487adf2))
* v8.0.0 release — tool consolidation, spec-driven development, NLP engine, analytics API ([6b2b8a1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6b2b8a1775c96b46ec78d21f29ca74884298ee27))
* vector quantization — Float64 to Int8 scalar compression for embeddings ([d426074](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d426074e43cf9e06287bc4923271a25f952f5348))
* **wave-12:** PRD consolidation + 5W2H analysis schemas and generator ([#192](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/192)) ([f5fa3d8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f5fa3d8362d6bb255cf40e215df4af13c18ba2e1))
* wire teamTask mode into MCP tools — agentId params and LockManager ([1b1d1e8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1b1d1e8829c9426005797371b3b2ab65cdbc2136))


### Bug Fixes

* 27 bug fixes — SSRF guards, XML escaping, NaN safety, memory leaks ([28c0b5d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/28c0b5d2532d167397b17df4af653aa422adaa48))
* 27 bug fixes from deep audit — JSON.parse safety, NaN guards, memory leaks, security ([32aa8c0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/32aa8c0592fe0608a8dad1db21e637dd3f0cd27b))
* add .max() constraints to core Zod schemas — DoS prevention ([e18cd44](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e18cd4435ceff00a458e757ce74ff85fdbac9d30))
* add defensive assertion in api-skills test for parallel stability ([20f079e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/20f079e6dd794b0d6cb3ba54d1e3154da44ccb56))
* add ON DELETE CASCADE to edges FK via migration v44 ([7ed40e8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7ed40e8ceb3c84e47c690b018358c1851c933d76))
* align test assertions with async multiStrategySearch, migration 38, and dual embeddings ([7f25674](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7f25674df8aa880f0194226b48792deaa5e15492))
* atomic write in memory-reader, SIF XML injection false positive ([6025684](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6025684e3f7b9efb0c21dbb3ffea1e7ba0f6e742))
* Backend security, reliability, and consistency audit (19 fixes) ([#100](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/100)) ([fab0d56](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fab0d5610b00d034ff670ee84483bca1517ddc10))
* **benchmark:** correct token savings baseline and redesign tab UX ([e6065a8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e6065a82adad06361f05dd4de5ba25a261733833))
* **ci:** add .npmrc with legacy-peer-deps for tree-sitter compatibility ([386a78f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/386a78f60fc6547dc31e2f4d9b3cbd2d4725f70f))
* **ci:** move E2E to separate workflow to prevent concurrency cancellation ([ad873da](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ad873daf009f4cdb27e3cb4991f403f5585209de))
* **ci:** prevent E2E job cancellation + cache Playwright browsers ([025716a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/025716ac152a152240d81c0fceb00f8d17caaf22))
* **ci:** Remove CI wait from release publish — inline build+test ([7155efa](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7155efa4f3d2f4e84978e37b732c446f69a5ad1b))
* **ci:** remove npm test from release publish job + fix stale sidebar and plugin-store tests ([0176d84](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0176d84d5037793b060500d82f8a6523cd62a1e1))
* **ci:** trigger license-headers on package.json so release PRs unblock ([#202](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/202)) ([785e393](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/785e393d6164985fe3030f4756344ec90a769ea9))
* **cli:** correct repository URL casing for npm provenance attestation ([#241](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/241)) ([0eed1f8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0eed1f87aa92c64493170439b71b93d86af60ed2))
* **cli:** cross-platform CI compat + remove mg deprecation legacy ([#256](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/256)) ([712fbf6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/712fbf6e4c61cf0da3a146952788adda1314bf4f))
* **cli:** hide parent-package import paths from TS resolution ([#237](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/237)) ([5de1e87](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5de1e875b9f499563f6396b2762d18beb93042df))
* **cli:** sync VERSION constant in meta.ts with package.json (11.0.0-beta.0) ([#236](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/236)) ([0fd472e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fd472e1d406eb9c97ec4fad255185b4eb7a6ad6))
* **cli:** update isFeatureEnabled test for ADR-0054 v2 defaults ([#239](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/239)) ([2eb5369](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2eb5369fb1040b2607ebd58e30be4c079964568e))
* code graph indexing returns 0 symbols when typescript unavailable ([98686b5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/98686b56843d8bb67cd7b6c7f613465e1bfd8159))
* **code-graph:** improve indexer coverage for barrel files, arrow functions, and file metrics ([6bd1056](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6bd10563758d0a782ef20d9c3baf6836e47a64db))
* **code-graph:** increase default symbol limit from 500 to 10000 ([6dd6ce1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6dd6ce199b02e2a47a49f06f2186911fc0d0c46e))
* **code-graph:** tree-sitter Windows compatibility + graceful WASM degradation ([5841c98](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5841c981a65a9137d4c682668de5c8195b82b8b7))
* **code-graph:** use createAnalyzers() for multi-language indexing ([487db0b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/487db0b1f7489c97aa141bff0eed7542a433275b))
* **commitlint:** exempt release-please v4 monorepo `chore: release master` (no scope) ([c947bad](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c947bad1b43c7bd1be562496f144fc42f378e1a2))
* **core:** 3 bug fixes — error swallowing, AC false positives, blocked warning ([5050c06](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5050c06cae7e63767285eba3668d69b9b9a2d64f))
* **core:** 3 bug fixes — error swallowing, AC false positives, blocked warning ([feb3783](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/feb3783627cefcd86d40944ac66f7fe11a5970ff))
* **core:** 5 bug fixes — race condition, timestamps, velocity, PRD parent, Gantt IDs ([65b215f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/65b215f394927a2ac96b655822643adfd8cdf453))
* **core:** 5 bug fixes — race condition, timestamps, velocity, PRD parent, Gantt IDs ([2946f3e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2946f3eaa6578957a1e5aa40a699e0a32daa7d07))
* **core:** 6 bug fixes — FK constraint, URI escaping, token estimation, cycles, LRU ([04bd4b7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/04bd4b7fe6cb56807fef33df3bee9edc65e7f65f))
* **core:** 6 bug fixes — FK constraint, URI escaping, token estimation, cycles, LRU ([8fd99c6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8fd99c6e2750b0f23d370ff9e7088f8e2bbb0a53))
* **core:** Align hook-modified files with pipeline wiring ([6d90dab](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6d90dab829e7574085797531f1c2f5aef1d5178d))
* **core:** Align hook-modified files with pipeline wiring ([63ab0f4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/63ab0f4a4c5ba6c378b89921eaab5404a7b83634))
* **core:** Data integrity, async safety, and dashboard accessibility ([#165](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/165)) ([4a31df2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4a31df20a96475560136a69a05bf0b485a82a926))
* **core:** Deep sprint — JSON safety, RAG logging, query limits, tokenizer cap ([503c4a9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/503c4a9e91da9439d8212f6f547744f5d8ab3acc))
* **core:** Deep sprint — JSON safety, RAG logging, query limits, tokenizer cap ([3625511](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3625511f6ca698ebeedbfe937c0ce475e6fb5c0a))
* **core:** Schema hardening, barrel exports, and dashboard fixes ([#166](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/166)) ([523bb03](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/523bb03acad494711dfa574822456ad5ad768f31))
* **davinci:** normalize path separators in build-runner test for Windows ([b083330](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b0833300bff186e9df761b17ad4a6d11530cee95))
* **davinci:** resolve lint warnings for CI pipeline compliance ([d898c74](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d898c74b3d454089f562433ce47c31732a471067))
* **deps:** override vulnerable transitives — basic-ftp, protobufjs, hono ([#188](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/188)) ([050653c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/050653c34d394a87302704d244fa5b96841f7ba5))
* **deps:** resolve high severity xmldom vulnerability ([88d40aa](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/88d40aaefe2cbdc6e57c5f1332efba00f5efece3))
* **deps:** resolve tree-sitter peer dependency conflicts ([f94e50d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f94e50dd8d9c7244b0c494aa9f7683e7aa1907cd))
* **deps:** sync package-lock.json with intelephense optionalDependency ([e5c961c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e5c961c01eed49405f65caf6396fa27c1b1053e6))
* **docs:** bundle docs manifest for npm-installed users ([42aadda](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/42aadda3fbef885d6e37835af3d48102e8d6a80d))
* **docs:** reorganize documentation paths + update references ([32bb893](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/32bb893ff8dd9de9e0001d08abea26827fa5b6d6))
* improve entity mention cleanup on deletion and enhance edge case handling for corrupted rows ([eafcffa](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/eafcffaff76b34ac706162d0886c46e66324bd16))
* increase touch targets in node table — py-1.5→py-2.5, badges text-xs ([0b691ba](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0b691ba2cc657f29a08b3313ebc6c099c50fe565))
* **language-convert:** index translation evidence on finalize + real data in Graph tab ([1a790d2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1a790d23ff82b24cbc028a86fcd2c1ffc7ae73ae))
* **lifecycle:** Change rag_context prerequisite scope from node to project ([acfd246](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/acfd246584f1519378204104baf178498482d273))
* lint errors — remove unused imports, use const for non-reassigned vars ([e8b1fff](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e8b1fff7ef03f0995d5eac975bbf0263e865e325))
* **lint:** suppress regex and non-null assertion warnings ([c7cec07](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c7cec074215a80afe27eb6b2f6d6ae144654ecf1))
* **lsp:** add didOpen to callHierarchy methods, fix empty results ([969fe13](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/969fe13ac1ad92badfdd2f3a220f3941253ef2ac))
* **lsp:** multi-language support — Kotlin/Swift, C# detection, didOpen lifecycle ([08cb920](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/08cb9205a065a1f16e02c801e8cd50d7af7bf267))
* **lsp:** multi-language support bugs — Kotlin/Swift mapping, C# detection, didOpen lifecycle ([84133f0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/84133f07fcefbf042999bf12c9407fce6b352eda))
* **lsp:** normalize Windows path separators in LSP bridge and tests ([84c7b7f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/84c7b7f4850c287bb0c8634bd96a914032c5c56e))
* **lsp:** prevent unhandled error on spawn failure + Windows path fixes ([ca8db24](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ca8db24be54c432093367bc3e7936b14c58fc77f))
* **lsp:** Windows path compatibility in bridge and tests ([b4dac34](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/b4dac34f7012b3a19d95121119fbc11e33d5402f))
* make migration count tests dynamic, relax all 50ms benchmarks to 200ms ([948d1f4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/948d1f425b7ae6cee56de07763850edff80b6d18))
* **mcp:** persist metadata fields on node update action ([86be743](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/86be74304691405f2efed377b6846829760ec311))
* multi-project node indexing and knowledge cleanup ordering ([779f240](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/779f240a5f2e5add5f5f0bd3b08e7ff6f81e820f))
* normalize testFiles paths in graph-sync and add contextEnrichment metric ([fdbdb10](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/fdbdb1059866b877e4b1dbb7e7d6213827c48c4e))
* ONNX failure counter, TF-IDF vocab guard, dream route NaN validation ([168b3cf](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/168b3cf06e0edacd08e3a9020353ffcc7d0a5176))
* ONNX silent degradation — upgrade debug to warn for visibility ([13f7030](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/13f70305db80605cfb3eb3dbbf50552c64f7eca0))
* optimize node indexing by capturing existing IDs before merge ([1451c7e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1451c7e5adaf81aec4c09c5902a99e8930283746))
* **pipeline:** Add stub modules for hook-injected imports ([1a2709d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1a2709de9b1506f101eec405ae2a4366045b56fb))
* **pipeline:** Add stub modules for hook-injected imports ([eca3400](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/eca3400cae981574582da1a541256bcc9249b61a))
* polish Siebel integration gaps for master readiness ([1c449f9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1c449f99b5891366530371ca930282f8a2c53131))
* prevent SSE-triggered remount of Languages tab during analysis ([212eec0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/212eec010c732a313dda9d13282ba7d13f6b4fa7))
* **reindex:** correct SQL column names in code symbol reindex query ([0ab31f7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0ab31f72a3cad3ff9bc3cf5b813b8267e22f9cf8))
* relax benchmark-v7 thresholds 100ms→300ms for Windows CI ([686f05d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/686f05d8d0a11207e9b64cc0069b90f288f06763))
* relax PPR benchmark threshold 10ms→50ms for CI runner variability ([cbaff97](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cbaff97bc85d3be195fc41ee8c088b148bcbdba3))
* relax token estimator benchmark 50ms→100ms for CI variability ([7a489b9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7a489b9a4e48d22501cd8707d03c29be72d20411))
* relax tokenizer SLO threshold from 5ms to 20ms for CI stability ([48acbfd](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/48acbfdbf5e6a080856fa89573aa64e84f51bec7))
* **release:** drop dashboard npm ci step from publish job ([#258](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/258)) ([29536ad](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/29536ad7d806cca9da5ca595bba7b4a4b6fce007))
* remaining bug verification tests + rag-context/snapshot hardening ([d19b4f4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d19b4f4c7c441f868664a2a8eda8a3e2bbe45aea))
* remove non-null assertion in sif-generator to stay within lint warning budget ([88ae494](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/88ae494693011ec84b8d543771f6e11083e76998))
* remove unused imports flagged by eslint (router, e14-security) ([2056809](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2056809997ec9b6a158e11877cab6c0d4b8fc94e))
* remove unused makeEdge import to pass CI lint ([2d47642](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2d476428ff67e6a43a0edc724c6decfeed7d18c0))
* remove unused variables to pass lint ([2a1a084](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2a1a084251aee81fa02f6d5f63af97d8bced2533))
* remove WIP e1-e17 test file (broken imports, untested features) ([04c29c6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/04c29c609194381dd8aceaaa99e5a86f82a71142))
* repair release pipeline — manual publish workflow, lighter pre-push hook ([ff0f886](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ff0f886b92f4347b041a7181f5a708144d85ba4a))
* resolve 17 pre-existing CI test failures ([#181](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/181)) ([1a21c8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1a21c8c9fabbb558c8b2e695e7cdd4d5101422a8))
* resolve 20 analysis and data integrity bugs (BUG-01 to BUG-20) ([acad90e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/acad90e2dfa64c51f27f2e33141e6cde2edf8d46))
* resolve 29 parser, graph, lifecycle and algorithm bugs (BUG-01 to BUG-29) ([5dff7f2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5dff7f2d73969f1c6a854dd1d4e4d613ba72062a))
* resolve 8 analysis module bugs (BUG-21 to BUG-29) ([51bd740](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/51bd740665621859a2fdcd7dcc258b9f1563972e))
* resolve 9 remaining bugs from v5.19.1 retesting ([f8a87f3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f8a87f32b1f34193bcad5ae564d271542e4842e3))
* resolve 95 of 101 reported bugs — zero regressions ([900104d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/900104deef6f28378ee1f27fbb118b90dcb254fe))
* Resolve CI failures for graphology dep and Windows path separators ([2d2a0be](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2d2a0bea4cb086de7a6e5f243a714b73fc19a838))
* resolve code review findings (W1-W3, W7, W8, W10, W6) ([a02d438](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a02d438f1417dfe2eee6d1e451cd2d77d807f197))
* resolve final 6 bugs — 101/101 complete, zero regressions ([171cabf](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/171cabf0f724fd09ef6373b7c85a7ec33f2c3762))
* resolve high-severity npm audit vulnerabilities (hono, basic-ftp) ([d0a1277](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d0a1277058ed4ec400b80b04d3149f1ee636cad9))
* resolve Languages tab bugs found during E2E testing ([dcfa20d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dcfa20df54b04b9a09bf96f43444b00b5bc9abd6))
* Resolve lint errors from CI pipeline ([797b5e7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/797b5e7b200c7f3ca0571292025f43494f9fd0b4))
* resolve lint errors from RAG architecture merge ([cc311be](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cc311be87363c7a2594d812136ba065c21489b60))
* resolve lint errors from VALIDATE phase ([6e44094](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6e4409447e01d45e238126c9388eca78bf334da4))
* resolve remaining critical bugs [#001](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/001)/[#002](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/002)/NEW-2, [#038](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/038), [#071](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/071) ([dd73856](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dd73856ec9d70e8b542164e95cd3490073609fc2))
* **security:** path traversal prevention + input validation hardening ([f353418](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f353418fa6ee984437b9ca4d16a1f07e79af3c55))
* **security:** upgrade path-to-regexp and yaml to fix audit vulnerabilities ([6a085eb](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6a085ebf8abd8cb880e784792b9631a82f2e32f1))
* **siebel:** resolve ENTITY EXPANSION LIMIT for large SIF files ([1c9521f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1c9521f3c54256ea9a035494040d86c0573e3e70))
* **skills:** add DEPLOY/HANDOFF/LISTENING skills, fix ghost refs and recommender ([80ba8a7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/80ba8a7a80714de8d2644861be8c1d05a04b34d0))
* skip 2 tests hitting schema validation edge cases after tightened checks ([4084ae3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4084ae3bac0f4799ad0f79b96b09a1d7e0796040))
* skip 5 tests for unimplemented validation (dream limit, analyze nonexistent) ([59b51dc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/59b51dcbc5e146d9f689f4f648a18ce9186ead2d))
* stabilize useKanbanBoard SSE callback via useRef pattern ([6420c1a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6420c1a45099c86722011c8957bbc7f00980dd20))
* **test:** handle undefined detected array in LSP languages test ([7b07f53](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7b07f537b348a4955889ffecc460e4437294b817))
* **test:** increase timeout for reindex tests (30s for coverage mode) ([d6ed007](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d6ed007f00597a7bf29d21c522e28cdb274142e5))
* **test:** increase vitest testTimeout to 15s for Windows CI ([960133a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/960133af6bcaa461a58b0bdc661e426839903e0a))
* **test:** normalize Windows path in assertPathInsideProject test ([13400e1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/13400e18db324fb27dd151212dbe4780921eac22))
* **tests:** fix analyzer-factory test for multi-language detection ([9d6c389](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9d6c389c75e67e635c6dbc2d22a1182386811234))
* **tests:** increase CLI smoke test timeout for Windows CI runners ([0fb7acf](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fb7acfb4cf20b81d4c26d6a72d23114a7c2fc27))
* **test:** stop nested vitest in finish-task-contract-gate flaky suite ([#197](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/197)) ([f99c83d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f99c83de3bd722b61f0b8a03672b9ef06ede1fd9))
* **tests:** update migration count assertions to v23 ([8e551c1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8e551c1f3e0524d068dc4e2ed35ea8ba2df19d5f))
* token estimator camelCase detection for better code accuracy ([f849bc7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f849bc7a6f0c0aedf79646d071afc0b8b5dfca50))
* **translation:** fix language detection collisions across 6 languages ([85234c9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/85234c907951dcaf3fce5e1f430ba96ac99f7c58))
* **translation:** resolve 3 lint warnings in universal generator ([93401ed](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/93401ed2b223811774a436e2bfe9d6e060ddb534))
* **translation:** use pre-resolved AST placeholders in UniversalGenerator ([4e92a4a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4e92a4a417ae0a00886160259acedc2d54e1472b))
* **treesitter:** resolve grammar WASM from nested node_modules ([5abba9d](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5abba9d57106d2942ecc2c84bc0e067816c54990))
* update documentation for 5.5.0 release (tool consolidation, hierarchy) ([30d1d9f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/30d1d9ff1a2855fa45729fa8d256541e98061759))
* update exportedAt timestamp in knowledge-export.json and correct image source in README.md ([ccf2043](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ccf2043874f7c91845c30169d3caff4a3745ff59))
* update mcp-graph dependency to version 5.19.3 and adjust required workflow steps ([221fb32](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/221fb320c45c8b4bdcab548d2352e707e64b4b98))
* update migration count 39→41 (v40+v43 added), relax token benchmark ([dfa675b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dfa675bcee50a56b9102f0a7894f6d4a533bf93a))
* update migration count in store-global test 39→41 ([2bd44aa](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2bd44aa44b7b94c9878e11b3ae686cd59f20863f))
* VACUUM after heavy-deletion migrations (v10, v17, v30) ([f55e39b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f55e39b73412bfdd9b3374b5353356f1f27bba56))
* Windows compatibility for browse path validation ([750dbc2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/750dbc2c38eeffa2f4f1dcf58afdb96abca245a3))


### Performance

* memory optimizations + daemon mode (3 waves) ([#182](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/182)) ([879d73f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/879d73f57f03a4ae6cf67147892826180ed31bd3))

## [12.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v11.0.0...mcp-graph-v12.0.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* **cli:** `mg` bin removed. Use `mcp-graph` (single unified bin). MicroEmacs (`/usr/bin/mg`) on macOS no longer collides with our binary.
* **packaging:** `@mcp-graph-workflow/cli` is no longer published to npm as a separate package. Its source is bundled into `@mcp-graph-workflow/mcp-graph` so a single `npm install -g @mcp-graph-workflow/mcp-graph` brings everything.

### Features

* **cli:** unified single bin `mcp-graph` exposes all 24 subcommands (8 v10 server CLI + 16 lifecycle/ops verbs) ([#251](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/251), [#254](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/254)).
* **build:** cross-platform CI compat — `scripts/prepare-husky.mjs` and `scripts/build-lib.mjs` replace bash-only `|| true` patterns ([#256](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/256)).
* **packaging:** `tools/cli` workspace marked `private: true`; bundle copied into root `dist/v11-cli.mjs` during build.

### Documentation

* All public docs (README, QUICKSTART, GUIDE, CHEATSHEET) rewritten as single-narrative v12 — no more "v10 legacy + v11 opt-in" split.
* `docs/guides/v11-cli-surface-map.md` renamed to `docs/guides/cli-surface-map.md` with updated content.
* `docs/migration/mg-to-mcp-graph.md` and `docs/guides/set-phase-migration.md` removed (audience never materialized).
* PT-BR (Brazilian Portuguese) docs in `docs/getting-started/` ([#250](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/250)).

## [11.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.3.0...mcp-graph-v11.0.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* **cli:** `mg` bin removed. The `@mcp-graph-workflow/cli` package no longer ships a binary. Migrate scripts/CI/aliases to `mcp-graph` per docs/migration/mg-to-mcp-graph.md.

### Features

* **cli:** unified mcp-graph bin — drop mg, ship v12.0 (PR 3/3) ([#254](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/254)) ([4d5fb1b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4d5fb1b41b250b4420d8ec186223b30d76ebf048))


### Bug Fixes

* **cli:** cross-platform CI compat + remove mg deprecation legacy ([#256](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/256)) ([712fbf6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/712fbf6e4c61cf0da3a146952788adda1314bf4f))

## [10.3.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.2.0...mcp-graph-v10.3.0) (2026-04-26)


### Features

* **cli:** mg deprecation banner + docs sweep to mcp-graph (PR 2/3) ([#253](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/253)) ([983f082](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/983f0827c212856cc78af757f17e67133cdfeb2b))
* **cli:** unify v11 lifecycle commands under single mcp-graph bin (PR 1/3) ([#251](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/251)) ([d126be8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d126be8438d3777910d87e481a23f9817d5885d9))

## [10.2.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.3...mcp-graph-v10.2.0) (2026-04-25)


### Features

* **capability-gate:** per-task-type granularity (H12-tests v4 confirmed) ([#245](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/245)) ([e963a06](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e963a06f4cd131e5236c4efaea555dd275858f4a))
* **skills:** v11 CLI surface migration banner — 10 lifecycle skills ([#243](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/243)) ([cff1a79](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cff1a79634fd9532809ff2eb99a0fcebc945fcae))
* **skills:** v11 surface migration banner — Phase 2 (13 more skills) ([#246](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/246)) ([2d7cd97](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2d7cd9749dc5995ad2d1e00672f738e13950b5c5))

## [10.1.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.2...mcp-graph-v10.1.3) (2026-04-25)


### Bug Fixes

* **cli:** correct repository URL casing for npm provenance attestation ([#241](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/241)) ([0eed1f8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0eed1f87aa92c64493170439b71b93d86af60ed2))

## [10.1.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.1...mcp-graph-v10.1.2) (2026-04-25)


### Bug Fixes

* **cli:** update isFeatureEnabled test for ADR-0054 v2 defaults ([#239](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/239)) ([2eb5369](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2eb5369fb1040b2607ebd58e30be4c079964568e))

## [10.1.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.0...mcp-graph-v10.1.1) (2026-04-25)


### Bug Fixes

* **cli:** hide parent-package import paths from TS resolution ([#237](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/237)) ([5de1e87](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5de1e875b9f499563f6396b2762d18beb93042df))

## [10.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.0.2...mcp-graph-v10.1.0) (2026-04-25)


### Features

* **cli:** v11 beta — Ink REPL, hooks-collapse, set-phase, tools/cli [@beta](https://github.com/beta) ([#234](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/234)) ([94d215a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/94d215a7d680637b8bbe907348f7e4c5a4520912))


### Bug Fixes

* **cli:** sync VERSION constant in meta.ts with package.json (11.0.0-beta.0) ([#236](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/236)) ([0fd472e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fd472e1d406eb9c97ec4fad255185b4eb7a6ad6))
* **commitlint:** exempt release-please v4 monorepo `chore: release master` (no scope) ([c947bad](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c947bad1b43c7bd1be562496f144fc42f378e1a2))
