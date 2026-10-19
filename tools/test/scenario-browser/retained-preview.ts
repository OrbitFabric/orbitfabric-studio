import { mockIPC } from "@tauri-apps/api/mocks";
import r1ResultText from "../../../tests/fixtures/sp3-r1/cosmos/integration_result.json?raw";
import r1AccountingText from "../../../tests/fixtures/sp3-r1/cosmos/verification_projection/scenario_projection_accounting.json?raw";
import r1PlanText from "../../../tests/fixtures/sp3-r1/cosmos/verification_projection/verification_projection_plan.json?raw";
import r1ProcedureText from "../../../tests/fixtures/sp3-r1/cosmos/verification_projection/cosmos/verification.py?raw";
import r1SuiteText from "../../../tests/fixtures/sp3-r1/cosmos/verification_projection/cosmos/verification_suite.py?raw";
import r1EvidenceText from "../../../tests/fixtures/sp3-r1/evidence-set.json?raw";
import fprimeResultText from "../../../tests/fixtures/integrations/g2/fprime-original-result.json?raw";

// Browser-only inspection of the real App with retained, freshly exported Core
// reports. This substitutes IPC and file selection, not the product consumer path.
// Synthetic cases are derived in memory, receive new exact identities and remain
// visibly labelled. The production entrypoint never imports this file.
const acceptanceBaseUrl = import.meta.env.BASE_URL;
const reports = await fetch(`${acceptanceBaseUrl}.sp2-acceptance/reports.json`).then(response => {
  if (!response.ok) throw new Error("Generate .sp2-acceptance/reports.json before browser acceptance");
  return response.json();
});

const caseIds = [
  "nominal", "multiple-paths", "stale-subject", "unresolved-subject",
  "missing-content", "digest-mismatch", "unsupported-accounting",
  "ambiguous-accounting", "dual-results", "observed-pass", "late-completion",
] as const;
type AcceptanceCaseId = typeof caseIds[number];
type ReferenceStatus = "verified" | "missing" | "digest_mismatch" | "failure" | "unavailable";
type ReferenceObservation = { status: ReferenceStatus; path: string | null; sha256: string | null; text: string | null; reason: string | null };
type ResultFixture = { path: string; text: string; artifactTexts: Map<string, string>; useAcceptanceGatewayChecks?: boolean };
type EvidenceFixture = { path: string; text: string; references: Map<string, string>; overrides: Map<string, ReferenceObservation> };
type DeferredBundle = { promise: Promise<unknown>; release: () => void };
type LateCompletionFixture = { oldPath: string; currentPath: string; selectionQueue: string[]; oldPreview: DeferredBundle | null };
type AcceptanceFixture = {
  id: AcceptanceCaseId;
  label: string;
  synthetic: boolean;
  resultSelections: string[];
  results: Map<string, ResultFixture>;
  evidence: EvidenceFixture;
  late?: LateCompletionFixture;
};

const params = new URLSearchParams(location.search);
const scenarioCase = params.get("scenario");
const evidenceCase = params.get("evidence") === "r1";
const requestedCase = params.get("case") ?? "nominal";
const acceptanceCaseId: AcceptanceCaseId = caseIds.includes(requestedCase as AcceptanceCaseId) ? requestedCase as AcceptanceCaseId : "nominal";
const fixture = await buildAcceptanceFixture(acceptanceCaseId);
let resultSelection = 0;

const sourceCommit = await readSourceCommit();
if (sourceCommit) {
  const identity = document.createElement("aside");
  identity.id = "sp3-acceptance-source";
  identity.setAttribute("role", "note");
  identity.style.cssText = "box-sizing:border-box;width:100%;padding:8px 16px;background:#111827;color:#f9fafb;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere";
  identity.textContent = `SP3 acceptance preview · ${sourceCommit.repository} · PR #${sourceCommit.pullRequest} · ${sourceCommit.commitSha}`;
  document.body.prepend(identity);
}
if (evidenceCase) addAcceptanceCaseBanner(fixture);

