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

import { RustParserAdapter } from "../../core/translation/parsers/rust-parser-adapter.js";
import { runAdapterContractSuite } from "./_helpers.js";

runAdapterContractSuite({
  adapter: new RustParserAdapter(),
  expectedLanguageId: "rust",
  realCode: `use std::io;

pub struct Greeter {
    name: String,
}

impl Greeter {
    pub fn new(name: String) -> Self {
        Greeter { name }
    }

    pub fn hello(&self) {
        println!("Hello, {}", self.name);
    }
}

fn main() {
    Greeter::new(String::from("world")).hello();
}
`,
  malformedCode: "fn struct impl { ;",
});
