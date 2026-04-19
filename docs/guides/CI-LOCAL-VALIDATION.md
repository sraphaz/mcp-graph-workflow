# CI — Local validation with `act`

> Validate `.github/workflows/*.yml` changes on your laptop before pushing.

## Why this exists

Three iterations of PR #194 (AGPL relicense) were each a ~10-minute
round-trip for a small fix in CI config:

1. `package-lock.json` stale after a version bump → `npm ci` refused
   to install.
2. `npm ci --omit=dev` in the license-deps scan triggered husky's
   `prepare` script → exit 127.
3. License allow-list missed a handful of disjunctive / legacy SPDX
   strings on real production dependencies.

None of those needed GitHub's runners to surface. `act` runs workflows
locally via Docker and catches these in ~60 seconds each.

## One-time setup

### Install `act`

```bash
brew install act                                      # macOS
gh extension install nektos/act                        # cross-platform via gh CLI
curl -fsSL https://raw.githubusercontent.com/nektos/act/master/install.sh | bash  # Linux
```

Verify:

```bash
act --version
```

### Install Docker

`act` runs jobs inside Docker containers. Any recent Docker Desktop
(macOS / Windows) or the `docker` service (Linux) works. Start it and
verify `docker info` succeeds.

### Pull the runner image once

The default image in `.actrc` is `catthehacker/ubuntu:act-22.04`
(~1.5 GB). The first run will pull it; subsequent runs reuse:

```bash
docker pull catthehacker/ubuntu:act-22.04
```

### Configure secrets (only if needed)

Some jobs reference `${{ secrets.* }}`. If you run a job that needs
them, create `.secrets` (gitignored) in the repo root with
`KEY=VALUE` pairs:

```
GITHUB_TOKEN=ghp_your_token_here
NPM_TOKEN=npm_your_token_here
CLA_SIGNATURES_TOKEN=github_pat_...
```

Most hot-path jobs (preflight, test, build) do **not** need secrets.
`.secrets` is referenced by `.actrc` even when empty; `scripts/ci/validate-locally.sh`
touches the file for you if it does not exist.

## Usage

The repo ships with `scripts/ci/validate-locally.sh`:

```bash
# Preflight only — lint + typecheck, ~60s
scripts/ci/validate-locally.sh

# Test matrix (runs all 4 shards sequentially locally — slower, but validates
# that --shard=N/4 splits cleanly and nothing is sensitive to shard order)
scripts/ci/validate-locally.sh --job test

# Build only
scripts/ci/validate-locally.sh --job build

# Everything in ci.yml
scripts/ci/validate-locally.sh --full

# Pass-through args to act
scripts/ci/validate-locally.sh -- --list        # list jobs
scripts/ci/validate-locally.sh -- -v            # verbose
```

## Limitations

`act` is a **smoke test**, not a byte-for-byte mirror of GitHub
Actions. Known gaps:

### Platforms

`act` always runs Linux containers. Windows / macOS matrix jobs from
`ci-nightly.yml` are **not reproducible locally**. When a nightly
fails on Windows specifically, you will still need GitHub's runner to
reproduce — or push a branch and dispatch `ci-nightly.yml` manually
with `workflow_dispatch` + `ref` input.

### Cache

`actions/cache@v5` in `act` uses a local cache backend that does not
share state with GitHub's cache service. Expect cold-cache timings
locally; warm timings only compare run-to-run on the same host.

### Artifacts

`actions/upload-artifact@v7` writes to a `/tmp` path inside the
container and does not surface to your host unless you explicitly
mount volumes. For `junit-shard-*.xml` files produced by the sharded
test job, read them by `docker cp` or by switching to `--reporter=default`
for local runs.

### Secrets

`.secrets` is a flat `KEY=VALUE` file, not a proper secret store. Do
not commit it. `.actrc` points at this file; the wrapper script creates
an empty one if absent.

### GitHub-context values

`act` fakes `github.event.pull_request.*` with sensible defaults. The
`commitlint` job, for example, may not find a real `base.sha` and will
lint the last commit only. Acceptable for smoke testing; exact PR
behaviour only reproduces in real CI.

## When to use this

Use `scripts/ci/validate-locally.sh` before pushing when:

- You changed any `.github/workflows/*.yml` or
  `.github/actions/*/action.yml`.
- You changed `package.json` `"scripts"` entries referenced by CI
  (e.g. `lint`, `typecheck`, `test:coverage`, `build`).
- You changed `package-lock.json` or the dashboard lockfile.
- You suspect a change could break `npm ci` for production deps
  (e.g. adding an `optionalDependencies` entry, touching a `prepare`
  script).

Do **not** rely on this for:

- Windows / macOS regressions.
- Coverage merging or artifact uploads.
- Cross-run cache behaviour.
- Anything that depends on real GitHub API access.

When in doubt, push a draft PR — the CI plan keeps hot-path CI under
three minutes, which is cheaper than debugging an `act` mismatch.