mockIPC((command, args: any) => {
  // Browser-only observation: use the executable that produced these reports.
  // This is not native executable-resolution acceptance.
  if (command === "resolve_core_executable") return {
    configuredExecutable: args.configuredExecutable,
    resolvedExecutable: reports.invocations.run_core_version.executable,
  };
  if (command === "plugin:dialog|open") {
    if (args.options.directory) return reports.missionPath;
    if (evidenceCase && args.options.title === "Load exact Integration Result") {
      const queued = fixture.late?.selectionQueue.shift();
      if (queued) return queued;
      const selected = fixture.resultSelections[Math.min(resultSelection, fixture.resultSelections.length - 1)];
      resultSelection += 1;
      return selected;
    }
    if (evidenceCase && args.options.title === "Load retained Evidence Set") return fixture.evidence.path;
    return reports.scenarioPath;
  }
  if (command === "resolve_mission_source") return { selectedPath: reports.missionPath, missionDir: reports.missionPath };
  if (command === "clear_core_request_temp") return null;
  if (command === "run_core_export_scenario_declaration" && scenarioCase === "failed") {
    if (!reports.failedScenarioInvocation) throw new Error("Regenerate reports with the failed Scenario fixture");
    return reports.failedScenarioInvocation;
  }
  if (Object.hasOwn(reports.invocations, command)) return reports.invocations[command];
  if (evidenceCase && command === "read_integration_result_bundle") {
    const selected = fixture.results.get(args.path);
    if (!selected) throw new Error(`Unexpected Result identity: ${args.path}`);
    const bundle = resultBundle(selected);
    if (fixture.late && args.path === fixture.late.oldPath && fixture.late.oldPreview === null) {
      fixture.late.oldPreview = deferredBundle(bundle);
      updateLateStatus("Old preview is pending. Load or retain the newer state, then release it.");
      return fixture.late.oldPreview.promise;
    }
    return bundle;
  }
  if (evidenceCase && command === "read_integration_text_file" && args.path === fixture.evidence.path) {
    return { path: fixture.evidence.path, text: fixture.evidence.text };
  }
  if (evidenceCase && command === "read_retained_reference") return retainedReference(args);
  throw new Error(`Outside browser Scenario acceptance scope: ${command}`);
});
await import("../../../src/main");
if (fixture.late) addLateCompletionControls(fixture.late);

