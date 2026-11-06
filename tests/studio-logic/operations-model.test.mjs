import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildModeFocus,
  buildOperationsModel,
} = require("../../.test-dist/features/operations/operationsModel.js");

function snapshot(model) {
  return {
    kind: "orbitfabric.mission_snapshot",
    snapshot_version: "0.1",
    orbitfabric_version: "1.1.0",
    result: "loaded",
    mission: { id: "test", name: "Test", model_version: "1" },
    source: { mission_dir: "/test" },
    boundaries: {},
    diagnostics: [],
    model: {
      spacecraft: { id: "test", model_version: "1" },
      subsystems: [],
      modes: {},
      mode_transitions: [],
      telemetry: [],
      commands: [],
      events: [],
      faults: [],
      packets: [],
      policies: {},
      payloads: [],
      data_products: [],
      contacts: {},
      commandability: {},
      ...model,
    },
  };
}

test("Operational State Map contains only declared mission modes and transitions", () => {
  const model = buildOperationsModel(snapshot({
    modes: {
      NOMINAL: { initial: true },
      SAFE: { description: "Protective mode" },
    },
    mode_transitions: [
      { from: "NOMINAL", to: "SAFE", reason: "fault" },
      { from: "SAFE", to: "MISSING", reason: "invalid endpoint" },
    ],
    commands: [{
      id: "payload.start",
      allowed_modes: ["NOMINAL"],
      expected_effects: { payload_state: "PAYLOAD_ACTIVE" },
    }],
  }));

  assert.deepEqual(model.modes.map((mode) => mode.ref.id), ["NOMINAL", "SAFE"]);
  assert.equal(model.transitions.length, 1);
  assert.deepEqual(
    model.transitions.map(({ from, to, reason }) => ({ from, to, reason })),
    [{ from: "NOMINAL", to: "SAFE", reason: "fault" }],
  );
  assert.equal(model.modes.some((mode) => mode.ref.id === "PAYLOAD_ACTIVE"), false);
});

test("Mode Focus joins only explicit mode declarations and preserves Core facts", () => {
  const model = buildOperationsModel(snapshot({
    modes: { NOMINAL: { initial: true }, SAFE: {} },
    mode_transitions: [
      { from: "NOMINAL", to: "SAFE", reason: "fault" },
      { from: "SAFE", to: "NOMINAL", reason: "cleared" },
    ],
    commands: [
      {
        id: "payload.start",
        allowed_modes: ["NOMINAL"],
        preconditions: ["payload.ready"],
        expected_effects: { payload_state: "ACTIVE" },
      },
      { id: "eps.safe", allowed_modes: ["SAFE"] },
    ],
    faults: [
      { id: "eps.low", recovery: { mode_transition: "SAFE", auto_commands: ["eps.safe"] } },
    ],
    commandability: {
      rules: [
        { id: "ground.payload", command: "payload.start", sources: ["ground"], allowed_modes: [] },
        { id: "safe.only", command: "eps.safe", sources: ["ground"], allowed_modes: ["NOMINAL"] },
        { id: "unrelated", command: "other", sources: ["ground"], allowed_modes: [] },
      ],
      autonomous_actions: [
        {
          id: "nominal.watch",
          trigger: { mode: "NOMINAL" },
          dispatches: [{ command: "payload.start", source: "autonomy" }],
        },
      ],
      recovery_intents: [
        { id: "recover.safe", target_mode: "SAFE", commands: ["eps.safe"] },
      ],
    },
  }));

  const nominal = buildModeFocus(model, "NOMINAL");
  assert.ok(nominal);
  assert.deepEqual(nominal.outgoing.map((item) => item.to), ["SAFE"]);
  assert.deepEqual(nominal.incoming.map((item) => item.from), ["SAFE"]);
  assert.deepEqual(nominal.commands.map((item) => item.ref.id), ["payload.start"]);
  assert.deepEqual(
    nominal.commandability.map(({ rule, modeDeclared, commandListedForMode }) => ({
      id: rule.ref.id,
      modeDeclared,
      commandListedForMode,
    })),
    [
      { id: "ground.payload", modeDeclared: false, commandListedForMode: true },
      { id: "safe.only", modeDeclared: true, commandListedForMode: false },
    ],
  );
  assert.deepEqual(nominal.autonomousActions.map((item) => item.ref.id), ["nominal.watch"]);
  assert.deepEqual(nominal.faultRecoveries, []);

  const safe = buildModeFocus(model, "SAFE");
  assert.ok(safe);
  assert.deepEqual(safe.faultRecoveries.map((item) => item.ref.id), ["eps.low"]);
  assert.deepEqual(safe.recoveryIntents.map((item) => item.ref.id), ["recover.safe"]);
});


test("B1 reference fault-triggered autonomous action retains exact trigger, object dispatch and source", () => {
  // This exact contract shape is from the Reference Mission commandability.yaml.
  // A declared autonomous action is not evidence of runtime dispatch.
  const model = buildOperationsModel(snapshot({
    modes: { PAYLOAD_ACTIVE: {}, DEGRADED_POWER: {} },
    commandability: {
      autonomous_actions: [{
        id: "auto_stop_payload_on_low_power",
        trigger: { fault: "eps.low_battery_warning" },
        dispatches: { command: "payload.stop_acquisition", source: "onboard_autonomy" },
        expected_events: ["payload.acquisition_completed", "obc.mode_changed"],
        expected_effects: { mode: "DEGRADED_POWER" },
      }],
    },
  }));
  assert.equal(model.autonomousActions.length, 1);
  const action = model.autonomousActions[0];
  assert.equal(action.ref.id, "auto_stop_payload_on_low_power");
  assert.equal(action.triggerMode, null);
  assert.equal(action.triggerFault, "eps.low_battery_warning");
  assert.deepEqual(action.dispatchCommandIds, ["payload.stop_acquisition"]);
  assert.deepEqual(action.dispatchSourceIds, ["onboard_autonomy"]);
  assert.deepEqual(action.trigger, { fault: "eps.low_battery_warning" });
  assert.deepEqual(action.dispatches, {
    command: "payload.stop_acquisition",
    source: "onboard_autonomy",
  });
  assert.equal(buildModeFocus(model, "PAYLOAD_ACTIVE").autonomousActions.length, 0);
});

test("B1 historical mode-triggered array-shape continues to retain source identity", () => {
  const model = buildOperationsModel(snapshot({
    modes: { NOMINAL: {} },
    commandability: {
      autonomous_actions: [{
        id: "mode.watch",
        trigger: { mode: "NOMINAL" },
        dispatches: [{ command: "payload.start", source: "onboard_autonomy" }],
      }],
    },
  }));
  assert.deepEqual(buildModeFocus(model, "NOMINAL").autonomousActions.map((a) => a.ref.id), ["mode.watch"]);
  assert.deepEqual(model.autonomousActions[0].dispatchSourceIds, ["onboard_autonomy"]);
  assert.equal(model.autonomousActions[0].triggerFault, null);
});

test("B1 unknown trigger/dispatch shape remains an attributable declared action without inventing commands", () => {
  const model = buildOperationsModel(snapshot({
    modes: { NOMINAL: {} },
    commandability: {
      autonomous_actions: [{ id: "future.trigger", trigger: { event: "event.x" }, dispatches: "unsupported" }],
    },
  }));
  assert.equal(model.autonomousActions.length, 1);
  assert.deepEqual(model.autonomousActions[0].dispatchCommandIds, []);
  assert.equal(model.autonomousActions[0].triggerMode, null);
  assert.deepEqual(model.autonomousActions[0].trigger, { event: "event.x" });
});
