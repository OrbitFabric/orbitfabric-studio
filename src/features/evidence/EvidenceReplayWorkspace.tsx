import { FamilyLabel } from "../presentation/FamilyLabel";
import { useEffect, useState } from "react";
import type { EvidenceUnderstandingModel, ReplayEvidenceRecord, ReplayProjection } from "../../convergence/evidenceUnderstanding";

export function EvidenceReplayWorkspace({
  model,
  busy,
  failure,
  onChooseResult,
  onChooseEvidence,
}: {
  model: EvidenceUnderstandingModel;
  busy: string | null;
  failure: string | null;
  onChooseResult: () => void;
  onChooseEvidence: () => void;
}) {
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedAtomId || !model.atoms.some((atom) => atom.atomId === selectedAtomId)) {
      setSelectedAtomId(model.atoms[0]?.atomId ?? null);
    }
  }, [model.atoms, selectedAtomId]);
  const selected = model.atoms.find((atom) => atom.atomId === selectedAtomId) ?? null;
  const scenario = model.scenario;

  return <section className="evidence-workspace" aria-label="Evidence Replay">
    <header className="evidence-toolbar">
      <div><p className="eyebrow">Evidence</p><h1>Deterministic replay</h1></div>
      <div className="evidence-actions">
        <button type="button" className="secondary-action" disabled={busy !== null} onClick={onChooseResult}>{busy === "result" ? "Reading Result…" : "Load Integration Result"}</button>
        <button type="button" className="primary-action" disabled={busy !== null} onClick={onChooseEvidence}>{busy === "evidence" ? "Reading Evidence…" : "Load Evidence Set"}</button>
      </div>
    </header>
    <p className="evidence-boundary">Replay follows retained identities and explicit correlations. It does not re-execute, simulate, infer timing or invent causality.</p>
    {failure ? <p role="alert" className="evidence-notice evidence-failure">{failure}</p> : null}
    {!scenario ? <div className="evidence-empty"><h2>Choose a Scenario first</h2><p>The replay root is an exact Core Scenario Declaration.</p></div> : <>
      <section className="evidence-summary">
        <div><small>DECLARED</small><strong>{scenario.id}</strong><code title={scenario.sha256}>{shortSha(scenario.sha256)}</code></div>
        <div><small>RESULTS</small><strong>{model.results.length}</strong><span>{model.results.length ? "exact identities loaded" : "unavailable"}</span></div>
        <div><small>EVIDENCE SET</small><strong>{model.evidenceSet?.id ?? "unavailable"}</strong><span>{model.evidenceSet ? `${model.evidenceSet.recordCount} retained records` : "no curator manifest loaded"}</span></div>
      </section>
      <div className="evidence-layout">
        <aside><h2>Scenario atoms</h2><ol className="evidence-atoms">{model.atoms.map((atom) => <li key={atom.atomId}><button type="button" className={atom.atomId === selectedAtomId ? "is-active" : ""} onClick={() => setSelectedAtomId(atom.atomId)}><span>{atom.declarationPosition}</span><strong>{atom.kind}</strong><code>{atom.atomId}</code></button></li>)}</ol></aside>
        <section>{selected ? <>
          <header className="replay-heading"><span>DECLARED</span><h2>{selected.kind}</h2><code>{selected.atomId}</code></header>
          <details><summary>Core declaration · expected intent, not observation</summary><pre>{JSON.stringify(selected.declaration, null, 2)}</pre></details>
          {!selected.projections.length ? <p className="evidence-empty">Projection disposition unavailable: no Integration Result is loaded.</p> : null}
          {selected.projections.map((projection) => <article className="replay-lane" key={projection.resultSha256}>
            <div className="replay-stage"><small>PROJECTED</small><strong>{projection.disposition}</strong><span className={`evidence-state ${projection.availability}`}>{projection.availability}</span><p>{projection.reason}</p><code>{projection.integrationId} · {projection.operationId}</code></div>
            <div className="replay-stage"><small>PRODUCER MAPPING IDS</small>{projection.mappings.length ? projection.mappings.map((mapping) => <div key={mapping.id}><code>{mapping.id}</code><p>{mapping.targets.length} explicit downstream path{mapping.targets.length === 1 ? "" : "s"}</p>{mapping.targets.map((target, index) => <code key={`${mapping.id}:${index}`}>{target.namespace} · {target.kind} · {target.id}</code>)}</div>) : <strong>{projection.availability === "current" ? "Producer declared [] · 0 downstream paths" : "unavailable"}</strong>}</div>
            <div className="replay-stage"><small>RESULT ARTIFACT RELATIONS</small>{projection.artifacts.length ? projection.artifacts.map((artifact) => <code key={artifact.id}>{artifact.id} · {artifact.status}</code>) : <strong>{projection.availability === "current" ? "0 explicit artifact relations" : "unavailable"}</strong>}</div>
            <div className="replay-stage"><small>CURATOR-LINKED EVIDENCE</small>{projection.evidence.length ? projection.evidence.map((record) => <EvidenceRecord key={record.id} record={record} />) : <strong>No explicit mapping or artifact subject</strong>}</div>
            <ExactProjectionProvenance projection={projection} scenarioSha256={scenario.sha256} atomId={selected.atomId} />
          </article>)}
          {selected.directEvidence.length ? <section className="direct-evidence"><h3>Curator-linked atom evidence</h3><p>These subjects identify this exact atom. They do not assert an edge to any Result, mapping or artifact.</p>{selected.directEvidence.map((record) => <EvidenceRecord key={record.id} record={record} />)}</section> : null}
        </> : null}</section>
      </div>
    </>}
    <section className="direct-evidence"><h2><FamilyLabel family="result">Independent Result identities</FamilyLabel></h2><p>Adapter operation results are not Scenario execution states. EXECUTED interpretation is unavailable without a producer contract that declares it.</p>
      {model.results.map((result) => <details key={result.sha256}><summary>{result.adapterId}@{result.adapterVersion} · {result.operationId}</summary><code>{result.sha256}</code><p>Scenario accounting: {result.accounting}</p><h3>Adapter operation result</h3><pre>{JSON.stringify(result.operationResult, null, 2)}</pre><h3>Producer-owned evidence statements</h3><pre>{JSON.stringify(result.producerStatements, null, 2)}</pre>{result.evidence.map((record) => <EvidenceRecord key={record.id} record={record} />)}</details>)}
    </section>
    <section className="direct-evidence"><h2><FamilyLabel family="evidence">Retained Evidence Set records</FamilyLabel></h2><p>OBSERVED meaning and verdicts remain producer-owned. Co-membership does not establish pairwise relations.</p>{model.records.map((record) => <EvidenceRecord key={record.id} record={record} />)}</section>
  </section>;
}

