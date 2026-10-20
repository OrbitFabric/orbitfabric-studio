import type { EntityRef } from "../../mission/entityRef";
import type {
  ScenarioUnderstandingModel,
  ScenarioAtomUnderstanding,
} from "../../convergence/scenarioUnderstanding";
export type Inspection =
  | { kind: "entity"; entity: EntityRef }
  | { kind: "relation"; id: string }
  | {
      kind: "atom";
      scenario: ScenarioUnderstandingModel;
      atom: ScenarioAtomUnderstanding;
    };
export function inspectionIdentity(i: Inspection): string {
  if (i.kind === "entity")
    return JSON.stringify(["entity", i.entity.domain, i.entity.id]);
  if (i.kind === "relation") return JSON.stringify(["relation", i.id]);
  return JSON.stringify([
    "atom",
    i.scenario.exactIdentity?.scenarioId,
    i.scenario.sourceSha256,
    i.atom.id,
  ]);
}

// Inspection has priority, but a relation/atom must never fall back to a stale entity.
export function investigationSubject(inspection: Inspection | null, nativeSelection: EntityRef | null): EntityRef | null {
  return inspection ? inspection.kind === "entity" ? inspection.entity : null : nativeSelection;
}
export interface InspectionState { membership: string; current: Inspection | null; history: Inspection[] }
export function advanceInspection(state: InspectionState, membership: string, next: Inspection): InspectionState {
  const prior = state.membership === membership ? state : { membership, current: null, history: [] };
  return { membership, current: next, history: prior.current && inspectionIdentity(prior.current) !== inspectionIdentity(next)
    ? [...prior.history, prior.current].slice(-20) : prior.history };
}
