import type { MissionSession } from "../../mission/MissionSession";
import { entityKey, type EntityRef } from "../../mission/entityRef";
import type { ScenarioUnderstandingModel } from "../../convergence/scenarioUnderstanding";

// Presentation projection only: edges are exact Core records, never inferred from IDs.
export function missionGraph(
  session: MissionSession,
  domain: string,
  anchor: EntityRef | null,
) {
  const records = [...session.readModel.entityRecordsByKey.values()];
  const relations =
    session.readiness.relationships === "ready"
      ? [...session.readModel.relationshipsById.values()]
      : [];
  const adjacent = anchor
    ? relations.filter(
        (r) =>
          entityKey(r.from) === entityKey(anchor) ||
          entityKey(r.to) === entityKey(anchor),
      )
    : [];
  const keys = anchor
    ? new Set([
        entityKey(anchor),
        ...adjacent.flatMap((r) => [entityKey(r.from), entityKey(r.to)]),
      ])
    : null;
  const visible = records.filter((r) =>
    keys ? keys.has(entityKey(r)) : r.domain === domain,
  );
  const visibleKeys = new Set(visible.map(entityKey));
  return {
    records: visible,
    relations: (anchor ? adjacent : relations).filter(
      (r) =>
        visibleKeys.has(entityKey(r.from)) && visibleKeys.has(entityKey(r.to)),
    ),
    total: records.length,
    unresolved: [...(keys ?? [])].filter((k) => !visibleKeys.has(k)).length,
  };
}
export function authoredGraph(model: ScenarioUnderstandingModel) {
  return {
    atoms: model.atoms,
    order: model.atoms
      .slice(1)
      .map((atom, i) => ({ from: model.atoms[i].id, to: atom.id })),
  };
}

// Subsystem orientation is derived only from explicit Core relationships. The family
// is a representation filter; it is neither Scope nor an inferred ownership assertion.
export function orientedMissionGraph(session: MissionSession, domain: string, focus: EntityRef | null, neighbor: EntityRef | null) {
  if (neighbor) return missionGraph(session, domain, neighbor);
  if (!focus) {
    const records = [...session.readModel.entityRecordsByKey.values()].filter(r => r.domain === 'subsystems' || r.domain === 'payloads');
    return representedGraph(session, new Set(records.map(entityKey)));
  }
  const first = missionGraph(session, domain, focus);
  const anchors = first.records.filter(r => entityKey(r) === entityKey(focus) || r.domain === 'payloads');
  const keys = new Set(anchors.map(entityKey));
  for (const anchor of anchors) for (const r of missionGraph(session, domain, anchor).records) if (r.domain === domain) keys.add(entityKey(r));
  return representedGraph(session, keys);
}
function representedGraph(session: MissionSession, keys: Set<string>) {
  const all = [...session.readModel.entityRecordsByKey.values()];
  const records = all.filter(r => keys.has(entityKey(r)));
  const resolved = new Set(records.map(entityKey));
  const relevant = session.readiness.relationships === 'ready' ? [...session.readModel.relationshipsById.values()].filter(r => keys.has(entityKey(r.from)) || keys.has(entityKey(r.to))) : [];
  const unresolved = new Set(relevant.flatMap(r => [r.from,r.to]).filter(r=>!session.readModel.entityRecordsByKey.has(entityKey(r))).map(entityKey));
  return {records, relations: relevant.filter(r=>resolved.has(entityKey(r.from)) && resolved.has(entityKey(r.to))), total:all.length, unresolved:unresolved.size};
}
export function scenarioContextGraph(session: MissionSession, model: ScenarioUnderstandingModel, focus: EntityRef | null) {
  // Scenario references are producer-owned exact EntityRefs, never parsed from labels.
  const refs = model.atoms.flatMap(a => a.references.map(r=>r.entity));
  const keys = new Set(refs.map(entityKey));
  const graph = representedGraph(session, keys);
  if (!focus || !keys.has(entityKey(focus))) return {...graph, unresolved: refs.filter(r=>!session.readModel.entityRecordsByKey.has(entityKey(r))).length};
  const adjacent = graph.relations.filter(r=>entityKey(r.from)===entityKey(focus)||entityKey(r.to)===entityKey(focus));
  const visible = new Set([entityKey(focus),...adjacent.flatMap(r=>[entityKey(r.from),entityKey(r.to)])]);
  return {...graph,records:graph.records.filter(r=>visible.has(entityKey(r))),relations:adjacent};
}

// React Flow projects IDs into DOM attributes/selectors. Core's NUL-delimited map
// keys stay internal; JSON tuples preserve exact domains without a DOM-invalid NUL.
export function graphEntityKey(ref:EntityRef):string { return JSON.stringify([ref.domain,ref.id]); }
