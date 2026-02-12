// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Tokens",
  "Position Encoding",
  "Self-Attention",
  "Feed Forward",
  "Output",
] as const;

export const TOTAL_STEPS = 5;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  TOKENS: [0, 3] as const,
  POS_ENC: [3, 6] as const,
  ATTENTION: [6, 10.5] as const,
  FFN: [10.5, 14] as const,
  OUTPUT: [14, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions ───
export const POS = {
  tokens: [-10, 0, 0] as [number, number, number],
  posEnc: [-5, 0, 0] as [number, number, number],
  attention: [0, 0, 0] as [number, number, number],
  ffn: [5, 0, 0] as [number, number, number],
  output: [10, 0, 0] as [number, number, number],
};

// ─── Color palette ───
export const COLOR = {
  tokens: "#94a3b8",
  posEnc: "#fbbf24",
  attention: "#f472b6",
  ffn: "#818cf8",
  output: "#34d399",
  bg: "#1e3a5f",
};
