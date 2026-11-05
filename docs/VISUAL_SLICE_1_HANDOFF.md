# Visual Slice 1: REGIA handoff, 2026-10-22

Status: WIP / NOT VISUALLY ACCEPTED. Stop for REGIA review.
Baseline: 7525ba018e43c0c1749e3fa08b8525cfec8bce77.

Implemented: Atlas participant/discovery split; compact Model controls; independent layout of connected components without invented edges; explicit inspection versus focus; opt-in floating Investigation; capture composition includes Investigation; live select values preserved in graph export.

Final verification: 226/226 logic PASS; TypeScript/Vite build PASS (chunk-size warning); git diff --check PASS. Chromium actual production App with retained Core reports and mocked IPC/save: both 1672x941 and 1280x800 PASS for 7 participants, 8 represented nodes/1 relation, explicit anchor, camera continuity, PNG generation, scroll/camera restoration and route smoke checks. These are NOT native or end-to-end Core execution results. Logs and screenshots: docs/evidence/visual-slice-1/browser-final. Earlier failed attempts are preserved separately.

Native Cargo test/check and Tauri/WebKitGTK: NOT RUN, cargo absent. Retained npm audit: 3 HIGH, SECURITY FAIL; package.json and lockfile unchanged. Audit was not refreshed in this continuation.

Visual limitations: exported PNG contains active Investigation and correct selected values, but the 1280px inspected Model still clips graph content horizontally; html2canvas shows control styling artifacts. Capture visual acceptance remains PARTIAL, not PASS. Default graph card arrangement and whitespace still require REGIA comparison with V01/V02. Functional browser PASS does not qualify visual quality. No merge, release, SP5 or other surface redesign.

## Reproduce on Debian 12
Use the supplied source archive in an isolated directory (same Studio product; no new product branch). Run npm ci, npm run test:logic, npm run build; in src-tauri run cargo test --locked and cargo check --locked. Launch with WEBKIT_DISABLE_DMABUF_RENDERER=1 and a fresh CARGO_TARGET_DIR using npm run tauri:dev. Open the pinned real Reference Mission with pinned Core from the directive. Check both viewport sizes, inspection, explicit Investigation, Return, Capture and scrolling. Native saving/clipboard remain NOT RUN here.

The bundle preserves the checkpoint commits; the source tar contains tracked source and all evidence, no node_modules. No remote publication was performed; origin in the recovered checkout points to another local checkout.
