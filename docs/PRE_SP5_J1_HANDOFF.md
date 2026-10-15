# Pre-SP5 C2 / J1: production family markers

Disposition: **IMPLEMENTED / PENDING HUMAN ACCEPTANCE. No merge or release.**

## A. Authority and verified baseline

- Product: `OrbitFabric/orbitfabric-studio`, `main` HEAD `852210795aa15020f5f117298c42900bd3e95501`, TREE `07cf1e2a78c46914fb3293072a096cc07c9b1940`. Verified via GitHub and fresh clone; working tree initially clean; upstream main rechecked unchanged before implementation publication.
- Dedicated branch: `studio/pre-sp5-c2-j1-family-markers`; target `main`; one DRAFT PR. Exact published HEAD/TREE and live CI disposition belong to the PR handoff, because a document cannot contain its own commit identity.
- [Decision 022](https://github.com/OrbitFabric/OrbitFabric-Architecture-Lab/blob/24356df276bbc15ed2cba19125870258e26a1c6d/decisions/studio/022-pre-sp5-c1-acceptance-c2-scope-a-authorization.md), [Evidence 034](https://github.com/OrbitFabric/OrbitFabric-Architecture-Lab/blob/24356df276bbc15ed2cba19125870258e26a1c6d/evidence/studio/034-pre-sp5-c1-product-prototype-convergence-assessment.md), [Roadmap 003](https://github.com/OrbitFabric/OrbitFabric-Architecture-Lab/blob/24356df276bbc15ed2cba19125870258e26a1c6d/roadmap/studio/003-pre-sp5-product-release-convergence.md).
- Lab authorization HEAD `24356df276bbc15ed2cba19125870258e26a1c6d`, TREE `cb14692647b1498d0ff365426518aa80b585aa94`; PR #210 verified OPEN / DRAFT / UNMERGED and untouched.
- Visual source: accepted S3 `FamilyMarker.jsx`, `family-markers.mjs`, styles, tests/fixtures/browser check and acceptance dossier at `c8fd6b5895c0f78ac9e2dbedcca337117747d61d` (implementation `b5fcc6d29c214e861ac61641351d67afb384e6cd`). Only original SVG paths and restrained accents transferred. No fixture model transferred.

## B. Production mapping, decided before component edits

Authority: `src/core/contracts.ts` (`MissionModelDto`), `src/mission/entityRef.ts`, `resolveEntityContract.ts`, `scenarioUnderstanding.ts`, `scenarioPresentation.ts`, integration contracts and SP4 lifecycle contracts/read model. Exact domain and atom-kind lookups only. Neither arbitrary object names nor IDs are classified.

| Real source vocabulary | Display family | Selected production site / disposition |
| --- | --- | --- |
| `subsystems` / declared mission participants | subsystem | Atlas participant section heading; Scenario entity references |
| `payloads` | payload | Atlas payload count; Scenario exact references |
| `commands` | command | Atlas command count; Scenario references |
| `telemetry` | telemetry | Atlas telemetry count; Scenario references |
| `events` | event | Atlas event count; Scenario references |
| `faults` | fault, neutral accent | Atlas declared fault count; exact references, never runtime warning |
| `data_products` | data product | Atlas count; exact references |
| `modes` | mode | Atlas count; Scenario mode references and atoms; not current runtime state |
| Core Scenario declaration / `scenario_metadata` | scenario | Scenario heading / metadata atom |
| `initial_mode`, `expect_mode` | mode | Existing atom titles; initial/expectation role preserved |
| `initial_telemetry`, `telemetry_injection`, `expect_telemetry` | telemetry | Existing atom titles; no warning/status color |
| `command`, `expect_command`, `expect_command_status` | command | Existing atom titles; action vs expectation remains textual |
| `expect_event` | event | Existing atom title, never observed event assertion |
| `expect_payload_lifecycle` | payload | Declared expectation, never active payload state |
| `expect_scenario_status` | scenario | Expected PASSED remains declared intent; no Result/PASS marker |
| `expect_data_flow` | none | Data flow is not automatically a Data Product; explicit title retained |
| `IntegrationResult` | result | Existing Last Result heading and Evidence independent Result identities heading; status remains separate |
| retained Evidence Set records | evidence | Existing Evidence records heading; no assessment/verification shield |
| Result-owned `ScenarioProjectionAccounting` | none in J1 | No equivalent existing dedicated heading selected; preserve existing content; hierarchy belongs to J4 |
| `IntegrationPackageDescriptor`, profile/input resources | none in J1 | Real typed resources exist, but no universal Lab Resource equivalence adopted |
| `IntegrationPackageOperation`, execution state | none in J1 | Existing operations do not establish Lab Work/Occurrence semantics |
| Installed/desired/catalog/verification lifecycle types | none in J1 | Preserve independent SP4 lanes and exact identities; no generic lifecycle health marker |
| spacecraft, packets, contacts, flows, command sources/rules, autonomous actions, recovery intents, unknown domains/kinds | none | Explicit existing text retained; no inferred family or unsupported destination |

Subsystem and Payload remain distinct even when they share an ID. `FamilyLabel` never receives or replaces an identity; existing `{domain,id}`, keys, handlers and lookup logic remain in their owners.

## C. Implementation and file accounting

- `src/features/presentation/familyMarkers.ts`: 11 frozen S3 shapes; exact production-domain and Scenario-kind lookup tables; own-property-safe unknown fallback.
- `src/features/presentation/FamilyLabel.tsx`: stateless inline decoration alongside caller-supplied visible text; SVG 16 px, 20-unit viewBox, 1.5 stroke, `currentColor`, `aria-hidden`, nonfocusable.
- `src/styles/family-markers.css`: only marker/label classes; fixed S3 accent values; first-line alignment, wrap support, pointer-inert SVG and forced-colors treatment. No new design system, global status styles or selection/focus overrides.
- `src/main.tsx`: stylesheet import.
- `MissionAtlas.tsx`: participant heading plus typed inventory facts. Mixed semantic territories remain unclassified. Participant cards and handlers untouched.
- `ScenarioWorkspace.tsx`: Scenario heading, atom titles and existing domain-qualified reference text. No new event handlers or state.
- `IntegrationsWorkspace.tsx`: explicit optional family on existing `CardTitle`, used only for Last Result; status pill unchanged.
- `EvidenceReplayWorkspace.tsx`: two existing headings only. Replay selection and projections unchanged.
- `tests/studio-logic/family-markers.test.mjs`, logic test runner/config: eight focused tests integrated into full suite.
- `tools/test/scenario-browser/retained-preview.ts`: test-only executable-resolution observation using the path that produced retained reports. Existing harness lacked this post-H4 IPC case. No claim of native resolution proof.
- `tools/test/family-markers/browser-check.mjs`: optional reproducible actual-App checks with externally provided Playwright/Chromium; no added dependency.
- This dossier and `docs/evidence/j1/`: screenshots, browser observations, baseline narrow-header observation, audit and fixture provenance.

Deliberately untouched: Core/gateways, contracts/validators, all read models/reducers, identity, App/navigation, Explorer/X-Ray, Relationships/Context Path, Operations/Mode Focus, graph geometry/routing/ports/ELK, capture implementation, Rust/Tauri, dependencies/lockfiles and CI definitions. No Lab source files or PRs changed.

## D. Semantic preservation

Markers are decoration selected by an already existing type or by the statically typed surface. They do not read status, outcomes, readiness, authorization, trust, health or evidence assessment. All original labels, declared roles, expected values and explanatory boundaries remain visible. Fault uses neutral geometry/accent; Scenario expectation never selects the Result marker. A completed Integration Result is not Scenario success.

The new component has no state, effects, handlers, filesystem/process access or navigation. The diff leaves selection dispatches, exact identity construction, graph files and Core → Tauri/gateway → generation-scoped read models intact. Source comparison against the baseline confirms all those ownership areas, package manifests and lockfile byte-identical. Focus and selection styles remain existing product styles, not the prototype ring design.

## E. Verification

| Gate | Actual result |
| --- | --- |
| Focused J1 logic/render tests | **8/8 PASS**: deterministic mapping, safe fallback, text/noninteractive SVG, same ID in distinct domains and selection, all Scenario atoms/EXPECT, separate focus/selection accents, contrast, long exact identities |
| Full existing Studio logic suite plus J1 | **183/183 PASS**, no skips/cancellations |
| TypeScript + Vite production build | **PASS**; existing large-chunk warning remains |
| Whitespace / protected source diff | **PASS** |
| `npm audit --audit-level=low` | **FAIL**: two high affected packages, `fast-uri` and `source-map-js`; lockfile unchanged from baseline. No threshold waiver or dependency update in J1 |
| Actual-App Chromium 153.0.8010.0 | Atlas, eight Scenario atoms, exact references, keyboard focus/selection, Result and Evidence headings at 1280/960/640 px; no family-label overflow; see `browser.json` |
| Grayscale | Chromium screenshots of selected Scenario and retained Evidence at all three widths; original labels and family shapes remain available |
| Surface Capture | Actual Scenario rendering to PNG and layout restoration **PASS in Chromium**, native save intercepted by test driver to retain PNG; native save/clipboard **NOT RUN** |
| Compact shell pointer navigation | **FAIL at 640 px, reproduced on unchanged product baseline**; Core actions overlap navigation. Keyboard navigation used for 640 px surface checks. Not a J1 regression, not fixed or accepted by this report |
| Last Result in live Integrations workspace | Build verified; loaded-package native/browser walkthrough **NOT RUN**. Evidence Result heading exercised with exact retained Result |
| Native Linux WebKitGTK | **NOT RUN** |
| Native Windows WebView2 | **NOT RUN** |
| Human visual acceptance | **PENDING** |
| Established GitHub CI | Runs on published draft candidate; exact run/job disposition recorded in PR handoff. Local tests do not substitute for CI |
| C3 whole-candidate qualification / public Core v1.4.0 matrix | **NOT RUN / NOT AUTHORIZED** |

Browser provenance: freshly exported reports from accepted H4 Core `55b94665a76865b9d4f49861b2e3ec6ae93c3dea`, Reference Mission `75c6e336755430584c0cc39d15190193e255c4a0`. Reference checkout has unrelated preexisting workflow changes; mission/scenario inputs unchanged. Exact report/input hashes are recorded separately. The real App, gateway parsing, reducers and rendering are used with mocked IPC/file dialogs. Retained Result/accounting/Evidence bytes come from existing product fixtures. No live adapter invocation, native process execution or new native compatibility claim.

Reproduce frontend gates: `npm ci`, `npm run test:logic`, `npm run build`, `npm audit --audit-level=low`, `git diff --check`.

Browser: prepare pinned reports with the existing `tools/test/scenario-browser/prepare.py`; run from repository root with `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium node tools/test/family-markers/browser-check.mjs`. Port 1420 must be available. This requires external browser tooling and changes no dependency declaration.

## F. Residuals and deferred sites

1. Existing dependency audit failure prevents claiming a fully green candidate; requires separate dependency disposition, not silent iconography scope expansion.
2. Existing 640 px header overlap is a shell limitation; the compact marker/layout evidence is explicitly narrower than an end-to-end pointer-navigation PASS. 1280 px can also compress the existing brand area. No shell redesign is included.
3. Native rendering/save and loaded Integrations Result visual check remain open; human acceptance is mandatory.
4. Unknown/ambiguous kinds, Accounting, Resource, Operation/Work, lifecycle and graph sites intentionally retain text-only presentation. No J2/J3 dependency was necessary. Temporary inspection/Return, content hierarchy and accounting improvements remain separate packages.
5. Marker padding consumes 22 px of text width and can cause earlier wrapping. Existing cards/rows and graph geometry are not resized by a new algorithm. Screenshots document actual wrapping; native review must reject clipping or lost meaning.
6. Final palette remains deferred under WM010 §23. Current S3 accents meet the automated contrast test against the five product surface colors; this is not final design approval.

## G. Published identity

The single draft PR supplies exact candidate HEAD, TREE, changed-file/diff summary, clean local working-tree status and CI run links. Baseline identity is fixed in A. No merge, tag, version or release operation is authorized or performed. PR #210 remains untouched.

## H. Human visual walkthrough and falsification

Check out the exact PR HEAD. Open the real Reference Mission in Tauri; record OS, engine, width and subject. Repeat wide/standard/compact views and grayscale.

1. Overview: inspect Mission participants and count rows for modes, commands, faults, telemetry, events, Data Products and Payload. Fault must look like a declared family, not an observed alarm. Counts and participant selection must match baseline.
2. Scenarios: choose the existing stop-acquisition declaration. All eight atoms and authored values remain available. Inspect Initial mode, Command, Event/Telemetry/Payload expectations and Scenario status expectation. Expected PASSED must remain DECLARED; no checkmark or result-success inference.
3. Click a domain-qualified entity, inspect X-Ray and use the existing route/close behavior. Repeat with equal IDs in different domains where available. Selection and focus must retain product behavior. There is no new Return action.
4. Tab/Shift+Tab through references, activate with Enter, verify the ring/border remains separate from the marker. Read long exact IDs and hashes; open details and copy them.
5. Evidence: load the retained Result and Evidence Set. Distinguish the Result document marker from Evidence; producer outcome, projection disposition, absent/unavailable assessment and curator statements must remain separate.
6. Integrations: load an actual registered package with a retained Result. Inspect Last Result family label and separate producer status pill, including failure/no-result cases. Completion must not imply Scenario success.
7. Capture Scenario and Evidence in each supported native engine; inspect PNG for markers and full text and confirm live selection/scroll/layout restoration. Native dialogs/save/clipboard require native testing.
8. At 640 px, record the preexisting header collision explicitly. Use keyboard to inspect content, but do not report complete pointer usability as PASS.

Reject J1 for wrong-family classification, identity aliasing, lost/hidden labels, misleading status or verdict, changed selection/focus/navigation, clipping introduced by markers, graph/port/routing drift, or capture regression. Chromium results do not close native or human acceptance.

Selected evidence: [Scenario standard](evidence/j1/scenario-960.png), [Scenario compact](evidence/j1/scenario-640.png), [selection/grayscale](evidence/j1/scenario-selected-gray-960.png), [Result/Evidence grayscale](evidence/j1/evidence-gray-1280.png), [full Scenario capture](evidence/j1/scenario-capture.png).

## I. Stop boundary and permanent roadmap return contract

J1 implementation is complete, **acceptance pending**. J2–J5 not started. No C3/C4, SP5, release or merge. **STOP FOR HUMAN ACCEPTANCE.**

This lane does not replace Studio Roadmaps 001/003, Ecosystem 028/030 or WM007–WM011. After publication or after pausing/abandoning convergence, return to Decision 022 and Roadmap 003 with the last exact candidate/release HEAD/TREE, included/excluded packages and PRs, actual platform support evidence, Core/Reference/adapter/catalog identities, positive/negative tests, accepted residuals and separate bug/new-semantics inventory.

Carry forward: W1 operation-specific GUI input binding; W2 prepared-revision authorization parity; W3 durable Work/Result continuity; deferred Resources/Accounting and other surfaces; independent SP5 authorization and Reference Mission EC3 distinction; non-normative subject-first cognitive-scalability Issue #203; independent graph research PR #207; WM010 §23 palette and no S3-02; SP6 Generated Output Center after separately authorized SP5; SP7 Data Product Journey; separately gated SP8 runtime; SP9 authoring outside scope; accepted public adapter onboarding and provider-explicit AC ownership; published R1/R2 and future Engineering Stories as separately authorized work.

Preserve `DECLARED != PROJECTED != GENERATED != EXECUTED != OBSERVED`. Neither retained replay nor this release lane completes EC3 or SP5. Reconcile newer accepted evidence against the roadmaps and make an explicit authorization/no-go/research-first decision before further implementation.
