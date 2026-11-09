"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  apiRequest,
  errorMessage,
  formatDate,
  priorityLabels,
  statusLabels,
  Ticket,
  TicketDetail,
  TicketPriority,
  TicketStatus
} from "./api-client";

type Props = { csrf: string; onSessionExpired: () => void };
type TicketChanges = Partial<{ status: TicketStatus; priority: TicketPriority; category: string | null }>;

export function TicketsPanel({ csrf, onSessionExpired }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "">("");
  const [selected, setSelected] = useState<TicketDetail>();
  const [error, setError] = useState<string>();

  const fail = useCallback(
    (reason: unknown, fallback: string) => {
      if (reason instanceof ApiError && reason.status === 401) onSessionExpired();
      else setError(errorMessage(reason, fallback));
    },
    [onSessionExpired]
  );

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
    try {
      setTickets(await apiRequest<Ticket[]>(`/tickets?${query.toString()}`));
    } catch (reason) {
      fail(reason, "Não foi possível carregar os tickets.");
    }
  }, [statusFilter, priorityFilter, fail]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(ticketId: string) {
    setError(undefined);
    try {
      setSelected(await apiRequest<TicketDetail>(`/tickets/${ticketId}`));
    } catch (reason) {
      fail(reason, "Não foi possível abrir o ticket.");
    }
  }

  async function update(ticketId: string, changes: TicketChanges) {
    setError(undefined);
    try {
      const updated = await apiRequest<Ticket>(`/tickets/${ticketId}`, { method: "PATCH", csrf, body: changes });
      setTickets((current) => current?.map((item) => (item.id === updated.id ? updated : item)));
      if (selected?.id === ticketId) await open(ticketId);
    } catch (reason) {
      fail(reason, "Não foi possível atualizar o ticket.");
    }
  }

  return (
    <div className="admin-section">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="filters">
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketStatus | "")}>
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridade
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as TicketPriority | "")}
          >
            <option value="">Todas</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <div className={selected ? "split" : undefined}>
        <div className="admin-list" aria-live="polite">
          {tickets === undefined ? (
            <p className="empty" role="status">
              Carregando tickets…
            </p>
          ) : tickets.length === 0 ? (
            <p className="empty">Nenhum ticket encontrado com esses filtros.</p>
          ) : (
            tickets.map((ticket) => (
              <article className={`admin-card${selected?.id === ticket.id ? " selected" : ""}`} key={ticket.id}>
                <strong>{ticket.number}</strong>
                <p>{ticket.summary}</p>
                <small>
                  {statusLabels[ticket.status]} · {priorityLabels[ticket.priority]}
                  {ticket.category ? ` · ${ticket.category}` : ""} · {formatDate(ticket.updatedAt)}
                </small>
                <button type="button" className="secondary" onClick={() => void open(ticket.id)}>
                  Ver detalhes
                </button>
              </article>
            ))
          )}
        </div>

        {selected && (
          <TicketDetailView
            key={`${selected.id}-${selected.updatedAt}`}
            ticket={selected}
            onClose={() => setSelected(undefined)}
            onUpdate={(changes) => update(selected.id, changes)}
          />
        )}
      </div>
    </div>
  );
}

function TicketDetailView({
  ticket,
  onClose,
  onUpdate
}: {
  ticket: TicketDetail;
  onClose: () => void;
  onUpdate: (changes: TicketChanges) => Promise<void>;
}) {
  const [category, setCategory] = useState(ticket.category ?? "");

  return (
    <aside className="detail" aria-labelledby="ticket-detail-title">
      <div className="detail-heading">
        <h2 id="ticket-detail-title">{ticket.number}</h2>
        <button type="button" className="link-button" onClick={onClose}>
          Fechar
        </button>
      </div>
      <p>
        <strong>{ticket.summary}</strong>
      </p>
      <p className="muted">{ticket.description}</p>
      <dl className="facts">
        <dt>Contato</dt>
        <dd>{[ticket.contactEmail, ticket.contactPhone].filter(Boolean).join(" · ") || "—"}</dd>
        <dt>Criado em</dt>
        <dd>{formatDate(ticket.createdAt)}</dd>
      </dl>

      <div className="detail-controls">
        <label>
          Estado
          <select
            value={ticket.status}
            onChange={(event) => void onUpdate({ status: event.target.value as TicketStatus })}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridade
          <select
            value={ticket.priority}
            onChange={(event) => void onUpdate({ priority: event.target.value as TicketPriority })}
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onUpdate({ category: category.trim() || null });
          }}
        >
          <label htmlFor="ticket-category">Categoria</label>
          <input
            id="ticket-category"
            value={category}
            maxLength={80}
            onChange={(event) => setCategory(event.target.value)}
          />
          <button className="secondary">Salvar</button>
        </form>
      </div>

      <h3>Conversa</h3>
      {ticket.messages.length === 0 ? (
        <p className="empty">Sem mensagens registradas.</p>
      ) : (
        <ol className="messages compact">
          {ticket.messages.map((message) => (
            <li key={message.id} className={`message ${message.role === "USER" ? "user" : "assistant"}`}>
              <p className="message-label">{message.role === "USER" ? "Cliente" : "Assistente"}</p>
              <p>{message.content}</p>
              {message.citations.length > 0 && (
                <ul className="citations" aria-label="Fontes citadas">
                  {message.citations.map((citation, index) => (
                    <li key={`${citation.sourceId}-${index}`}>
                      {citation.title} v{citation.sourceVersion}
                      {citation.page ? ` · p. ${citation.page}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      <h3>Histórico</h3>
      <ol className="history">
        {ticket.history.map((entry) => (
          <li key={entry.id}>
            <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>{" "}
            {entry.type === "CREATED" ? "Ticket criado" : "Atualizado"}: {describeChanges(entry.changes)}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function describeChanges(changes: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof changes.status === "string")
    parts.push(`estado ${statusLabels[changes.status as TicketStatus] ?? changes.status}`);
  if (typeof changes.priority === "string")
    parts.push(`prioridade ${priorityLabels[changes.priority as TicketPriority] ?? changes.priority}`);
  if ("category" in changes)
    parts.push(`categoria ${typeof changes.category === "string" ? changes.category : "removida"}`);
  return parts.join(", ") || "sem alterações";
}
