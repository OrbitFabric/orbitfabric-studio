# OrbitFabric Studio Visual Slice 1.1

Date: 2026-10-23. Implemented and browser-verified. REGIA visual acceptance pending.

## Exact recovery

The eleven supplied files were used according to the clarification: two checkpoint artifacts, five approved visual directions, four actual Debian/Capture observations. V01/V02 are implementation targets; V03/V04/V05 establish shared identity only.

Recovered baseline HEAD `c6003da30c81be3ca9ba338af9ffbfcf0a76d46f`, TREE `c3f26a91560b98fb2fcaffc5f754884ceb1e6381`.

The original bundle is **incremental**, requiring `7525ba018e43c0c1749e3fa08b8525cfec8bce77`. It cannot be cloned independently in a new workspace. The archive reconstructs the exact authorized tree. The original final commit was recovered byte-for-byte from the bundle, verified by Git SHA-1, and installed with an explicit shallow boundary at that commit. No fabricated replacement commit or previous workspace was used. `tools/test/convergence/recover-slice1.py` reproduces this recovery from the two original inputs; its successful fresh-directory execution is logged. Input SHA-256 values and sizes are retained in `docs/evidence/visual-slice-1.1/input-manifest.json`.

## Implemented changes

| Requirement | Result | Implementation |
|---|---|---|
| Coherent V01–V05 family | IMPLEMENTED within authorized surfaces | Shared navy material, blue interaction states, offline Inter fonts, exact-type glyph vocabulary, decorative orbital banner |
| Overview / Atlas | IMPLEMENTED | `MissionAtlas.tsx`: exact participants, compact cards, recognizable type accents, existing navigation actions, actual content counts |
| Mission Model | IMPLEMENTED | `EngineeringGraph.tsx`, `graphFraming.ts`: connected components first, readable relation corridor, type legend and minimap, resize-aware camera preserving relative user zoom/pan |
| Shared shell | IMPLEMENTED | `App.tsx`, `visual-workbench.css`: wordmark, mission identity, navigation hierarchy |
| Investigation presentation | IMPLEMENTED | Explicit open/close, dedicated heading, compact proposal bar; question/Anchor/Scope logic unchanged |
| Capture | IMPLEMENTED; browser verified | `offscreenGraphCapture.ts`: detached full-representation framing, exact live selected text, explicit native-control styles, geometry-edge label compositing, flat export node material avoids transformed shadow artifacts |
| Core-owned engineering semantics | PRESERVED | Seven declared subsystems, eight represented objects and one explicit Core relationship in whole Mission; no illustrative relations, counts or ownership claims copied from reference images |
| Other perspectives | NOT REDESIGNED | Existing routes smoke-tested; shared shell appearance carries across routes |
| Native Debian / Tauri qualification | NOT RUN | Cargo/native desktop toolchain absent; no native-save or clipboard acceptance claim |

`EntityGlyph.tsx` uses exact declared `type` values only, with a generic fallback. It never recognizes entity IDs or derives engineering relationships. Lower-card type and criticality remain available in Inspector; Atlas foregrounds name, exact ID and full description.

Camera resizing preserves the user's relative zoom/pan. At 1280 pixels with Inspector open, the complete mission is necessarily a reduced-scale overview; exact inspection, Show inspected subject, focus and zoom remain available. Atlas uses scrolling at smaller heights rather than hiding content. The approved reference contains illustrative relationships that the real Core export does not: its dense topology is deliberately not reproduced.

Capture is a full representation export, not a screenshot of the current pan. The detached graph is fitted at a readable export width (minimum 1280; 1680 with Inspector), while the interactive camera and reading positions are retained. Active Investigation and full Inspector content are included. Export-only node shadows are suppressed to avoid html2canvas transformed-box artifacts.

## Verification on final product source

