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

import { JavaParserAdapter } from "../../core/translation/parsers/java-parser-adapter.js";
import { runAdapterContractSuite } from "./_helpers.js";

runAdapterContractSuite({
  adapter: new JavaParserAdapter(),
  expectedLanguageId: "java",
  realCode: `package com.example;

import java.util.List;

public class Greeter {
    private final String name;

    public Greeter(String name) {
        this.name = name;
    }

    public void hello() {
        System.out.println("Hello, " + name);
    }
}
`,
  malformedCode: "public class { void { ;",
});
