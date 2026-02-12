// ─── Step labels for UI ───
export const STEP_LABELS = [
  "Raw Text",
  "Character Split",
  "Byte Pair Encoding",
  "Merge Rules",
  "Token IDs",
  "Vocabulary",
] as const;

export const TOTAL_STEPS = 6;

// ─── Phase timings [start, end] in seconds ───
export const PHASE = {
  RAW_TEXT:   [0, 2.5] as const,
  CHAR_SPLIT: [2.5, 5.5] as const,
  BPE:        [5.5, 9] as const,
  MERGE:      [9, 12] as const,
  TOKEN_IDS:  [12, 15] as const,
  VOCAB:      [15, 18] as const,
};

export const TOTAL_DURATION = 18;

// ─── Key positions (left-to-right flow) ───
export const POS = {
  rawText:   [-12, 0, 0] as [number, number, number],
  charSplit: [-7, 0, 0] as [number, number, number],
  bpe:       [-2, 0, 0] as [number, number, number],
  merge:     [4, 0, 0] as [number, number, number],
  tokenIds:  [9, 0, 0] as [number, number, number],
  vocab:     [13, 0, 0] as [number, number, number],
};

// ─── Color palette (stone-zinc theme) ───
export const COLOR = {
  text:      "#d6d3d1",
  char:      "#a8a29e",
  bpe:       "#78716c",
  merge:     "#57534e",
  tokenId:   "#a1a1aa",
  vocab:     "#d4d4d8",
  accent:    "#fbbf24",
  bg:        "#1c1917",
};