- Logic: **227/227 PASS**, zero failures/skips. Includes one new exact-type decoration/fallback/immutability check and existing semantics, topology, identity, negative-source and session-boundary tests.
- TypeScript/Vite production build: **PASS**. Existing large-chunk warning remains.
- `git diff --check`: **PASS**.
- Real Core export preparation: **PASS**, Core `5196e128974510b4cbd3bcd89ea971ff2b68301b` (1.4.0), Reference Mission `e8f4a392e0bc3075df1ea3b00b842ba6b9e6e5ca`. Retained reports and exact source hashes are included.
- Browser: **PASS at 1672×941 and 1280×800**, Chromium 153.0.8010.0, actual production App through test-only mocked IPC/save transport. No page errors. Exact node/edge counts; graph bounds including relation label with Inspector; explicit Anchor; Return camera; Atlas PNG; graph Capture bounds; camera/scroll restoration; focus retaining Anchor; whole-Mission restoration; deliberate save failure cleanup; seven-route smoke checks.
- Final screenshots and actual generated PNG files: `docs/evidence/visual-slice-1.1/browser-final/`. Capture bounds JSON is machine-checkable. Earlier intermediate failures remain retained and are not final acceptance evidence.
- Native Cargo/Tauri/WebKitGTK, native file dialogs/saving and clipboard: **NOT RUN**. Browser transport mocks are not native execution.
- Dependency manifests and lockfiles unchanged. Previous checkpoint's recorded dependency-audit findings were not requalified in this visual slice.

## Reproduce

Extract the source archive into a new directory. It is complete runnable source with evidence, not a binary installer.

```bash
npm ci
npm run test:logic
npm run build
mkdir -p .sp2-acceptance
cp docs/evidence/visual-slice-1.1/retained-core/reports.json .sp2-acceptance/reports.json
# Install Playwright externally, or use an existing installation and browser.
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core \
CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium \
VISUAL_SLICE_EVIDENCE_DIR=verification-local \
node tools/test/convergence/visual-slice-1.1-check.cjs
```

Fresh Core exports can replace the retained reports with the pinned repositories and:

```bash
python tools/test/convergence/prepare.py /absolute/path/to/reference --core /absolute/path/to/orbitfabric
```

For native qualification on the user's Debian environment:

```bash
cd src-tauri
cargo test --locked
cargo check --locked
cd ..
WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev
```

Open the real Reference Mission with the pinned Core, repeat both viewport sizes, inspect, focus, Return, Investigation, Capture and save/clipboard checks. Confirm font rendering, controls and PNGs in WebKitGTK. These commands are proposed reproduction steps, not claimed executed results.

## Git delivery

The delivered Slice 1.1 bundle is intentionally incremental against the exact supplied Slice 1 HEAD. Its prerequisites are explicit. For a completely new Git checkout, run `recover-slice1.py` against the original source archive and original bundle, then fetch the new bundle:

```bash
python tools/test/convergence/recover-slice1.py /path/OrbitFabric_Studio_Slice1_Source.tar.gz /path/OrbitFabric_Studio_Slice1.bundle /path/recovered
cd /path/recovered
git bundle verify /path/OrbitFabric_Studio_Slice1_1.bundle
git fetch /path/OrbitFabric_Studio_Slice1_1.bundle HEAD
git switch -c visual-slice-1.1 FETCH_HEAD
```

No remote publication, PR, merge or release was performed.

## Assets and attribution

Inter font binaries are bundled locally under `src/assets/fonts` with SIL Open Font License, for consistent offline desktop rendering. Existing dependency manifests are unchanged.

`src/assets/orbital-horizon.png` was generated with built-in imagegen as decorative art. It conveys no mission configuration or engineering facts. Final prompt:

> Use case: stylized-concept. Asset type: decorative background for OrbitFabric Studio engineering workbench banner. Wide cinematic orbital view, 3:1 aspect ratio. Deep nearly black navy space on the left 45 percent, sparse subtle stars. On the right a realistic small unbranded satellite with blue solar panels above Earth's curved blue atmospheric limb and detailed clouds. Rich but restrained electric blue lighting at horizon, professional scientific software aesthetic. Earth and satellite mainly in right half, satellite near 72 percent width. No text, no UI, no numbers, no labels, no watermark. This is decorative art, not an engineering diagram. Save image for use as local project asset.
