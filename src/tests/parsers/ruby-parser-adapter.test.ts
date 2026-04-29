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

import { RubyParserAdapter } from "../../core/translation/parsers/ruby-parser-adapter.js";
import { runAdapterContractSuite } from "./_helpers.js";

runAdapterContractSuite({
  adapter: new RubyParserAdapter(),
  expectedLanguageId: "ruby",
  realCode: `require 'json'

class Greeter
  def initialize(name)
    @name = name
  end

  def hello
    puts "Hello, #{@name}"
  end
end

Greeter.new("world").hello
`,
  malformedCode: "class def end ;",
});
