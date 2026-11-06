import type {
  JsonObject,
  JsonValue,
  MissionContractObject,
  MissionSnapshotDto,
} from "../../core/contracts";
import type { EntityRef } from "../../mission/entityRef";

export interface OperationalModeFact {
  ref: EntityRef;
  description: string | null;
  initial: boolean;
}

export interface ModeTransitionFact {
  key: string;
  from: string;
  to: string;
  reason: string;
  description: string | null;
}

export interface ModeCommandFact {
  ref: EntityRef;
  description: string | null;
  allowedModes: readonly string[];
  preconditions: JsonValue | undefined;
  expectedEffects: JsonValue | undefined;
}

export interface CommandabilityRuleFact {
  ref: EntityRef;
  commandId: string;
  sources: readonly string[];
  allowedModes: readonly string[];
  confirmation: JsonValue | undefined;
  expectedEvents: readonly string[];
  expectedEffects: JsonValue | undefined;
}

export interface AutonomousActionFact {
  ref: EntityRef;
  description: string | null;
  // A fault trigger is not a mode trigger. Preserve the exact Core declaration.
  triggerMode: string | null;
  triggerFault: string | null;
  trigger: JsonValue | undefined;
  dispatchCommandIds: readonly string[];
  dispatchSourceIds: readonly string[];
  dispatches: JsonValue | undefined;
  expectedEvents: readonly string[];
  expectedEffects: JsonValue | undefined;
}

export interface FaultRecoveryFact {
  ref: EntityRef;
  targetMode: string;
  autoCommandIds: readonly string[];
}

export interface RecoveryIntentFact {
  ref: EntityRef;
  targetMode: string;
  commandIds: readonly string[];
  expectedEvents: readonly string[];
  expectedEffects: JsonValue | undefined;
}

export interface OperationsModel {
  modes: readonly OperationalModeFact[];
  transitions: readonly ModeTransitionFact[];
  commands: readonly ModeCommandFact[];
  commandabilityRules: readonly CommandabilityRuleFact[];
  autonomousActions: readonly AutonomousActionFact[];
  faultRecoveries: readonly FaultRecoveryFact[];
  recoveryIntents: readonly RecoveryIntentFact[];
}

export interface ModeCommandabilityFact {
  rule: CommandabilityRuleFact;
  modeDeclared: boolean;
  commandListedForMode: boolean;
}

export interface ModeFocusModel {
  mode: OperationalModeFact;
  outgoing: readonly ModeTransitionFact[];
  incoming: readonly ModeTransitionFact[];
  commands: readonly ModeCommandFact[];
  commandability: readonly ModeCommandabilityFact[];
  autonomousActions: readonly AutonomousActionFact[];
  faultRecoveries: readonly FaultRecoveryFact[];
  recoveryIntents: readonly RecoveryIntentFact[];
}

export function buildOperationsModel(snapshot: MissionSnapshotDto): OperationsModel {
  const model = snapshot.result === "loaded" ? snapshot.model : null;
  if (model === null) {
    return emptyOperationsModel();
  }

  const modes = Object.entries(model.modes).map(([id, contract]) => ({
    ref: { domain: "modes", id },
    description: stringValue(contract.description),
    initial: contract.initial === true,
  }));
  const modeIds = new Set(modes.map((mode) => mode.ref.id));

  const transitions = model.mode_transitions.flatMap((value, index) => {
    const from = stringValue(value.from);
    const to = stringValue(value.to);
    const reason = stringValue(value.reason);
    if (from === null || to === null || reason === null) {
      return [];
    }
    if (!modeIds.has(from) || !modeIds.has(to)) {
      return [];
    }
    return [{
      key: `${index}:${from}:${to}:${reason}`,
      from,
      to,
      reason,
      description: stringValue(value.description),
    }];
  });

  const commands = model.commands.map(commandFact);
  const commandability = objectValue(model.commandability);

  return {
    modes,
    transitions,
    commands,
    commandabilityRules: objectArray(commandability, "rules").flatMap(commandabilityRuleFact),
    autonomousActions: objectArray(commandability, "autonomous_actions").flatMap(
      autonomousActionFact,
    ),
    faultRecoveries: model.faults.flatMap(faultRecoveryFact),
    recoveryIntents: objectArray(commandability, "recovery_intents").flatMap(
      recoveryIntentFact,
    ),
  };
}

