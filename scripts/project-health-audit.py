#!/usr/bin/env python3
"""
Project Health Audit — mcp-graph-workflow
Detecta areas que precisam de atencao: scope creep, complexidade acidental,
cobertura rasa, features beta sem testes, e gera recomendacoes estrategicas.

Deps: Python stdlib only (no pip install needed)
Usage: python3 scripts/project-health-audit.py
Output: scripts/project-health-report.json + console summary
"""

import os
import re
import json
import sys
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime

# ── Config ──────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
CORE = SRC / "core"
TESTS = SRC / "tests"
MCP_TOOLS = SRC / "mcp" / "tools"
API_ROUTES = SRC / "api" / "routes"
DASHBOARD = SRC / "web" / "dashboard" / "src"

# ANSI colors
C_RESET = "\033[0m"
C_RED = "\033[91m"
C_GREEN = "\033[92m"
C_YELLOW = "\033[93m"
C_BLUE = "\033[94m"
C_CYAN = "\033[96m"
C_BOLD = "\033[1m"
C_DIM = "\033[2m"

COMPLEXITY_THRESHOLD = 400  # lines
SURFACE_RATIO_THRESHOLD = 5.0

GENERIC_NAMES = {"data", "result", "item", "obj", "temp", "val", "res"}
FORBIDDEN_IMPORTS = {
    "src/core/": ["cli/", "mcp/", "api/", "web/"],
    "src/schemas/": ["core/", "mcp/", "cli/", "api/", "web/"],
}


# ── Utilities ───────────────────────────────────────────────

def count_lines(filepath: Path) -> int:
    try:
        return len(filepath.read_text(encoding="utf-8", errors="replace").splitlines())
    except Exception:
        return 0


def find_ts_files(directory: Path, exclude_tests: bool = True) -> list[Path]:
    files = []
    if not directory.exists():
        return files
    for f in directory.rglob("*.ts"):
        if "node_modules" in str(f):
            continue
        if exclude_tests and ".test." in f.name:
            continue
        if f.name == "index.ts":
            continue
        files.append(f)
    for f in directory.rglob("*.tsx"):
        if "node_modules" in str(f):
            continue
        if exclude_tests and ".test." in f.name:
            continue
        files.append(f)
    return files


def read_safe(filepath: Path) -> str:
    try:
        return filepath.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


# ── 1. Scope Creep Detector ─────────────────────────────────

def count_core_modules() -> list[str]:
    if not CORE.exists():
        return []
    return sorted([d.name for d in CORE.iterdir() if d.is_dir() and not d.name.startswith(".")])


def count_mcp_tools() -> int:
    count = 0
    if not MCP_TOOLS.exists():
        return 0
    for f in MCP_TOOLS.glob("*.ts"):
        content = read_safe(f)
        count += len(re.findall(r'server\.tool\s*\(', content))
    return count


def count_dashboard_tabs() -> list[str]:
    nav_config = DASHBOARD / "components" / "layout" / "nav-config.ts"
    if not nav_config.exists():
        return []
    content = read_safe(nav_config)
    # Find group ids (they have 'items:' after the icon)
    group_ids = set(re.findall(r'id:\s*"([^"]+)",\s*label:\s*"[^"]+",\s*icon:\s*\w+,\s*items:', content))
    # Match all { id: "xxx", label: "Yyy" } pairs, exclude groups
    all_items = re.findall(r'\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)"', content)
    labels = [label for item_id, label in all_items if item_id not in group_ids]
    return labels


def count_api_endpoints() -> int:
    count = 0
    if not API_ROUTES.exists():
        return 0
    for f in API_ROUTES.glob("*.ts"):
        content = read_safe(f)
        count += len(re.findall(r'router\.(get|post|put|patch|delete)\s*\(', content))
    return count


def count_migrations() -> int:
    migrations_file = CORE / "store" / "migrations.ts"
    if not migrations_file.exists():
        return 0
    content = read_safe(migrations_file)
    versions = re.findall(r'version:\s*(\d+)', content)
    return max(int(v) for v in versions) if versions else 0


