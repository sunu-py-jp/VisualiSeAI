// ─── Step labels for UI ───
export const STEP_LABELS = [
  "User Task",
  "Planning",
  "Tool Selection",
  "Execution",
  "Observation",
  "Final Result",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  TASK:      [0, 3]     as const,
  PLAN:      [3, 6.5]   as const,
  TOOL:      [6.5, 10]  as const,
  EXEC:      [10, 13.5] as const,
  OBSERVE:   [13.5, 17] as const,
  RESULT:    [17, 20]   as const,
};

export const TOTAL_DURATION = 20;

// ─── Key positions ───
export const POS = {
  user:   [-11, -1, 0]   as [number, number, number],
  brain:  [-3, 1, 0]     as [number, number, number],
  tools:  [4, 0, 0]      as [number, number, number],
  toolA:  [2.5, 2.5, 1]  as [number, number, number],
  toolB:  [5.5, 2.5, -1] as [number, number, number],
  toolC:  [4, -2, 0]     as [number, number, number],
  result: [11, -0.5, 0]  as [number, number, number],
};

// ─── Color palette (indigo-violet theme) ───
export const COLOR = {
  user:    "#94a3b8",
  task:    "#818cf8",
  brain:   "#a78bfa",
  plan:    "#c084fc",
  tool:    "#6366f1",
  exec:    "#8b5cf6",
  observe: "#a5b4fc",
  result:  "#e0e7ff",
  loop:    "#7c3aed",
  bg:      "#1e1b4b",
};
