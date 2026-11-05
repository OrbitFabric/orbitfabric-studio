// Accepted S3 shapes; only families with bounded production presentation sites.
// This module returns decoration, never identity, execution state or assessment.
const marker = (accent: string, path: string) => Object.freeze({ accent, path });
export const FAMILY_MARKERS = Object.freeze({
  relation: marker("command", "M5 4a2 2 0 1 0 0 4 2 2 0 1 0 0-4 M15 2a2 2 0 1 0 0 4 2 2 0 1 0 0-4 M14 13a2 2 0 1 0 0 4 2 2 0 1 0 0-4 M7 6l6-2 M6 8l7 6"),
  subsystem: marker("structure", "M3 3H17V17H3Z M3 8H17 M8 8V17"),
  payload: marker("structure", "M3 3H17V17H3Z M7 7H13V13H7Z"),
  command: marker("command", "M2 4H18V16H2Z M5 7L8 10L5 13 M10 13H14"),
  telemetry: marker("observable", "M2 14H18 M2 10H5L8 5L12 12L15 8H18"),
  event: marker("observable", "M10 2L18 10L10 18L2 10Z M9 9H11V11H9Z"),
  fault: marker("neutral", "M8 3H3V17H8 M12 3H17V17H12 M7 10H9L11 7L13 10"),
  "data product": marker("product", "M6 2H17V14H6Z M3 6V18H14 M9 6H14 M9 9H14"),
  scenario: marker("structure", "M2 7H6V13H2Z M8 7H12V13H8Z M14 7H18V13H14Z M6 10H8 M12 10H14"),
  result: marker("product", "M4 2H12L16 6V18H4Z M12 2V6H16 M7 10H13V14H7Z"),
  evidence: marker("product", "M4 2H12L16 6V18H4Z M12 2V6H16 M7 10H10V14H7Z M10 12H14"),
  mode: marker("structure", "M6 3H14L17 6V14L14 17H6L3 14V6Z M7 10H13"),
});
export type DisplayFamily = keyof typeof FAMILY_MARKERS;

export function familyMarker(family: string | null) {
  return family !== null && Object.prototype.hasOwnProperty.call(FAMILY_MARKERS, family)
    ? FAMILY_MARKERS[family as DisplayFamily] : null;
}

// Exact Core domain keys, never display names, IDs or substring matching.
const DOMAIN_FAMILIES: Readonly<Record<string, DisplayFamily>> = Object.freeze({
  subsystems: "subsystem", payloads: "payload", commands: "command",
  telemetry: "telemetry", events: "event", faults: "fault",
  data_products: "data product", modes: "mode",
});
export function familyForDomain(domain: string): DisplayFamily | null {
  return Object.prototype.hasOwnProperty.call(DOMAIN_FAMILIES, domain) ? DOMAIN_FAMILIES[domain] : null;
}

// Exact declaration kinds already rendered by scenarioPresentation.
// Expected status remains Scenario intent; it is never a produced Result.
const ATOM_FAMILIES: Readonly<Record<string, DisplayFamily>> = Object.freeze({
  scenario_metadata: "scenario", initial_mode: "mode",
  initial_telemetry: "telemetry", command: "command",
  telemetry_injection: "telemetry", expect_event: "event",
  expect_mode: "mode", expect_command: "command",
  expect_telemetry: "telemetry", expect_command_status: "command",
  expect_payload_lifecycle: "payload", expect_scenario_status: "scenario",
});
export function familyForScenarioAtom(kind: string): DisplayFamily | null {
  return Object.prototype.hasOwnProperty.call(ATOM_FAMILIES, kind) ? ATOM_FAMILIES[kind] : null;
}
