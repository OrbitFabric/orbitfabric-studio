# One Product Convergence V1: REGIA review candidate

Disposition: integrated product implementation, DRAFT, not merge-ready. This is the single Studio branch `studio/experience-convergence-v1`, based directly on `852210795aa15020f5f117298c42900bd3e95501`, tree `07cf1e2a78c46914fb3293072a096cc07c9b1940`. No release, merge, SP5 or probabilistic work is included. M0+ is not promoted; B1 remains rejected.

## Implementation and checkpoints

Checkpoint A is local commit `ebc067d`: production family-marker transfer, Core-backed Mission Model, Core-authored Scenario graph and shared typed inspection container. Its tests are 186/186 PASS; TypeScript/Vite PASS. Checkpoint B adds the bounded deterministic investigation inside the same App, with subsequent corrective UI integration and regression evidence. The final PR supplies published identities; connector publication may change commit metadata while preserving tested trees. No second frontend or implementation branch was created.

The existing App, Tauri gateways, MissionSession, reducers and semantic producers remain owners. Mission Model uses Core entity index and relationship records, with exact domain-qualified endpoints and relationship IDs. Scenario uses `buildScenarioUnderstanding`, retains every atom and the existing full textual surface, and adds a read-only React Flow authored-order representation. Neither graph imports Lab fixtures, inferred name relationships or the rejected S2-04A algorithm. Existing Operations and Context Map ELK routing is unchanged.

The Engineer can start with an existing native selection or choose a question before binding an anchor. Explicitly including an accepted declaration establishes a bounded corpus in the current Mission generation. Three tested source files are selected by the test operator, never discovered by the product. Retained selected observations remain explicitly source-qualified. Scope checkboxes and representation filters are independent. Question changes retain bounded Return checkpoints; inspection does not retarget the anchor. Compare shows independent source identities and declared-field/order differences. It does not claim cross-scenario atom equivalence or assess intent quality.

Projection and association consume the existing `buildEvidenceUnderstanding` model, requiring the selected exact Scenario and Result. All eight atoms survive, including unavailable records. The canonical producer account has three projected and five not projected atoms. Mapping associations, direct atom associations and assessment remain separate. `succeeded` is a producer operation result, not an executed Scenario PASS. Execution assessment is explicitly UNSUPPORTED.

## Source and donor crosswalk

| Donor / source symbols | Product mapping | Disposition |
| --- | --- | --- |
| Studio baseline App, MissionHydrator, MissionSession, studioReducer | Existing native session and surface composition | RETAIN; no second session or consumer |
| Lab #209 `MissionOverview`, `MissionObject`, `overviewGraph` | `EngineeringGraph.MissionModel`, `graphModel.missionGraph` | ADAPT visual family cards, exact inspected object, neighborhood; use Core records, exclude donor derived graph/data |
| Lab #196/#197 `ScenarioSurface`, `DeclarationNode`, `ScenarioInspection` | `ScenarioGraph`, native `ScenarioWorkspace`, `InspectionContent` | ADAPT authored order, typed roles, field inspection; preserve all Core atoms and original textual details |
| Lab #199/#201 `PresentationProvider`, `InspectorFrame`, `inspectionKey` | App inspection state, `inspection.ts`, `InspectorFrame`, `presentationMemory` | ADAPT domain/source-qualified identities, previous-subject Return, narrow/expanded inspection, bounded per-generation presentation state |
| Lab #202 S2 | New graph dimensions and explicit direction; existing native graph routing retained | Reference only; no geometry/router wholesale import, no S2-04A |
| Lab #209 `FamilyMarker`, `family-markers` via Studio #358 | `FamilyLabel.tsx`, `familyMarkers.ts`, `family-markers.css`; original four J1 surface sites | Targeted transfer; exact product domain/kind lookup and SVG paths. Fault neutral, expectation not PASS |
| A4.1/A4.2 question/answer contract and A4.3 falsifiers | `investigationModel`, `InvestigationPanel` | ADAPT bounded QF2/QF4/QF5/QF6, explicit Scope, authority, Unknown, independent operands and Return; no experimental shell/fixture copied |
| C1 Evidence 034 at archived #210 | Crosswalk and preserved W1/W2/W3 exclusions | REUSE completed assessment; no restart or release lane resurrection |
| Lab #194 Work cables, Resources and simulated invocation | Existing native Integrations remains | DEFER generalized Work binding; missing authorized product mapping is not replaced with simulated facts |

Verified stack ancestry through live PR metadata: #194 `e5a1bb9` -> #195 `e5ff422` -> #196 `533278b` -> #197 `7468018` -> #198 `5a94e28` -> #199 `471cb44` -> #201 `9374b29` -> #202 `40ca881` -> #209 `c8fd6b5`. Final #209 includes accepted implementation `b5fcc6d29c214e861ac61641351d67afb384e6cd`, tree `32c0d1ef62067bf21fbd4be1d177721f4f146479`; documentation head tree `045eef495a16de67874ab4080e8fe2f30a2d10d7`. All these Lab PRs remain open/draft/unmerged. Product #358 is closed/unmerged at `20a8759b00124f52a835ce3a2b4416e4de2bf35c`, tree `b5f6ed24d557b21c87add662b165d91fec0ae434`.

Current North Star Decision 022 at Lab `3029ef2c16fc9f28ffa41b4090d4eec70e4ed329` is distinct from historical release Decision 022. Archived Decision 024 at `61180a0fc9163fb21def1b4948910bc535ab98e3` preserves J1 acceptance while stopping the release program. This campaign is authorized by the new user mandate, not by reopening that lane. Alignment with North Star: ENABLING and FALSIFICATION, deterministic only.

## Preservation audit

