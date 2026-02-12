// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Input",
  "Q / K / V Split",
  "Dot Product",
  "Softmax",
  "Weighted Sum",
  "Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  INPUT: [0, 2.5] as const,
  QKV: [2.5, 6] as const,
  DOT: [6, 9.5] as const,
  SOFTMAX: [9.5, 13] as const,
  WEIGHTED: [13, 16] as const,
  OUTPUT: [16, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions ───
export const POS = {
  input: [-11, 0, 0] as [number, number, number],
  qkv: [-5.5, 0, 0] as [number, number, number],
  dot: [-0.5, 0, 0] as [number, number, number],
  softmax: [4, 0, 0] as [number, number, number],
  weighted: [8, 0, 0] as [number, number, number],
  output: [11, 0, 0] as [number, number, number],
};

// ─── Color palette ───
export const COLOR = {
  input: "#94a3b8",
  query: "#f472b6",
  key: "#22d3ee",
  value: "#fbbf24",
  softmax: "#a78bfa",
  output: "#34d399",
  bg: "#1e3a5f",
};
