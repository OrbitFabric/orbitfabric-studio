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
