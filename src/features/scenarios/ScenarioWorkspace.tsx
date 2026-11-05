import { useState, type ReactNode } from "react";
import { scenarioContextGraph } from "../experience/graphModel";
import { ScenarioGraph } from "../experience/EngineeringGraph";
import type { ScenarioAtomUnderstanding } from "../../convergence/scenarioUnderstanding";
import { FamilyLabel } from "../presentation/FamilyLabel";
import { familyForDomain, familyForScenarioAtom } from "../presentation/familyMarkers";
import type { ScenarioUnderstandingModel } from "../../convergence/scenarioUnderstanding";
import type { EntityRef } from "../../mission/entityRef";
import { entityKey } from "../../mission/entityRef";
import type { MissionSession } from "../../mission/MissionSession";
import { resolveEntityContract } from "../../mission/resolveEntityContract";
import { declarationFields, presentScenarioAtom, scenarioAtomPreview } from "./scenarioPresentation";

interface Props {
  model: ScenarioUnderstandingModel;
  onRepresented?: (identities:string[])=>void;
  selectedRelation?: string | null;
  onInspectRelation?: (id: string) => void;
  selectedAtom?: string | null;
  onInspectAtom?: (atom: ScenarioAtomUnderstanding) => void;
  session: MissionSession;
  selectedEntity: EntityRef | null;
  disabled: boolean;
  pickerFailure: string | null;
  onChoose: () => void;
  onRefresh: () => void;
  onInspectEntity: (entity: EntityRef) => void;
}

