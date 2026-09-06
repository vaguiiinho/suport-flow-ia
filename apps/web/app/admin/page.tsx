"use client";

import { FormEvent, useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
type Ticket = { id: string; number: string; summary: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; category: string | null; updatedAt: string };
type Source = { id: string; title: string; type: "ARTICLE" | "PDF"; visibility: "PUBLIC" | "INTERNAL"; indexingStatus: string; active: boolean };

export default function AdminPage() {
  const [csrf, setCsrf] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function load() {
    const [tokenResponse, ticketResponse, sourceResponse] = await Promise.all([
      fetch(`${apiUrl}/auth/csrf`, { credentials: "include" }),
      fetch(`${apiUrl}/tickets`, { credentials: "include" }),
      fetch(`${apiUrl}/knowledge/sources`, { credentials: "include" })
    ]);
    if (!tokenResponse.ok || !ticketResponse.ok || !sourceResponse.ok) throw new Error("Sua sessão expirou. Entre novamente.");
    setCsrf((await tokenResponse.json()).csrfToken as string);
    setTickets((await ticketResponse.json()) as Ticket[]);
    setSources((await sourceResponse.json()) as Source[]);
  }

  useEffect(() => { void load().catch(() => undefined); }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(undefined);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error("Não foi possível autenticar.");
      setCsrf((await response.json()).csrfToken as string);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível autenticar."); }
    finally { setLoading(false); }
  }

  async function update(ticket: Ticket, status: Ticket["status"]) {
    if (!csrf) return;
    const response = await fetch(`${apiUrl}/tickets/${ticket.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ status }) });
    if (!response.ok) { setError("Não foi possível atualizar o ticket."); return; }
    const updated = await response.json() as Ticket;
    setTickets((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  if (!csrf) return <main><section className="chat admin" aria-labelledby="login-title"><p className="section-label">Área protegida</p><h1 id="login-title">Painel do atendente</h1><form className="composer" onSubmit={login}><label htmlFor="email">E-mail</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><label htmlFor="password">Senha</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button></form>{error && <p className="error" role="alert">{error}</p>}</section></main>;

  return <main><section className="chat admin" aria-labelledby="admin-title"><p className="section-label">Área protegida</p><h1 id="admin-title">Operação de suporte</h1>{error && <p className="error" role="alert">{error}</p>}<h2>Tickets</h2><div className="admin-list">{tickets.length ? tickets.map((ticket) => <article className="admin-card" key={ticket.id}><strong>{ticket.number}</strong><p>{ticket.summary}</p><label>Estado <select value={ticket.status} onChange={(event) => void update(ticket, event.target.value as Ticket["status"])}><option value="OPEN">Aberto</option><option value="IN_PROGRESS">Em andamento</option><option value="RESOLVED">Resolvido</option><option value="CLOSED">Fechado</option></select></label><small>{ticket.priority}{ticket.category ? ` · ${ticket.category}` : ""}</small></article>) : <p className="empty">Nenhum ticket para esta organização.</p>}</div><h2>Base de conhecimento</h2><div className="admin-list">{sources.map((source) => <article className="admin-card" key={source.id}><strong>{source.title}</strong><p>{source.type} · {source.visibility}</p><small>{source.indexingStatus}{source.active ? " · ativa" : ""}</small></article>)}</div></section></main>;
}
