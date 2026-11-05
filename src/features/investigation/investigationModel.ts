import type { MissionSession } from "../../mission/MissionSession";
import { entityKey, type EntityRef } from "../../mission/entityRef";
import {
  sameScenarioMembership,
  type ScenarioAcceptedObservation,
} from "../../convergence/scenarioSlot";
import { buildScenarioUnderstanding } from "../../convergence/scenarioUnderstanding";
import type { EvidenceUnderstandingModel } from "../../convergence/evidenceUnderstanding";

export type EngineeringQuestion =
  "participation" | "projection" | "association" | "compare" | "execution";
export type Investigation = {
  question: EngineeringQuestion;
  anchor: EntityRef | null;
  scope: string[];
  resultSha256: string;
  representation: "all" | "actions";
  left: string;
  right: string;
};
export const initialInvestigation: Investigation = {
  question: "participation",
  anchor: null,
  scope: [],
  resultSha256: "",
  representation: "all",
  left: "",
  right: "",
};
export type Population = ReadonlyMap<string, ScenarioAcceptedObservation>;
export function observationKey(o: ScenarioAcceptedObservation): string {
  const d = o.declaration;
  return JSON.stringify([
    o.membership.sessionId,
    o.membership.generation,
    d.scenario?.id,
    d.source.scenarioSha256,
    o.targetPath,
  ]);
}
export function admitObservation(
  population: Population,
  observation: ScenarioAcceptedObservation,
  session: MissionSession,
): Map<string, ScenarioAcceptedObservation> {
  if (!sameScenarioMembership(observation.membership, session))
    throw new Error("Stale Mission generation");
  const d = observation.declaration;
  if (d.result !== "loaded") throw new Error("No loaded Core declaration");
  if (
    d.mission.id !== session.snapshot.mission?.id ||
    d.mission.modelVersion !== session.snapshot.mission?.model_version
  )
    throw new Error("Wrong Mission provenance");
  // Equal source identity with contradictory producer content is never silently overwritten.
  for (const existing of population.values())
    if (
      existing.declaration.source.scenarioSha256 === d.source.scenarioSha256 &&
      existing.declaration.scenario?.id === d.scenario.id &&
      JSON.stringify(existing.declaration) !== JSON.stringify(d)
    )
      throw new Error(
        "Conflicting declaration for the same exact source identity",
      );
  const next = new Map(population);
  next.set(observationKey(observation), observation);
  return next;
}
export function observationModel(o: ScenarioAcceptedObservation) {
  return buildScenarioUnderstanding({
    accepted: o,
    pending: null,
    hydrationFailure: null,
  });
}
export function transitionInvestigation(
  state: { current: Investigation; history: Investigation[] },
  next: Investigation,
) {
  return JSON.stringify(state.current) === JSON.stringify(next)
    ? state
    : { current: next, history: [...state.history, state.current].slice(-20) };
}
export function evaluateInvestigation(
  session: MissionSession,
  population: Population,
  request: Investigation,
  evidence: EvidenceUnderstandingModel,
) {
  const observations = request.scope.map((k) => population.get(k));
  const invalid = observations.some(
    (o) => !o || !sameScenarioMembership(o.membership, session),
  );
  const selected = observations.filter(
    (o): o is ScenarioAcceptedObservation => !!o,
  );
  const models = selected.map(observationModel);
  const state =
    request.question === "execution"
      ? "UNSUPPORTED"
      : invalid
        ? "UNAVAILABLE"
        : !request.scope.length
          ? "PENDING_BINDING"
          : !request.anchor && request.question === "participation"
            ? "PENDING_BINDING"
            : "AVAILABLE";
  const anchorKnown =
    !!request.anchor &&
    session.readModel.entityRecordsByKey.has(entityKey(request.anchor));
  const participation =
    state === "AVAILABLE" && request.question === "participation" && anchorKnown
      ? models.flatMap((model, i) =>
          model.atoms.flatMap((atom) =>
            atom.references
              .filter((r) => entityKey(r.entity) === entityKey(request.anchor!))
              .map((r) => ({
                model,
                atom,
                role: r.role,
                sourceKey: request.scope[i],
              })),
          ),
        )
      : [];
  const projectedModel = models.length === 1 ? models[0] : null;
  const lineageMatches =
    !!projectedModel &&
    evidence.scenario?.id === projectedModel.exactIdentity?.scenarioId &&
    evidence.scenario?.sha256 === projectedModel.sourceSha256;
  const result =
    evidence.results.find((r) => r.sha256 === request.resultSha256) ?? null;
  const projection =
    lineageMatches && result
      ? evidence.atoms.map((atom) => ({
          atom,
          projection:
            atom.projections.find((p) => p.resultSha256 === result.sha256) ??
            null,
        }))
      : [];
  let disposition: string = state;
  if (
    state === "AVAILABLE" &&
    request.question === "participation" &&
    !anchorKnown
  )
    disposition = "UNAVAILABLE";
  if (
    state === "AVAILABLE" &&
    (request.question === "projection" || request.question === "association")
  )
    disposition =
      !projectedModel || !request.resultSha256
        ? "PENDING_BINDING"
        : !lineageMatches
          ? "UNAVAILABLE"
          : !result
            ? "NOT_LOADED"
            : "AVAILABLE";
  if (
    state === "AVAILABLE" &&
    request.question === "compare" &&
    (!request.left ||
      !request.right ||
      request.left === request.right ||
      !request.scope.includes(request.left) ||
      !request.scope.includes(request.right))
  )
    disposition = "PENDING_BINDING";
  if (
    state === "AVAILABLE" &&
    request.question === "association" &&
    !evidence.evidenceSet
  )
    disposition = "NOT_LOADED";
  return {
    disposition,
    coverage: "UNKNOWN" as const,
    models,
    participation,
    projection,
    result,
    lineageMatches,
    authority:
      request.question === "participation" || request.question === "compare"
        ? "Core Scenario declarations"
        : request.question === "association"
          ? "Retained Evidence curator associations; no assessment contract"
          : "Result-owned projection accounting",
    boundary:
      "Explicitly selected observations only. Mission-wide population and cross-export content binding are UNKNOWN. Same generation is not an atomic producer attestation.",
    assessment: "UNAVAILABLE" as const,
  };
}
export function compareDeclarations(
  left: ScenarioAcceptedObservation,
  right: ScenarioAcceptedObservation,
) {
  const a = observationModel(left),
    b = observationModel(right);
  const fields = (m: ReturnType<typeof observationModel>) => ({
    description: m.scenario?.description,
    atoms: m.atoms.map((x) => ({
      kind: x.kind,
      role: x.role,
      time: x.scenarioTimeS,
      references: x.references,
      declaration: x.declaration,
    })),
  });
  const av = fields(a),
    bv = fields(b);
  return {
    left: a,
    right: b,
    descriptionDiffers: av.description !== bv.description,
    atomsDiffer: JSON.stringify(av.atoms) !== JSON.stringify(bv.atoms),
    criterion:
      "Declared fields and ordered atoms only; positional display does not assert semantic atom correspondence.",
  };
}
