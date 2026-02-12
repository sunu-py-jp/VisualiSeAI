// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Text Prompt",
  "Encoding",
  "Noise Init",
  "Iterative Refinement",
  "Upscaling",
  "Output Image",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  PROMPT:    [0, 2.5] as const,
  ENCODE:    [2.5, 5] as const,
  NOISE:     [5, 8] as const,
  REFINE:    [8, 13] as const,
  UPSCALE:   [13, 16] as const,
  OUTPUT:    [16, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right flow) ───
export const POS = {
  prompt:   [-12, 0, 0] as [number, number, number],
  encode:   [-7, 0, 0] as [number, number, number],
  noise:    [-1.5, 0, 0] as [number, number, number],
  refine:   [4, 0, 0] as [number, number, number],
  upscale:  [9, 0, 0] as [number, number, number],
  output:   [13, 0, 0] as [number, number, number],
};

// ─── Color palette (orange-red theme) ───
export const COLOR = {
  prompt:  "#fb923c",
  encode:  "#f97316",
  noise:   "#ea580c",
  refine:  "#dc2626",
  upscale: "#ef4444",
  output:  "#fbbf24",
  accent:  "#fdba74",
  bg:      "#451a03",
};