async function buildAcceptanceFixture(id: AcceptanceCaseId): Promise<AcceptanceFixture> {
  const cosmosPath = "/retained/sp3-r1/cosmos/integration_result.json";
  const fprimePath = "/retained/sp3-acceptance/fprime/integration_result.json";
  const evidencePath = "/retained/sp3-r1/evidence-set.json";
  const baseArtifacts = new Map([
    ["verification_projection/scenario_projection_accounting.json", r1AccountingText],
    ["verification_projection/verification_projection_plan.json", r1PlanText],
    ["verification_projection/cosmos/verification.py", r1ProcedureText],
    ["verification_projection/cosmos/verification_suite.py", r1SuiteText],
  ]);
  let cosmosText = r1ResultText;
  let accountingText = r1AccountingText;
  let evidenceText = r1EvidenceText;
  let resultSelections = [cosmosPath];
  let synthetic = id !== "nominal" && id !== "dual-results" && id !== "observed-pass";
  const results = new Map<string, ResultFixture>();
  const overrides = new Map<string, ReferenceObservation>();
  let label = "Retained real R1 nominal slice";

  if (id === "multiple-paths") {
    label = "Synthetic: producer-declared multiple downstream targets";
    const result = cloneJson<any>(JSON.parse(cosmosText));
    const mapping = result.mappings.find((candidate: any) => candidate.id === "mapping.op-0002");
    mapping.targets.push({ namespace: "acceptance.synthetic", kind: "opaque", id: "secondary-explicit-path" });
    cosmosText = jsonText(result);
  } else if (id === "stale-subject") {
    label = "Synthetic: independent current and stale curator subjects";
    const evidence = cloneJson<any>(JSON.parse(evidenceText));
    evidence.records[1].subjects.push({ type: "scenario_source", scenario_id: "payload_stop_acquisition_verification", scenario_sha256: "0".repeat(64) });
    evidenceText = jsonText(evidence);
  } else if (id === "unresolved-subject") {
    label = "Synthetic: independent current and unresolved curator subjects";
    const evidence = cloneJson<any>(JSON.parse(evidenceText));
    evidence.records[1].subjects.push({ type: "integration_result", result_sha256: "f".repeat(64) });
    evidenceText = jsonText(evidence);
  } else if (id === "missing-content") {
    label = "Synthetic gateway observation: one retained record is missing";
    overrides.set("cosmos/integration_result.json", { status: "missing", path: null, sha256: null, text: null, reason: "Acceptance fixture reports retained content missing." });
  } else if (id === "digest-mismatch") {
    label = "Synthetic gateway observation: one retained record has a digest mismatch";
    overrides.set("cosmos/integration_result.json", { status: "digest_mismatch", path: null, sha256: "d".repeat(64), text: null, reason: "Acceptance fixture reports retained content digest mismatch." });
  } else if (id === "unsupported-accounting") {
    label = "Synthetic: digest-verified unsupported accounting version";
    accountingText = jsonText({ kind: "orbitfabric.scenario_projection_accounting", accounting_version: "future-acceptance-only", future_content: { opaque: true } });
    const result = cloneJson<any>(JSON.parse(cosmosText));
    const artifact = result.artifacts.find((candidate: any) => candidate.id === "scenario.accounting");
    artifact.sha256 = await sha256(accountingText);
    cosmosText = jsonText(result);
    baseArtifacts.set(artifact.path, accountingText);
  } else if (id === "ambiguous-accounting") {
    label = "Synthetic: two explicit Result-owned accounting identities";
    const result = cloneJson<any>(JSON.parse(cosmosText));
    const artifact = result.artifacts.find((candidate: any) => candidate.id === "scenario.accounting");
    const duplicate = { ...artifact, id: "scenario.accounting.duplicate", path: "verification_projection/scenario_projection_accounting-duplicate.json" };
    result.artifacts.push(duplicate);
    baseArtifacts.set(duplicate.path, accountingText);
    cosmosText = jsonText(result);
  } else if (id === "dual-results") {
    label = "Retained: independent COSMOS and Scenario-free F Prime Results";
    resultSelections = [cosmosPath, fprimePath];
    synthetic = false;
  } else if (id === "observed-pass") {
    label = "Retained: existing F Prime producer evidence status passed";
    resultSelections = [fprimePath];
    synthetic = false;
  } else if (id === "late-completion") {
    label = "Synthetic interaction probe: stale request and generation completions";
  }

  const cosmosSha = await sha256(cosmosText);
  const accountingSha = await sha256(accountingText);
  if (cosmosText !== r1ResultText || accountingText !== r1AccountingText) evidenceText = rebindEvidence(evidenceText, cosmosSha, accountingSha);
  const evidenceReferences = new Map([
    ["cosmos/integration_result.json", cosmosText],
    ["cosmos/verification_projection/scenario_projection_accounting.json", accountingText],
  ]);
  results.set(cosmosPath, { path: cosmosPath, text: cosmosText, artifactTexts: baseArtifacts });
  if (id === "dual-results" || id === "observed-pass") {
    results.set(fprimePath, { path: fprimePath, text: fprimeResultText, artifactTexts: new Map(), useAcceptanceGatewayChecks: true });
  }

  let late: LateCompletionFixture | undefined;
  if (id === "late-completion") {
    const oldPath = "/retained/sp3-acceptance/late/old-result.json";
    const currentPath = "/retained/sp3-acceptance/late/current-result.json";
    const oldResult = cloneJson<any>(JSON.parse(r1ResultText));
    const currentResult = cloneJson<any>(JSON.parse(r1ResultText));
    const existingStatement = cloneJson<any>(JSON.parse(fprimeResultText).evidence[0]);
    existingStatement.producer = "orbitfabric-openc3-cosmos";
    oldResult.evidence = [{ ...existingStatement, id: "acceptance-old-request" }];
    currentResult.evidence = [{ ...existingStatement, id: "acceptance-current-request" }];
    results.set(oldPath, { path: oldPath, text: jsonText(oldResult), artifactTexts: baseArtifacts });
    results.set(currentPath, { path: currentPath, text: jsonText(currentResult), artifactTexts: baseArtifacts });
    late = { oldPath, currentPath, selectionQueue: [], oldPreview: null };
    resultSelections = [currentPath];
  }
  return { id, label, synthetic, resultSelections, results, evidence: { path: evidencePath, text: evidenceText, references: evidenceReferences, overrides }, late };
}

