export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type IndexingStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
export type Visibility = "PUBLIC" | "INTERNAL";

export type Ticket = {
  id: string;
  number: string;
  summary: string;
  description: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketDetail = Ticket & {
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT";
    content: string;
    createdAt: string;
    citations: Array<{ sourceId: string; sourceVersion: number; title: string; page: number | null }>;
  }>;
  history: Array<{ id: string; type: "CREATED" | "UPDATED"; changes: Record<string, unknown>; createdAt: string }>;
};

export type Source = {
  id: string;
  title: string;
  type: "ARTICLE" | "PDF";
  visibility: Visibility;
  version: number;
  indexingStatus: IndexingStatus;
  active: boolean;
  updatedAt: string;
};

export type IngestionJob = {
  id: string;
  operation: "INDEX" | "REINDEX";
  status: IndexingStatus;
  attempts: number;
  progress: number;
  error: { code: string; message: string | null } | null;
  updatedAt: string;
  source: { familyId: string; title: string; type: "ARTICLE" | "PDF"; version: number; deleted: boolean };
};

export const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado"
};

export const priorityLabels: Record<TicketPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente"
};

export const indexingLabels: Record<IndexingStatus, string> = {
  PENDING: "Na fila",
  PROCESSING: "Processando",
  SUCCEEDED: "Indexada",
  FAILED: "Falhou"
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

type RequestOptions = { method?: string; csrf?: string; body?: unknown; headers?: Record<string, string> };

/** Browser-side call to the API using the attendant's httpOnly session cookie. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.csrf) headers["x-csrf-token"] = options.csrf;
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body
  });
  if (!response.ok) {
    let message = "A operação não pôde ser concluída.";
    try {
      const payload = (await response.json()) as { message?: unknown };
      if (typeof payload.message === "string") message = payload.message;
      else if (Array.isArray(payload.message)) message = payload.message.join("; ");
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError && reason.status === 401) return "Sua sessão expirou. Entre novamente.";
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

/** Random idempotency key; unlike crypto.randomUUID it also works outside secure (HTTPS/localhost) contexts. */
export function randomKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
