import { useMemo } from "react";

import { usePresentationMemory } from "../experience/presentationMemory";

import type { EntityIndexRecordDto } from "../../core/contracts";
import { entityKey, type EntityRef } from "../../mission/entityRef";
import type { MissionSession } from "../../mission/MissionSession";

interface EntityExplorerProps {
  session: MissionSession;
  selectedEntity: EntityRef | null;
  onSelectEntity: (ref: EntityRef) => void;
}

export function EntityExplorer({
  session,
  selectedEntity,
  onSelectEntity,
}: EntityExplorerProps) {
  // Presentation-only state survives route unmount; the App provider is per
  // mission generation and resets on accepted mission replacement.
  const [query, setQuery] = usePresentationMemory<string>("explore:query", "");
  const [domain, setDomain] = usePresentationMemory<string>("explore:domain", "all");
  const entities = session.entityIndex?.entities ?? [];
  const domains = useMemo(
    () => [...new Set(entities.map((entity) => entity.domain))].sort(),
    [entities],
  );

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return entities.filter((entity) => {
      if (domain !== "all" && entity.domain !== domain) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [entity.id, entity.display_name, entity.domain, entity.entity_type].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      );
    });
  }, [domain, entities, query]);

  if (session.readiness.entities === "pending") {
    return (
      <section className="explorer-empty" role="status">
        <p className="eyebrow">Entity Explorer</p>
        <h1>Reading the mission inventory…</h1>
      </section>
    );
  }

  if (session.readiness.entities === "failed") {
    return (
      <section className="explorer-empty">
        <p className="eyebrow">Entity Explorer</p>
        <h1>Entity inventory unavailable</h1>
        <p>The Mission Model is still open, but Core's Entity Index could not be hydrated.</p>
      </section>
    );
  }

  return (
    <section className="entity-explorer" aria-label="Entity Explorer">
      <header className="explorer-header">
        <div>
          <p className="eyebrow">Entity Explorer</p>
          <h1>Find anything in the mission</h1>
          <p>
            Search the Core-owned entity inventory without knowing which source file contains an
            object.
          </p>
        </div>
        <span className="explorer-count">{results.length} visible</span>
      </header>

      <div className="explorer-controls">
        <label className="search-field">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ID or display name"
            autoFocus
          />
        </label>
        <label className="domain-field">
          <span>Domain</span>
          <select value={domain} onChange={(event) => setDomain(event.target.value)}>
            <option value="all">All domains</option>
            {domains.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="entity-list" role="list">
        {results.map((entity) => (
          <EntityRow
            key={entityKey({ domain: entity.domain, id: entity.id })}
            entity={entity}
            selected={
              selectedEntity?.domain === entity.domain && selectedEntity.id === entity.id
            }
            onSelect={() => onSelectEntity({ domain: entity.domain, id: entity.id })}
          />
        ))}
        {results.length === 0 ? (
          <div className="no-results">No Core entity matches the current search.</div>
        ) : null}
      </div>
    </section>
  );
}

function EntityRow({
  entity,
  selected,
  onSelect,
}: {
  entity: EntityIndexRecordDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`entity-row${selected ? " is-selected" : ""}`}
      type="button"
      role="listitem"
      onClick={onSelect}
    >
      <span className="entity-type">{humanize(entity.entity_type)}</span>
      <span className="entity-main">
        <strong title={entity.display_name}>{entity.display_name}</strong>
        <code title={entity.id}>{entity.id}</code>
      </span>
      <span className="entity-domain">{humanize(entity.domain)}</span>
    </button>
  );
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}
