// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Data Input",
  "Embedding",
  "Index Building",
  "Query Vector",
  "ANN Search",
  "Top-K Results",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  INPUT: [0, 3] as const,
  EMBED: [3, 6] as const,
  INDEX: [6, 9] as const,
  QUERY: [9, 12] as const,
  SEARCH: [12, 15] as const,
  TOPK: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right layout) ───
export const POS = {
  input: [-10, 0, 0] as [number, number, number],
  embed: [-5, 0, 0] as [number, number, number],
  index: [0, 0, 0] as [number, number, number],
  query: [6, 0, 0] as [number, number, number],
  results: [11, 0, 0] as [number, number, number],
};

// ─── Color palette (blue-indigo theme) ───
export const COLOR = {
  doc: "#93c5fd",
  vector: "#818cf8",
  index: "#6366f1",
  query: "#f59e0b",
  search: "#a78bfa",
  result: "#34d399",
  bg: "#0f1b3d",
};
