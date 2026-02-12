// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Teacher Model",
  "Soft Labels",
  "Student Model",
  "Knowledge Transfer",
  "Training",
  "Compact Model",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  TEACHER: [0, 3] as const,
  SOFT: [3, 6] as const,
  STUDENT: [6, 9] as const,
  TRANSFER: [9, 12] as const,
  TRAIN: [12, 15] as const,
  COMPACT: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right layout) ───
export const POS = {
  teacher: [-8, 0, 0] as [number, number, number],
  soft: [-2.5, 0, 0] as [number, number, number],
  student: [4, 0, 0] as [number, number, number],
  compact: [10, 0, 0] as [number, number, number],
};

// ─── Color palette (cyan-teal theme) ───
export const COLOR = {
  teacher: "#22d3ee",
  soft: "#67e8f9",
  student: "#2dd4bf",
  transfer: "#a78bfa",
  train: "#fbbf24",
  compact: "#34d399",
  bg: "#0c2a3a",
};
