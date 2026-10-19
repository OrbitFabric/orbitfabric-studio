import { PresentationMemory } from "./features/experience/presentationMemory";
import { InvestigationPanel } from "./features/investigation/InvestigationPanel";
import { MissionModel } from "./features/experience/EngineeringGraph";
import { InspectorFrame } from "./features/experience/InspectorFrame";
import { InspectionContent } from "./features/experience/InspectionContent";
import { inspectionIdentity, type Inspection } from "./features/experience/inspection";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import {
  initialStudioState,
  studioReducer,
  type MissionOpenFailure,
  type MissionWorkspaceView,
} from "./app/studioState";
import { TauriCoreGateway } from "./core/TauriCoreGateway";
import {
  CORE_EXECUTABLE_STORAGE_KEY,
  CoreCompatibilityError,
  normalizeCoreExecutable,
} from "./core/coreCompatibility";
import { MissionAtlas } from "./features/atlas/MissionAtlas";
import { SurfaceCaptureButton } from "./features/capture/SurfaceCaptureButton";
import { EntityExplorer } from "./features/explorer/EntityExplorer";
import { IntegrationsWorkspace } from "./features/integrations/IntegrationsWorkspace";
import { CoreProvenance } from "./features/core/CoreProvenance";
import { MissionLauncher } from "./features/launcher/MissionLauncher";
import { OperationsWorkspace } from "./features/operations/OperationsWorkspace";
import { RelationsWorkspace } from "./features/relationships/RelationsWorkspace";
import { ValidationFindingsDrawer } from "./features/validation/ValidationFindingsDrawer";
import { EntityXRay } from "./features/xray/EntityXRay";
import { MissionHydrator, MissionStructuralInvalidError } from "./mission/MissionHydrator";
import { ScenarioHydrator } from "./convergence/ScenarioHydrator";
import { requestScenario } from "./convergence/requestScenario";
import { buildScenarioUnderstanding } from "./convergence/scenarioUnderstanding";
import { ScenarioWorkspace } from "./features/scenarios/ScenarioWorkspace";
import { buildEvidenceUnderstanding } from "./convergence/evidenceUnderstanding";
import { IntegrationResultHydrator, IntegrationResultConsistencyError, IntegrationResultProtocolError } from "./convergence/IntegrationResultHydrator";
import { TauriIntegrationGateway } from "./integrations/TauriIntegrationGateway";
import { parseSelectedIntegrationResult } from "./integrations/result";
import { EvidenceManifestHydrator, EvidenceManifestProtocolError } from "./convergence/EvidenceManifestHydrator";
import { TauriEvidenceGateway } from "./convergence/TauriEvidenceGateway";
import { sha256Utf8 } from "./integrations/sha256";
import { ReplayRequestGuard } from "./convergence/replayRequestGuard";
import { EvidenceReplayWorkspace } from "./features/evidence/EvidenceReplayWorkspace";
import {
  AdapterLifecycleConsistencyError,
  AdapterLifecycleHydrator,
  AdapterLifecycleProtocolError,
} from "./convergence/AdapterLifecycleHydrator";
import { TauriAdapterLifecycleGateway } from "./convergence/TauriAdapterLifecycleGateway";
import { buildAdapterLifecycleReadModel } from "./convergence/adapterLifecycleReadModel";
import type {
  CatalogLifecycleRequest,
  LifecycleHydrationFailure,
  LifecycleRequest,
  PackageBindingRequest,
  TargetedLifecycleRequest,
} from "./convergence/adapterLifecycleSlot";

const RECENT_MISSIONS_KEY = "orbitfabric-studio.recent-missions";
const MAX_RECENTS = 8;

