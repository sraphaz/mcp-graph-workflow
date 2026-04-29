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

import { PhpParserAdapter } from "../../core/translation/parsers/php-parser-adapter.js";
import { runAdapterContractSuite } from "./_helpers.js";

runAdapterContractSuite({
  adapter: new PhpParserAdapter(),
  expectedLanguageId: "php",
  realCode: `<?php

namespace App;

class Greeter {
    private string $name;

    public function __construct(string $name) {
        $this->name = $name;
    }

    public function hello(): void {
        echo "Hello, " . $this->name . "\\n";
    }
}

$g = new Greeter("world");
$g->hello();
`,
  malformedCode: "<?php class { function { ;",
});
