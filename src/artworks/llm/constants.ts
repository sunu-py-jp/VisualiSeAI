// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Text Input",
  "Tokenization",
  "Embedding",
  "Transformer Layers",
  "Prediction",
  "Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  INPUT:      [0, 2.5] as const,
  TOKENIZE:   [2.5, 5.5] as const,
  EMBED:      [5.5, 8.5] as const,
  TRANSFORM:  [8.5, 13] as const,
  PREDICT:    [13, 16] as const,
  OUTPUT:     [16, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right flow) ───
export const POS = {
  input:     [-12, 0, 0] as [number, number, number],
  tokenize:  [-7, 0, 0] as [number, number, number],
  embed:     [-2, 0, 0] as [number, number, number],
  transform: [4, 0, 0] as [number, number, number],
  predict:   [9, 0, 0] as [number, number, number],
  output:    [13, 0, 0] as [number, number, number],
};

// ─── Color palette (violet-purple theme) ───
export const COLOR = {
  input:     "#c4b5fd",
  token:     "#a78bfa",
  embed:     "#8b5cf6",
  transform: "#7c3aed",
  predict:   "#6d28d9",
  output:    "#ddd6fe",
  accent:    "#f0abfc",
  bg:        "#2e1065",
};
