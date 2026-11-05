import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { FAMILY_MARKERS, familyMarker, familyForDomain, familyForScenarioAtom } = require("../../.test-dist/features/presentation/familyMarkers.js");
const { FamilyLabel } = require("../../.test-dist/features/presentation/FamilyLabel.js");
const { ScenarioWorkspace } = require("../../.test-dist/features/scenarios/ScenarioWorkspace.js");
const { consumeScenarioReport } = require("../../.test-dist/convergence/scenarioProtocol.js");
const { buildScenarioUnderstanding } = require("../../.test-dist/convergence/scenarioUnderstanding.js");
const { emptyScenarioSlot } = require("../../.test-dist/convergence/scenarioSlot.js");
const { entityKey } = require("../../.test-dist/mission/entityRef.js");
const render = (family, text) => renderToStaticMarkup(React.createElement(FamilyLabel, { family }, text));
const fixture = () => JSON.parse(readFileSync("tests/fixtures/convergence/r1-scenario-declaration.json", "utf8"));
function scenario(wire, selectedEntity = null) {
  const model = buildScenarioUnderstanding({ ...emptyScenarioSlot(), accepted: {
    membership: { sessionId: "j1", generation: 1 }, targetPath: "/r1.yaml",
    declaration: consumeScenarioReport(JSON.stringify(wire)),
  } });
  const modelSnapshot = { commands: [{ id: "same" }], events: [{ id: "same" }],
    telemetry: [], payloads: [], subsystems: [], faults: [], data_products: [], modes: {} };
  return renderToStaticMarkup(React.createElement(ScenarioWorkspace, { model,
    session: { readiness: { relationships: "pending" }, readModel: { entityRecordsByKey: new Map(), relationshipsById: new Map() }, snapshot: { result: "loaded", model: modelSnapshot } }, selectedEntity,
    disabled: false, pickerFailure: null, onChoose() {}, onRefresh() {}, onInspectEntity() {},
  }));
}

test("J1 exact production domains map deterministically, without name or ID inference", () => {
  const expected = { subsystems: "subsystem", payloads: "payload", commands: "command", telemetry: "telemetry", events: "event", faults: "fault", data_products: "data product", modes: "mode" };
  for (const [domain, family] of Object.entries(expected)) {
    assert.equal(familyForDomain(domain), family);
    assert.equal(familyMarker(family), familyMarker(family));
  }
  assert.equal(familyForDomain("my_commands"), null);
  assert.equal(familyForDomain("Commands"), null);
  assert.equal(familyForDomain("command_sources"), null);
  assert.ok(Object.isFrozen(FAMILY_MARKERS));
});

test("J1 unsupported domains, atom kinds and prototype keys preserve exact text without decoration", () => {
  for (const unknown of ["future", "constructor", "__proto__", "PASS", "ready", "work", "accounting", "lifecycle"]) {
    assert.equal(familyMarker(unknown), null);
    assert.equal(familyForDomain(unknown), null);
    assert.equal(familyForScenarioAtom(unknown), null);
    assert.equal(render(unknown, unknown), unknown);
  }
  // A data-flow expectation is not automatically a Data Product identity.
  assert.equal(familyForScenarioAtom("expect_data_flow"), null);
  assert.equal(render(null, "Exact unknown type"), "Exact unknown type");
});

test("J1 all supported markers remain decorative, noninteractive and text-labelled", () => {
  const paths = new Set();
  for (const family of Object.keys(FAMILY_MARKERS)) {
    const html = render(family, `Explicit ${family} label`);
    assert.ok(html.includes(`Explicit ${family} label`));
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /focusable="false"/);
    assert.match(html, /stroke="currentColor"/);
    assert.match(html, /stroke-width="1.5"/);
    assert.doesNotMatch(html, /role=|tabindex=|<button|<a |<title|animate/);
    paths.add(familyMarker(family).path);
  }
  assert.equal(paths.size, Object.keys(FAMILY_MARKERS).length);
});

test("J1 identical textual IDs in different domains retain identities, labels and selection", () => {
  const wire = fixture();
  wire.atoms[3].references = [{ role: "command", entity: { domain: "commands", id: "same" } }];
  wire.atoms[4].references = [{ role: "event", entity: { domain: "events", id: "same" } }];
  const refs = [wire.atoms[3].references[0].entity, wire.atoms[4].references[0].entity];
  const before = JSON.stringify(wire);
  assert.notEqual(entityKey(refs[0]), entityKey(refs[1]));
  for (const ref of refs) {
    const html = scenario(wire, ref);
    assert.match(html, /commands:same/);
    assert.match(html, /events:same/);
    const selected = html.match(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?<\/button>/g);
    assert.equal(selected.length, 2); // atom reference and participant entry
    for (const button of selected) assert.ok(button.includes(`${ref.domain}:${ref.id}`));
  }
  assert.equal(JSON.stringify(wire), before);
});

test("J1 actual Scenario keeps all atoms, authored expectation role and expected PASSED without a Result marker", () => {
  const wire = fixture();
  const html = scenario(wire);
  for (const atom of wire.atoms) assert.ok(html.includes(`data-atom-id="${atom.id}"`));
  assert.match(html, /Scenario status expectation/);
  assert.match(html, /Expectation/);
  assert.match(html, /PASSED/);
  assert.doesNotMatch(html, /data-family="result"|family-accent-success/);
  assert.equal(familyForScenarioAtom("expect_scenario_status"), "scenario");
  assert.equal(familyForScenarioAtom("expect_command_status"), "command");
  assert.equal(familyMarker("fault").accent, "neutral");
  wire.atoms[3].kind = "future_unmapped_kind";
  assert.match(scenario(wire), /future_unmapped_kind/);
});

test("J1 selection and focus styling remain separate from fixed family accents", () => {
  const css = readFileSync("src/styles/family-markers.css", "utf8");
  assert.doesNotMatch(css, /\.is-selected|:focus|aria-pressed|background:|border:|--success|--warning|--danger/);
  assert.match(css, /pointer-events: none/);
  const wire = fixture();
  wire.atoms[3].references = [{ role: "command", entity: { domain: "commands", id: "same" } }];
  const markers = html => html.match(/<svg\b[\s\S]*?<\/svg>/g);
  assert.deepEqual(markers(scenario(wire)), markers(scenario(wire, { domain: "commands", id: "same" })));
});

test("J1 accents retain non-color shapes and sufficient contrast on actual product surfaces", () => {
  const css = readFileSync("src/styles/family-markers.css", "utf8");
  const luminance = hex => hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0);
  for (const color of css.matchAll(/color: #([a-f0-9]{6})/g)) {
    for (const bg of ["0b0e13", "10151d", "151c26", "1a2330", "1e2d3d"]) {
      const a = luminance(color[1]), b = luminance(bg);
      assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5);
    }
  }
});

test("J1 long technical identities remain exact and recoverable", () => {
  const id = `payload.${"engineering_identity_".repeat(20)}.stop_acquisition`;
  const ref = Object.freeze({ domain: "commands", id });
  const key = entityKey(ref);
  const html = render(familyForDomain(ref.domain), `${ref.domain}:${ref.id}`);
  assert.ok(html.includes(`${ref.domain}:${id}`));
  assert.equal(entityKey(ref), key);
  assert.equal(ref.id, id);
});