| Protected capability | Source finding | Runtime evidence boundary |
| --- | --- | --- |
| Tauri, Core resolution, native process boundary | `src-tauri`, `src/core` byte-identical | Native IPC/desktop NOT RUN here |
| MissionSession, hydration, identity, validators, slots/reducers | `src/mission`, `src/convergence`, `src/app` byte-identical | Existing logic suite PASS; browser actual App consumes retained Core outputs |
| Atlas | Original component and controls retained, J1 labels only | Browser Overview plus additional Mission Model |
| Explorer / X-Ray | Existing components retained; X-Ray hosted in typed Inspector | Native route available; complete type/relationship logic unchanged |
| Relations / Context Map | Existing workspace and graph sources unchanged | Native route available; no exhaustive new graph acceptance claimed |
| Operations | Workspace/model/ELK sources unchanged | Native route available; no new operational semantics |
| Scenario | Original toolbar, diagnostics, source provenance and full atom list retained | Graph, exact atom inspection, canonical declaration exercised |
| Integrations and lifecycle | Only original J1 heading label in workspace; all engine/lifecycle source unchanged | Route available; live package invocation and lifecycle installation matrix NOT RUN |
| Result / Evidence | Existing replay workspace, hydrators, accounting validation retained; J1 heading labels | Real retained Result/accounting/Evidence bytes consumed through mocked IPC |
| Capture | Existing capture source unchanged | Chromium Scenario PNG rendering and restoration PASS; native save intercepted, clipboard NOT RUN |
| Dependencies | package.json and lockfile byte-identical | npm audit FAIL: two HIGH, baseline attributed, not waived |

`preservation.json` contains the reproducible protected-path diff check and complete changed-file inventory. Do not interpret unchanged source as new native-runtime acceptance.

## Verification and residuals

Final browser: **PASS at 1280/960/640 px**, zero page errors; navigation Return checks and Scenario Capture restoration included. Final logic: **201/201 PASS**, zero skipped. Build: **PASS**, existing large-bundle warning. Browser runs the actual product entrypoint through the existing test-only retained-preview transport. Fresh Core `5196e128974510b4cbd3bcd89ea971ff2b68301b` exports against Reference Mission `e8f4a392e0bc3075df1ea3b00b842ba6b9e6e5ca`; source SHA-256s are in `browser.json`. The canonical stop source is `b19ff6e1cf3c45cdb81e239d30aad97e8b6f037703c06f27102b762e69a1146a`, matching retained accounting inputs. No synthetic producer facts enter the application bundle.

Browser transport extensions are test-only: Core executable resolution, explicit choice among three retained Core declarations, and capture-save interception. Production entrypoint never imports the harness. Retained Result and Evidence fixtures are existing SP3 acceptance bytes, not evidence of an adapter invoked in this campaign.

Security remains **FAIL** for `fast-uri` and `source-map-js`, two HIGH findings. Package files remain unchanged. The previous compact topbar overlap is addressed by the integrated shell's two-row layout; pointer navigation is now exercised at 640 px. This is a new shell adjustment under convergence authorization, not a retrospective J1 fix.

Remaining acceptance limitations:

- Cargo/native desktop unavailable in Work. Rust, Tauri IPC, WebKitGTK, WebView2, native dialogs/save/clipboard remain NOT RUN locally. A successful Chromium run is not native acceptance.
- Live adapter operation execution, populated installed/desired/catalog lifecycle and full platform/compatibility matrix are not newly exercised. Existing implementations are preserved, not replaced.
- New Mission graph uses deterministic family/neighborhood placement, not the full Lab geometry algorithm. Dense-neighborhood edge overlap and very large populations require further visual falsification. There is no claim of pixel parity or universal graph scalability.
- The product has bounded session-only investigation state, not an authoritative Scenario registry, atomic cross-export source seal or universal completeness proof. Coherent omission/ABA producer attacks remain UNKNOWN, not solved by B1.
- Return restores question qualifiers and bounded native-view context; presentation memory preserves the additive graph cameras. Existing native workspace unmount semantics are retained. No universal Work or cross-session history promise.
- Assessment is unavailable even when associations are present. No generalized binding/Work surface, operation-specific GUI binding parity, revision authorization parity or durable Work/Result continuity is introduced (C1 W1/W2/W3).
- A4.3 C01–C10 paired AS-IS/M0+ comparison remains NOT RUN. The relevant semantic negatives are adapted regression tests, not a retrospective A4.3 PASS or UX superiority claim.
- Maintainer visual acceptance of this integrated product is PENDING. Accepted Lab/J1 evidence does not automatically accept the new composition.

## Single local verification entrypoint

Run on the published exact candidate, with clean pinned Core and Reference checkouts:

```sh
python tools/test/convergence/verify-local.py \
  --expected-head <PUBLISHED_PR_HEAD> \
  --core-root /absolute/path/to/pinned-core \
  --core /absolute/path/to/core-venv/bin/orbitfabric \
  --reference-root /absolute/path/to/pinned-reference \
  --playwright-module /absolute/path/to/playwright-core \
  --chromium /absolute/path/to/chromium \
  --output /absolute/path/to/verification-output
```

The batch verifies pins, installs the unchanged lockfile, runs tests/build/audit, exports authoritative Core reports, runs the automated whole-App browser journey, and runs Cargo tests/check and Tauri build if available. It writes explicit PASS/FAIL/NOT_RUN. It returns nonzero for failures or remaining unexecuted gates. It does not claim to automate native OS rendering or dialogs.

Review the same single PR. Reject for lost native capability, wrong domain/source identity, hidden Scope expansion, invented completeness, generated-as-executed, association-as-assessment, lost Return or unreadable graphical presentation. Security and native gates remain separate blockers to merge/release approval. **STOP FOR REGIA. Do not merge.**
