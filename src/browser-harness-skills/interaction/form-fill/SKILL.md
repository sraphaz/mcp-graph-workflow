---
name: browser-harness/interaction/form-fill
description: Reusable pattern for filling and submitting an arbitrary HTML form.
triggers:
  - form
  - submit
version: 1.0.0
---

# Form-fill interaction

## Recipe

1. `wait_for(selector: <form-selector>)` — make sure the form is rendered.
2. For each field: `type_text(selector: <input>, text: <value>)`.
3. `click(selector: <submit>)`.
4. `wait_for(selector: <success-element>)` — verify post-submit state.
5. `screenshot()` — for the report.

## Edge Cases

- `<select>` requires a custom helper (use `Runtime.evaluate` to set value
  + dispatch `change`). If missing, self-heal one named `set_select`.
- File uploads need `Page.setFileInputFiles` via `cdp_raw` — see the
  `upload_file` reference helper if present.
