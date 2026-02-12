// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Input Token",
  "Router Network",
  "Expert Selection",
  "Parallel Processing",
  "Weighted Combine",
  "Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  INPUT:    [0, 2.5] as const,
  ROUTER:   [2.5, 5.5] as const,
  SELECT:   [5.5, 8.5] as const,
  PROCESS:  [8.5, 12.5] as const,
  COMBINE:  [12.5, 15.5] as const,
  OUTPUT:   [15.5, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right flow) ───
export const POS = {
  input:    [-12, 0, 0] as [number, number, number],
  router:   [-6, 0, 0] as [number, number, number],
  experts:  [2, 0, 0] as [number, number, number],
  combine:  [9, 0, 0] as [number, number, number],
  output:   [13, 0, 0] as [number, number, number],
};

// ─── Color palette (green-emerald theme) ───
export const COLOR = {
  input:    "#4ade80",
  router:   "#22c55e",
  expert:   "#16a34a",
  selected: "#10b981",
  dimmed:   "#1a3a2a",
  combine:  "#34d399",
  output:   "#6ee7b7",
  accent:   "#a7f3d0",
  bg:       "#052e16",
};
