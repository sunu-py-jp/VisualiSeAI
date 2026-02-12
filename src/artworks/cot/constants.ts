// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Question",
  "Step 1: Understand",
  "Step 2: Decompose",
  "Step 3: Reason",
  "Step 4: Verify",
  "Answer",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  QUESTION: [0, 3] as const,
  UNDERSTAND: [3, 6] as const,
  DECOMPOSE: [6, 9] as const,
  REASON: [9, 12] as const,
  VERIFY: [12, 15] as const,
  ANSWER: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left to right) ───
export const POS = {
  question: [-10, 0, 0] as [number, number, number],
  step1: [-5.5, 0, 0] as [number, number, number],
  step2: [-1.5, 0, 0] as [number, number, number],
  step3: [2.5, 0, 0] as [number, number, number],
  step4: [6.5, 0, 0] as [number, number, number],
  answer: [10.5, 0, 0] as [number, number, number],
};

// ─── Color palette (violet-fuchsia theme) ───
export const COLOR = {
  question: "#a78bfa", // violet-400
  step1: "#c084fc",    // purple-400
  step2: "#d946ef",    // fuchsia-500
  step3: "#e879f9",    // fuchsia-400
  step4: "#a855f7",    // purple-500
  answer: "#f0abfc",   // fuchsia-300
  chain: "#7c3aed",    // violet-600
  bg: "#1e1a2e",
};
