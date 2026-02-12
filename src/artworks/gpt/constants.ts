// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Token Embed",
  "Position Encode",
  "Causal Mask",
  "Attention + FFN",
  "Next Token",
  "Autoregressive Loop",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  TOKEN_EMBED:  [0, 2.5] as const,
  POS_ENCODE:   [2.5, 5] as const,
  CAUSAL_MASK:  [5, 8] as const,
  ATTENTION_FFN:[8, 12] as const,
  NEXT_TOKEN:   [12, 15] as const,
  AUTO_LOOP:    [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right flow) ───
export const POS = {
  tokenEmbed:  [-12, 0, 0] as [number, number, number],
  posEncode:   [-7, 0, 0] as [number, number, number],
  causalMask:  [-2, 0, 0] as [number, number, number],
  attention:   [4, 0, 0] as [number, number, number],
  nextToken:   [9, 0, 0] as [number, number, number],
  autoLoop:    [13, 0, 0] as [number, number, number],
};

// ─── Color palette (teal-emerald theme) ───
export const COLOR = {
  token:     "#5eead4",
  position:  "#2dd4bf",
  mask:      "#14b8a6",
  attention: "#0d9488",
  predict:   "#10b981",
  loop:      "#34d399",
  accent:    "#6ee7b7",
  bg:        "#042f2e",
};