export function ScenarioWorkspace({ onRepresented, selectedRelation, onInspectRelation, selectedAtom, onInspectAtom, model, session, selectedEntity, disabled, pickerFailure, onChoose, onRefresh, onInspectEntity }: Props) {
  const context = scenarioContextGraph(session, model, null);
  function entityLink(entity: EntityRef, label?: string) {
    const resolved = resolveEntityContract(session.snapshot, entity) !== null;
    const selected = selectedEntity !== null && entityKey(selectedEntity) === entityKey(entity);
    return <button type="button" className={`scenario-entity${selected ? " is-selected" : ""}`} disabled={!resolved}
      aria-pressed={selected}
      title={resolved ? `Inspect ${entity.domain}:${entity.id}` : "Entity unavailable in the current Mission Snapshot"}
      onClick={() => onInspectEntity(entity)}>
      {label ? <span>{label}</span> : null}<FamilyLabel family={familyForDomain(entity.domain)}><code>{entity.domain}:{entity.id}</code></FamilyLabel>
      {!resolved ? <small>Entity unavailable</small> : null}
    </button>;
  }
  return <section className="scenario-workspace" aria-label="Scenario Understanding">
    <header className="scenario-toolbar">
      <div><p className="eyebrow">UNDERSTAND · AUTHORED INTENT</p><h1><FamilyLabel family="scenario">Scenario understanding</FamilyLabel></h1></div>
      <div className="scenario-actions">
        <button type="button" className="secondary-action" disabled={disabled || !model.sourcePath || Boolean(model.pending)} onClick={onRefresh}>Refresh Scenario</button>
        <button type="button" className="primary-action" disabled={disabled} onClick={onChoose}>Choose Scenario</button>
      </div>
    </header>
    {pickerFailure ? <p role="alert" className="scenario-notice">File selection unavailable: {pickerFailure}</p> : null}
    {model.pending ? <p role="status" className="scenario-notice">Reading Scenario through Core...</p> : null}
    {model.hydrationFailure ? <div role="alert" className="scenario-notice scenario-failure">
      <strong>{model.hydrationFailure.class === "consistency" ? "Mission consistency failure"
        : model.hydrationFailure.class === "protocol" ? "Scenario protocol failure" : "Scenario transport failure"}</strong>
      <p>{model.hydrationFailure.message}</p>
    </div> : null}
    {model.retainedObservation ? <p className="scenario-notice">Showing the previously accepted declaration. The latest refresh has not replaced it.</p> : null}
    {!model.scenario && model.result !== "failed" ? <div className="scenario-empty">
      <h2>{model.pending ? "Loading the selected declaration" : "Choose a Scenario to understand its intent"}</h2>
      <p>Open a local Scenario file associated with this mission to inspect its declared initial state, actions and expectations.</p>
      <p>No adapter is required. Use the source list above, or choose another file explicitly. Inventory entries are not Core validation.</p>
    </div> : null}
    {model.result === "failed" ? <section className="scenario-notice scenario-failure" aria-label="Core Scenario diagnostics">
      <h2>Core could not declare this Scenario</h2>
      <p>Scenario identity, mission binding and atoms are unavailable. This is a Core declaration failure.</p>
      <ul>{model.diagnostics.map((diagnostic, index) => <li key={index}>
        <strong>{diagnostic.severity} · {diagnostic.code}</strong><p>{diagnostic.message}</p>
        {diagnostic.suggestion ? <p>{diagnostic.suggestion}</p> : null}
        <small>{[diagnostic.file, diagnostic.domain, diagnostic.objectId].filter(value => value !== null).join(" · ")}</small>
      </li>)}</ul>
    </section> : null}
    {model.scenario ? <>

      <section className="scenario-hero">
        <div><span className="scenario-declared">DECLARED</span><h2>{model.scenario.name}</h2>
          <p className="scenario-purpose">{model.scenario.description ?? "Purpose unavailable: no description was declared."}</p>
          <p className="scenario-binding"><code>{model.scenario.id}</code></p>
          <details className="scenario-source-identity"><summary>Accepted declaration source</summary><p>Core-validated declaration. File inventory is separate and does not validate the current file contents.</p><p>Mission <code>{model.mission?.id}</code> · model <code>{model.mission?.modelVersion}</code></p><code>{model.sourcePath}</code><code>{model.sourceSha256}</code></details>
        </div>
        <dl className="scenario-accounting"><div><dt>authored atoms</dt><dd>{model.atomCount}</dd></div><div><dt>Core context entities</dt><dd>{context.records.length}</dd></div><div><dt>Core relations</dt><dd>{session.readiness.relationships === "ready" ? context.relations.length : "Unavailable"}</dd></div></dl>
      </section>
      {onInspectAtom && <ScenarioGraph onRepresented={onRepresented} key={model.sourceSha256} model={model} session={session} selectedEntity={selectedEntity} selectedRelation={selectedRelation ?? null} onInspectEntity={onInspectEntity} onRelation={onInspectRelation ?? (()=>{})} selectedAtom={selectedAtom ?? null} onInspect={onInspectAtom} />}
      <div className="scenario-content">
        <section aria-labelledby="scenario-atoms-heading">
          <h2 id="scenario-atoms-heading">Declared intent</h2>
          <p className="scenario-explanation">Source steps retain authored order. Within each step, atoms follow Core normalization order. Times are declared Scenario times; runtime timing and causality are unavailable.</p>
          <ol className="scenario-atoms">{model.atoms.map(atom => {
            const row = presentScenarioAtom(atom);
            return <li key={`${atom.exactIdentity.scenarioSha256}:${atom.id}`} className={`scenario-atom${selectedAtom === atom.id ? " is-selected" : ""}`} data-atom-id={atom.id}>
              <details><summary className="scenario-atom-heading"><span className="scenario-position">{atom.declarationPosition}</span>
                <span className="scenario-atom-title"><FamilyLabel family={familyForScenarioAtom(atom.kind)}>{row.title}</FamilyLabel></span><span className="scenario-role">{row.role} · DECLARED</span><span className="scenario-row-preview">{scenarioAtomPreview(atom).references.join(" · ") || row.fields.map(f=>`${f.name}: ${f.value}`).join(" · ")}</span><span className="scenario-field-count">{row.fields.length} fields</span></summary>
              <div className="scenario-atom-body">
                {onInspectAtom && <button className="secondary-action" onClick={()=>onInspectAtom(atom)}>Inspect exact atom</button>}
                <p className="scenario-atom-location"><code>{atom.id}</code> · {row.position}{row.ordinal ? ` · ${row.ordinal}` : ""}
                  {row.declaredTime !== null ? <span>Declared Scenario time: {row.declaredTime}</span> : null}</p>
                <div className="scenario-refs">{atom.references.map((ref, index) => <div key={index}>{entityLink(ref.entity, ref.role)}</div>)}</div>
                {atom.kind === "scenario_metadata" ? <details className="scenario-metadata"><summary>Declared metadata fields</summary><DeclaredFields fields={row.fields} /></details>
                  : <DeclaredFields fields={row.fields} />}
                <details className="scenario-atom-source"><summary>Atom identity and Core labels</summary><p>Kind: <code>{atom.kind}</code> · Role: <code>{atom.role}</code></p><code>{atom.exactIdentity.scenarioSha256} + {atom.id}</code></details>
              </div></details>
            </li>;
          })}</ol>
        </section>
        <aside className="scenario-context">
          <section><h2>Mission participants</h2><p className="scenario-explanation">Inspect the mission entities referenced by Core.</p>
            <ul className="scenario-participants">{model.participants.map(participant => <li key={entityKey(participant.entity)}>
              {entityLink(participant.entity)}<small>{participant.occurrences.map(item => `${item.atomId} (${item.role})`).join(", ")}</small>
            </li>)}</ul>
            {!model.participants.length ? <p>No entity references were declared.</p> : null}
          </section>
          <section><h2>Representation boundary</h2>
            <p>This view describes Scenario intent. Projection coverage, generated artifacts, execution results and observations are unavailable here.</p>
            <p>Independent downstream projections remain separate from Scenario truth.</p>
            <p className="scenario-explanation">No adapter is needed to inspect this declaration.</p>
          </section>
          <section><h2>Diagnostics</h2><p>No Core declaration diagnostics.</p></section>
        </aside>
      </div>
    </> : null}
    {model.result ? <details className="scenario-provenance"><summary>Exact identity, source and Core boundaries</summary>
      <dl className="scenario-fields">
        <div><dt>Scenario ID</dt><dd>{model.exactIdentity?.scenarioId ?? "Unavailable"}</dd></div>
        <div><dt>Scenario SHA-256</dt><dd><code>{model.sourceSha256 ?? "Unavailable"}</code></dd></div>
        <div><dt>Selected source</dt><dd>{model.sourcePath}</dd></div>
        <div><dt>Producer</dt><dd>OrbitFabric Core {model.producerVersion} · Declaration {model.declarationVersion}</dd></div>
      </dl>
      <p>Exact Scenario identity is Scenario ID plus source SHA-256. Atom identity is source SHA-256 plus atom ID.</p>
      <dl className="scenario-fields">{declarationFields(model.boundaries).map(field => <div key={field.name}><dt>{field.name}</dt><dd>{field.value}</dd></div>)}</dl>
    </details> : null}
  </section>;
}

function DeclaredFields({ fields }: { fields: { name: string; value: string }[] }) {
  return fields.length ? <dl className="scenario-fields">{fields.map(field => <div key={field.name}><dt>{field.name}</dt><dd>{field.value}</dd></div>)}</dl>
    : <p className="scenario-explanation">No declaration fields.</p>;
}

export function ScenarioSources({children}:{children:ReactNode}) {
  const [expanded,setExpanded]=useState(false);
  return <details className="scenario-sources" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary>Scenario sources · file candidates</summary>{children}</details>;
}
