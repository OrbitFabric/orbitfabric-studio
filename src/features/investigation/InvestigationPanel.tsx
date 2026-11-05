import { useMemo, useState } from "react";
import type { MissionSession } from "../../mission/MissionSession";
import { entityKey, type EntityRef } from "../../mission/entityRef";
import type { ScenarioSlotState } from "../../convergence/scenarioSlot";
import type { EvidenceUnderstandingModel } from "../../convergence/evidenceUnderstanding";
import { investigationSubject, type Inspection } from "../experience/inspection";
import { presentScenarioAtom } from "../scenarios/scenarioPresentation";
import {
  admitObservation,
  compareDeclarations,
  evaluateInvestigation,
  initialInvestigation,
  observationKey,
  transitionInvestigation,
  type EngineeringQuestion,
  type Investigation,
  type Population,
} from "./investigationModel";
const questions: Record<EngineeringQuestion, string> = {
  participation: "Where does this subject participate?",
  projection: "How was this Scenario projected?",
  association: "What evidence is associated?",
  compare: "How do two declared intents differ?",
  execution: "Was this Scenario executed successfully?",
};
export function InvestigationPanel({
  session,
  slot,
  evidence,
  selection,
  inspection,
  onInspect,
  onScenarios,
  onEvidence,
  onReturnContext,
  canReturn,
  disabled,
}: {
  session: MissionSession;
  slot: ScenarioSlotState;
  evidence: EvidenceUnderstandingModel;
  selection: EntityRef | null;
  inspection: Inspection | null;
  onInspect: (target: Inspection) => void;
  onScenarios: () => void;
  onEvidence: () => void;
  onReturnContext: () => void;
  canReturn: boolean;
  disabled: boolean;
}) {
  const subject = investigationSubject(inspection, selection);
  const [open, setOpen] = useState(false);
  const [population, setPopulation] = useState<Population>(new Map());
  const [state, setState] = useState({
    current: initialInvestigation,
    history: [] as Investigation[],
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [navigationCheckpoint, setNavigationCheckpoint] =
    useState<Investigation | null>(null);
  const q = state.current;
  const update = (patch: Partial<Investigation>) =>
    setState((s) => transitionInvestigation(s, { ...s.current, ...patch }));
  const answer = useMemo(
    () => evaluateInvestigation(session, population, q, evidence),
    [session, population, q, evidence],
  );
  function include() {
    if (!slot.accepted) return;
    try {
      const next = admitObservation(population, slot.accepted, session);
      setPopulation(next);
      const k = observationKey(slot.accepted);
      update({ scope: [...new Set([...q.scope, k])] });
      setFailure(null);
    } catch (e) {
      setFailure(String(e));
    }
  }
  const left = population.get(q.left),
    right = population.get(q.right);
  const comparison =
    answer.disposition === "AVAILABLE" &&
    q.question === "compare" &&
    left &&
    right
      ? compareDeclarations(left, right)
      : null;
  const rows =
    q.representation === "actions"
      ? answer.participation.filter((p) => p.atom.role === "action")
      : answer.participation;
  return (
    <section
      className={`investigation-panel${open ? " is-open" : ""}`}
      aria-label="Engineering investigation"
    >
      <div className="investigation-bar">
        <button
          className="secondary-action"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          Engineering questions
        </button>
        <span>
          {q.anchor
            ? `${q.anchor.domain}:${q.anchor.id}`
            : "Choose a question or acquire an exact subject"}{" "}
          · {q.scope.length} selected declarations
        </span>
        <button
          className="secondary-action"
          disabled={!subject || disabled}
          onClick={() => {
            update({ anchor: subject });
            setOpen(true);
          }}
        >
          {inspection ? "Investigate inspected subject" : "Investigate native selected subject"}
        </button>
        <small className="investigation-subject" aria-label="Investigation subject proposal">
          {subject ? `Proposed subject: ${subject.domain}:${subject.id}` : "Inspect an entity to propose an investigation subject"}
          {inspection && selection && ` · Native selection: ${selection.domain}:${selection.id}`}
          <span>Only this explicit action changes Anchor. Scope is retained.</span>
        </small>
      </div>
      {canReturn && navigationCheckpoint && (
        <button
          className="secondary-action"
          onClick={() => {
            setState((s) => ({ ...s, current: navigationCheckpoint }));
            setNavigationCheckpoint(null);
            onReturnContext();
          }}
        >
          Return to investigation context
        </button>
      )}
      <div hidden={!open} className="investigation-content">
        <header className="investigation-heading"><div><p className="eyebrow">Engineering questions</p><h2>Investigation</h2></div><button className="secondary-action" aria-label="Close investigation" onClick={()=>setOpen(false)}>×</button></header>
        <fieldset disabled={disabled}>
          <div className="experience-tools">
            <label>
              Question{" "}
              <select
                aria-label="Question"
                value={q.question}
                onChange={(e) =>
                  update({ question: e.target.value as EngineeringQuestion })
                }
              >
                {Object.entries(questions).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Anchor{" "}
              <select
                aria-label="Anchor"
                value={q.anchor ? entityKey(q.anchor) : ""}
                onChange={(e) => {
                  const r = session.readModel.entityRecordsByKey.get(
                    e.target.value,
                  );
                  update({ anchor: r ? { domain: r.domain, id: r.id } : null });
                }}
              >
                <option value="">Choose exact subject</option>
                {[...session.readModel.entityRecordsByKey.values()].map((r) => (
                  <option key={entityKey(r)} value={entityKey(r)}>
                    {r.domain}:{r.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-action"
              disabled={!state.history.length}
              onClick={() =>
                setState((s) => ({
                  current: s.history[s.history.length - 1],
                  history: s.history.slice(0, -1),
                }))
              }
            >
              Return to previous investigation
            </button>
          </div>
          <div className="investigation-scope">
            <h3>Scope · explicitly selected declarations</h3>
            <p>
              Load a Scenario through the native Scenario view, then include
              that accepted observation. No automatic discovery.
            </p>
            <button
              className="secondary-action"
              onClick={() => {
                setNavigationCheckpoint(q);
                onScenarios();
              }}
            >
              Open native Scenarios
            </button>{" "}
            <button
              className="secondary-action"
              disabled={
                !slot.accepted || !!slot.pending || !!slot.hydrationFailure
              }
              onClick={include}
            >
              Include loaded declaration
            </button>
            {failure && <p role="alert">{failure}</p>}
            {[...population].map(([k, o]) => (
              <label className="scope-option" key={k}>
                <input
                  type="checkbox"
                  checked={q.scope.includes(k)}
                  onChange={(e) =>
                    update({
                      scope: e.target.checked
                        ? [...q.scope, k]
                        : q.scope.filter((x) => x !== k),
                    })
                  }
                />
                <span>
                  {o.declaration.scenario?.name}
                  <small>
                    {o.targetPath} · {o.declaration.source.scenarioSha256}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {(q.question === "projection" || q.question === "association") && (
            <div className="experience-tools">
              <label>
                Exact Result{" "}
                <select
                  aria-label="Exact Result"
                  value={q.resultSha256}
                  onChange={(e) => update({ resultSha256: e.target.value })}
                >
                  <option value="">Choose loaded Result</option>
                  {evidence.results.map((r) => (
                    <option key={r.sha256} value={r.sha256}>
                      {r.adapterId} · {r.sha256}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-action"
                onClick={() => {
                  setNavigationCheckpoint(q);
                  onEvidence();
                }}
              >
                Open native Result / Evidence
              </button>
              <span>Select exactly one declaration in Scope.</span>
            </div>
          )}
          {q.question === "compare" && (
            <div className="experience-tools">
              {(["left", "right"] as const).map((side) => (
                <label key={side}>
                  {side === "left" ? "Left operand" : "Right operand"}
                  <select
                    aria-label={
                      side === "left" ? "Left operand" : "Right operand"
                    }
                    value={q[side]}
                    onChange={(e) => update({ [side]: e.target.value })}
                  >
                    <option value="">Choose exact declaration</option>
                    {q.scope.map((k) => (
                      <option key={k} value={k}>
                        {population.get(k)?.declaration.scenario?.name} ·{" "}
                        {population
                          .get(k)
                          ?.declaration.source.scenarioSha256?.slice(0, 12)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <div className="answer-boundary" role="status">
            <strong>
              {answer.disposition} · coverage {answer.coverage}
            </strong>
            <p>
              {answer.authority}. {answer.boundary}
            </p>
            <p>
              DECLARED ≠ PROJECTED ≠ GENERATED ≠ EXECUTED ≠ OBSERVED.
              Assessment: {answer.assessment}.
            </p>
          </div>
          {answer.disposition === "AVAILABLE" &&
            q.question === "participation" && (
              <>
                <div className="experience-tools">
                  <label>
                    Representation{" "}
                    <select
                      aria-label="Representation"
                      value={q.representation}
                      onChange={(e) =>
                        update({
                          representation: e.target.value as "all" | "actions",
                        })
                      }
                    >
                      <option value="all">All declared roles</option>
                      <option value="actions">Actions only</option>
                    </select>
                  </label>
                  <span>
                    {rows.length} represented / {answer.participation.length}{" "}
                    matching references in selected observations
                  </span>
                </div>
                {!rows.length && (
                  <p>
                    No matching references in this representation. This is not
                    proof of mission-wide absence.
                  </p>
                )}
                <table className="investigation-table">
                  <thead>
                    <tr>
                      <th>Scenario / exact source</th>
                      <th>Atom and role</th>
                      <th>Declared fields</th>
                      <th>Inspection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td>
                          {r.model.scenario?.name}
                          <small>{r.model.sourceSha256}</small>
                        </td>
                        <td>
                          {r.atom.id} · {r.atom.role}
                          <br />
                          {r.role}
                        </td>
                        <td>
                          {presentScenarioAtom(r.atom).fields.map((f) => (
                            <div key={f.name}>
                              {f.name}: {f.value}
                            </div>
                          ))}
                        </td>
                        <td>
                          <button
                            className="secondary-action"
                            onClick={() =>
                              onInspect({
                                kind: "atom",
                                scenario: r.model,
                                atom: r.atom,
                              })
                            }
                          >
                            Inspect atom
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          {answer.disposition === "AVAILABLE" &&
            (q.question === "projection" || q.question === "association") && (
              <>
                <p>
                  Exact Result: <code>{answer.result?.sha256}</code>. Producer
                  operation result: {answer.result?.operationResult} — not a
                  Scenario verdict.
                </p>
                <table className="investigation-table">
                  <thead>
                    <tr>
                      <th>Declared atom</th>
                      <th>Producer disposition</th>
                      <th>Mapping / reason</th>
                      <th>Association / assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {answer.projection.map(({ atom, projection: p }) => (
                      <tr key={atom.atomId}>
                        <td>
                          {atom.atomId} · {atom.role}
                        </td>
                        <td>
                          {p?.availability ?? "unavailable"}
                          <br />
                          {p?.disposition ?? "unavailable"}
                        </td>
                        <td>
                          {p?.mappings.map((m) => m.id).join(", ") ||
                            "No admitted mapping"}
                          <p>{p?.reason}</p>
                        </td>
                        <td>
                          {atom.directEvidence.length} direct atom associations
                          · {p?.evidence.length ?? 0} mapping/artifact
                          associations
                          <br />
                          Assessment UNAVAILABLE
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {q.question === "association" && (
                  <>
                    <h3>Exact Result associations</h3>
                    {answer.result?.evidence.map((r) => (
                      <p key={r.id}>
                        {r.id} · {r.producerId} ·{" "}
                        {r.reference?.status ?? "unavailable"}
                        <br />
                        <code>{r.sha256}</code> · association, not assessment
                      </p>
                    ))}
                    <p>
                      Curator {evidence.evidenceSet?.curator} · Evidence Set{" "}
                      {evidence.evidenceSet?.sha256}
                    </p>
                  </>
                )}
              </>
            )}
          {comparison && (
            <>
              <p>{comparison.criterion}</p>
              <p>
                <strong>
                  Declared description:{" "}
                  {comparison.descriptionDiffers ? "DIFFERENT" : "SAME"} ·
                  ordered atoms: {comparison.atomsDiffer ? "DIFFERENT" : "SAME"}
                </strong>
              </p>
              <div className="investigation-compare">
                {[comparison.left, comparison.right].map((m, i) => (
                  <section key={i}>
                    <h3>{m.scenario?.name}</h3>
                    <code>{m.sourceSha256}</code>
                    <p>{m.scenario?.description}</p>
                    {m.atoms.map((a) => (
                      <article key={a.id}>
                        <h4>
                          {a.declarationPosition}.{" "}
                          {presentScenarioAtom(a).title} · {a.role}
                        </h4>
                        {presentScenarioAtom(a).fields.map((f) => (
                          <p key={f.name}>
                            {f.name}: {f.value}
                          </p>
                        ))}
                        <button
                          className="secondary-action"
                          onClick={() =>
                            onInspect({ kind: "atom", scenario: m, atom: a })
                          }
                        >
                          Inspect exact atom
                        </button>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            </>
          )}
        </fieldset>
      </div>
    </section>
  );
}
