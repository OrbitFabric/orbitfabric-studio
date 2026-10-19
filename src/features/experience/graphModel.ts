import type { MissionSession } from '../../mission/MissionSession';
import { entityKey, type EntityRef } from '../../mission/entityRef';
import type { ScenarioUnderstandingModel } from '../../convergence/scenarioUnderstanding';

// Presentation projection only: edges are exact Core records, never inferred from IDs.
export function missionGraph(session: MissionSession, domain: string, anchor: EntityRef | null) {
  const records = [...session.readModel.entityRecordsByKey.values()];
  const relations = session.readiness.relationships === 'ready' ? [...session.readModel.relationshipsById.values()] : [];
  const adjacent = anchor ? relations.filter(r => entityKey(r.from) === entityKey(anchor) || entityKey(r.to) === entityKey(anchor)) : [];
  const keys = anchor ? new Set([entityKey(anchor), ...adjacent.flatMap(r => [entityKey(r.from), entityKey(r.to)])]) : null;
  const visible = records.filter(r => keys ? keys.has(entityKey(r)) : r.domain === domain);
  const visibleKeys = new Set(visible.map(entityKey));
  return { records: visible, relations: (anchor ? adjacent : relations).filter(r => visibleKeys.has(entityKey(r.from)) && visibleKeys.has(entityKey(r.to))),
    total: records.length, unresolved: [...(keys ?? [])].filter(k => !visibleKeys.has(k)).length };
}
export function authoredGraph(model: ScenarioUnderstandingModel) {
  return { atoms: model.atoms, order: model.atoms.slice(1).map((atom, i) => ({ from: model.atoms[i].id, to: atom.id })) };
}