def detect_scope_creep() -> dict:
    modules = count_core_modules()
    tools = count_mcp_tools()
    tabs = count_dashboard_tabs()
    endpoints = count_api_endpoints()
    migrations = count_migrations()

    surface = tools + endpoints + len(tabs)
    ratio = surface / max(len(modules), 1)

    return {
        "core_modules": len(modules),
        "core_module_names": modules,
        "mcp_tools": tools,
        "dashboard_tabs": len(tabs),
        "dashboard_tab_names": tabs,
        "api_endpoints": endpoints,
        "migrations": migrations,
        "surface_area": surface,
        "surface_ratio": round(ratio, 2),
        "warning": ratio > SURFACE_RATIO_THRESHOLD,
    }


# ── 2. Feature Depth Analyzer ──────────────────────────────

def map_module_to_tests() -> dict[str, dict]:
    modules = {}
    if not CORE.exists():
        return modules

    for module_dir in sorted(CORE.iterdir()):
        if not module_dir.is_dir() or module_dir.name.startswith("."):
            continue

        module_name = module_dir.name
        source_files = [f for f in find_ts_files(module_dir, exclude_tests=True)]

        # Find matching test files
        test_files = []
        if TESTS.exists():
            # Check tests/{module}/ directory
            module_test_dir = TESTS / module_name
            if module_test_dir.exists():
                test_files.extend(list(module_test_dir.glob("*.test.ts")))

            # Check tests/{module}-*.test.ts and tests/*-{module}*.test.ts
            for tf in TESTS.glob("*.test.ts"):
                stem = tf.stem.replace(".test", "")
                # Match by module name prefix
                if stem.startswith(module_name) or module_name in stem:
                    if tf not in test_files:
                        test_files.append(tf)

        src_count = len(source_files)
        test_count = len(test_files)
        coverage = round((test_count / max(src_count, 1)) * 100, 1)

        classification = "ok"
        if test_count == 0:
            classification = "shallow"
        elif src_count > 10 and test_count < 2:
            classification = "deep_but_untested"

        modules[module_name] = {
            "source_files": src_count,
            "test_files": test_count,
            "coverage_pct": coverage,
            "classification": classification,
            "source_paths": [str(f.relative_to(ROOT)) for f in source_files[:5]],
            "test_paths": [str(f.relative_to(ROOT)) for f in test_files[:5]],
        }

    return modules


# ── 3. Test Coverage Gap Map ────────────────────────────────

def find_untested_files() -> dict[str, list[str]]:
    gaps = defaultdict(list)
    if not CORE.exists():
        return dict(gaps)

    test_stems = set()
    if TESTS.exists():
        for tf in TESTS.rglob("*.test.ts"):
            stem = tf.stem.replace(".test", "")
            test_stems.add(stem)
        # Also check subdirs
        for td in TESTS.iterdir():
            if td.is_dir():
                for tf in td.glob("*.test.ts"):
                    stem = tf.stem.replace(".test", "")
                    test_stems.add(stem)

    for module_dir in sorted(CORE.iterdir()):
        if not module_dir.is_dir():
            continue
        for src_file in find_ts_files(module_dir):
            stem = src_file.stem
            if stem not in test_stems:
                gaps[module_dir.name].append(str(src_file.relative_to(ROOT)))

    return dict(gaps)


# ── 4. Complexity Detector ──────────────────────────────────

