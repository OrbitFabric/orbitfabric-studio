import { FamilyLabel } from "../presentation/FamilyLabel";
import { familyForDomain } from "../presentation/familyMarkers";
import type { JsonObject, JsonValue, MissionContractObject } from "../../core/contracts";
import type { EntityRef } from "../../mission/entityRef";
import type { MissionSession } from "../../mission/MissionSession";

interface MissionAtlasProps {
  session: MissionSession;
  selectedEntity: EntityRef | null;
  onSelectEntity: (ref: EntityRef) => void;
}

export function MissionAtlas({
  session,
  selectedEntity,
  onSelectEntity,
}: MissionAtlasProps) {
  const mission = session.snapshot.mission;
  const model = session.snapshot.model;

  if (mission === null || model === null) {
    return null;
  }

  const participants = model.subsystems;
  const payloadCount = model.payloads.length;
  const contacts = model.contacts;
  const contactWindowCount = arrayPropertyLength(contacts, "contact_windows");
  const downlinkFlowCount = arrayPropertyLength(contacts, "downlink_flows");

  return (
    <div className="atlas" aria-label="Mission Atlas">
      <section className="atlas-hero">
        <div>
          <p className="eyebrow">Mission Atlas</p>
          <h1>{mission.name}</h1>
          <p className="atlas-identity">
            <code>{mission.id}</code>
            <span>model {mission.model_version}</span>
          </p>
        </div>
        <p className="atlas-purpose">
          One mission system, recomposed from the contract Core actually loaded.
        </p>
      </section>

      <section className="atlas-section" aria-labelledby="atlas-system-title">
        <header className="section-heading">
          <div>
            <p className="section-kicker">System</p>
            <h2 id="atlas-system-title"><FamilyLabel family="subsystem">Mission participants</FamilyLabel></h2>
          </div>
          <p>
            Declared participant contexts. Studio does not infer physical containment from this
            list.
          </p>
        </header>

        <div className="participant-grid">
          {participants.map((participant) => (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              selected={
                selectedEntity?.domain === "subsystems" && selectedEntity.id === participant.id
              }
              onSelect={() =>
                onSelectEntity({ domain: "subsystems", id: participant.id })
              }
            />
          ))}
        </div>
      </section>

      <section className="atlas-section atlas-territories" aria-labelledby="atlas-contract-title">
        <header className="section-heading">
          <div>
            <p className="section-kicker">Contract</p>
            <h2 id="atlas-contract-title">Ways to understand this mission</h2>
          </div>
          <p>Complementary semantic territories, present only when the contract contains them.</p>
        </header>

        <div className="territory-list">
          <Territory
            title="Operations"
            question="How can the mission behave?"
            facts={[
              { label: `${Object.keys(model.modes).length} modes`, domain: "modes" },
              `${model.mode_transitions.length} declared transitions`,
              { label: `${model.commands.length} commands`, domain: "commands" },
              { label: `${model.faults.length} faults`, domain: "faults" },
            ]}
          />
          <Territory
            title="Mission Data"
            question="What information and interactions form the contract?"
            facts={[
              { label: `${model.telemetry.length} telemetry items`, domain: "telemetry" },
              { label: `${model.events.length} events`, domain: "events" },
              `${model.packets.length} packets`,
            ]}
          />
          {model.data_products.length > 0 || downlinkFlowCount > 0 || contactWindowCount > 0 ? (
            <Territory
              title="Data Lifecycle"
              question="What does the mission produce, retain and make available for downlink?"
              facts={[
                { label: `${model.data_products.length} data products`, domain: "data_products" },
                `${downlinkFlowCount} downlink flows`,
                `${contactWindowCount} contact windows`,
              ]}
            />
          ) : null}
          {payloadCount > 0 ? (
            <Territory
              title="Payload Contracts"
              question="Which payload capabilities are explicitly declared?"
              facts={[{ label: `${payloadCount} payload contract${payloadCount === 1 ? "" : "s"}`, domain: "payloads" }]}
            />
          ) : null}
        </div>
      </section>

      <HydrationStrip session={session} />
    </div>
  );
}

function ParticipantCard({
  participant,
  selected,
  onSelect,
}: {
  participant: MissionContractObject;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`participant-card${selected ? " is-selected" : ""}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="participant-name">{participant.name ?? participant.id}</span>
      <code>{participant.id}</code>
      <span className="participant-meta">
        {stringProperty(participant, "type") ?? "declared participant"}
        {stringProperty(participant, "criticality")
          ? ` · ${stringProperty(participant, "criticality")} criticality`
          : ""}
      </span>
      {participant.description ? (
        <span className="participant-description">{participant.description}</span>
      ) : null}
    </button>
  );
}

function Territory({
  title,
  question,
  facts,
}: {
  title: string;
  question: string;
  facts: (string | { label: string; domain: string })[];
}) {
  return (
    <article className="territory">
      <div>
        <h3>{title}</h3>
        <p>{question}</p>
      </div>
      <ul>
        {facts.map((fact) => (
          <li key={typeof fact === "string" ? fact : fact.domain}>{typeof fact === "string" ? fact
            : <FamilyLabel family={familyForDomain(fact.domain)}>{fact.label}</FamilyLabel>}</li>
        ))}
      </ul>
    </article>
  );
}

function HydrationStrip({ session }: { session: MissionSession }) {
  const lint = session.lint;
  const findingText = lint
    ? `${lint.summary.errors} errors · ${lint.summary.warnings} warnings · ${lint.summary.info} info`
    : null;

  return (
    <footer className="hydration-strip" aria-label="Mission hydration status">
      <Status label="Model" state="ready" detail="Core snapshot loaded" />
      <Status label="Entities" state={session.readiness.entities} />
      <Status label="Relations" state={session.readiness.relationships} />
      <Status label="Validation" state={session.readiness.lint} detail={findingText} />
    </footer>
  );
}

function Status({
  label,
  state,
  detail,
}: {
  label: string;
  state: "pending" | "ready" | "failed";
  detail?: string | null;
}) {
  return (
    <span className={`hydration-status hydration-${state}`}>
      <span className="status-dot" aria-hidden="true" />
      <strong>{label}</strong>
      <span>{detail ?? state}</span>
    </span>
  );
}

function stringProperty(object: MissionContractObject, key: string): string | null {
  const value = object[key];
  return typeof value === "string" ? value : null;
}

function arrayPropertyLength(object: JsonObject, key: string): number {
  const value: JsonValue | undefined = object[key];
  return Array.isArray(value) ? value.length : 0;
}
