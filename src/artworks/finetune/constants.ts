// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Pre-trained Model",
  "Task Data",
  "Training Loop",
  "Gradient Update",
  "Adapted Model",
  "Task Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  PRETRAINED: [0, 3] as const,
  TASKDATA: [3, 6] as const,
  TRAINING: [6, 10] as const,
  GRADIENT: [10, 13] as const,
  ADAPTED: [13, 16] as const,
  OUTPUT: [16, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions ───
export const POS = {
  model: [0, 0, 0] as [number, number, number],
  dataStart: [-10, 0, 0] as [number, number, number],
  outputEnd: [10, 0, 0] as [number, number, number],
};

// ─── Color palette (amber-orange theme) ───
export const COLOR = {
  pretrained: "#60a5fa", // cool blue
  adapted: "#f59e0b", // amber
  data: "#fb923c", // orange data points
  gradient: "#f97316", // gradient wave
  output: "#fbbf24", // golden output
  bg: "#3b2a1a", // dark warm bg
};
