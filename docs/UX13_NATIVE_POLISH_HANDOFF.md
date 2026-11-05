# UX-13A / UX-13B: localized native UX polish

Status: code/browser qualified; awaiting REGIA native Debian acceptance. No remote publication, merge, release or new visual slice.

## Authentic checkpoint recovery

Input HEAD `72874ec68d8925f7ecfa43eb4104700d3302aaff`, TREE `1cff1874df05f0ac79668ab299f948aee6bce4bb`. Verified every one of the archive's 610 tracked entries against that Git tree. The supplied incremental bundle requires `c6003da30c81be3ca9ba338af9ffbfcf0a76d46f`. Recovered that authentic parent commit and tree from the original Slice 1 archive and bundle using the existing `recover-slice1.py`, then fetched the supplied Slice 1.1 bundle. History before c6003da is explicitly shallow, not fabricated. Input checksums and verification are in `docs/evidence/ux13/recovery.json`. Original attachments are unchanged.

## Reproduced findings and minimal corrections

**UX-13A: a misleading/clipped minimap, not a stale camera transform.** At both viewports, the existing CSS sized the minimap panel to 120x74 while React Flow 12.11.2 rendered its default SVG at 200x150. For example, at 1672px the panel began at x=1501, width=120; its SVG began at x=1502, width=200, and extended beyond the graph. Nodes and the viewport mask were therefore only partially visible inside the intended minimap footprint. This matches the native screenshots. Baseline pointer-drag arithmetic was correct for the actual larger SVG; no independent stale-transform or node-measurement defect was reproduced. A standard click does not recenter this installed XYFlow minimap. Drag pans and wheel zooms; intentional panning can still move nodes off canvas.

Correction: `src/features/experience/EngineeringGraph.tsx`, MissionModel passes numeric MiniMap style dimensions (120x74) through RelationalCanvas. React Flow now uses those same dimensions for the SVG, viewBox and pointer scale. `src/styles/visual-workbench.css`, `.mission-model .react-flow__minimap` removes the conflicting CSS dimensions and uses content-box for the decorative 1px border. SVG is 120x74; outer bordered panel is 122x76. Scenario context minimaps retain their previous default size. No camera, fit, layout, node, edge or navigation algorithm changed.

**UX-13B: inherited rounded overflow clips the first glyph.** `.experience-model` supplies overflow:hidden and border-radius:12px. The borderless MissionModel places its eyebrow at the container's exact top-left content origin, so the inherited rounded clip cuts the U. Reproduced in Chromium as well as reported native, not evidence of a WebKit-only font bug. The original header crop and final crop show the difference.

Correction: `.mission-model` sets border-radius:0; it retains overflow and all existing header positions, typography and padding. Eyebrow and title remain at the same x coordinate. Other model surfaces retain their rounded containers.

Production delta: only two files, 7 additions / 5 deletions. Atlas, entity decoration, floating Questions, source semantics and Capture implementation unchanged. Package manifest and lockfile unchanged.

## Final qualification

- Full existing logic suite: 227/227 PASS. `logic-final.log`.
- TypeScript/Vite production build: PASS; existing chunk-size warning. `build-final.log`.
- `git diff --check`: PASS. `diff-check.log`.
- Deterministic browser geometry/interaction regression: 16 measured states per resolution, 1672x941 and 1280x800; PASS. `after/results.json` contains raw node dimensions, SVG/panel/viewBox bounds, viewport mask and camera for each state.
- Each state checks measured main-node bounds against minimap rectangles; viewport-mask x/y/width/height against the live canvas camera; SVG containment and actual size; eyebrow/title alignment and absence of rounded clipping.
- Real pointer checks: click retains camera; a single 8x4px minimap drag matches expected XYFlow pan scale; minimap wheel zoom, canvas drag, zoom button, Fit; Inspector open, width change to 480, minimap drag with Inspector; Atlas return; Focus then Whole Mission returns the persisted camera; explicit Investigation; PNG generation leaves live camera unchanged; Inspector close.
- Baseline evidence: `before/results.json`, initial/header/pan screenshots at both resolutions. Baseline drag agrees with normal library behavior despite the clipped presentation.
- Existing Slice 1.1 browser regression is recorded separately under `existing-regression` (including Atlas/model PNG, success and failure capture restoration, graph bounds, explicit Anchor, focus and other routes). PASS at both resolutions, zero page errors.
- Rust tests/checks: NOT RUN, cargo unavailable. Tauri/WebKitGTK: NOT RUN. Browser runs use the actual production App, retained pinned Core reports and mocked IPC/save. No claim of fresh Core execution or native saving/clipboard acceptance.
- Security remains FAIL: three previously reported HIGH findings, carried from retained audit; no security remediation or new audit claim.

## Reproduce

From the source root: `npm ci`, `npm run test:logic`, `npm run build`, `git diff --check`.

For browser reproduction, copy `docs/evidence/visual-slice-1.1/retained-core/reports.json` to `.sp2-acceptance/reports.json`; install Playwright and Chromium outside the product dependencies. Set PLAYWRIGHT_MODULE to the absolute playwright-core module path and CHROMIUM_EXECUTABLE_PATH to the browser binary, then run `node tools/test/convergence/ux13-check.cjs`. The harness starts/stops its own Vite server on port 1420. Baseline mode (`UX13_BASELINE=1`) is for the original pinned checkout only.

On Debian 12, run `cargo test --locked` and `cargo check --locked` in src-tauri. Launch using `WEBKIT_DISABLE_DMABUF_RENDERER=1` and a fresh CARGO_TARGET_DIR with `npm run tauri:dev`. Open the real frozen mission/Core. Verify the two labels at both viewport sizes, minimap dragging and wheel zoom, Inspector open/resize/close, Atlas and Focus return, and native Capture. Nodes leaving view after intentional pan is normal; Fit restores framing. REGIA native acceptance remains required.

## Bundle contract

The delivered bundle is incremental from exact parent `72874ec68d8925f7ecfa43eb4104700d3302aaff`, not standalone. In a repository containing that baseline, run `git bundle verify /path/OrbitFabric_Studio_Slice1_1_UX13.bundle`, fetch its HEAD, and inspect it in an isolated worktree. A fresh independent recovery is validated before delivery. The source archive contains all tracked source, prior evidence and new evidence; no installed node_modules. Final HEAD/TREE, artifact sizes and SHA-256 are supplied in the delivery manifest alongside the files.
