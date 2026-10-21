import { readLocalReference } from '../experience/sourceRequests';
import { FamilyLabel } from "../presentation/FamilyLabel";
import type { DisplayFamily } from "../presentation/familyMarkers";
import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import { TauriCoreGateway } from "../../core/TauriCoreGateway";
import { requireCoreDomain } from "../../core/coreCompatibility";
import type { MissionSession } from "../../mission/MissionSession";
import type { EntityRef } from "../../mission/entityRef";
import { createBundledIntegrationPluginRegistry } from "../../integrations/bundled-plugin-registry";
import { evaluateIntegrationCompatibility, parseCoreIntegrationInputManifest } from "../../integrations/compatibility";
import type {
  CoreIntegrationInputSet,
  IntegrationBundleRead,
  IntegrationCompatibility,
  IntegrationExecutionAssessment,
  IntegrationExecutionAuthorization,
  IntegrationPackageDescriptor,
  IntegrationProfileDocument,
  IntegrationProfileValidation,
  IntegrationResult,
} from "../../integrations/contracts";
import {
  createExecutionAuthorization,
  executeIntegrationAdapter,
} from "../../integrations/execution";
import type { IntegrationPluginContext } from "../../integrations/plugin-api";
import type { IntegrationPluginRegistry } from "../../integrations/plugin-registry";
import { TauriIntegrationGateway } from "../../integrations/TauriIntegrationGateway";
import { parseIntegrationPackageManifest } from "../../integrations/manifest";
import {
  parseProjectionProfile,
  selectProfileSchema,
  validateProjectionProfile,
} from "../../integrations/profile";
import { parseIntegrationResult, validateIntegrationResult } from "../../integrations/result";
import { sha256Utf8 } from "../../integrations/sha256";
import { assessIntegrationFreshness } from "../../integrations/staleness";
import { IntegrationTargetInspectorHost } from "./IntegrationTargetInspectorHost";
import { AdapterLifecyclePanel } from "./AdapterLifecyclePanel";
import type { AdapterLifecycleReadModel } from "../../convergence/adapterLifecycleReadModel";

const REGISTERED_PACKAGES_KEY = "orbitfabric-studio.integration-packages";
const PROFILE_ASSOCIATIONS_KEY = "orbitfabric-studio.integration-profiles";
const RESULT_ASSOCIATIONS_KEY = "orbitfabric-studio.integration-results";
const OUTPUT_ASSOCIATIONS_KEY = "orbitfabric-studio.integration-output-dirs";

interface PackageEntry {
  manifestPath: string;
  descriptor: IntegrationPackageDescriptor | null;
  error: string | null;
  health: "available" | "unavailable" | "invalid content";
}

interface ProfileState {
  document: IntegrationProfileDocument;
  validation: IntegrationProfileValidation;
}

interface ResultState {
  result: IntegrationResult;
  bundle: IntegrationBundleRead;
  assessment: IntegrationExecutionAssessment | null;
}