export function buildModeFocus(
  model: OperationsModel,
  modeId: string,
): ModeFocusModel | null {
  const mode = model.modes.find((candidate) => candidate.ref.id === modeId);
  if (!mode) {
    return null;
  }

  const commands = model.commands.filter((command) => command.allowedModes.includes(modeId));
  const commandIds = new Set(commands.map((command) => command.ref.id));

  return {
    mode,
    outgoing: model.transitions.filter((transition) => transition.from === modeId),
    incoming: model.transitions.filter((transition) => transition.to === modeId),
    commands,
    commandability: model.commandabilityRules.flatMap((rule) => {
      const modeDeclared = rule.allowedModes.includes(modeId);
      const commandListedForMode = commandIds.has(rule.commandId);
      return modeDeclared || commandListedForMode
        ? [{ rule, modeDeclared, commandListedForMode }]
        : [];
    }),
    autonomousActions: model.autonomousActions.filter(
      (action) => action.triggerMode === modeId,
    ),
    faultRecoveries: model.faultRecoveries.filter(
      (recovery) => recovery.targetMode === modeId,
    ),
    recoveryIntents: model.recoveryIntents.filter(
      (intent) => intent.targetMode === modeId,
    ),
  };
}

function commandFact(command: MissionContractObject): ModeCommandFact {
  return {
    ref: { domain: "commands", id: command.id },
    description: stringValue(command.description),
    allowedModes: stringArray(command.allowed_modes),
    preconditions: command.preconditions,
    expectedEffects: command.expected_effects,
  };
}

function commandabilityRuleFact(value: MissionContractObject): CommandabilityRuleFact[] {
  const commandId = stringValue(value.command);
  if (commandId === null) {
    return [];
  }
  return [{
    ref: { domain: "commandability_rules", id: value.id },
    commandId,
    sources: stringArray(value.sources),
    allowedModes: stringArray(value.allowed_modes),
    confirmation: value.confirmation,
    expectedEvents: stringArray(value.expected_events),
    expectedEffects: value.expected_effects,
  }];
}

function autonomousActionFact(value: MissionContractObject): AutonomousActionFact[] {
  const trigger = objectValue(value.trigger);
  // Core Reference Mission declares one dispatch as an object. Retain support for
  // historical array-shaped consumers without claiming either shape is runtime execution.
  const dispatches = Array.isArray(value.dispatches)
    ? jsonObjectArray(value.dispatches)
    : [objectValue(value.dispatches)];
  return [{
    ref: { domain: "autonomous_actions", id: value.id },
    description: stringValue(value.description),
    triggerMode: stringValue(trigger.mode),
    triggerFault: stringValue(trigger.fault),
    trigger: value.trigger,
    dispatchCommandIds: dispatches.flatMap((dispatch) => {
      const commandId = stringValue(dispatch.command);
      return commandId === null ? [] : [commandId];
    }),
    dispatchSourceIds: dispatches.flatMap((dispatch) => {
      const sourceId = stringValue(dispatch.source);
      return sourceId === null ? [] : [sourceId];
    }),
    dispatches: value.dispatches,
    expectedEvents: stringArray(value.expected_events),
    expectedEffects: value.expected_effects,
  }];
}

function faultRecoveryFact(value: MissionContractObject): FaultRecoveryFact[] {
  const recovery = objectValue(value.recovery);
  const targetMode = stringValue(recovery.mode_transition);
  if (targetMode === null) {
    return [];
  }
  return [{
    ref: { domain: "faults", id: value.id },
    targetMode,
    autoCommandIds: stringArray(recovery.auto_commands),
  }];
}

function recoveryIntentFact(value: MissionContractObject): RecoveryIntentFact[] {
  const targetMode = stringValue(value.target_mode);
  if (targetMode === null) {
    return [];
  }
  return [{
    ref: { domain: "recovery_intents", id: value.id },
    targetMode,
    commandIds: stringArray(value.commands),
    expectedEvents: stringArray(value.expected_events),
    expectedEffects: value.expected_effects,
  }];
}

function objectArray(object: JsonObject, key: string): MissionContractObject[] {
  const value = object[key];
  return Array.isArray(value) ? value.filter(isContractObject) : [];
}

function jsonObjectArray(value: JsonValue | undefined): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function isContractObject(value: JsonValue): value is MissionContractObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.id === "string"
  );
}

function objectValue(value: JsonValue | undefined): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringArray(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringValue(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function emptyOperationsModel(): OperationsModel {
  return {
    modes: [],
    transitions: [],
    commands: [],
    commandabilityRules: [],
    autonomousActions: [],
    faultRecoveries: [],
    recoveryIntents: [],
  };
}