function App() {
  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const [coreExecutable, setCoreExecutableState] = useState(() =>
    localStorage.getItem(CORE_EXECUTABLE_STORAGE_KEY) ?? "orbitfabric",
  );
  const [recentMissions, setRecentMissions] = useState<string[]>(loadRecentMissions);
  const [validationOpen, setValidationOpen] = useState(false);
  const generationRef = useRef(0);
  const workspacePrimaryRef = useRef<HTMLDivElement>(null);
  const [returnContext,setReturnContext] = useState<{view:MissionWorkspaceView;inspection:Inspection|null;top:number}|null>(null);
  const presentationMemory = useMemo(() => new Map<string,unknown>(), [state.activeSession?.sessionId,state.activeSession?.generation]);
  const membershipKey = `${state.activeSession?.sessionId}:${state.activeSession?.generation}`;
  const [inspectionState, setInspectionState] = useState<{membership:string;current: Inspection | null; history: Inspection[]}>({membership:membershipKey,current:null,history:[]});
  const inspection = inspectionState.membership === membershipKey ? inspectionState.current : null;
  const inspectionHistory = inspectionState.membership === membershipKey ? inspectionState.history : [];
  const setInspection = (current: Inspection | null) => setInspectionState(s => ({...s,current}));
  const setInspectionHistory = (history: Inspection[] | ((h:Inspection[])=>Inspection[])) => setInspectionState(s => ({...s,history:typeof history === 'function' ? history(s.history) : history}));
  function inspect(next: Inspection) {
    setInspectionState(s => ({membership:membershipKey,current:next,history:s.current && inspectionIdentity(s.current)!==inspectionIdentity(next) ? [...s.history,s.current].slice(-20) : s.history}));
  }
  useEffect(() => { setInspection(null); setInspectionHistory([]); setReturnContext(null); }, [state.activeSession?.sessionId, state.activeSession?.generation]);
  useEffect(() => {
    if (state.selection.subject) inspect({kind: "entity", entity: state.selection.subject});
  }, [state.selection.subject]);
  const [scenarioPickerFailure, setScenarioPickerFailure] = useState<string | null>(null);
  const scenarioHydrator = useMemo(() => new ScenarioHydrator(new TauriCoreGateway()), []);
  const scenarioModel = useMemo(() => buildScenarioUnderstanding(state.scenario), [state.scenario]);
  const evidenceModel = useMemo(() => buildEvidenceUnderstanding(state.scenario, state.integration, state.evidence), [state.scenario, state.integration, state.evidence]);
  const integrationGateway = useMemo(() => new TauriIntegrationGateway(), []);
  const integrationHydrator = useMemo(() => new IntegrationResultHydrator(integrationGateway), [integrationGateway]);
  const evidenceHydrator = useMemo(() => new EvidenceManifestHydrator(new TauriEvidenceGateway()), []);
  const [evidenceBusy, setEvidenceBusy] = useState<string | null>(null);
  const [evidenceFailure, setEvidenceFailure] = useState<string | null>(null);
  const replayGuard = useRef(new ReplayRequestGuard());
  const replayMembership = useRef(state.activeSession);
  replayMembership.current = state.opening ? null : state.activeSession;
  const lifecycleHydrator = useMemo(
    () => new AdapterLifecycleHydrator(new TauriAdapterLifecycleGateway()),
    [],
  );
  const lifecycleModel = useMemo(
    () => buildAdapterLifecycleReadModel(state.lifecycle),
    [state.lifecycle],
  );
  const autoLifecycleMembership = useRef<string | null>(null);
  const hydratedInventories = useRef(new WeakSet<object>());

  useEffect(() => {
    const session = state.activeSession;
    if (!session || state.opening) return;
    const key = `${session.sessionId}\u0000${session.generation}`;
    if (autoLifecycleMembership.current === key) return;
    autoLifecycleMembership.current = key;
    void hydrateInstalledLifecycle(session, "replace");
    // The membership key is the deliberate automatic hydration boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSession?.sessionId, state.activeSession?.generation, state.opening]);

  useEffect(() => {
    const session = state.activeSession;
    const records = state.lifecycle.installed.accepted;
    if (!session || state.opening || !records || hydratedInventories.current.has(records)) return;
    hydratedInventories.current.add(records);
    for (const record of records) {
      void hydrateInstalledVerification(session, record.instanceId);
      void hydrateInstalledPackage(session, {
        instanceId: record.instanceId,
        manifestPath: record.manifestPath,
        expectedManifestSha256: record.manifestSha256,
      });
    }
    // Accepted inventory object identity ensures stale inventory completions cannot start children.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lifecycle.installed.accepted, state.activeSession?.sessionId, state.activeSession?.generation, state.opening]);

  async function hydrateInstalledLifecycle(
    session: NonNullable<typeof state.activeSession>,
    mode: "replace" | "refresh",
  ) {
    const request: LifecycleRequest = {
      membership: lifecycleMembership(session),
      requestToken: createRequestId(session.generation),
      mode,
    };
    dispatch({ type: "ADAPTER_LIFECYCLE_INSTALLED_REQUESTED", request });
    try {
      const records = await lifecycleHydrator.hydrateInstalled(
        session.core.resolvedExecutable,
        request,
      );
      dispatch({ type: "ADAPTER_LIFECYCLE_INSTALLED_READY", request, records });
    } catch (error) {
      dispatch({
        type: "ADAPTER_LIFECYCLE_INSTALLED_FAILED",
        request,
        failure: lifecycleFailure(error),
      });
    }
  }

  async function hydrateInstalledVerification(
    session: NonNullable<typeof state.activeSession>,
    instanceId: string,
  ) {
    const request: TargetedLifecycleRequest = {
      membership: lifecycleMembership(session),
      requestToken: createRequestId(session.generation),
      mode: "replace",
      target: instanceId,
    };
    dispatch({ type: "ADAPTER_LIFECYCLE_VERIFY_REQUESTED", request });
    try {
      const report = await lifecycleHydrator.hydrateVerify(
        session.core.resolvedExecutable,
        request,
      );
      dispatch({ type: "ADAPTER_LIFECYCLE_VERIFY_READY", request, report });
    } catch (error) {
      dispatch({
        type: "ADAPTER_LIFECYCLE_VERIFY_FAILED",
        request,
        failure: lifecycleFailure(error),
      });
    }
  }

  async function hydrateInstalledPackage(
    session: NonNullable<typeof state.activeSession>,
    binding: Pick<PackageBindingRequest, "instanceId" | "manifestPath" | "expectedManifestSha256">,
  ) {
    const request: PackageBindingRequest = {
      membership: lifecycleMembership(session),
      requestToken: createRequestId(session.generation),
      mode: "replace",
      ...binding,
    };
    dispatch({ type: "ADAPTER_LIFECYCLE_PACKAGE_BINDING_REQUESTED", request });
    try {
      const observation = await lifecycleHydrator.hydratePackageBinding(request);
      dispatch({ type: "ADAPTER_LIFECYCLE_PACKAGE_BINDING_READY", request, observation });
    } catch (error) {
      dispatch({
        type: "ADAPTER_LIFECYCLE_PACKAGE_BINDING_FAILED",
        request,
        failure: lifecycleFailure(error),
      });
    }
  }

  async function checkAdapterProjectLock(lockPath: string) {
    const session = state.activeSession;
    if (!session || state.opening) return;
    const request: TargetedLifecycleRequest = {
      membership: lifecycleMembership(session),
      requestToken: createRequestId(session.generation),
      mode: state.lifecycle.projectLock.accepted?.lockPath === lockPath ? "refresh" : "replace",
      target: lockPath,
    };
    dispatch({ type: "ADAPTER_LIFECYCLE_PROJECT_LOCK_REQUESTED", request });
    try {
      const report = await lifecycleHydrator.hydrateProjectLock(
        session.core.resolvedExecutable,
        request,
      );
      dispatch({ type: "ADAPTER_LIFECYCLE_PROJECT_LOCK_READY", request, report });
    } catch (error) {
      dispatch({
        type: "ADAPTER_LIFECYCLE_PROJECT_LOCK_FAILED",
        request,
        failure: lifecycleFailure(error),
      });
    }
  }

  async function selectAdapterCatalogRelease(
    catalogPath: string,
    sourceCoordinate: string,
    releaseVersion: string,
  ) {
    const session = state.activeSession;
    if (!session || state.opening) return;
    const request: CatalogLifecycleRequest = {
      membership: lifecycleMembership(session),
      requestToken: createRequestId(session.generation),
      mode: "replace",
      catalogPath,
      sourceCoordinate,
      releaseVersion,
    };
    dispatch({ type: "ADAPTER_LIFECYCLE_CATALOG_REQUESTED", request });
    try {
      const selection = await lifecycleHydrator.hydrateCatalogRelease(
        session.core.resolvedExecutable,
        request,
      );
      dispatch({ type: "ADAPTER_LIFECYCLE_CATALOG_READY", request, selection });
    } catch (error) {
      dispatch({
        type: "ADAPTER_LIFECYCLE_CATALOG_FAILED",
        request,
        failure: lifecycleFailure(error),
      });
    }
  }

  async function chooseReplayResult() {
    if (!state.activeSession || state.opening) return;
    const ticket = { membership: { sessionId: state.activeSession.sessionId, generation: state.activeSession.generation }, requestToken: createRequestId(state.activeSession.generation) };
    replayGuard.current.begin(ticket);
    const current = () => replayGuard.current.accepts(ticket, replayMembership.current);
    setEvidenceBusy("result"); setEvidenceFailure(null);
    try {
      const selected = await open({ multiple: false, directory: false, title: "Load exact Integration Result", filters: [{ name: "Integration Result", extensions: ["json"] }] });
      if (!current() || typeof selected !== "string") return;
      const previewBytes = (await integrationGateway.readResultBundle(selected)).resultText;
      const preview = parseSelectedIntegrationResult(previewBytes);
      const expectedResultSha256 = await sha256Utf8(previewBytes);
      if (!current()) return;
      const request = {
        ...ticket,
        expectedResultSha256,
        context: { integrationId: preview.integration.id, adapterId: preview.adapter.id, adapterVersion: preview.adapter.version, operationId: preview.operation.id },
        resultPath: selected,
      };
      dispatch({ type: "INTEGRATION_RESULT_REQUESTED", request });
      try {
        const observation = await integrationHydrator.hydrate(request);
        dispatch({ type: "INTEGRATION_RESULT_READY", request, observation });
      } catch (error) {
        const failure = { class: error instanceof IntegrationResultProtocolError ? "protocol" as const : error instanceof IntegrationResultConsistencyError ? "consistency" as const : "transport" as const, message: errorMessage(error) };
        dispatch({ type: "INTEGRATION_RESULT_HYDRATION_FAILED", request, failure });
        throw error;
      }
    } catch (error) { if (current()) setEvidenceFailure(errorMessage(error)); } finally { if (current()) setEvidenceBusy(null); }
  }

  async function chooseEvidenceSet() {
    if (!state.activeSession || state.opening) return;
    const ticket = { membership: { sessionId: state.activeSession.sessionId, generation: state.activeSession.generation }, requestToken: createRequestId(state.activeSession.generation) };
    replayGuard.current.begin(ticket);
    const current = () => replayGuard.current.accepts(ticket, replayMembership.current);
    setEvidenceBusy("evidence"); setEvidenceFailure(null);
    try {
      const selected = await open({ multiple: false, directory: false, title: "Load retained Evidence Set", filters: [{ name: "Evidence Set", extensions: ["json"] }] });
      if (!current() || typeof selected !== "string") return;
      const request = { ...ticket, targetPath: selected, mode: "replace" as const };
      dispatch({ type: "EVIDENCE_SET_REQUESTED", request });
      try {
      const observation = await evidenceHydrator.hydrate(request);
      dispatch({ type: "EVIDENCE_SET_READY", request, observation });
      } catch (error) {
        dispatch({ type: "EVIDENCE_SET_HYDRATION_FAILED", request, failure: { class: error instanceof EvidenceManifestProtocolError ? "protocol" : "transport", message: errorMessage(error) } });
        throw error;
      }
    } catch (error) { if (current()) setEvidenceFailure(errorMessage(error)); }
    finally { if (current()) setEvidenceBusy(null); }
  }

  async function chooseScenario() {
    const capturedSession = state.activeSession;
    if (!capturedSession) return;
    setScenarioPickerFailure(null);
    try {
      const selected = await open({ multiple: false, directory: false, title: "Choose OrbitFabric Scenario",
        filters: [{ name: "Scenario", extensions: ["yaml", "yml"] }] });
      if (typeof selected !== "string") return;
      await requestScenario(scenarioHydrator, dispatch, capturedSession, selected, "replace", createRequestId(capturedSession.generation));
    } catch (error) {
      setScenarioPickerFailure(errorMessage(error));
    }
  }

  async function refreshScenario() {
    if (!state.activeSession || !state.scenario.accepted) return;
    await requestScenario(scenarioHydrator, dispatch, state.activeSession,
      state.scenario.accepted.targetPath, "refresh", createRequestId(state.activeSession.generation));
  }

  const hydrator = useMemo(
    () => new MissionHydrator(new TauriCoreGateway()),
    [],
  );

  function setCoreExecutable(value: string) {
    setCoreExecutableState(value);
    localStorage.setItem(CORE_EXECUTABLE_STORAGE_KEY, value);
  }

  async function chooseAndOpenMission() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open OrbitFabric mission",
    });

    if (typeof selected !== "string") {
      return;
    }

    await beginOpen(selected, false);
  }

  async function beginOpen(selectedPath: string, isRefresh: boolean) {
    replayGuard.current.invalidate();
    setEvidenceBusy(null);
    setEvidenceFailure(null);
    setValidationOpen(false);
    setScenarioPickerFailure(null);
    const generation = ++generationRef.current;
    const requestId = createRequestId(generation);

    dispatch({
      type: "MISSION_OPEN_REQUESTED",
      opening: {
        requestId,
        generation,
        selectedPath,
        isRefresh,
      },
    });

    try {
      const primary = await hydrator.openPrimary({
        selectedPath,
        configuredExecutable: normalizeCoreExecutable(coreExecutable),
        requestId,
        generation,
      });

      dispatch({ type: "MISSION_PRIMARY_COMMITTED", session: primary });
      rememberRecent(primary.source.selectedPath);

      const lintTask = hydrator
        .hydrateLint(primary)
        .then((lint) => {
          dispatch({ type: "MISSION_LINT_READY", sessionId: requestId, lint });
        })
        .catch((error) => {
          dispatch({
            type: "MISSION_SECONDARY_FAILED",
            sessionId: requestId,
            surface: "lint",
            message: errorMessage(error),
          });
        });

      const relationshipsTask = hydrator
        .hydrateEntityIndex(primary)
        .then(async (entityIndex) => {
          dispatch({
            type: "MISSION_ENTITY_INDEX_READY",
            sessionId: requestId,
            entityIndex,
          });

          try {
            const relationships = await hydrator.hydrateRelationships(primary, entityIndex);
            dispatch({
              type: "MISSION_RELATIONSHIPS_READY",
              sessionId: requestId,
              relationships,
            });
          } catch (error) {
            dispatch({
              type: "MISSION_SECONDARY_FAILED",
              sessionId: requestId,
              surface: "relationships",
              message: errorMessage(error),
            });
          }
        })
        .catch((error) => {
          dispatch({
            type: "MISSION_SECONDARY_FAILED",
            sessionId: requestId,
            surface: "entities",
            message: errorMessage(error),
          });
          dispatch({
            type: "MISSION_SECONDARY_FAILED",
            sessionId: requestId,
            surface: "relationships",
            message: "Relationship hydration requires a compatible Entity Index.",
          });
        });

      await Promise.allSettled([lintTask, relationshipsTask]);
      await hydrator.clearRequestTempBestEffort(requestId);
    } catch (error) {
      dispatch({
        type: "MISSION_OPEN_FAILED",
        requestId,
        failure: openFailure(error),
      });
    }
  }

  function rememberRecent(path: string) {
    setRecentMissions((current) => {
      const next = [path, ...current.filter((item) => item !== path)].slice(0, MAX_RECENTS);
      localStorage.setItem(RECENT_MISSIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const session = state.activeSession;

  if (session === null) {
    return (
      <MissionLauncher
        isOpening={state.opening !== null}
        coreExecutable={coreExecutable}
        recentMissions={recentMissions}
        failure={state.openFailure}
        onCoreExecutableChange={setCoreExecutable}
        onOpenMission={chooseAndOpenMission}
        onOpenRecent={(path) => beginOpen(path, false)}
      />
    );
  }

  const mission = session.snapshot.mission;
  const isOpeningReplacement = state.opening !== null;
  const selectedEntity = state.selection.subject;
  const changeWorkspaceView = (view: MissionWorkspaceView) => {
    workspacePrimaryRef.current?.scrollTo({ top: 0, left: 0 });
    dispatch({ type: "WORKSPACE_VIEW_CHANGED", view });
  };


  return (
    <PresentationMemory.Provider value={presentationMemory}><main className="studio-shell">
      <header className="studio-topbar">
        <div className="mission-title-block">
          <span className="studio-wordmark">OrbitFabric Studio</span>
          <div className="mission-title">
            <strong>{mission?.name ?? "Mission"}</strong>
            <span>
              <code>{mission?.id}</code>
              {mission ? ` · model ${mission.model_version}` : ""}
            </span>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Mission workspace">
          <button
            type="button"
            className={state.view === "overview" ? "is-active" : ""}
            onClick={() => changeWorkspaceView("overview")}
          >
            Overview
          </button>
          {session.snapshot.model ? (
            <button
              type="button"
              className={state.view === "operations" ? "is-active" : ""}
              onClick={() => changeWorkspaceView("operations")}
            >
              Operations
            </button>
          ) : null}
          {session.readiness.entities === "ready" ? (
            <button
              type="button"
              className={state.view === "explore" ? "is-active" : ""}
              onClick={() => changeWorkspaceView("explore")}
            >
              Explore
            </button>
          ) : null}
          {session.readiness.relationships === "ready" ? (
            <button
              type="button"
              className={state.view === "relations" ? "is-active" : ""}
              onClick={() => changeWorkspaceView("relations")}
            >
              Relations
            </button>
          ) : null}
          <button
            type="button"
            className={state.view === "scenarios" ? "is-active" : ""}
            onClick={() => changeWorkspaceView("scenarios")}
          >
            Scenarios
          </button>
          <button
            type="button"
            className={state.view === "integrations" ? "is-active" : ""}
            onClick={() => changeWorkspaceView("integrations")}
          >
            Integrations
          </button>
          <button type="button" className={state.view === "evidence" ? "is-active" : ""}
            onClick={() => changeWorkspaceView("evidence")}>
            Evidence
          </button>
        </nav>

        <div className="topbar-actions">
          <CoreProvenance
            session={session}
            configuredExecutable={coreExecutable}
            onConfiguredExecutableChange={setCoreExecutable}
          />
          <SurfaceCaptureButton
            missionId={mission?.id ?? "mission"}
            view={state.view}
            selection={selectedEntity}
            disabled={isOpeningReplacement}
          />
          <button
            className="secondary-action"
            type="button"
            disabled={isOpeningReplacement}
            onClick={() => beginOpen(session.source.selectedPath, true)}
          >
            {state.opening?.isRefresh ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={isOpeningReplacement}
            onClick={chooseAndOpenMission}
          >
            Open Mission
          </button>
        </div>
      </header>

      {state.openFailure ? <ReplacementFailure failure={state.openFailure} /> : null}

      {isOpeningReplacement ? (
        <div className="opening-overlay-status" role="status">
          Reading mission through Core…
        </div>
      ) : null}

      {session.lint && session.lint.findings.length > 0 ? (
        <button
          className="diagnostic-summary"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={validationOpen}
          aria-controls="validation-findings-dialog"
          onClick={() => setValidationOpen(true)}
        >
          <strong>Validation findings</strong>
          <span>
            {session.lint.summary.errors} errors · {session.lint.summary.warnings} warnings ·{" "}
            {session.lint.summary.info} info
          </span>
          <small>Review findings</small>
        </button>
      ) : null}

      <InvestigationPanel key={`${session.sessionId}:${session.generation}`} session={session} slot={state.scenario} evidence={evidenceModel}
        selection={selectedEntity} onInspect={inspect}
        onScenarios={()=>{setReturnContext({view:state.view,inspection,top:document.querySelector(".studio-main-surface")?.scrollTop??0});changeWorkspaceView("scenarios");}}
        onEvidence={()=>{setReturnContext({view:state.view,inspection,top:document.querySelector(".studio-main-surface")?.scrollTop??0});changeWorkspaceView("evidence");}}
        canReturn={!!returnContext} onReturnContext={()=>{if(returnContext){dispatch({type:"WORKSPACE_VIEW_CHANGED",view:returnContext.view});setInspection(returnContext.inspection);const top=returnContext.top;requestAnimationFrame(()=>document.querySelector(".studio-main-surface")?.scrollTo(0,top));setReturnContext(null);}}}
        disabled={isOpeningReplacement}/>
      <section className="studio-main-surface">
        <div
          className={`workspace-layout${inspection ? " has-experience-inspector" : ""}`}
        >
          <div className="workspace-primary" ref={workspacePrimaryRef}>
            {state.view === "evidence" ? (
              <EvidenceReplayWorkspace key={`${session.sessionId}:${session.generation}:${evidenceModel.scenario?.sha256 ?? "none"}`} model={evidenceModel} busy={state.opening ? "mission" : evidenceBusy} failure={evidenceFailure}
                onChooseResult={chooseReplayResult} onChooseEvidence={chooseEvidenceSet} />
            ) : state.view === "scenarios" ? (
              <ScenarioWorkspace selectedAtom={inspection?.kind === "atom" && inspection.scenario.sourceSha256 === scenarioModel.sourceSha256 ? inspection.atom.id : null}
                onInspectAtom={atom => inspect({kind:"atom",atom,scenario:scenarioModel})} model={scenarioModel} session={session} selectedEntity={selectedEntity}
                disabled={isOpeningReplacement} pickerFailure={scenarioPickerFailure}
                onChoose={chooseScenario} onRefresh={refreshScenario}
                onInspectEntity={(subject) => dispatch({ type: "SELECTION_CHANGED", subject, origin: "scenarios" })}
              />
            ) : state.view === "operations" ? (
              <OperationsWorkspace
                session={session}
                selectedEntity={selectedEntity}
                focusedMode={state.operationsMode}
                onSelectMode={(subject) =>
                  dispatch({ type: "SELECTION_CHANGED", subject, origin: "operations" })
                }
                onInspectEntity={(subject) => {
                  changeWorkspaceView("explore");
                  dispatch({ type: "SELECTION_CHANGED", subject, origin: "operations" });
                }}
              />
            ) : state.view === "explore" ? (
              <EntityExplorer
                session={session}
                selectedEntity={selectedEntity}
                onSelectEntity={(subject) =>
                  dispatch({ type: "SELECTION_CHANGED", subject, origin: "explorer" })
                }
              />
            ) : state.view === "relations" ? (
              <RelationsWorkspace
                session={session}
                subject={selectedEntity}
                contextPath={state.selection.contextPath}
                onFollow={(step) =>
                  dispatch({ type: "CONTEXT_EDGE_FOLLOWED", step, origin: "context-map" })
                }
                onNavigateMap={(subject, path) =>
                  dispatch({
                    type: "CONTEXT_PATH_REPLACED",
                    subject,
                    path,
                    origin: "context-map",
                  })
                }
                onOpenExplore={() => changeWorkspaceView("explore")}
              />
            ) : state.view === "integrations" ? (
              <IntegrationsWorkspace
                session={session}
                lifecycle={lifecycleModel}
                lifecycleDisabled={isOpeningReplacement}
                selectedEntity={selectedEntity}
                onRefreshLifecycle={() => hydrateInstalledLifecycle(session, "refresh")}
                onCheckProjectLock={checkAdapterProjectLock}
                onSelectCatalogRelease={selectAdapterCatalogRelease}
                onInspectEntity={(subject) => {
                  changeWorkspaceView("explore");
                  dispatch({ type: "SELECTION_CHANGED", subject, origin: "integrations" });
                }}
              />
            ) : (
              <>
              <MissionModel key={`${session.sessionId}:${session.generation}`} session={session} selected={inspection?.kind === "entity" ? inspection.entity : null}
                onInspect={entity => { inspect({kind:"entity",entity}); dispatch({type:"SELECTION_CHANGED",subject:entity,origin:"atlas"}); }}
                onRelation={id => inspect({kind:"relation",id})}/>
              <MissionAtlas
                session={session}
                selectedEntity={selectedEntity}
                onSelectEntity={(subject) =>
                  dispatch({ type: "SELECTION_CHANGED", subject, origin: "atlas" })
                }
              />
              </>
            )}
          </div>

          {inspection ? <InspectorFrame identity={inspectionIdentity(inspection)} title={inspection.kind === "entity" ? inspection.entity.id : inspection.kind === "relation" ? inspection.id : inspection.atom.id}
            onClear={() => {setInspection(null);setInspectionHistory([]);dispatch({type:"SELECTION_CHANGED",subject:null,origin:null});}}
            onReturn={inspectionHistory.length ? () => {setInspection(inspectionHistory[inspectionHistory.length - 1]);setInspectionHistory(h=>h.slice(0,-1));} : undefined}>
            <p className="experience-boundary">Inspection does not change the investigation anchor or Scope. Source generation {session.generation}.</p>
            {inspection.kind === "atom" && inspection.scenario.sourceSha256 !== scenarioModel.sourceSha256 && <p role="status">Retained exact declaration · not represented in the current Scenario view.</p>}
            {inspection.kind === "entity" ? <EntityXRay
              session={session}
              subject={inspection.entity}
              contextPath={selectedEntity?.id === inspection.entity.id && selectedEntity.domain === inspection.entity.domain ? state.selection.contextPath : []}
              onClose={() =>
                (setInspection(null), dispatch({ type: "SELECTION_CHANGED", subject: null, origin: null }))
              }
              onFollowRelationship={(step) =>
                dispatch({ type: "CONTEXT_PATH_REPLACED", subject: step.to,
                  path: [...(selectedEntity?.id === step.from.id && selectedEntity.domain === step.from.domain ? state.selection.contextPath : []), step], origin: "xray" })
              }
              onTruncateContextPath={(subject, length) =>
                dispatch({
                  type: "CONTEXT_PATH_TRUNCATED",
                  subject,
                  length,
                  origin: "xray",
                })
              }
            /> : <InspectionContent target={inspection} session={session} onEntity={entity => inspect({kind:"entity",entity})}/>}
          </InspectorFrame> : null}
        </div>
      </section>

      {validationOpen && session.lint ? (
        <ValidationFindingsDrawer
          report={session.lint}
          readModel={session.readModel}
          onClose={() => setValidationOpen(false)}
          onInspectEntity={(subject) => {
            setValidationOpen(false);
            changeWorkspaceView("explore");
            dispatch({ type: "SELECTION_CHANGED", subject, origin: "validation" });
          }}
        />
      ) : null}
    </main></PresentationMemory.Provider>
  );
}

function ReplacementFailure({ failure }: { failure: MissionOpenFailure }) {
  return (
    <aside className="replacement-failure" role="alert">
      <strong>New mission was not opened.</strong>
      <span>{failure.message}</span>
      <small>The previously loaded mission is still active.</small>
    </aside>
  );
}

function openFailure(error: unknown): MissionOpenFailure {
  if (error instanceof MissionStructuralInvalidError) {
    return {
      message:
        error.diagnostics[0]?.message ??
        "OrbitFabric Core could not construct the Mission Model.",
      diagnostics: error.diagnostics,
    };
  }

  return {
    message: errorMessage(error),
    diagnostics: [],
    coreState: error instanceof CoreCompatibilityError ? error.state : undefined,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function lifecycleMembership(session: { sessionId: string; generation: number }) {
  return { sessionId: session.sessionId, generation: session.generation };
}

function lifecycleFailure(error: unknown): LifecycleHydrationFailure {
  return {
    class:
      error instanceof AdapterLifecycleProtocolError
        ? "protocol"
        : error instanceof AdapterLifecycleConsistencyError
          ? "consistency"
          : "transport",
    message: errorMessage(error),
  };
}

function createRequestId(generation: number): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `mission-${generation}-${random}`;
}

function loadRecentMissions(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_MISSIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export default App;
