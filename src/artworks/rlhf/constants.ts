// ─── Step labels for UI ───
export const STEP_LABELS = [
  "LLM Generates",
  "Human Compares",
  "Reward Model",
  "PPO Training",
  "Model Updates",
  "Aligned Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  GENERATE: [0, 3] as const,
  COMPARE: [3, 6] as const,
  REWARD: [6, 9] as const,
  PPO: [9, 12] as const,
  UPDATE: [12, 15] as const,
  OUTPUT: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right layout) ───
export const POS = {
  llm: [-10, 0, 0] as [number, number, number],
  outputA: [-5.5, 1.8, 0] as [number, number, number],
  outputB: [-5.5, -1.8, 0] as [number, number, number],
  human: [-2, 0, 0] as [number, number, number],
  reward: [3, 0, 0] as [number, number, number],
  ppo: [8, 0, 0] as [number, number, number],
};

// ─── Color palette (red-rose theme) ───
export const COLOR = {
  llm: "#f87171",
  outputA: "#fb923c",
  outputB: "#c084fc",
  human: "#fda4af",
  reward: "#fbbf24",
  ppo: "#f43f5e",
  aligned: "#4ade80",
  bg: "#3b1929",
  selected: "#4ade80",
  dimmed: "#4b5563",
};
