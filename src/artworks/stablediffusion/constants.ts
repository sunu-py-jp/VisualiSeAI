// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Text Prompt",
  "CLIP Encoding",
  "Latent Noise",
  "U-Net Denoising",
  "VAE Decode",
  "Final Image",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  PROMPT: [0, 2.5] as const,
  CLIP: [2.5, 5] as const,
  LATENT: [5, 8] as const,
  UNET: [8, 13] as const,
  VAE: [13, 16] as const,
  FINAL: [16, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right layout) ───
export const POS = {
  prompt: [-11, 0, 0] as [number, number, number],
  clip: [-6, 0, 0] as [number, number, number],
  latent: [-1, 0, 0] as [number, number, number],
  unet: [4, 0, 0] as [number, number, number],
  vae: [8, 0, 0] as [number, number, number],
  final: [12, 0, 0] as [number, number, number],
};

// ─── Color palette (purple-indigo theme) ───
export const COLOR = {
  prompt: "#a78bfa",
  clip: "#818cf8",
  latent: "#6366f1",
  unet: "#8b5cf6",
  vae: "#c084fc",
  final: "#a855f7",
  accent: "#e0c3fc",
  bg: "#1e1b4b",
};
