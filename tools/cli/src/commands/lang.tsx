/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import {
  type LangCode,
  SUPPORTED_LANGS,
  configPath,
  getActiveLang,
  persistLang,
  readPersistedLang,
  resolveLang,
  setActiveLang,
  t,
} from "../i18n/index.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

/**
 * `mg lang` — view / toggle / set the user-facing language.
 *
 *   mg lang                    print current language + how to change it
 *   mg lang toggle             flip between en and pt-br, persist
 *   mg lang en                 set to English, persist
 *   mg lang pt-br              set to Portuguese-BR, persist
 *
 * `--lang <code>` flag on any other command is a one-shot override that
 * does NOT persist — useful for scripts.
 */

export async function runLang(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const arg = ctx.args[0];

  if (!arg) {
    return showCurrent(ctx);
  }

  if (arg === "toggle") {
    return doToggle(ctx);
  }

  if (SUPPORTED_LANGS.includes(arg as LangCode)) {
    return doSet(ctx, arg as LangCode);
  }

  return {
    exitCode: 2,
    text: t("lang.unsupported", {
      lang: arg,
      supported: SUPPORTED_LANGS.join(", "),
    }),
  };
}

function showCurrent(ctx: CommandHandlerArgs): CommandHandlerResult {
  const active = getActiveLang();

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        active,
        persisted: readPersistedLang(),
        supported: SUPPORTED_LANGS,
        configPath: configPath(),
      },
    };
  }

  return {
    exitCode: 0,
    element: (
      <Box flexDirection="column" paddingX={1}>
        <Text>
          <Text dimColor>{t("lang.current", { lang: "" }).replace("{lang}", "")}</Text>
          <Text bold color="cyan">{active}</Text>
        </Text>
        <Box marginTop={1}>
          <Text dimColor>supported: </Text>
          <Text>{SUPPORTED_LANGS.join(", ")}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>switch:</Text>
          <Text>
            <Text dimColor>  </Text>
            <Text color="green">mg lang toggle</Text>
            <Text dimColor>{"     # flip between en and pt-br"}</Text>
          </Text>
          <Text>
            <Text dimColor>  </Text>
            <Text color="green">mg lang &lt;code&gt;</Text>
            <Text dimColor>{"     # set explicitly + persist"}</Text>
          </Text>
          <Text>
            <Text dimColor>  </Text>
            <Text color="green">--lang &lt;code&gt;</Text>
            <Text dimColor>{"      # one-shot, no persist (any command)"}</Text>
          </Text>
        </Box>
      </Box>
    ),
  };
}

function doToggle(ctx: CommandHandlerArgs): CommandHandlerResult {
  const current = getActiveLang();
  const next: LangCode = current === "en" ? "pt-br" : "en";
  return doSet(ctx, next);
}

function doSet(
  ctx: CommandHandlerArgs,
  lang: LangCode,
): CommandHandlerResult {
  persistLang(lang);
  setActiveLang(lang);
  // Re-resolve so subsequent t() calls in this run already use the new lang.
  const active = resolveLang();
  setActiveLang(active);

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        previous: getActiveLang() === lang ? null : null,
        active: lang,
        persisted: true,
        configPath: configPath(),
      },
    };
  }

  return {
    exitCode: 0,
    element: (
      <Box flexDirection="column" paddingX={1}>
        <Text color="green" bold>
          {t("lang.changed", { lang })}
        </Text>
        <Text dimColor>{t("lang.persistedAt", { path: configPath() })}</Text>
      </Box>
    ),
  };
}
