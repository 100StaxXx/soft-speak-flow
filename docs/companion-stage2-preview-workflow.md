# Companion Stage-2 Preview Workflow

This review pass assumes one `stage 2` sheet per species with six element panels in this order:

1. `fire`
2. `ice`
3. `storm`
4. `nature`
5. `void`
6. `light`

## Commands

Generate the prompt/manifest pack:

```bash
npm run companions:stage2:manifest
```

Generate stage-2 species sheets with the OpenAI API, then extract each sheet into six singles.
This command requires `OPENAI_API_KEY` to already be set in the current shell environment:

```bash
npm run companions:stage2:generate-sheets
```

Extract a 2x3 uploaded species sheet into six review singles:

```bash
npm run companions:stage2:extract-sheet -- --input "/absolute/path/to/species-sheet.png" --preset dragon
```

Render review contact sheets and an HTML gallery for every species that has singles:

```bash
npm run companions:stage2:sheets
```

## Output

All review assets are written to:

```text
output/companion-stage2-previews/
```

Key folders:

- `manifests/`
- `reference-sheets/`
- `singles/`
- `contact-sheets/`
- `index.html`

## Notes

- `ice` is locked to a fully glacial treatment.
- This workflow is for `stage 2` review art only.
- `companions:stage2:generate-sheets` uses the extracted dragon sheet as the style/layout reference for the remaining species.
- The workflow organizes prompts, generates review sheets, extracts singles, and assembles contact sheets.
