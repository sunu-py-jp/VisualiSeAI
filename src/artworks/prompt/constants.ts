// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Raw Query",
  "System Prompt",
  "Context Injection",
  "Few-shot Examples",
  "LLM Processing",
  "Enhanced Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  RAW: [0, 3] as const,
  SYSTEM: [3, 6] as const,
  CONTEXT: [6, 9] as const,
  FEWSHOT: [9, 12] as const,
  LLM: [12, 15] as const,
  OUTPUT: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left to right) ───
export const POS = {
  query: [-10, 0, 0] as [number, number, number],
  system: [-5, 0, 0] as [number, number, number],
  context: [-1, 0, 0] as [number, number, number],
  fewshot: [3, 0, 0] as [number, number, number],
  llm: [7, 0, 0] as [number, number, number],
  output: [11, 0, 0] as [number, number, number],
};

// ─── Color palette (lime-green theme) ───
export const COLOR = {
  query: "#a3e635",   // lime-400
  system: "#65a30d",  // lime-700
  context: "#84cc16", // lime-500
  fewshot: "#22c55e", // green-500
  llm: "#16a34a",     // green-600
  output: "#4ade80",  // green-400
  bg: "#1a2e1a",
};