function rebindEvidence(text: string, resultSha: string, accountingSha: string): string {
  const evidence = cloneJson<any>(JSON.parse(text));
  const oldResultSha = evidence.records[0].content.reference.sha256;
  const oldAccountingSha = evidence.records[1].content.reference.sha256;
  for (const record of evidence.records) {
    if (record.content.reference.sha256 === oldResultSha) record.content.reference.sha256 = resultSha;
    if (record.content.reference.sha256 === oldAccountingSha) record.content.reference.sha256 = accountingSha;
    for (const subject of record.subjects) if (subject.result_sha256 === oldResultSha) subject.result_sha256 = resultSha;
  }
  return jsonText(evidence);
}

function resultBundle(resultFixture: ResultFixture) {
  const result = JSON.parse(resultFixture.text);
  return Promise.all(result.artifacts.map(async (artifact: any) => {
    if (resultFixture.useAcceptanceGatewayChecks) return { artifactId: artifact.id, path: `${resultFixture.path.slice(0, resultFixture.path.lastIndexOf("/") + 1)}${artifact.path}`, contained: true, exists: true, sha256Matches: true };
    const text = resultFixture.artifactTexts.get(artifact.path);
    return {
      artifactId: artifact.id,
      path: `${resultFixture.path.slice(0, resultFixture.path.lastIndexOf("/") + 1)}${artifact.path}`,
      contained: text !== undefined,
      exists: text !== undefined,
      sha256Matches: text !== undefined && await sha256(text) === artifact.sha256,
    };
  })).then(artifactChecks => ({ resultPath: resultFixture.path, resultText: resultFixture.text, artifactChecks }));
}

async function retainedReference(args: any): Promise<ReferenceObservation> {
  const result = fixture.results.get(args.parentPath);
  const evidence = args.parentPath === fixture.evidence.path ? fixture.evidence : null;
  const parentText = result?.text ?? evidence?.text ?? null;
  if (parentText === null) throw new Error("Unexpected retained parent identity");
  const parentSha = await sha256(parentText);
  if (parentSha !== args.parentSha256) return { status: "failure", path: null, sha256: null, text: null, reason: "Parent digest mismatch" };
  const override = evidence?.overrides.get(args.relativePath);
  if (override) return override;
  const text = result?.artifactTexts.get(args.relativePath) ?? evidence?.references.get(args.relativePath);
  if (text === undefined) return { status: "missing", path: null, sha256: null, text: null, reason: "Missing browser fixture" };
  const actualSha = await sha256(text);
  if (actualSha !== args.expectedSha256) return { status: "digest_mismatch", path: null, sha256: actualSha, text: null, reason: "Fixture digest mismatch" };
  return { status: "verified", path: `${args.parentPath.slice(0, args.parentPath.lastIndexOf("/") + 1)}${args.relativePath}`, sha256: actualSha, text, reason: null };
}

function addAcceptanceCaseBanner(value: AcceptanceFixture): void {
  const banner = document.createElement("aside");
  banner.id = "sp3-acceptance-case";
  banner.setAttribute("role", "note");
  banner.style.cssText = "box-sizing:border-box;width:100%;padding:7px 16px;background:#172033;color:#dbeafe;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere";
  banner.textContent = `Acceptance case: ${value.id} · ${value.synthetic ? "SYNTHETIC IN-MEMORY" : "RETAINED BYTES"} · ${value.label}`;
  const source = document.getElementById("sp3-acceptance-source");
  source?.insertAdjacentElement("afterend", banner) ?? document.body.prepend(banner);
}

