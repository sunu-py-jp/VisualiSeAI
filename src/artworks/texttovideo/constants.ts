// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Text Prompt",
  "Spatial Encoding",
  "Frame Generation",
  "Temporal Coherence",
  "Motion Refinement",
  "Video Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  PROMPT:    [0, 2.5] as const,
  SPATIAL:   [2.5, 5.5] as const,
  FRAMES:    [5.5, 9] as const,
  TEMPORAL:  [9, 12] as const,
  MOTION:    [12, 15.5] as const,
  OUTPUT:    [15.5, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right flow) ───
export const POS = {
  prompt:   [-12, 0, 0] as [number, number, number],
  spatial:  [-7, 0, 0] as [number, number, number],
  frames:   [-1.5, 0, 0] as [number, number, number],
  temporal: [4, 0, 0] as [number, number, number],
  motion:   [9, 0, 0] as [number, number, number],
  output:   [13, 0, 0] as [number, number, number],
};

// ─── Color palette (rose-pink theme) ───
export const COLOR = {
  prompt:   "#f43f5e",
  spatial:  "#e11d48",
  frame:    "#be185d",
  temporal: "#db2777",
  motion:   "#ec4899",
  output:   "#fda4af",
  accent:   "#fb7185",
  bg:       "#4c0519",
};
