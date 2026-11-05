import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const {
  consumeScenarioReport,
} = require("../../.test-dist/convergence/scenarioProtocol.js");
const {
  admitObservation,
  observationKey,
  evaluateInvestigation,
  initialInvestigation,
  transitionInvestigation,
  compareDeclarations,
} = require("../../.test-dist/features/investigation/investigationModel.js");
const { entityKey } = require("../../.test-dist/mission/entityRef.js");
function fixture() {
  const d = consumeScenarioReport(
    readFileSync(
      "tests/fixtures/convergence/r1-scenario-declaration.json",
      "utf8",
    ),
  );
  const anchor = { domain: "commands", id: "payload.stop_acquisition" };
  const session = {
    sessionId: "s",
    generation: 1,
    snapshot: {
      mission: { id: d.mission.id, model_version: d.mission.modelVersion },
    },
    readModel: { entityRecordsByKey: new Map([[entityKey(anchor), anchor]]) },
  };
  const observation = {
    membership: { sessionId: "s", generation: 1 },
    targetPath: "/selected.yaml",
    declaration: d,
  };
  const population = admitObservation(new Map(), observation, session);
  const q = {
    ...initialInvestigation,
    anchor,
    scope: [observationKey(observation)],
  };
  const evidence = {
    results: [],
    atoms: [],
    scenario: null,
    evidenceSet: null,
  };
  return { session, observation, population, q, evidence };
}
test("Only explicitly admitted declarations answer participation; role preserved", () => {
  const f = fixture();
  const a = evaluateInvestigation(f.session, f.population, f.q, f.evidence);
  assert.equal(a.disposition, "AVAILABLE");
  assert.equal(a.coverage, "UNKNOWN");
  assert.equal(a.participation.length, 1);
  assert.equal(a.participation[0].atom.role, "action");
  assert.equal(a.assessment, "UNAVAILABLE");
});
test("Same ID in another domain is not command participation", () => {
  const f = fixture();
  const anchor = { domain: "events", id: f.q.anchor.id };
  f.session.readModel.entityRecordsByKey.set(entityKey(anchor), anchor);
  assert.equal(
    evaluateInvestigation(
      f.session,
      f.population,
      { ...f.q, anchor },
      f.evidence,
    ).participation.length,
    0,
  );
});
test("Wrong mission provenance cannot enter Scope", () => {
  const f = fixture();
  f.observation.declaration.mission.id = "wrong";
  assert.throws(
    () => admitObservation(new Map(), f.observation, f.session),
    /provenance/,
  );
});
test("Stale generation rejected at admission and answer, including A-B-A session identity", () => {
  const f = fixture();
  const newer = { ...f.session, generation: 3 };
  assert.throws(
    () => admitObservation(f.population, f.observation, newer),
    /generation/,
  );
  assert.equal(
    evaluateInvestigation(newer, f.population, f.q, f.evidence).disposition,
    "UNAVAILABLE",
  );
});
test("Conflicting same-digest declaration rejected, never overwritten", () => {
  const f = fixture();
  const changed = structuredClone(f.observation);
  changed.declaration.atoms[3].role = "expectation";
  assert.throws(
    () => admitObservation(f.population, changed, f.session),
    /Conflicting/,
  );
});
test("Coherent omission cannot certify completeness or absence", () => {
  const f = fixture();
  f.observation.declaration.atoms = [];
  f.observation.declaration.atomCount = 0;
  const a = evaluateInvestigation(f.session, f.population, f.q, f.evidence);
  assert.equal(a.coverage, "UNKNOWN");
  assert.equal(a.participation.length, 0);
});
test("Missing scoped observation fails closed instead of reducing the denominator", () => {
  const f = fixture();
  assert.equal(
    evaluateInvestigation(
      f.session,
      f.population,
      { ...f.q, scope: [...f.q.scope, "missing"] },
      f.evidence,
    ).disposition,
    "UNAVAILABLE",
  );
});
test("Representation filtering does not modify Scope or admitted answer", () => {
  const f = fixture();
  const a = evaluateInvestigation(f.session, f.population, f.q, f.evidence);
  const b = evaluateInvestigation(
    f.session,
    f.population,
    { ...f.q, representation: "actions" },
    f.evidence,
  );
  assert.deepEqual(a, b);
});
test("Execution unsupported even with succeeded producer Result", () => {
  const f = fixture();
  f.evidence.results = [{ sha256: "r", operationResult: "succeeded" }];
  const a = evaluateInvestigation(
    f.session,
    f.population,
    { ...f.q, question: "execution", resultSha256: "r" },
    f.evidence,
  );
  assert.equal(a.disposition, "UNSUPPORTED");
  assert.equal(a.assessment, "UNAVAILABLE");
});
test("Projection requires exact loaded declaration and Result, does not repair wrong digest", () => {
  const f = fixture();
  const q = { ...f.q, question: "projection", resultSha256: "r" };
  assert.equal(
    evaluateInvestigation(f.session, f.population, q, f.evidence).disposition,
    "UNAVAILABLE",
  );
  f.evidence.scenario = {
    id: f.observation.declaration.scenario.id,
    sha256: f.observation.declaration.source.scenarioSha256,
  };
  assert.equal(
    evaluateInvestigation(f.session, f.population, q, f.evidence).disposition,
    "NOT_LOADED",
  );
});
test("All accounting atoms survive and missing disposition remains unavailable", () => {
  const f = fixture();
  f.evidence.scenario = {
    id: f.observation.declaration.scenario.id,
    sha256: f.observation.declaration.source.scenarioSha256,
  };
  f.evidence.results = [{ sha256: "r" }];
  f.evidence.atoms = f.observation.declaration.atoms.map((a) => ({
    atomId: a.id,
    projections: [],
    directEvidence: [],
  }));
  const a = evaluateInvestigation(
    f.session,
    f.population,
    { ...f.q, question: "projection", resultSha256: "r" },
    f.evidence,
  );
  assert.equal(a.projection.length, 8);
  assert.equal(a.projection[0].projection, null);
  assert.equal(a.assessment, "UNAVAILABLE");
});
test("Question first stays pending until explicit anchor and scope, no automatic subject", () => {
  const f = fixture();
  assert.equal(
    evaluateInvestigation(
      f.session,
      f.population,
      initialInvestigation,
      f.evidence,
    ).disposition,
    "PENDING_BINDING",
  );
});
test("Compare keeps source identities and distinguishes declared differences without verdict", () => {
  const f = fixture();
  const second = structuredClone(f.observation);
  second.declaration.source.scenarioSha256 = "b".repeat(64);
  second.declaration.atoms[3].declaration = { command: "different" };
  const c = compareDeclarations(f.observation, second);
  assert.equal(c.atomsDiffer, true);
  assert.notEqual(c.left.sourceSha256, c.right.sourceSha256);
  assert.equal("verdict" in c, false);
});
test("Identical question edit is idempotent; Return checkpoint contains exact qualifiers", () => {
  const f = fixture();
  const s = { current: f.q, history: [] };
  assert.equal(transitionInvestigation(s, { ...f.q }), s);
  const n = transitionInvestigation(s, { ...f.q, question: "compare" });
  assert.deepEqual(n.history[0], f.q);
});
test("Association without Evidence Set is NOT_LOADED, no generated assessment", () => {
  const f = fixture();
  f.evidence.scenario = {
    id: f.observation.declaration.scenario.id,
    sha256: f.observation.declaration.source.scenarioSha256,
  };
  f.evidence.results = [{ sha256: "r" }];
  const a = evaluateInvestigation(
    f.session,
    f.population,
    { ...f.q, question: "association", resultSha256: "r" },
    f.evidence,
  );
  assert.equal(a.disposition, "NOT_LOADED");
  assert.equal(a.assessment, "UNAVAILABLE");
});
