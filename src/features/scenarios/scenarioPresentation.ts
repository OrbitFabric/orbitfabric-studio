import type { ScenarioAtomUnderstanding } from "../../convergence/scenarioUnderstanding";

const KIND_LABELS: Record<string, string> = {
  scenario_metadata: "Scenario metadata", initial_mode: "Initial mode",
  initial_telemetry: "Initial telemetry", command: "Command",
  telemetry_injection: "Telemetry injection", expect_event: "Event expectation",
  expect_mode: "Mode expectation", expect_command: "Command expectation",
  expect_telemetry: "Telemetry expectation", expect_command_status: "Command status expectation",
  expect_payload_lifecycle: "Payload lifecycle expectation", expect_data_flow: "Data flow expectation",
  expect_scenario_status: "Scenario status expectation",
};
const ROLE_LABELS: Record<string, string> = {
  metadata: "Metadata", initial_state: "Initial state", action: "Action", expectation: "Expectation",
};

export function presentScenarioAtom(atom: ScenarioAtomUnderstanding) {
  return {
    title: KIND_LABELS[atom.kind] ?? atom.kind,
    role: ROLE_LABELS[atom.role] ?? atom.role,
    position: atom.stepIndex === null ? "Outside source steps"
      : `Source step ${atom.stepIndex + 1} (index ${atom.stepIndex})`,
    ordinal: atom.withinStepOrdinal === null ? null : `Core ordinal ${atom.withinStepOrdinal}`,
    declaredTime: atom.scenarioTimeS === null ? null : `${atom.scenarioTimeS} s`,
    fields: declarationFields(atom.declaration),
  };
}

// Formats structured Core declaration fields, without reconstructing identities or meaning.
export function declarationFields(value: unknown): { name: string; value: string }[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).map(([name, entry]) => ({ name, value: formatDeclaredValue(entry) }));
  }
  return [{ name: "declaration", value: formatDeclaredValue(value) }];
}

function formatDeclaredValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "Unavailable";
}

// Source-backed preview: references and fields remain exact, with full details in
// the existing structured account and Inspector. No domain inference from IDs.
export function scenarioAtomPreview(atom: ScenarioAtomUnderstanding) {
  const fields = declarationFields(atom.declaration);
  return {
    references: atom.references.map(ref => `${ref.entity.domain}:${ref.entity.id}`),
    fields: atom.kind === "scenario_metadata"
      ? fields.filter(field => field.name === "id" || field.name === "name")
      : fields.filter(field => !atom.references.some(ref => ref.entity.id === field.value)),
  };
}

// Spatial emphasis follows consecutive authored roles, never execution or time.
// A role reappearing later starts a new column, preserving the source order.
export function scenarioAtomLayout(atoms: ScenarioAtomUnderstanding[]) {
  let column = -1, previous = "", y = 0;
  return atoms.map(atom => {
    const group = atom.role === "metadata" || atom.role === "initial_state" ? "declaration" : atom.role;
    if (group !== previous) { column++; y = 0; previous = group; }
    const height = atom.role === "metadata" ? 132 : atom.role === "action" ? 204 : 104;
    const position = {x: column * 384, y: atom.role === "action" && y === 0 ? 100 : y};
    y = position.y + height + 10;
    return {position, width: 360, height};
  });
}
