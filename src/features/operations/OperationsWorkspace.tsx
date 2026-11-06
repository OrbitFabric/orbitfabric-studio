import { useMemo } from "react";

import type { JsonValue } from "../../core/contracts";
import { entityKey, type EntityRef } from "../../mission/entityRef";
import type { MissionSession } from "../../mission/MissionSession";
import { OperationalStateMap } from "./OperationalStateMap";
import {
  buildModeFocus,
  buildOperationsModel,
  type AutonomousActionFact,
  type ModeTransitionFact,
  type OperationalModeFact,
} from "./operationsModel";

interface OperationsWorkspaceProps {
  session: MissionSession;
  selectedEntity: EntityRef | null;
  focusedMode: EntityRef | null;
  onSelectMode: (mode: EntityRef) => void;
  onInspectEntity: (entity: EntityRef) => void;
}

export function OperationsWorkspace({
  session,
  selectedEntity,
  focusedMode,
  onSelectMode,
  onInspectEntity,
}: OperationsWorkspaceProps) {
  const model = useMemo(() => buildOperationsModel(session.snapshot), [session.snapshot]);

  if (model.modes.length === 0) {
    return (
      <section className="operations-empty">
        <p className="eyebrow">Operations Logic</p>
        <h1>No mission modes are declared</h1>
        <p>The loaded Core snapshot does not expose an operational state map.</p>
      </section>
    );
  }

  const selectedMode =
    selectedEntity?.domain === "modes" &&
    model.modes.some((mode) => mode.ref.id === selectedEntity.id)
      ? selectedEntity.id
      : focusedMode?.domain === "modes" &&
          model.modes.some((mode) => mode.ref.id === focusedMode.id)
        ? focusedMode.id
      : model.modes.find((mode) => mode.initial)?.ref.id ?? model.modes[0].ref.id;
  const focus = buildModeFocus(model, selectedMode);
  if (!focus) {
    return null;
  }

  const inspect = (ref: EntityRef) => {
    if (session.readModel.entityRecordsByKey.has(entityKey(ref))) {
      onInspectEntity(ref);
    }
  };
  const isInspectable = (ref: EntityRef) =>
    session.readModel.entityRecordsByKey.has(entityKey(ref));
  const representedModeIds = new Set(model.modes.map((mode) => mode.ref.id));
  const nonModeActions = model.autonomousActions.filter(
    (action) => action.triggerMode === null || !representedModeIds.has(action.triggerMode),
  );

  return (
    <div className="operations-workspace">
      <header className="operations-hero">
        <div>
          <p className="eyebrow">Operations Logic</p>
          <h1>What can happen from here?</h1>
          <p>
            Explore declared modes, transitions, command constraints and recovery contracts. This
            view presents Core facts; it does not simulate runtime behavior.
          </p>
        </div>
        <div className="operations-boundary">
          <strong>Declared, not observed</strong>
          <span>No readiness, health or executability is inferred.</span>
        </div>
      </header>

      <div className="operations-mode-picker">
        <label htmlFor="operations-mode-select">Focus declared mode</label>
        <select
          id="operations-mode-select"
          value={selectedMode}
          onChange={(event) => onSelectMode({ domain: "modes", id: event.target.value })}
        >
          {model.modes.map((mode) => (
            <option key={mode.ref.id} value={mode.ref.id}>{mode.ref.id}</option>
          ))}
        </select>
        <span>All Core-declared modes are available here, including modes without transitions.</span>
      </div>

      <OperationalStateMap
        missionKey={`${session.source.missionDir}:${session.snapshot.mission?.id ?? "unknown"}`}
        model={model}
        selectedModeId={selectedMode}
        onSelectMode={(mode) => onSelectMode(mode.ref)}
      />

      <section className="mode-focus" aria-label="Autonomous actions outside represented mode triggers">
        <header className="mode-focus-header">
          <div>
            <p className="eyebrow">Declared autonomous behavior</p>
            <h2>Actions not triggered by a represented mode</h2>
            <p>Fault-triggered and other actions are Core declarations, not observed dispatches or runtime outcomes.</p>
          </div>
        </header>
        <FocusSection
          title="Autonomous actions with fault, other or unresolved mode triggers"
          count={nonModeActions.length}
          empty="No autonomous action is declared outside represented mode triggers."
        >
          {nonModeActions.map((action) => (
            <AutonomousActionCard
              key={action.ref.id}
              action={action}
              onInspect={isInspectable(action.ref) ? () => inspect(action.ref) : undefined}
            />
          ))}
        </FocusSection>
      </section>

      <section className="mode-focus" aria-label={`Mode Focus ${focus.mode.ref.id}`}>
        <header className="mode-focus-header">
          <div>
            <p className="eyebrow">Mode Focus</p>
            <div className="mode-focus-title">
              <h2>{focus.mode.ref.id}</h2>
              {focus.mode.initial ? <span>Initial</span> : null}
            </div>
            {focus.mode.description ? <p>{focus.mode.description}</p> : null}
          </div>
          {isInspectable(focus.mode.ref) ? (
            <button
              type="button"
              className="secondary-action"
              onClick={() => inspect(focus.mode.ref)}
            >
              Inspect mode
            </button>
          ) : null}
        </header>

        <div className="mode-focus-grid">
          <TransitionSection
            title="Can transition to"
            empty="No outgoing transition is declared."
            transitions={focus.outgoing}
            endpoint="to"
            onSelectMode={(id) => onSelectMode({ domain: "modes", id })}
          />
          <TransitionSection
            title="Can be reached from"
            empty="No incoming transition is declared."
            transitions={focus.incoming}
            endpoint="from"
            onSelectMode={(id) => onSelectMode({ domain: "modes", id })}
          />
        </div>

        <FocusSection
          title="Commands declaring this mode"
          count={focus.commands.length}
          empty="No command lists this mode in allowed_modes."
        >
          {focus.commands.map((command) => (
            <EntityFactCard
              key={command.ref.id}
              label="Command"
              title={command.ref.id}
              description={command.description}
              onInspect={isInspectable(command.ref) ? () => inspect(command.ref) : undefined}
            >
              <DeclaredJson label="Preconditions" value={command.preconditions} />
              <DeclaredJson label="Expected effects" value={command.expectedEffects} />
            </EntityFactCard>
          ))}
        </FocusSection>

        <FocusSection
          title="Commandability contracts"
          count={focus.commandability.length}
          empty="No rule explicitly names this mode or a command listed above."
        >
          {focus.commandability.map(({ rule, modeDeclared, commandListedForMode }) => (
            <EntityFactCard
              key={rule.ref.id}
              label="Commandability rule"
              title={rule.ref.id}
              onInspect={isInspectable(rule.ref) ? () => inspect(rule.ref) : undefined}
            >
              <div className="operations-tags">
                {modeDeclared ? <span>mode declared</span> : null}
                {commandListedForMode ? <span>command listed for mode</span> : null}
              </div>
              <FactLine label="Command" values={[rule.commandId]} />
              <FactLine label="Sources" values={rule.sources} />
              <FactLine label="Expected events" values={rule.expectedEvents} />
              <DeclaredJson label="Confirmation" value={rule.confirmation} />
              <DeclaredJson label="Expected effects" value={rule.expectedEffects} />
            </EntityFactCard>
          ))}
        </FocusSection>

        <FocusSection
          title="Declared recovery into this mode"
          count={focus.faultRecoveries.length + focus.recoveryIntents.length}
          empty="No fault recovery or recovery intent targets this mode."
        >
          {focus.faultRecoveries.map((recovery) => (
            <EntityFactCard
              key={`fault:${recovery.ref.id}`}
              label="Fault recovery"
              title={recovery.ref.id}
              onInspect={isInspectable(recovery.ref) ? () => inspect(recovery.ref) : undefined}
            >
              <FactLine label="Auto commands" values={recovery.autoCommandIds} />
            </EntityFactCard>
          ))}
          {focus.recoveryIntents.map((intent) => (
            <EntityFactCard
              key={`intent:${intent.ref.id}`}
              label="Recovery intent"
              title={intent.ref.id}
              onInspect={isInspectable(intent.ref) ? () => inspect(intent.ref) : undefined}
            >
              <FactLine label="Commands" values={intent.commandIds} />
              <FactLine label="Expected events" values={intent.expectedEvents} />
              <DeclaredJson label="Expected effects" value={intent.expectedEffects} />
            </EntityFactCard>
          ))}
        </FocusSection>

        <FocusSection
          title="Autonomous actions triggered by this mode"
          count={focus.autonomousActions.length}
          empty="No autonomous action explicitly declares this mode as its trigger."
        >
          {focus.autonomousActions.map((action) => (
            <AutonomousActionCard
              key={action.ref.id}
              action={action}
              onInspect={isInspectable(action.ref) ? () => inspect(action.ref) : undefined}
            />
          ))}
        </FocusSection>
      </section>
    </div>
  );
}

