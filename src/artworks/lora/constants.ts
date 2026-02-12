// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Original Weights",
  "Freeze Weights",
  "Low-Rank A",
  "Low-Rank B",
  "A×B Addition",
  "Efficient Model",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  ORIGINAL: [0, 3] as const,
  FREEZE: [3, 6] as const,
  LORA_A: [6, 9] as const,
  LORA_B: [9, 12] as const,
  MULTIPLY: [12, 15] as const,
  EFFICIENT: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions ───
export const POS = {
  matrix: [-2, 0, 0] as [number, number, number],
  loraA: [4, -2, 0] as [number, number, number],
  loraB: [7.5, 1.5, 0] as [number, number, number],
  result: [4, 1.5, 0] as [number, number, number],
};

// ─── Color palette (sky-cyan theme) ───
export const COLOR = {
  weight: "#38bdf8", // sky-400
  frozen: "#7dd3fc", // sky-300 icy
  loraA: "#06b6d4", // cyan-500
  loraB: "#22d3ee", // cyan-400
  multiply: "#67e8f9", // cyan-300
  efficient: "#0ea5e9", // sky-500
  bg: "#0c2a3e", // dark cyan bg
};
