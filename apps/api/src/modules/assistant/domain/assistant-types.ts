export interface RetrievedChunk {
  id: string;
  sourceId: string;
  sourceVersion: number;
  title: string;
  content: string;
  position: number;
  page: number | null;
  similarity: number;
}

export interface Citation {
  chunkId: string;
  sourceId: string;
  sourceVersion: number;
  title: string;
  page: number | null;
}

export interface AssistantAnswer {
  answer: string;
  citations: Citation[];
  fallback: boolean;
  canOpenTicket: boolean;
  metadata: {
    promptVersion: string;
    retrievalStrategyVersion: string;
    model: string | null;
  };
}
