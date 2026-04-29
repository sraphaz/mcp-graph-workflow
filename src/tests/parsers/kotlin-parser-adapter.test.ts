/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { KotlinParserAdapter } from "../../core/translation/parsers/kotlin-parser-adapter.js";
import { runAdapterContractSuite } from "./_helpers.js";

runAdapterContractSuite({
  adapter: new KotlinParserAdapter(),
  expectedLanguageId: "kotlin",
  realCode: `package com.example

class Greeter(private val name: String) {
    fun hello() {
        println("Hello, $name")
    }
}

fun main() {
    Greeter("world").hello()
}
`,
  malformedCode: "fun class { ;",
});
