// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Original Image",
  "Forward Diffusion",
  "Pure Noise",
  "Reverse Diffusion",
  "Generated Image",
] as const;

export const TOTAL_STEPS = 5;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  ORIGINAL: [0, 3] as const,
  FORWARD: [3, 7] as const,
  NOISE: [7, 10] as const,
  REVERSE: [10, 15] as const,
  GENERATED: [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right layout) ───
export const POS = {
  original: [-10, 0, 0] as [number, number, number],
  forwardMid: [-4, 0, 0] as [number, number, number],
  noise: [0, 0, 0] as [number, number, number],
  reverseMid: [4, 0, 0] as [number, number, number],
  generated: [10, 0, 0] as [number, number, number],
};

// ─── Color palette (pink-rose theme) ───
export const COLOR = {
  original: "#f472b6",
  forward: "#fb7185",
  noise: "#94a3b8",
  reverse: "#e879f9",
  generated: "#f43f5e",
  accent: "#fda4af",
  bg: "#4a1942",
};

// ─── Particle count for the icosahedron decomposition ───
export const PARTICLE_COUNT = 200;
