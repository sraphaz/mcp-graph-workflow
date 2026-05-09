#!/usr/bin/env tsx
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-dashboard-ux — Task 1.1: run dashboard tab audit
 * Usage: npx tsx scripts/audit-dashboard.ts [--out <path>]
 */

import { collectTabs, buildAuditMarkdown } from "../src/core/dashboard/tab-auditor.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const outFlag = process.argv.indexOf("--out");
const outPath = outFlag !== -1 ? process.argv[outFlag + 1] : "docs/_internal/dashboard-audit.md";
const tabsDir = resolve("src/web/dashboard/src/components/tabs");

const tabs = collectTabs(tabsDir);
const md = buildAuditMarkdown(tabs);

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, md, "utf-8");

process.stdout.write(md + "\n");
process.stderr.write(`\nAudit written to ${outPath} (${tabs.length} tabs)\n`);
