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

import { ScalaParserAdapter } from "../../core/translation/parsers/scala-parser-adapter.js";
import { runAdapterContractSuite } from "./_helpers.js";

runAdapterContractSuite({
  adapter: new ScalaParserAdapter(),
  expectedLanguageId: "scala",
  realCode: `package com.example

import scala.io.StdIn

class Greeter(name: String) {
  def hello(): Unit = println(s"Hello, $name")
}

object Main extends App {
  new Greeter("world").hello()
}
`,
  malformedCode: "class object def { ;",
});
