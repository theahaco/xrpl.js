# Typeahead pictures for PR #57

These are **rendered previews of real TypeScript language-service results**, not screenshots of an editor. Native-editor capture was unavailable because the computer-use tool was not approved to access Zed. The UI is an illustration; no editor-specific rendering or interaction is claimed.

`completions.json` records the actual input programs, cursor positions, completion names/kinds/modifiers, selected documentation/signatures, TypeScript version, SDK revision and entry declaration hash. The transaction and command menus show excerpts of all 78 and 45 entries respectively. Payment fields show required/optional status from the returned modifiers. The builder menu shows all three actions. Documentation is displayed as an excerpt, with formatting whitespace normalized and trailing raw JSDoc link markup omitted.

- `transactions.png`: `client.tx.` with Payment documentation.
- `commands.png`: `client.command.` with accountInfo documentation.
- `payment-fields.png`: field suggestions inside `client.tx.payment({ ... })`.
- `builder-actions.png`: `signAndSubmit`, `toJSON` and `trySignAndSubmit`, including the inferred Payment response type.

To regenerate from the SDK repository root, build the SDK and install the audit harness dependencies, then run:

```sh
node devx-audit/harness/capture-completions.cjs
python3 devx-audit/harness/render-completions.py
```

The renderer needs Pillow and defaults to macOS Arial/Menlo fonts. Set `PREVIEW_UI_FONT`, `PREVIEW_BOLD_FONT`, and `PREVIEW_MONO_FONT` to font files on other platforms. `XRPL_TYPESCRIPT_PATH` can select a specific installed TypeScript package; the generated JSON and picture footer always record the actual version used. The attached images were generated with TypeScript 5.9.3. The capture checks the expected counts, required names and nonempty documentation before writing output.