function AutonomousActionCard({
  action,
  onInspect,
}: {
  action: AutonomousActionFact;
  onInspect?: () => void;
}) {
  return (
    <EntityFactCard
      label="Autonomous action · DECLARED"
      title={action.ref.id}
      description={action.description}
      onInspect={onInspect}
    >
      <FactLine label="Trigger mode" values={action.triggerMode ? [action.triggerMode] : []} />
      <FactLine label="Trigger fault" values={action.triggerFault ? [action.triggerFault] : []} />
      <FactLine label="Dispatch commands" values={action.dispatchCommandIds} />
      <FactLine label="Dispatch sources" values={action.dispatchSourceIds} />
      <FactLine label="Expected events" values={action.expectedEvents} />
      <DeclaredJson label="Exact declared trigger" value={action.trigger} />
      <DeclaredJson label="Exact declared dispatch" value={action.dispatches} />
      <DeclaredJson label="Expected effects" value={action.expectedEffects} />
    </EntityFactCard>
  );
}

function TransitionSection({
  title,
  empty,
  transitions,
  endpoint,
  onSelectMode,
}: {
  title: string;
  empty: string;
  transitions: readonly ModeTransitionFact[];
  endpoint: "from" | "to";
  onSelectMode: (id: string) => void;
}) {
  return (
    <section className="mode-transition-section">
      <header>
        <h3>{title}</h3>
        <span>{transitions.length}</span>
      </header>
      {transitions.length === 0 ? <p className="operations-empty-copy">{empty}</p> : (
        <div className="mode-transition-list">
          {transitions.map((transition) => (
            <button
              key={transition.key}
              type="button"
              onClick={() => onSelectMode(transition[endpoint])}
            >
              <strong>{transition[endpoint]}</strong>
              <code>{transition.reason}</code>
              {transition.description ? <small>{transition.description}</small> : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FocusSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mode-focus-section">
      <header>
        <h3>{title}</h3>
        <span>{count}</span>
      </header>
      {count === 0 ? (
        <p className="operations-empty-copy">{empty}</p>
      ) : (
        <div className="operations-fact-grid">{children}</div>
      )}
    </section>
  );
}

function EntityFactCard({
  label,
  title,
  description,
  onInspect,
  children,
}: {
  label: string;
  title: string;
  description?: string | null;
  onInspect?: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="operations-fact-card">
      <header>
        <div>
          <span>{label}</span>
          <code>{title}</code>
        </div>
        {onInspect ? (
          <button type="button" onClick={onInspect} aria-label={`Inspect ${title}`}>
            Inspect
          </button>
        ) : null}
      </header>
      {description ? <p>{description}</p> : null}
      {children}
    </article>
  );
}

function FactLine({ label, values }: { label: string; values: readonly string[] }) {
  if (values.length === 0) {
    return null;
  }
  return (
    <div className="operations-fact-line">
      <span>{label}</span>
      <code>{values.join(", ")}</code>
    </div>
  );
}

function DeclaredJson({ label, value }: { label: string; value: JsonValue | undefined }) {
  if (value === undefined || value === null || isEmpty(value)) {
    return null;
  }
  return (
    <details className="operations-declared-json">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function isEmpty(value: JsonValue): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object" && value !== null) {
    return Object.keys(value).length === 0;
  }
  return false;
}