function addLateCompletionControls(late: LateCompletionFixture): void {
  const controls = document.createElement("aside");
  controls.id = "sp3-late-completion-controls";
  controls.setAttribute("aria-label", "SP3 acceptance-only late completion controls");
  controls.style.cssText = "box-sizing:border-box;width:100%;padding:8px 16px;background:#312e1f;color:#fef3c7;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;display:flex;gap:8px;align-items:center;flex-wrap:wrap";
  controls.innerHTML = `<strong>Acceptance-only controls</strong><button type="button" data-probe="request">Start request-token probe</button><button type="button" data-probe="generation">Start generation probe</button><button type="button" data-probe="release" disabled>Release old completion</button><span id="sp3-late-status">Open the Mission and Scenario before starting a probe.</span>`;
  document.getElementById("sp3-acceptance-case")?.insertAdjacentElement("afterend", controls);
  controls.querySelector<HTMLButtonElement>("[data-probe=request]")?.addEventListener("click", () => {
    resetLate(late);
    late.selectionQueue.push(late.oldPath, late.currentPath);
    const productButton = findProductButton("Load Integration Result");
    productButton.click();
    setTimeout(() => {
      const supersedingButton = findReplayResultButton();
      supersedingButton.disabled = false;
      supersedingButton.click();
      updateLateStatus("The second same-generation selection is current; release the held old preview after its Result appears.");
    }, 0);
    updateLateStatus("Starting two same-generation selections while the old preview is held.");
  });
  controls.querySelector<HTMLButtonElement>("[data-probe=generation]")?.addEventListener("click", () => {
    resetLate(late);
    late.selectionQueue.push(late.oldPath);
    findProductButton("Load Integration Result").click();
    updateLateStatus("Old preview held. Open the Mission again, then release after the replacement Mission is visible.");
  });
  controls.querySelector<HTMLButtonElement>("[data-probe=release]")?.addEventListener("click", () => {
    late.oldPreview?.release();
    updateLateStatus("Old completion released. It must not replace the current request or Mission generation.");
  });
}

function resetLate(late: LateCompletionFixture): void {
  late.selectionQueue.length = 0;
  late.oldPreview = null;
  const release = document.querySelector<HTMLButtonElement>("[data-probe=release]");
  if (release) release.disabled = true;
}

function deferredBundle(value: unknown): DeferredBundle {
  let release!: () => void;
  const promise = new Promise(resolve => { release = () => resolve(value); });
  const releaseButton = document.querySelector<HTMLButtonElement>("[data-probe=release]");
  if (releaseButton) releaseButton.disabled = false;
  return { promise, release };
}

function findProductButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(candidate => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Open the Evidence workspace before using the acceptance control: ${label}`);
  return button;
}

function findReplayResultButton(): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(candidate => /(?:Load Integration Result|Reading Result…)/.test(candidate.textContent?.trim() ?? ""));
  if (!button) throw new Error("Open the Evidence workspace before using the request-token probe.");
  return button;
}

function updateLateStatus(message: string): void {
  const status = document.getElementById("sp3-late-status");
  if (status) status.textContent = message;
}

function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function jsonText(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

async function readSourceCommit(): Promise<{ repository: string; pullRequest: number; commitSha: string } | null> {
  try {
    const response = await fetch(`${acceptanceBaseUrl}source-commit.json`);
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return null;
    const value = await response.json();
    if (typeof value?.repository !== "string" || typeof value?.pull_request !== "number" || !/^[0-9a-f]{40}$/.test(value?.commit_sha)) throw new Error("Invalid SP3 acceptance source identity");
    return { repository: value.repository, pullRequest: value.pull_request, commitSha: value.commit_sha };
  } catch (error) {
    if (acceptanceBaseUrl !== "/") throw error;
    return null;
  }
}
