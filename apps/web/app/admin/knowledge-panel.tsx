"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  apiRequest,
  errorMessage,
  formatDate,
  IngestionJob,
  indexingLabels,
  randomKey,
  Source,
  Visibility
} from "./api-client";

type Props = { csrf: string; onSessionExpired: () => void };

export function KnowledgePanel({ csrf, onSessionExpired }: Props) {
  const [sources, setSources] = useState<Source[]>();
  const [failures, setFailures] = useState<IngestionJob[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const fail = useCallback(
    (reason: unknown, fallback: string) => {
      if (reason instanceof ApiError && reason.status === 401) onSessionExpired();
      else setError(errorMessage(reason, fallback));
    },
    [onSessionExpired]
  );

  const load = useCallback(async () => {
    try {
      const [sourceList, failedJobs] = await Promise.all([
        apiRequest<Source[]>("/knowledge/sources"),
        apiRequest<IngestionJob[]>("/ingestion-jobs?status=FAILED&limit=20")
      ]);
      setSources(sourceList.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      setFailures(failedJobs.filter((job) => !job.source.deleted));
    } catch (reason) {
      fail(reason, "Não foi possível carregar a base de conhecimento.");
    }
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string, fallback: string) {
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (reason) {
      fail(reason, fallback);
      return false;
    }
  }

  function reindex(familyId: string) {
    return run(
      () =>
        apiRequest(`/knowledge/${familyId}/reindex`, {
          method: "POST",
          csrf,
          headers: { "idempotency-key": randomKey() }
        }),
      "Reprocessamento solicitado. O worker vai indexar a fonte em instantes.",
      "Não foi possível solicitar o reprocessamento."
    );
  }

  function remove(source: Source) {
    if (!window.confirm(`Remover "${source.title}" da base de conhecimento?`)) return;
    const path = source.type === "ARTICLE" ? "articles" : "pdfs";
    void run(
      () => apiRequest(`/knowledge/${path}/${source.id}`, { method: "DELETE", csrf }),
      "Fonte removida.",
      "Não foi possível remover a fonte."
    );
  }

  return (
    <div className="admin-section">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <div className="form-grid">
        <ArticleForm
          onSubmit={(input) =>
            run(
              () => apiRequest("/knowledge/articles", { method: "POST", csrf, body: input }),
              "Artigo criado e enviado para indexação.",
              "Não foi possível criar o artigo."
            )
          }
        />
        <PdfForm
          onSubmit={(form) =>
            run(
              () => apiRequest("/knowledge/pdfs", { method: "POST", csrf, body: form }),
              "PDF enviado para indexação.",
              "Não foi possível enviar o PDF."
            )
          }
        />
      </div>

      {failures.length > 0 && (
        <>
          <h2>Falhas de ingestão</h2>
          <div className="admin-list">
            {failures.map((job) => (
              <article className="admin-card failure" key={job.id}>
                <strong>{job.source.title}</strong>
                <p>
                  {job.error?.code ?? "ERRO_DESCONHECIDO"}
                  {job.error?.message ? ` — ${job.error.message}` : ""}
                </p>
                <small>
                  v{job.source.version} · {job.attempts} tentativa(s) · {formatDate(job.updatedAt)}
                </small>
                <button type="button" onClick={() => void reindex(job.source.familyId)}>
                  Reprocessar
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="detail-heading">
        <h2>Fontes</h2>
        <button type="button" className="secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>
      <div className="admin-list" aria-live="polite">
        {sources === undefined ? (
          <p className="empty" role="status">
            Carregando fontes…
          </p>
        ) : sources.length === 0 ? (
          <p className="empty">Nenhuma fonte cadastrada. Crie um artigo ou envie um PDF.</p>
        ) : (
          sources.map((source) => (
            <article className="admin-card" key={source.id}>
              <strong>{source.title}</strong>
              <p>
                {source.type === "ARTICLE" ? "Artigo" : "PDF"} ·{" "}
                {source.visibility === "PUBLIC" ? "Pública" : "Interna"} · v{source.version}
              </p>
              <small>
                <span className={`badge ${source.indexingStatus.toLowerCase()}`}>
                  {indexingLabels[source.indexingStatus]}
                </span>
                {source.active ? " · ativa no assistente" : ""}
              </small>
              <div className="card-actions">
                <button type="button" className="secondary" onClick={() => void reindex(source.id)}>
                  Reprocessar
                </button>
                <button type="button" className="danger" onClick={() => remove(source)}>
                  Remover
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function VisibilitySelect({
  id,
  value,
  onChange
}: {
  id: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
}) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as Visibility)}>
      <option value="PUBLIC">Pública — usada nas respostas ao cliente</option>
      <option value="INTERNAL">Interna — apenas atendentes</option>
    </select>
  );
}

function ArticleForm({
  onSubmit
}: {
  onSubmit: (input: { title: string; content: string; visibility: Visibility }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    if (await onSubmit({ title: title.trim(), content, visibility })) {
      setTitle("");
      setContent("");
    }
    setPending(false);
  }

  return (
    <form className="composer panel-form" onSubmit={submit} aria-labelledby="article-form-title">
      <h3 id="article-form-title">Novo artigo</h3>
      <label htmlFor="article-title">Título</label>
      <input
        id="article-title"
        value={title}
        minLength={3}
        maxLength={160}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <label htmlFor="article-content">Conteúdo</label>
      <textarea
        id="article-content"
        rows={6}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        required
      />
      <label htmlFor="article-visibility">Visibilidade</label>
      <VisibilitySelect id="article-visibility" value={visibility} onChange={setVisibility} />
      <button disabled={pending}>{pending ? "Salvando…" : "Criar artigo"}</button>
    </form>
  );
}

function PdfForm({ onSubmit }: { onSubmit: (form: FormData) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set("title", title.trim());
    form.set("visibility", visibility);
    form.set("file", file);
    setPending(true);
    if (await onSubmit(form)) {
      setTitle("");
      setFile(undefined);
      setInputKey((key) => key + 1);
    }
    setPending(false);
  }

  return (
    <form className="composer panel-form" onSubmit={submit} aria-labelledby="pdf-form-title">
      <h3 id="pdf-form-title">Enviar PDF</h3>
      <label htmlFor="pdf-title">Título</label>
      <input
        id="pdf-title"
        value={title}
        minLength={3}
        maxLength={160}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <label htmlFor="pdf-file">Arquivo PDF</label>
      <input
        key={inputKey}
        id="pdf-file"
        type="file"
        accept="application/pdf"
        onChange={(event) => setFile(event.target.files?.[0])}
        required
      />
      <label htmlFor="pdf-visibility">Visibilidade</label>
      <VisibilitySelect id="pdf-visibility" value={visibility} onChange={setVisibility} />
      <button disabled={pending || !file}>{pending ? "Enviando…" : "Enviar PDF"}</button>
    </form>
  );
}
