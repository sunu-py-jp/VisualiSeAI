// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Text Input",
  "Image Input",
  "Audio Input",
  "Encoder Fusion",
  "Cross-Modal Attention",
  "Unified Output",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  TEXT:      [0, 3]     as const,
  IMAGE:    [1.5, 4.5]  as const,
  AUDIO:    [3, 6]      as const,
  FUSION:   [6, 10]     as const,
  CROSS:    [10, 14.5]  as const,
  OUTPUT:   [14.5, 18]  as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions ───
export const POS = {
  textStart:   [-12, 0, 0]   as [number, number, number],
  imageStart:  [0, 10, -3]   as [number, number, number],
  audioStart:  [0, -10, 2]   as [number, number, number],
  textEnc:     [-5, 0, 0]    as [number, number, number],
  imageEnc:    [0, 4, -1.5]  as [number, number, number],
  audioEnc:    [0, -4, 1]    as [number, number, number],
  fusion:      [2, 0, 0]     as [number, number, number],
  output:      [10, 0, 0]    as [number, number, number],
};

// ─── Color palette (fuchsia-pink theme) ───
export const COLOR = {
  text:    "#38bdf8",
  image:   "#a78bfa",
  audio:   "#34d399",
  textEnc: "#818cf8",
  imgEnc:  "#c084fc",
  audEnc:  "#6ee7b7",
  fusion:  "#d946ef",
  cross:   "#f0abfc",
  output:  "#fce7f3",
  bg:      "#2e1065",
};
