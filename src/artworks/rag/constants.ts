// ─── Step labels for UI ───
export const STEP_LABELS = [
  "User Query",
  "Embedding",
  "Vector Search",
  "Data Retrieval",
  "LLM Processing",
  "Answer",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  QUERY: [0, 2.5] as const,
  EMBED: [2.5, 5.5] as const,
  SEARCH: [5.5, 9] as const,
  DATA: [9, 12] as const,
  LLM: [12, 15] as const,
  ANSWER: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions ───
export const POS = {
  user: [-11, -0.5, 0] as [number, number, number],
  embed: [-5, 0.5, 0] as [number, number, number],
  db: [0, 0, 0] as [number, number, number],
  llm: [7.5, 0, 0] as [number, number, number],
};

// ─── Color palette ───
export const COLOR = {
  user: "#94a3b8",
  query: "#22d3ee",
  embed: "#a78bfa",
  db: "#34d399",
  data: "#fbbf24",
  llm: "#f472b6",
  answer: "#fde68a",
  bg: "#1e3a5f",
};