export function ExactProjectionProvenance({
  projection,
  scenarioSha256,
  atomId,
}: {
  projection: ReplayProjection;
  scenarioSha256: string;
  atomId: string;
}) {
  const hasExactAtomAccounting = projection.accountingArtifact !== null && projection.disposition !== "unavailable";

  return <details><summary>Exact provenance</summary><dl>
    <div><dt>Result SHA-256</dt><dd><code>{projection.resultSha256}</code></dd></div>
    {hasExactAtomAccounting ? <>
      <div><dt>Scenario SHA-256</dt><dd><code>{scenarioSha256}</code></dd></div>
      <div><dt>Atom id</dt><dd><code>{atomId}</code></dd></div>
    </> : null}
    {projection.accountingArtifact ? <>
      <div><dt>Accounting artifact id</dt><dd><code>{projection.accountingArtifact.id}</code></dd></div>
      <div><dt>Accounting SHA-256</dt><dd><code>{projection.accountingArtifact.sha256}</code></dd></div>
    </> : null}
    <div><dt>Adapter</dt><dd>{projection.adapterId}@{projection.adapterVersion}</dd></div>
  </dl></details>;
}

function shortSha(value: string): string { return `${value.slice(0, 12)}…`; }

function EvidenceRecord({ record }: { record: ReplayEvidenceRecord }) {
  const matchedSubjectSummary = summarizeSubjects(record.matchedSubjects);
  const subjectSummary = summarizeSubjects(record.subjects);
  return <details className="evidence-record"><summary>{record.id} · {record.reference?.status ?? "unavailable"}</summary>
    <p>{record.producerId} · {record.kind}</p>
    <dl className="evidence-reference"><div><dt>SHA-256</dt><dd><code>{record.sha256}</code></dd></div><div><dt>Path</dt><dd><code>{record.path}</code></dd></div></dl>
    <p>Generic observation / verdict interpretation: unavailable.</p>
    <h4>Explicit subjects matching this view</h4>
    <div className="evidence-subject-summary" aria-label="Matching subject summary">{matchedSubjectSummary.map((item) => <span key={item.key}><code>{item.type}</code><span className={`evidence-state ${item.state}`}>{item.state}</span><strong>{item.count}</strong></span>)}</div>
    <details><summary>Full exact matching subject details · {record.matchedSubjects.length}</summary>
      {record.matchedSubjects.map((subject, index) => <div key={index}><span className={`evidence-state ${subject.state}`}>{subject.state}</span><pre>{JSON.stringify(subject.subject, null, 2)}</pre><p>{subject.reason}</p></div>)}
    </details>
    <h4>All curator-authored subjects (independent assertions)</h4>
    <div className="evidence-subject-summary" aria-label="Curator-authored subject summary">{subjectSummary.map((item) => <span key={item.key}><code>{item.type}</code><span className={`evidence-state ${item.state}`}>{item.state}</span><strong>{item.count}</strong></span>)}</div>
    <details><summary>Full exact curator-authored subject JSON · {record.subjects.length}</summary>
      <pre>{JSON.stringify(record.subjects, null, 2)}</pre>
    </details>
    {record.reference?.reason ? <p>{record.reference.reason}</p> : null}
    {record.reference?.status === "verified" && record.reference.text !== null ? <details><summary>Digest-verified producer bytes · unclassified content</summary><pre>{record.reference.text}</pre></details> : <p>Text preview unavailable; byte availability is independent of subject correlation.</p>}
  </details>;
}

function summarizeSubjects(subjects: ReplayEvidenceRecord["subjects"]) {
  const counts = new Map<string, { key: string; type: string; state: string; count: number }>();
  for (const item of subjects) {
    const type = item.subject.type;
    const key = `${type}:${item.state}`;
    const current = counts.get(key);
    counts.set(key, { key, type, state: item.state, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((left, right) => left.type.localeCompare(right.type) || left.state.localeCompare(right.state));
}
