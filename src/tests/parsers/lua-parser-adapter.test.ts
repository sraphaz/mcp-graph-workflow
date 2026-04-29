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

import { LuaParserAdapter } from "../../core/translation/parsers/lua-parser-adapter.js";
import { runAdapterContractSuite } from "./_helpers.js";

runAdapterContractSuite({
  adapter: new LuaParserAdapter(),
  expectedLanguageId: "lua",
  realCode: `local Greeter = {}
Greeter.__index = Greeter

function Greeter.new(name)
  local self = setmetatable({}, Greeter)
  self.name = name
  return self
end

function Greeter:hello()
  print("Hello, " .. self.name)
end

local g = Greeter.new("world")
g:hello()
`,
  malformedCode: "local function end ;",
});