export function IntegrationsWorkspace({
  session,
  lifecycle,
  lifecycleDisabled,
  selectedEntity,
  onRefreshLifecycle,
  onCheckProjectLock,
  onSelectCatalogRelease,
  onInspectEntity,
  onOpenResult,
}: {
  onOpenResult: (path:string)=>void;
  session: MissionSession;
  lifecycle: AdapterLifecycleReadModel;
  lifecycleDisabled: boolean;
  selectedEntity: EntityRef | null;
  onRefreshLifecycle: () => Promise<void>;
  onCheckProjectLock: (path: string) => Promise<void>;
  onSelectCatalogRelease: (
    catalogPath: string,
    sourceCoordinate: string,
    releaseVersion: string,
  ) => Promise<void>;
  onInspectEntity: (subject: EntityRef) => void;
}) {
  const integrationGateway = useMemo(() => new TauriIntegrationGateway(), []);
  const coreGateway = useMemo(() => new TauriCoreGateway(), []);
  const pluginRegistry = useMemo(() => createBundledIntegrationPluginRegistry(), []);
  const [entries, setEntries] = useState<PackageEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [inputSet, setInputSet] = useState<CoreIntegrationInputSet | null>(null);
  const [inputManifestPath, setInputManifestPath] = useState<string | null>(null);
  const [compatibility, setCompatibility] = useState<IntegrationCompatibility | null>(null);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [authorization, setAuthorization] = useState<IntegrationExecutionAuthorization | null>(null);
  const [operationId, setOperationId] = useState<string>("");
  const [outputDir, setOutputDir] = useState<string>("");
  const [resultState, setResultState] = useState<ResultState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = entries.find((entry) => entry.manifestPath === selectedPath) ?? null;
  const descriptor = selected?.descriptor ?? null;

  useEffect(() => {
    let cancelled = false;
    async function loadRegistry() {
      const paths = readStringList(REGISTERED_PACKAGES_KEY);
      const loaded = await Promise.all(paths.map((path) => loadPackageEntry(integrationGateway, path)));
      if (!cancelled) {
        setEntries(loaded);
        setSelectedPath((current) => current && paths.includes(current) ? current : null);
      }
    }
    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, [integrationGateway]);

  useEffect(() => {
    setInputSet(null);
    setInputManifestPath(null);
    setCompatibility(null);
    setAuthorization(null);
  }, [session.sessionId]);

  useEffect(() => {
    setAuthorization(null);
    setInputSet(null);
    setInputManifestPath(null);
    setCompatibility(null);
    setProfile(null);
    setResultState(null);
    if (!descriptor) {
      setOperationId("");
      setOutputDir("");
      return;
    }
    setOperationId(descriptor.operations[0]?.id ?? "");
    setOutputDir(readAssociation(OUTPUT_ASSOCIATIONS_KEY, descriptor.integrationId) ?? "");
    void loadAssociatedProfile(descriptor);
    void loadAssociatedResult(descriptor);
    // Descriptor identity is the state-reset boundary; package loading is explicit and finite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, descriptor?.adapterId, descriptor?.adapterVersion]);

  async function loadAssociatedProfile(packageDescriptor: IntegrationPackageDescriptor) {
    const path = readAssociation(PROFILE_ASSOCIATIONS_KEY, packageDescriptor.integrationId);
    if (!path) {
      return;
    }
    try {
      setProfile(await readAndValidateProfile(packageDescriptor, path));
    } catch (loadError) {
      setError(`Associated Profile could not be loaded: ${errorMessage(loadError)}`);
    }
  }

  async function loadAssociatedResult(packageDescriptor: IntegrationPackageDescriptor) {
    const path = readAssociation(RESULT_ASSOCIATIONS_KEY, packageDescriptor.integrationId);
    if (!path) {
      return;
    }
    try {
      const bundle = await integrationGateway.readResultBundle(path);
      const result = parseIntegrationResult(bundle.resultText);
      const validation = validateIntegrationResult(result, bundle);
      if (!validation.usable) {
        throw new Error(validation.issues.map((item) => item.message).join("\n"));
      }
      setResultState({ result, bundle, assessment: null });
    } catch (loadError) {
      setError(`Last Integration Result could not be loaded: ${errorMessage(loadError)}`);
    }
  }

  async function registerPackage() {
    const path = await open({
      multiple: false,
      directory: false,
      title: "Register Integration Package",
      filters: [{ name: "Integration Package", extensions: ["json"] }],
    });
    if (typeof path !== "string") {
      return;
    }
    setBusy("package");
    setError(null);
    try {
      const entry = await loadPackageEntry(integrationGateway, path);
      setEntries((current) => {
        const next = [...current.filter((item) => item.manifestPath !== entry.manifestPath), entry]
          .sort((a, b) => a.manifestPath.localeCompare(b.manifestPath));
        writeStringList(REGISTERED_PACKAGES_KEY, next.map((item) => item.manifestPath));
        return next;
      });
      setSelectedPath(entry.manifestPath);
    } finally {
      setBusy(null);
    }
  }

  function unregisterSelected() {
    if (!selectedPath) {
      return;
    }
    setEntries((current) => {
      const next = current.filter((item) => item.manifestPath !== selectedPath);
      writeStringList(REGISTERED_PACKAGES_KEY, next.map((item) => item.manifestPath));
      setSelectedPath(next[0]?.manifestPath ?? null);
      return next;
    });
  }

  async function prepareCoreInput() {
    if (!descriptor) {
      return;
    }
    setBusy("input");
    setError(null);
    try {
      requireCoreDomain(session.core.compatibility, "integrations");
      const requestId = createRequestId("integration-input");
      const exported = await coreGateway.exportIntegrationInputSet(
        session.core.resolvedExecutable,
        session.source,
        requestId,
      );
      const parsed = parseCoreIntegrationInputManifest(exported.manifestText);
      setInputSet(parsed);
      setInputManifestPath(exported.manifestPath);
      setCompatibility(evaluateIntegrationCompatibility(descriptor, parsed));
    } catch (prepareError) {
      setError(`Core Integration Input Set could not be prepared: ${errorMessage(prepareError)}`);
      setInputSet(null);
      setInputManifestPath(null);
      setCompatibility(null);
    } finally {
      setBusy(null);
    }
  }

  async function chooseProfile() {
    if (!descriptor) {
      return;
    }
    const path = await open({
      multiple: false,
      directory: false,
      title: "Associate Projection Profile",
      filters: [{ name: "Projection Profile", extensions: ["yaml", "yml"] }],
    });
    if (typeof path !== "string") {
      return;
    }
    setBusy("profile");
    setError(null);
    try {
      const loaded = await readAndValidateProfile(descriptor, path);
      setProfile(loaded);
      writeAssociation(PROFILE_ASSOCIATIONS_KEY, descriptor.integrationId, loaded.document.path);
    } catch (profileError) {
      setProfile(null);
      setError(`Projection Profile could not be associated: ${errorMessage(profileError)}`);
    } finally {
      setBusy(null);
    }
  }

  async function chooseOutputDirectory() {
    if (!descriptor) {
      return;
    }
    const path = await open({
      multiple: false,
      directory: true,
      title: "Choose Integration Output Directory",
    });
    if (typeof path !== "string") {
      return;
    }
    setOutputDir(path);
    writeAssociation(OUTPUT_ASSOCIATIONS_KEY, descriptor.integrationId, path);
  }

  function authorizeExecution() {
    if (!descriptor) {
      return;
    }
    setAuthorization(createExecutionAuthorization(descriptor));
  }

  async function runOperation() {
    if (!descriptor || !authorization || !inputManifestPath || !profile || !outputDir || !operationId) {
      return;
    }
    setBusy("execution");
    setError(null);
    try {
      const execution = await executeIntegrationAdapter(
        integrationGateway,
        descriptor,
        authorization,
        {
          operation: operationId,
          inputSetManifestPath: inputManifestPath,
          profilePath: profile.document.path,
          outputDir,
        },
      );
      if (!execution.assessment.result) {
        setResultState(null);
        setError(
          execution.assessment.issues.length > 0
            ? execution.assessment.issues.map((item) => item.message).join("\n")
            : "Integration adapter did not produce a Result.",
        );
        return;
      }
      const bundle = await integrationGateway.readResultBundle(execution.invocation.resultPath);
      setResultState({
        result: execution.assessment.result,
        bundle,
        assessment: execution.assessment,
      });
      writeAssociation(
        RESULT_ASSOCIATIONS_KEY,
        descriptor.integrationId,
        execution.invocation.resultPath,
      );
      if (!execution.assessment.valid) {
        setError(execution.assessment.issues.map((item) => item.message).join("\n"));
      }
    } catch (runError) {
      setError(`Integration operation could not be executed: ${errorMessage(runError)}`);
    } finally {
      setBusy(null);
    }
  }

  async function readAndValidateProfile(
    packageDescriptor: IntegrationPackageDescriptor,
    path: string,
  ): Promise<ProfileState> {
    const read = await integrationGateway.readTextFile(path);
    const sha256 = await sha256Utf8(read.text);
    const document = parseProjectionProfile(read.path, sha256, read.text);
    const schema = selectProfileSchema(packageDescriptor, document.identity.schemaVersion);
    const schemaRead = await integrationGateway.readPackageProfileSchema(
      packageDescriptor.manifestPath,
      schema.path,
      schema.sha256,
    );
    const validation = validateProjectionProfile(packageDescriptor, schemaRead, document);
    return { document, validation };
  }

  const result = resultState?.result ?? null;
  const freshness = assessIntegrationFreshness(result, inputSet, profile?.document ?? null);
  const pluginContext: IntegrationPluginContext | null = descriptor && result
    ? {
        integration: {
          id: descriptor.integrationId,
          result,
        },
        actions: {
          async openCoreEntity(ref) {
            onInspectEntity(ref);
          },
          async revealResultArtifact(artifactId) {
            const element = document.getElementById(artifactElementId(artifactId));
            if (!element) {
              throw new Error(`Result artifact ${artifactId} is not currently rendered.`);
            }
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.focus({ preventScroll: true });
          },
        },
      }
    : null;
  const canRun = Boolean(
    descriptor &&
      authorization &&
      inputManifestPath &&
      compatibility?.state === "compatible" &&
      profile?.validation.valid &&
      operationId &&
      outputDir &&
      busy === null,
  );

  return (
    <div className="integrations-workspace">
      <section className="integrations-heading">
        <div>
          <span className="section-kicker">Mission integration</span>
          <h1>Integrations</h1>
          <p>
            Read installed, desired and Catalog facts below. Local registrations are separate remembered references, not Mission-owned installations.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={registerPackage} disabled={busy !== null}>
          {busy === "package" ? "Registering…" : "Register package"}
        </button>
      </section>

      {error ? <pre className="integration-error" role="alert">{error}</pre> : null}

      <AdapterLifecyclePanel
        model={lifecycle}
        disabled={lifecycleDisabled}
        onRefresh={onRefreshLifecycle}
        onCheckProjectLock={onCheckProjectLock}
        onSelectCatalogRelease={onSelectCatalogRelease}
      />

      <section className="integration-card">
        <CardTitle title="Locally registered references" status={selected?.health ?? "not selected"} />
        {entries.length === 0 ? (
          <p className="integration-empty">No Integration Package is registered for this Studio installation.</p>
        ) : (
          <>
            <div className="integration-row">
              <label>
                Local reference (select explicitly for this Mission session)
                <select value={selectedPath ?? ""} title={selectedPath ?? undefined} onChange={(event) => setSelectedPath(event.target.value)}>
                  <option value="">Choose a local reference</option>
                  {entries.map((entry) => (
                    <option key={entry.manifestPath} value={entry.manifestPath}>{entry.health} · {entry.manifestPath}</option>
                  ))}
                </select>
              </label>
              <button className="secondary-action" type="button" onClick={unregisterSelected}>Unregister</button>
            </div>
            <p className="integration-muted">Persistent-local origin. These paths are not automatically linked to this Mission. Unavailable means the file could not be read; invalid content means bytes were read and rejected by the manifest parser. No reference is deleted automatically.</p>
            {selected?.error ? <p className="integration-bad">{selected.error}</p> : null}
            {descriptor ? <PackageFacts descriptor={descriptor} /> : null}
          </>
        )}
      </section>

      {descriptor ? (
        <>
          <section className="integration-card">
            <CardTitle title="Core Input" status={compatibility?.state ?? "not prepared"} />
            <p className="integration-muted">
              Studio asks OrbitFabric Core to export one coherent Integration Input Set. It never reconstructs
              this contract from the mission YAML or from separately hydrated Studio reports.
            </p>
            <button className="secondary-action" type="button" onClick={prepareCoreInput} disabled={busy !== null}>
              {busy === "input" ? "Preparing…" : inputSet ? "Regenerate Core Input Set" : "Prepare Core Input Set"}
            </button>
            {inputSet ? <CoreInputFacts inputSet={inputSet} compatibility={compatibility} /> : null}
          </section>

          <section className="integration-card">
            <CardTitle
              title="Projection Profile"
              status={profile ? profile.validation.valid ? "schema valid" : "invalid" : "not associated"}
            />
            <div className="integration-row">
              <button className="secondary-action" type="button" onClick={chooseProfile} disabled={busy !== null}>
                {busy === "profile" ? "Reading…" : profile ? "Change Profile" : "Associate Profile"}
              </button>
              {profile ? <code className="integration-path" title={profile.document.path}>{profile.document.path}</code> : null}
            </div>
            {profile ? <ProfileFacts profile={profile} /> : null}
          </section>

          <section className="integration-card">
            <CardTitle title="Execution" status={authorization ? "authorized" : "not authorized"} />
            <div className="integration-grid two-columns">
              <label>
                Advertised operation
                <select value={operationId} onChange={(event) => setOperationId(event.target.value)}>
                  {descriptor.operations.map((operation) => (
                    <option key={operation.id} value={operation.id}>{operation.id}</option>
                  ))}
                </select>
              </label>
              <label>
                Output root
                <div className="integration-row compact">
                  <input readOnly value={outputDir} title={outputDir || undefined} placeholder="Choose an explicit output directory" />
                  <button className="secondary-action" type="button" onClick={chooseOutputDirectory}>Choose</button>
                </div>
              </label>
            </div>
            <div className="execution-trust">
              <div>
                <strong>Executable declaration</strong>
                <code>{descriptor.execution.argvPrefix.join(" ")}</code>
                <small>Registration does not authorize this executable.</small>
              </div>
              <button
                className={authorization ? "secondary-action" : "primary-action"}
                type="button"
                onClick={authorizeExecution}
              >
                {authorization ? "Execution authorized" : "Authorize adapter execution"}
              </button>
            </div>
            <div className="integration-run-row">
              <RunReadiness
                compatibility={compatibility}
                profile={profile}
                authorization={authorization}
                inputManifestPath={inputManifestPath}
                outputDir={outputDir}
              />
              <button className="primary-action" type="button" disabled={!canRun} onClick={runOperation}>
                {busy === "execution" ? "Running…" : `Run ${operationId || "operation"}`}
              </button>
            </div>
          </section>

          <section className="integration-card result-card">
            <CardTitle family="result" title="Last Result" status={result?.result ?? "none"} />
            {result ? (
              <>
                <button className="secondary-action" onClick={()=>onOpenResult(resultState!.bundle.resultPath)}>Open this retained Result in Evidence</button>
                <p className="integration-muted">Producer outcome is not Scenario execution or assessment. The exact retained bytes are revalidated on opening.</p>
                <div className="integration-grid result-summary">
                  <Fact label="Operation" value={result.operation.id} />
                  <Fact label="Result" value={result.result} />
                  <Fact label="Freshness" value={freshness.state} detail={freshness.reason} />
                  <Fact label="Result version" value={result.resultVersion} />
                </div>
                {resultState?.assessment && !resultState.assessment.valid ? (
                  <div className="integration-bad">Protocol / integrity issues are present for this run.</div>
                ) : null}
                <CapabilityComparison descriptor={descriptor} operationId={result.operation.id} result={result} />
                <Artifacts result={result} bundle={resultState!.bundle} />
                <Coverage result={result} />
                <Continuity
                  result={result}
                  selectedEntity={selectedEntity}
                  onInspectEntity={onInspectEntity}
                  pluginRegistry={pluginRegistry}
                  pluginContext={pluginContext}
                />
              </>
            ) : (
              <p className="integration-empty">No Integration Result has been loaded for this package.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function PackageFacts({ descriptor }: { descriptor: IntegrationPackageDescriptor }) {
  return (
    <div className="integration-grid">
      <Fact label="Integration" value={descriptor.integrationId} />
      <Fact label="Adapter" value={`${descriptor.adapterId} · ${descriptor.adapterVersion}`} />
      <Fact label="Protocol" value={descriptor.execution.protocol} />
      <Fact label="Manifest" value={descriptor.manifestVersion} />
      <Fact label="Package capabilities" value={descriptor.advertisedCapabilities.join(", ") || "none"} />
      <Fact label="Operations" value={descriptor.operations.map((item) => item.id).join(", ") || "none"} />
    </div>
  );
}

function CoreInputFacts({
  inputSet,
  compatibility,
}: {
  inputSet: CoreIntegrationInputSet;
  compatibility: IntegrationCompatibility | null;
}) {
  return (
    <div className="integration-grid">
      <Fact label="Input Set" value={inputSet.inputSetVersion} />
      <Fact label="Load" value={inputSet.loadResult ?? "unknown"} />
      <Fact label="Lint" value={inputSet.lintResult ?? "unknown"} />
      <Fact label="Fingerprint" value={shortSha(inputSet.inputSetSha256)} />
      <Fact label="Compatibility" value={compatibility?.state ?? "unknown"} />
      <Fact label="Surfaces" value={`${inputSet.surfaces.filter((item) => item.status === "available").length}/${inputSet.surfaces.length} available`} />
      {compatibility?.reasons.map((reason) => (
        <div className="integration-reason" key={`${reason.code}-${reason.message}`}>
          <code>{reason.code}</code><span>{reason.message}</span>
        </div>
      ))}
    </div>
  );
}

function ProfileFacts({ profile }: { profile: ProfileState }) {
  return (
    <div className="integration-grid">
      <Fact label="Profile" value={`${profile.document.identity.id} · ${profile.document.identity.version}`} />
      <Fact label="Envelope" value={profile.document.identity.profileVersion} />
      <Fact label="Schema" value={profile.document.identity.schemaVersion} />
      <Fact label="Fingerprint" value={shortSha(profile.document.sha256)} />
      <Fact label="Validation" value={profile.validation.valid ? "valid" : "invalid"} />
      {!profile.validation.valid ? (
        <div className="integration-reason wide">
          {profile.validation.errors.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function RunReadiness({
  compatibility,
  profile,
  authorization,
  inputManifestPath,
  outputDir,
}: {
  compatibility: IntegrationCompatibility | null;
  profile: ProfileState | null;
  authorization: IntegrationExecutionAuthorization | null;
  inputManifestPath: string | null;
  outputDir: string;
}) {
  const gates = [
    ["Core compatible", compatibility?.state === "compatible"],
    ["Profile valid", profile?.validation.valid === true],
    ["Input manifest", Boolean(inputManifestPath)],
    ["Output root", Boolean(outputDir)],
    ["Execution authorized", Boolean(authorization)],
  ] as const;
  return (
    <div className="run-readiness">
      {gates.map(([label, ready]) => <span key={label} className={ready ? "is-ready" : "is-waiting"}>{label}</span>)}
    </div>
  );
}

function CapabilityComparison({
  descriptor,
  operationId,
  result,
}: {
  descriptor: IntegrationPackageDescriptor;
  operationId: string;
  result: IntegrationResult;
}) {
  const operation = descriptor.operations.find((item) => item.id === operationId);
  return (
    <section className="integration-subsection">
      <h2>Capabilities</h2>
      <div className="capability-columns">
        <CapabilityList label="Package advertised" values={descriptor.advertisedCapabilities} />
        <CapabilityList label="Operation advertised" values={operation?.capabilities ?? []} />
        <CapabilityList label="Result exercised" values={result.capabilities} />
      </div>
    </section>
  );
}

function CapabilityList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="capability-list">
      <strong>{label}</strong>
      {values.length ? values.map((value) => <code key={value}>{value}</code>) : <span>none</span>}
    </div>
  );
}

function Artifacts({ result, bundle }: { result: IntegrationResult; bundle: IntegrationBundleRead }) {
  const checks = new Map(bundle.artifactChecks.map((item) => [item.artifactId, item]));
  return (
    <section className="integration-subsection">
      <h2>Artifacts</h2>
      {result.artifacts.length === 0 ? <p className="integration-empty">No artifacts declared.</p> : (
        <div className="artifact-list">
          {result.artifacts.map((artifact) => {
            const check = checks.get(artifact.id);
            return (
              <article
                key={artifact.id}
                id={artifactElementId(artifact.id)}
                className="artifact-row"
                tabIndex={-1}
              >
                <div><strong>{artifact.id}</strong><code>{artifact.kind}</code></div>
                <span>{artifact.status}</span>
                <code>{artifact.path ?? "—"}</code>
                <span>{check?.sha256Matches === true ? "digest verified" : check?.sha256Matches === false ? "digest mismatch" : "digest n/a"}</span>
                <small>{artifact.derivedFromMappings.length ? `Mappings: ${artifact.derivedFromMappings.join(", ")}` : "No mapping references"}</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Coverage({ result }: { result: IntegrationResult }) {
  if (result.coverage.mode === "producer-owned-v1") {
    return (
      <section className="integration-subsection">
        <div className="subsection-heading">
          <h2>Producer Coverage</h2>
          <span className="status-pill">producer owned</span>
        </div>
        <p className="integration-muted">
          Generic coverage interpretation is unavailable for this Result version.
          The structured producer content is retained without conversion.
        </p>
        <pre className="integration-json">{result.coverage.sourceJson}</pre>
      </section>
    );
  }
  const states = new Map<string, number>();
  for (const record of result.coverage.records) {
    states.set(record.state, (states.get(record.state) ?? 0) + 1);
  }
  return (
    <section className="integration-subsection">
      <div className="subsection-heading">
        <h2>Projection Coverage</h2>
        <span className="status-pill">{result.coverage.status}</span>
      </div>
      <p className="integration-muted">
        Complete coverage means complete accounting of the declared scope; it does not mean that every entity was projected.
      </p>
      <div className="coverage-grid">
        {["projected", "partially_projected", "intentionally_not_projected", "not_projected", "unsupported", "blocked", "not_applicable"].map((state) => (
          <div key={state}><strong>{states.get(state) ?? 0}</strong><span>{state.replaceAll("_", " ")}</span></div>
        ))}
      </div>
    </section>
  );
}

function Continuity({
  result,
  selectedEntity,
  onInspectEntity,
  pluginRegistry,
  pluginContext,
}: {
  result: IntegrationResult;
  selectedEntity: EntityRef | null;
  onInspectEntity: (subject: EntityRef) => void;
  pluginRegistry: IntegrationPluginRegistry;
  pluginContext: IntegrationPluginContext | null;
}) {
  const mappings = selectedEntity
    ? result.mappings.filter((mapping) => mapping.sources.some((source) => sameRef(source, selectedEntity)))
    : result.mappings;
  return (
    <section className="integration-subsection">
      <div className="subsection-heading">
        <h2>Contract Continuity</h2>
        {selectedEntity ? <code>{selectedEntity.domain}/{selectedEntity.id}</code> : <span>All explicit mappings</span>}
      </div>
      {mappings.length === 0 ? <p className="integration-empty">No explicit Result mapping matches this context.</p> : (
        <div className="mapping-list">
          {mappings.map((mapping) => (
            <article key={mapping.id} className="mapping-row">
              <strong>{mapping.id}</strong>
              <div className="mapping-sides">
                <div>
                  <small>Core sources</small>
                  {mapping.sources.map((source) => (
                    <button key={`${source.domain}/${source.id}`} type="button" onClick={() => onInspectEntity(source)}>
                      {source.domain}/{source.id}
                    </button>
                  ))}
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <small>Target refs</small>
                  {mapping.targets.map((target) => (
                    pluginContext ? (
                      <IntegrationTargetInspectorHost
                        key={`${target.namespace}/${target.kind}/${target.id}`}
                        registry={pluginRegistry}
                        input={{ mapping, target }}
                        context={pluginContext}
                      />
                    ) : (
                      <code key={`${target.namespace}/${target.kind}/${target.id}`}>
                        {target.namespace} · {target.kind} · {target.id}
                      </code>
                    )
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CardTitle({ title, status, family = null }: { title: string; status: string; family?: DisplayFamily | null }) {
  return <div className="integration-card-title"><h2><FamilyLabel family={family}>{title}</FamilyLabel></h2><span className="status-pill">{status}</span></div>;
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="integration-fact"><small>{label}</small><strong>{value}</strong>{detail ? <span>{detail}</span> : null}</div>;
}

async function loadPackageEntry(
  gateway: TauriIntegrationGateway,
  path: string,
): Promise<PackageEntry> {
  return readLocalReference(path, path=>gateway.readPackageManifest(path), parseIntegrationPackageManifest);
}

function sameRef(left: EntityRef, right: EntityRef): boolean {
  return left.domain === right.domain && left.id === right.id;
}

function artifactElementId(artifactId: string): string {
  return `integration-artifact-${encodeURIComponent(artifactId)}`;
}

function shortSha(value: string | null): string {
  return value ? `${value.slice(0, 12)}…` : "unavailable";
}

function createRequestId(prefix: string): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

function readStringList(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStringList(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readAssociation(key: string, id: string): string | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const candidate = (value as Record<string, unknown>)[id];
    return typeof candidate === "string" ? candidate : null;
  } catch {
    return null;
  }
}

function writeAssociation(key: string, id: string, path: string) {
  let current: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      current = { ...(parsed as Record<string, unknown>) };
    }
  } catch {
    current = {};
  }
  current[id] = path;
  localStorage.setItem(key, JSON.stringify(current));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
