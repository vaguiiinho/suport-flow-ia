"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest, errorMessage } from "./api-client";
import { KnowledgePanel } from "./knowledge-panel";
import { TicketsPanel } from "./tickets-panel";

type SessionState = { status: "checking" } | { status: "anonymous" } | { status: "authenticated"; csrf: string };

export function AdminConsole() {
  const [session, setSession] = useState<SessionState>({ status: "checking" });
  const [tab, setTab] = useState<"tickets" | "knowledge">("tickets");

  useEffect(() => {
    apiRequest<{ csrfToken: string }>("/auth/csrf")
      .then(({ csrfToken }) => setSession({ status: "authenticated", csrf: csrfToken }))
      .catch(() => setSession({ status: "anonymous" }));
  }, []);

  if (session.status === "checking") {
    return (
      <section className="chat admin" aria-busy="true">
        <p className="empty" role="status">
          Verificando sessão…
        </p>
      </section>
    );
  }

  if (session.status === "anonymous") {
    return <LoginForm onAuthenticated={(csrf) => setSession({ status: "authenticated", csrf })} />;
  }

  async function logout(csrf: string) {
    await apiRequest("/auth/logout", { method: "POST", csrf }).catch(() => undefined);
    setSession({ status: "anonymous" });
  }

  const expire = () => setSession({ status: "anonymous" });

  return (
    <section className="chat admin" aria-labelledby="admin-title">
      <div className="chat-heading">
        <div>
          <p className="section-label">Área protegida</p>
          <h1 id="admin-title">Operação de suporte</h1>
        </div>
        <button type="button" className="secondary" onClick={() => void logout(session.csrf)}>
          Sair
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label="Seções do painel">
        <button
          type="button"
          role="tab"
          id="tab-tickets"
          aria-controls="panel-tickets"
          aria-selected={tab === "tickets"}
          onClick={() => setTab("tickets")}
        >
          Tickets
        </button>
        <button
          type="button"
          role="tab"
          id="tab-knowledge"
          aria-controls="panel-knowledge"
          aria-selected={tab === "knowledge"}
          onClick={() => setTab("knowledge")}
        >
          Base de conhecimento
        </button>
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "tickets" ? (
          <TicketsPanel csrf={session.csrf} onSessionExpired={expire} />
        ) : (
          <KnowledgePanel csrf={session.csrf} onSessionExpired={expire} />
        )}
      </div>
    </section>
  );
}

function LoginForm({ onAuthenticated }: { onAuthenticated: (csrf: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const result = await apiRequest<{ csrfToken: string }>("/auth/login", {
        method: "POST",
        body: { email, password }
      });
      onAuthenticated(result.csrfToken);
    } catch (reason) {
      setError(errorMessage(reason, "Não foi possível autenticar."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chat admin" aria-labelledby="login-title">
      <p className="section-label">Área protegida</p>
      <h1 id="login-title">Painel do atendente</h1>
      <form className="composer" onSubmit={submit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
