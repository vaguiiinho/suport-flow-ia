"use client";

import { FormEvent, useRef, useState } from "react";

type Citation = { chunkId: string; sourceId: string; sourceVersion: number; title: string; page: number | null };
type Reply = { answer: string; citations: Citation[]; fallback: boolean; canOpenTicket: boolean };
type ChatMessage = { role: "USER" | "ASSISTANT"; content: string; reply?: Reply };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export function SupportChat() {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [showEscalation, setShowEscalation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [contact, setContact] = useState("");
  const [ticketNumber, setTicketNumber] = useState<string>();
  const ticketKey = useRef<string | undefined>(undefined);
  const input = useRef<HTMLTextAreaElement>(null);

  async function session(): Promise<string> {
    if (conversationId) return conversationId;
    const response = await fetch(`${apiUrl}/anonymous-sessions`, { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error("Não foi possível iniciar uma conversa agora.");
    const result = (await response.json()) as { conversationId: string };
    setConversationId(result.conversationId);
    return result.conversationId;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = content.trim();
    if (!message || pending) return;
    setPending(true);
    setError(undefined);
    setContent("");
    try {
      const id = await session();
      const response = await fetch(`${apiUrl}/conversations/${id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: message })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(typeof body.message === "string" ? body.message : "Não foi possível enviar a mensagem.");
      const reply = body.answer as Reply;
      setMessages((current) => [
        ...current,
        { role: "USER", content: message },
        { role: "ASSISTANT", content: reply.answer, reply }
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a mensagem.");
      setContent(message);
    } finally {
      setPending(false);
      input.current?.focus();
    }
  }

  async function createTicket() {
    const lastQuestion = [...messages].reverse().find((message) => message.role === "USER")?.content;
    if (!conversationId || !confirmed || !contact.trim() || !lastQuestion || pending || ticketNumber) return;
    setPending(true);
    setError(undefined);
    try {
      ticketKey.current ??= crypto.randomUUID();
      const isEmail = contact.includes("@");
      const response = await fetch(`${apiUrl}/tickets`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": ticketKey.current },
        body: JSON.stringify({
          conversationId,
          confirmed: true,
          summary: lastQuestion.slice(0, 160),
          description: lastQuestion,
          ...(isEmail ? { contactEmail: contact.trim() } : { contactPhone: contact.trim() }),
          category: "GENERAL",
          priority: "MEDIUM"
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(typeof body.message === "string" ? body.message : "Não foi possível criar o chamado.");
      setTicketNumber(body.number as string);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o chamado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="chat" aria-labelledby="chat-title">
      <div className="chat-heading">
        <div>
          <p className="section-label">Assistente de suporte</p>
          <h2 id="chat-title">Como podemos ajudar?</h2>
        </div>
        <p>As respostas usam apenas fontes públicas aprovadas.</p>
      </div>
      <div className="messages" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && (
          <p className="empty">
            Descreva sua dúvida. Se não houver evidência suficiente, você poderá solicitar atendimento humano.
          </p>
        )}
        {messages.map((message, index) => (
          <article className={`message ${message.role.toLowerCase()}`} key={`${message.role}-${index}`}>
            <p className="message-label">{message.role === "USER" ? "Você" : "SupportFlow AI"}</p>
            <p>{message.content}</p>
            {message.reply?.fallback && (
              <p className="fallback">Esta resposta é um fallback seguro: não completamos lacunas sem fontes.</p>
            )}
            {message.reply && message.reply.citations.length > 0 && (
              <ul className="citations" aria-label="Fontes da resposta">
                {message.reply.citations.map((citation) => (
                  <li key={citation.chunkId}>
                    {citation.title}
                    {citation.page ? ` · página ${citation.page}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
      {messages.some((message) => message.reply?.canOpenTicket) && (
        <button
          className="link-button"
          type="button"
          onClick={() => setShowEscalation((value) => !value)}
          aria-expanded={showEscalation}
        >
          {showEscalation ? "Fechar solicitação" : "Solicitar atendimento humano"}
        </button>
      )}
      {showEscalation && (
        <aside className="escalation" aria-labelledby="escalation-title">
          <h3 id="escalation-title">Revise antes de continuar</h3>
          <p>
            Revise os dados: resumo, categoria e prioridade são sugestões. O chamado só será criado após sua confirmação
            abaixo.
          </p>
          <label htmlFor="contact">E-mail ou telefone para retorno</label>
          <input
            id="contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            autoComplete="email"
          />
          <label className="confirmation">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{" "}
            Confirmo que desejo continuar com a abertura do chamado.
          </label>
          {ticketNumber ? (
            <p className="confirmation-state" role="status">
              Chamado {ticketNumber} criado. Um atendente fará o acompanhamento.
            </p>
          ) : (
            <>
              <p className="confirmation-state" role="status">
                {confirmed && contact.trim()
                  ? "Pronto para criar o chamado."
                  : "Informe um contato e confirme a solicitação para prosseguir."}
              </p>
              <button type="button" disabled={!confirmed || !contact.trim() || pending} onClick={createTicket}>
                {pending ? "Criando chamado…" : "Criar chamado confirmado"}
              </button>
            </>
          )}
        </aside>
      )}
      <form className="composer" onSubmit={submit}>
        <label htmlFor="support-message">Sua mensagem</label>
        <textarea
          ref={input}
          id="support-message"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={4000}
          required
          disabled={pending}
          rows={3}
        />
        <div>
          <span>{content.length}/4000</span>
          <button type="submit" disabled={pending}>
            {pending ? "Buscando fontes…" : "Enviar mensagem"}
          </button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