def detect_complexity() -> dict:
    all_ts = [f for f in list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx")) if "node_modules" not in str(f)]
    source_files = [f for f in all_ts if ".test." not in f.name]
    test_files_list = [f for f in all_ts if ".test." in f.name]

    total_lines = 0
    hotspots = []

    for f in source_files:
        lines = count_lines(f)
        total_lines += lines
        if lines > COMPLEXITY_THRESHOLD:
            hotspots.append({
                "file": str(f.relative_to(ROOT)),
                "lines": lines,
            })

    hotspots.sort(key=lambda x: x["lines"], reverse=True)

    # Coupling detection: count imports per file
    coupling_hotspots = []
    for f in source_files:
        content = read_safe(f)
        imports = re.findall(r'from\s+"([^"]+)"', content)
        # Count unique module directories imported
        modules_imported = set()
        for imp in imports:
            if imp.startswith("."):
                continue
            parts = imp.split("/")
            if len(parts) >= 2:
                modules_imported.add(parts[0] + "/" + parts[1])
        if len(modules_imported) > 5:
            coupling_hotspots.append({
                "file": str(f.relative_to(ROOT)),
                "external_imports": len(modules_imported),
            })

    coupling_hotspots.sort(key=lambda x: x["external_imports"], reverse=True)

    return {
        "total_source_files": len(source_files),
        "total_test_files": len(test_files_list),
        "test_to_source_ratio": round(len(test_files_list) / max(len(source_files), 1), 2),
        "total_lines": total_lines,
        "complexity_hotspots": hotspots[:20],
        "coupling_hotspots": coupling_hotspots[:10],
    }


# ── 5. Beta Feature Detector ───────────────────────────────

def detect_beta_features() -> dict:
    nav_config = DASHBOARD / "components" / "layout" / "nav-config.ts"
    betas = []
    if nav_config.exists():
        content = read_safe(nav_config)
        # Find nav items with beta: true (within { id: "...", ..., beta: true })
        # Match items block: { id: "xxx", ... beta: true }
        for match in re.finditer(r'\{\s*id:\s*"([^"]+)"[^}]*?beta:\s*true[^}]*\}', content, re.DOTALL):
            betas.append(match.group(1))

    # Cross-reference with test coverage
    module_tests = map_module_to_tests()
    beta_analysis = []
    for beta_id in betas:
        # Map tab id to core module name
        module_name = beta_id.replace("-", "")
        # Find closest matching module
        matched = None
        for m in module_tests:
            if m.replace("-", "") == module_name or beta_id in m or m in beta_id:
                matched = m
                break
        test_count = module_tests.get(matched, {}).get("test_files", 0) if matched else 0
        beta_analysis.append({
            "tab_id": beta_id,
            "matched_module": matched,
            "test_files": test_count,
            "has_tests": test_count > 0,
        })

    return {
        "beta_features": betas,
        "beta_count": len(betas),
        "beta_without_tests": [b for b in beta_analysis if not b["has_tests"]],
        "beta_analysis": beta_analysis,
    }


# ── 6. Harness Self-Assessment ──────────────────────────────

def harness_self_assessment() -> dict:
    results = {}

    ts_files = find_ts_files(SRC, exclude_tests=True)

    # 6.1 any usage
    any_files = 0
    any_total = 0
    any_violations = []
    for f in ts_files:
        content = read_safe(f)
        matches = list(re.finditer(r'(?::\s*any\b|\bas\s+any\b)', content))
        if matches:
            any_files += 1
            any_total += len(matches)
            for m in matches[:3]:  # sample 3 per file
                line = content[:m.start()].count("\n") + 1
                any_violations.append(f"{f.relative_to(ROOT)}:{line}")

    type_score = round((1 - any_files / max(len(ts_files), 1)) * 100, 1)
    results["types"] = {
        "score": type_score,
        "files_with_any": any_files,
        "total_any": any_total,
        "total_files": len(ts_files),
        "sample_violations": any_violations[:15],
    }

    # 6.2 Untested modules
    gaps = find_untested_files()
    untested_count = sum(len(v) for v in gaps.values())
    test_score = round((1 - untested_count / max(len(ts_files), 1)) * 100, 1)
    results["tests"] = {
        "score": max(0, test_score),
        "untested_files": untested_count,
        "total_files": len(ts_files),
        "worst_modules": sorted(gaps.items(), key=lambda x: -len(x[1]))[:5],
    }

    # 6.3 Generic names
    generic_count = 0
    generic_violations = []
    for f in ts_files:
        content = read_safe(f)
        for m in re.finditer(r'\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b', content):
            name = m.group(1)
            if name.lower() in GENERIC_NAMES or (len(name) == 1 and name not in "ijke"):
                generic_count += 1
                line = content[:m.start()].count("\n") + 1
                generic_violations.append(f"{f.relative_to(ROOT)}:{line} ({name})")

    total_symbols = sum(
        len(re.findall(r'\b(?:const|let|var)\s+[A-Za-z_$]', read_safe(f)))
        for f in ts_files
    )
    naming_score = round((1 - generic_count / max(total_symbols, 1)) * 100, 1)
    results["naming"] = {
        "score": max(0, naming_score),
        "generic_names": generic_count,
        "total_symbols": total_symbols,
        "sample_violations": generic_violations[:15],
    }

    # 6.4 Raw throws
    raw_throws = 0
    swallowed_catches = 0
    console_errors = 0
    error_violations = []
    # Exclude scanner files that contain detection patterns as string literals
    scanner_excludes = {"error-handling-scanner", "naming-clarity-scanner", "context-density-scanner",
                        "type-coverage-scanner", "fitness-functions"}
    for f in ts_files:
        if f.stem in scanner_excludes:
            continue
        content = read_safe(f)
        # Check if file imports typed errors (various import patterns)
        has_typed_errors = bool(re.search(r'from\s+["\'].*(?:utils/errors|errors\.js)', content))
        if not has_typed_errors:
            for m in re.finditer(r'\bthrow\s+new\s+Error\s*\(', content):
                # Skip if inside a string literal or comment
                line_text = content.splitlines()[content[:m.start()].count("\n")]
                if line_text.strip().startswith("//") or line_text.strip().startswith("*"):
                    continue
                raw_throws += 1
                line = content[:m.start()].count("\n") + 1
                error_violations.append(f"{f.relative_to(ROOT)}:{line} (raw throw)")
        seen_catches = set()
        for m in re.finditer(r'\bcatch\s*\([^)]*\)\s*\{\s*\}', content):
            line = content[:m.start()].count("\n") + 1
            key = f"{f}:{line}"
            if key not in seen_catches:
                seen_catches.add(key)
                swallowed_catches += 1
                error_violations.append(f"{f.relative_to(ROOT)}:{line} (swallowed catch)")
        if ".test." not in f.name and "scanner" not in f.stem:
            for m in re.finditer(r'\bconsole\.(error|warn)\s*\(', content):
                line_text = content.splitlines()[content[:m.start()].count("\n")]
                if line_text.strip().startswith("//") or line_text.strip().startswith("*"):
                    continue
                console_errors += 1

    error_total = raw_throws + swallowed_catches + console_errors
    error_score = max(0, 100 - error_total * 2)
    results["errors"] = {
        "score": error_score,
        "raw_throws": raw_throws,
        "swallowed_catches": swallowed_catches,
        "console_errors": console_errors,
        "sample_violations": error_violations[:15],
    }

    # 6.5 Missing JSDoc on exported functions
    undocumented = 0
    total_exports = 0
    jsdoc_violations = []
    for f in ts_files:
        content = read_safe(f)
        lines = content.splitlines()
        for i, line in enumerate(lines):
            # Only count function exports (not type/interface/const-value re-exports)
            is_func_export = bool(
                re.match(r'^\s*export\s+(?:async\s+)?function\s+\w', line)
            )
            is_arrow_export = bool(
                re.match(r'^\s*export\s+const\s+\w+\s*=\s*(?:async\s*)?\(', line)
            )
            # Skip re-exports, type exports, interface exports
            if re.match(r'^\s*export\s+(?:type|interface|enum|class)\s', line):
                continue
            if re.match(r'^\s*export\s*\{', line):
                continue
            if not (is_func_export or is_arrow_export):
                continue
            total_exports += 1
            # Look back up to 10 lines for JSDoc (multi-line blocks)
            has_jsdoc = False
            for j in range(max(0, i - 10), i):
                if "*/" in lines[j]:
                    has_jsdoc = True
                    break
            if not has_jsdoc:
                undocumented += 1
                jsdoc_violations.append(f"{f.relative_to(ROOT)}:{i+1}")

    context_score = round((1 - undocumented / max(total_exports, 1)) * 100, 1)
    results["context"] = {
        "score": max(0, context_score),
        "undocumented_exports": undocumented,
        "total_exports": total_exports,
        "sample_violations": jsdoc_violations[:15],
    }

    # 6.6 Docs coverage
    has_claude = (ROOT / "CLAUDE.md").exists()
    has_readme = (ROOT / "README.md").exists()
    rules_dir = ROOT / ".claude" / "rules"
    rules_count = len(list(rules_dir.glob("*.md"))) if rules_dir.exists() else 0
    docs_dir = ROOT / "docs"
    docs_count = len(list(docs_dir.rglob("*.md"))) if docs_dir.exists() else 0
    core_dirs = len([d for d in CORE.iterdir() if d.is_dir()])
    rules_ratio = rules_count / max(core_dirs, 1)

    docs_score = 0
    if has_claude: docs_score += 30
    if has_readme: docs_score += 20
    docs_score += min(30, int(rules_ratio * 30))
    docs_score += min(20, int(min(docs_count / 5, 1) * 20))

    results["docs"] = {
        "score": docs_score,
        "has_claude_md": has_claude,
        "has_readme": has_readme,
        "rules_count": rules_count,
        "docs_count": docs_count,
        "core_dirs": core_dirs,
        "rules_coverage": round(rules_ratio * 100, 1),
    }

    # 6.7 Import direction violations
    violations = []
    for f in ts_files:
        rel = str(f.relative_to(ROOT))
        content = read_safe(f)
        for source_prefix, forbidden in FORBIDDEN_IMPORTS.items():
            if rel.startswith(source_prefix):
                for imp_match in re.finditer(r'from\s+"([^"]+)"', content):
                    imp_path = imp_match.group(1)
                    for forbidden_dir in forbidden:
                        if forbidden_dir in imp_path and not imp_path.startswith("."):
                            line = content[:imp_match.start()].count("\n") + 1
                            violations.append({
                                "file": rel,
                                "line": line,
                                "import": imp_path,
                                "rule": f"{source_prefix} must not import from {forbidden_dir}",
                            })

    fitness_score = max(0, 100 - len(violations) * 10)
    results["fitness"] = {
        "score": fitness_score,
        "violations": len(violations),
        "details": violations[:10],
    }

    # Composite score (same weights as TS scanner)
    weights = {"types": 0.25, "tests": 0.25, "fitness": 0.15, "docs": 0.15,
               "naming": 0.10, "errors": 0.05, "context": 0.05}
    composite = sum(results[dim]["score"] * w for dim, w in weights.items())
    grade = "A" if composite >= 85 else "B" if composite >= 70 else "C" if composite >= 55 else "D"

    return {
        "dimensions": results,
        "composite_score": round(composite, 1),
        "grade": grade,
        "weights": weights,
    }


# ── 7. Strategic Recommender ────────────────────────────────

def generate_recommendations(scope: dict, depth: dict[str, dict], beta: dict, harness: dict) -> list[dict]:
    recs = []

    # PRUNE: beta features without tests
    for b in beta.get("beta_without_tests", []):
        recs.append({
            "action": "PRUNE",
            "target": b["tab_id"],
            "reason": f"Beta feature '{b['tab_id']}' has 0 test files. Consider removing or freezing.",
            "priority": "high",
        })

    # DEEPEN: core modules with low coverage
    for module_name, info in sorted(depth.items(), key=lambda x: x[1]["coverage_pct"]):
        if info["classification"] == "shallow" and info["source_files"] > 2:
            recs.append({
                "action": "DEEPEN",
                "target": module_name,
                "reason": f"Module '{module_name}' has {info['source_files']} source files but 0 test files.",
                "priority": "high" if info["source_files"] > 5 else "medium",
            })
        elif info["classification"] == "deep_but_untested":
            recs.append({
                "action": "DEEPEN",
                "target": module_name,
                "reason": f"Module '{module_name}' has {info['source_files']} files but only {info['test_files']} tests.",
                "priority": "high",
            })

    # FREEZE: scope creep warning
    if scope.get("warning"):
        recs.append({
            "action": "FREEZE",
            "target": "new_features",
            "reason": f"Surface ratio {scope['surface_ratio']} exceeds threshold {SURFACE_RATIO_THRESHOLD}. "
                      f"Consider feature freeze until depth improves.",
            "priority": "critical",
        })

    # SHIP: well-tested modules
    for module_name, info in depth.items():
        if info["coverage_pct"] >= 50 and info["source_files"] >= 3 and info["test_files"] >= 2:
            recs.append({
                "action": "SHIP",
                "target": module_name,
                "reason": f"Module '{module_name}' has {info['coverage_pct']}% coverage — ready for external use.",
                "priority": "info",
            })

    # Harness-specific
    for dim, data in harness.get("dimensions", {}).items():
        if data["score"] < 55:
            recs.append({
                "action": "DEEPEN",
                "target": f"harness:{dim}",
                "reason": f"Harness dimension '{dim}' scores {data['score']}/100 (grade D). Critical attention needed.",
                "priority": "critical",
            })
        elif data["score"] < 70:
            recs.append({
                "action": "DEEPEN",
                "target": f"harness:{dim}",
                "reason": f"Harness dimension '{dim}' scores {data['score']}/100. Below B threshold.",
                "priority": "medium",
            })

    recs.sort(key=lambda x: {"critical": 0, "high": 1, "medium": 2, "info": 3}.get(x["priority"], 9))
    return recs


# ── Output ──────────────────────────────────────────────────

def print_header(title: str) -> None:
    print(f"\n{C_BOLD}{C_CYAN}{'=' * 60}{C_RESET}")
    print(f"{C_BOLD}{C_CYAN}  {title}{C_RESET}")
    print(f"{C_BOLD}{C_CYAN}{'=' * 60}{C_RESET}")


def print_section(title: str) -> None:
    print(f"\n{C_BOLD}{C_BLUE}--- {title} ---{C_RESET}")


def print_metric(label: str, value, warning: bool = False) -> None:
    color = C_RED if warning else C_GREEN
    print(f"  {label}: {color}{value}{C_RESET}")


def print_recommendation(rec: dict) -> None:
    colors = {"PRUNE": C_RED, "DEEPEN": C_YELLOW, "FREEZE": C_RED, "SHIP": C_GREEN}
    prio_colors = {"critical": C_RED, "high": C_YELLOW, "medium": C_CYAN, "info": C_DIM}
    action_color = colors.get(rec["action"], C_DIM)
    prio_color = prio_colors.get(rec["priority"], C_DIM)
    print(f"  {action_color}[{rec['action']}]{C_RESET} {prio_color}({rec['priority']}){C_RESET} "
          f"{rec['target']}: {rec['reason']}")


def print_report(report: dict) -> None:
    print_header("PROJECT HEALTH AUDIT — mcp-graph-workflow")
    print(f"  {C_DIM}Generated: {report['timestamp']}{C_RESET}")

    # Scope Creep
    print_section("1. SCOPE CREEP ANALYSIS")
    sc = report["scope_creep"]
    print_metric("Core modules", sc["core_modules"])
    print_metric("MCP tools", sc["mcp_tools"])
    print_metric("Dashboard tabs", sc["dashboard_tabs"])
    print_metric("API endpoints", sc["api_endpoints"])
    print_metric("DB migrations", sc["migrations"])
    print_metric("Surface ratio", f"{sc['surface_ratio']} (threshold: {SURFACE_RATIO_THRESHOLD})",
                 warning=sc["warning"])

    # Feature Depth
    print_section("2. FEATURE DEPTH (worst modules)")
    depth = report["feature_depth"]
    shallow = [(k, v) for k, v in depth.items() if v["classification"] != "ok"]
    shallow.sort(key=lambda x: x[1]["coverage_pct"])
    for name, info in shallow[:10]:
        tag = f"{C_RED}SHALLOW{C_RESET}" if info["classification"] == "shallow" else f"{C_YELLOW}DEEP_UNTESTED{C_RESET}"
        print(f"  {tag} {name}: {info['source_files']} src / {info['test_files']} tests ({info['coverage_pct']}%)")

    # Test Coverage Gaps
    print_section("3. TEST COVERAGE GAPS (top 10 modules)")
    gaps = report["test_gaps"]
    sorted_gaps = sorted(gaps.items(), key=lambda x: -len(x[1]))
    for module, files in sorted_gaps[:10]:
        print(f"  {C_YELLOW}{module}{C_RESET}: {len(files)} untested files")

    # Complexity
    print_section("4. COMPLEXITY HOTSPOTS (>400 lines)")
    cx = report["complexity"]
    print_metric("Total source files", cx["total_source_files"])
    print_metric("Total test files", cx["total_test_files"])
    print_metric("Test/source ratio", cx["test_to_source_ratio"])
    print_metric("Total lines", f"{cx['total_lines']:,}")
    for hs in cx["complexity_hotspots"][:10]:
        print(f"  {C_RED}{hs['lines']:>5} lines{C_RESET}  {hs['file']}")

    # Beta Features
    print_section("5. BETA FEATURES")
    bf = report["beta_features"]
    for b in bf["beta_analysis"]:
        status = f"{C_GREEN}tested{C_RESET}" if b["has_tests"] else f"{C_RED}NO TESTS{C_RESET}"
        print(f"  {b['tab_id']}: {status} (matched module: {b['matched_module'] or 'none'})")

    # Harness Self-Assessment
    print_section("6. HARNESS SELF-ASSESSMENT")
    ha = report["harness"]
    grade_colors = {"A": C_GREEN, "B": C_BLUE, "C": C_YELLOW, "D": C_RED}
    gc = grade_colors.get(ha["grade"], C_DIM)
    print(f"  {C_BOLD}Composite Score: {gc}{ha['composite_score']}/100 (Grade {ha['grade']}){C_RESET}")
    for dim, data in ha["dimensions"].items():
        bar_len = int(data["score"] / 5)
        bar = "#" * bar_len + "." * (20 - bar_len)
        dc = C_GREEN if data["score"] >= 70 else C_YELLOW if data["score"] >= 55 else C_RED
        weight = ha["weights"].get(dim, 0)
        print(f"  {dim:>10} ({int(weight*100):>2}%): {dc}[{bar}] {data['score']:>5.1f}{C_RESET}")

    # Strategic Recommendations
    print_section("7. STRATEGIC RECOMMENDATIONS")
    recs = report["recommendations"]
    counts = Counter(r["action"] for r in recs)
    print(f"  {C_RED}PRUNE: {counts.get('PRUNE', 0)}{C_RESET} | "
          f"{C_YELLOW}DEEPEN: {counts.get('DEEPEN', 0)}{C_RESET} | "
          f"{C_RED}FREEZE: {counts.get('FREEZE', 0)}{C_RESET} | "
          f"{C_GREEN}SHIP: {counts.get('SHIP', 0)}{C_RESET}")
    print()
    for rec in recs[:15]:
        print_recommendation(rec)

    print(f"\n{C_BOLD}{C_CYAN}{'=' * 60}{C_RESET}")
    print(f"  Report saved to: scripts/project-health-report.json")
    print(f"{C_BOLD}{C_CYAN}{'=' * 60}{C_RESET}\n")


# ── Main ────────────────────────────────────────────────────

def main() -> None:
    print(f"{C_DIM}Running project health audit...{C_RESET}")

    scope = detect_scope_creep()
    depth = map_module_to_tests()
    gaps = find_untested_files()
    complexity = detect_complexity()
    beta = detect_beta_features()
    harness = harness_self_assessment()
    recommendations = generate_recommendations(scope, depth, beta, harness)

    report = {
        "timestamp": datetime.now().isoformat(),
        "project": "mcp-graph-workflow",
        "scope_creep": scope,
        "feature_depth": depth,
        "test_gaps": gaps,
        "complexity": complexity,
        "beta_features": beta,
        "harness": harness,
        "recommendations": recommendations,
    }

    # Write JSON
    output_path = ROOT / "scripts" / "project-health-report.json"
    output_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    # Print human-readable
    print_report(report)

    # Exit code based on critical recommendations
    critical_count = sum(1 for r in recommendations if r["priority"] == "critical")
    sys.exit(1 if critical_count > 0 else 0)


if __name__ == "__main__":
    main()
