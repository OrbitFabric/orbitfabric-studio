import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const outDir = ".test-dist";
const tscEntry = join("node_modules", "typescript", "bin", "tsc");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  rmSync(outDir, { recursive: true, force: true });
  run(process.execPath, [tscEntry, "-p", "tsconfig.logic-tests.json"]);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "package.json"),
    JSON.stringify({ type: "commonjs" }, null, 2),
  );

  const tests = [
    "tests/studio-logic/family-markers.test.mjs",
    "tests/studio-logic/entity-ref.test.mjs",
    "tests/studio-logic/core-compatibility.test.mjs",
    "tests/studio-logic/context-graph.test.mjs",
    "tests/studio-logic/context-map-evidence.test.mjs",
    "tests/studio-logic/studio-state.test.mjs",
    "tests/studio-logic/validation-findings.test.mjs",
    "tests/studio-logic/operations-model.test.mjs",
    "tests/studio-logic/graph-layout-routing.test.mjs",
    "tests/studio-logic/integrations-foundation.test.mjs",
    "tests/studio-logic/integration-profile.test.mjs",
    "tests/studio-logic/integration-execution.test.mjs",
    "tests/studio-logic/integration-result-state-lanes.test.mjs",
    "tests/studio-logic/integration-coverage-versioning.test.mjs",
    "tests/studio-logic/scenario-accounting-replay.test.mjs",
    "tests/studio-logic/integration-staleness.test.mjs",
    "tests/studio-logic/integration-plugin-registry.test.mjs",
    "tests/studio-logic/integration-plugin-actions.test.mjs",
    "tests/studio-logic/convergence-contract-consumer.test.mjs",
    "tests/studio-logic/scenario-slot.test.mjs",
    "tests/studio-logic/scenario-slot-r1.test.mjs",
    "tests/studio-logic/scenario-understanding.test.mjs",
    "tests/studio-logic/scenario-request.test.mjs",
    "tests/studio-logic/integration-slot.test.mjs",
    "tests/studio-logic/evidence-slot.test.mjs",
    "tests/studio-logic/evidence-slot-r1.test.mjs",
    "tests/studio-logic/evidence-slot-reducer.test.mjs",
    "tests/studio-logic/adapter-lifecycle.test.mjs",
    "tests/studio-logic/adapter-lifecycle-read-model.test.mjs",
    "tests/studio-logic/adapter-lifecycle-exit-code.test.mjs",
    "tests/studio-logic/session-spine-acceptance.test.mjs",
  ];

  if (process.env.ORBITFABRIC_STUDIO_H4_OUTPUT) {
    tests.push("tests/studio-logic/core-compatibility-native.test.mjs");
  }

  if (process.env.ORBITFABRIC_STUDIO_CORE_SURFACES) {
    tests.push("tests/studio-logic/context-map-core-regression.test.mjs");
  }

  if (process.env.ORBITFABRIC_STUDIO_R1_OUTPUT) {
    tests.push("tests/studio-logic/scenario-native-r1-acceptance.test.mjs");
  }

  if (process.env.ORBITFABRIC_STUDIO_LIFECYCLE_SURFACES) {
    tests.push("tests/studio-logic/adapter-lifecycle-core-acceptance.test.mjs");
  }

  if (
    process.env.ORBITFABRIC_STUDIO_REFERENCE_POC &&
    process.env.ORBITFABRIC_STUDIO_REFERENCE_INPUT_MANIFEST &&
    process.env.ORBITFABRIC_STUDIO_REFERENCE_RESULT
  ) {
    tests.push("tests/studio-logic/reference-integration-acceptance.test.mjs");
    tests.push("tests/studio-logic/reference-integration-plugin-acceptance.test.mjs");
  }

  run(process.execPath, ["--test", ...tests]);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
