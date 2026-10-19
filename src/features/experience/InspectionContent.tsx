import type { Inspection } from "./inspection";
import type { MissionSession } from "../../mission/MissionSession";
import type { EntityRef } from "../../mission/entityRef";
import {
  declarationFields,
  presentScenarioAtom,
} from "../scenarios/scenarioPresentation";
export function InspectionContent({
  target,
  session,
  onEntity,
}: {
  target: Exclude<Inspection, { kind: "entity" }>;
  session: MissionSession;
  onEntity: (entity: EntityRef) => void;
}) {
  if (target.kind === "relation") {
    const r = session.readModel.relationshipsById.get(target.id);
    return r ? (
      <>
        <h3>{r.relationship_type}</h3>
        <p>Explicit Core relationship · not causality.</p>
        {[r.from, r.to].map((e, i) => (
          <button
            className="experience-relation"
            key={i}
            onClick={() => onEntity(e)}
          >
            {i ? "To" : "From"} · {e.domain}:{e.id}
          </button>
        ))}
        <dl className="experience-facts">
          <dt>Source witness</dt>
          <dd>{r.derived_from.model_field}</dd>
          <dt>Exact relationship</dt>
          <dd>{r.relationship_id}</dd>
        </dl>
      </>
    ) : (
      <p>Relationship unavailable in this generation.</p>
    );
  }
  const p = presentScenarioAtom(target.atom);
  return (
    <>
      <p className="eyebrow">DECLARED · {p.role}</p>
      <h3>{p.title}</h3>
      <p>
        {p.position} · {p.declaredTime ?? "No declared time"}
      </p>
      <p>
        Authored intent. Assessment and runtime observation are unavailable.
      </p>
      <dl className="experience-facts">
        {p.fields.map((f) => (
          <div key={f.name}>
            <dt>{f.name}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <h3>Referenced mission objects</h3>
      {target.atom.references.map((r, i) => (
        <button
          className="experience-relation"
          key={i}
          onClick={() => onEntity(r.entity)}
        >
          {r.role} · {r.entity.domain}:{r.entity.id}
        </button>
      ))}
      <details>
        <summary>Exact source identity</summary>
        <dl className="experience-facts">
          {declarationFields({
            scenario: target.scenario.exactIdentity,
            atom: target.atom.id,
            source: target.scenario.sourcePath,
            producer: target.scenario.producerVersion,
          }).map((f) => (
            <div key={f.name}>
              <dt>{f.name}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
