import dynamic from "next/dynamic";
import type { ComponentType } from "react";

interface ArtworkSceneProps {
  playing: boolean;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

export interface ArtworkEntry {
  component: ComponentType<ArtworkSceneProps>;
  stepLabels: readonly string[];
}

const registry: Record<string, ArtworkEntry> = {
  rag: {
    component: dynamic(() => import("./rag/RagScene"), { ssr: false }),
    stepLabels: [
      "User Query",
      "Embedding",
      "Vector Search",
      "Data Retrieval",
      "LLM Processing",
      "Answer",
    ],
  },
  llm: {
    component: dynamic(() => import("./llm/Scene"), { ssr: false }),
    stepLabels: [
      "Text Input",
      "Tokenization",
      "Embedding",
      "Transformer Layers",
      "Prediction",
      "Output",
    ],
  },
  gpt: {
    component: dynamic(() => import("./gpt/Scene"), { ssr: false }),
    stepLabels: [
      "Token Embed",
      "Position Encode",
      "Causal Mask",
      "Attention + FFN",
      "Next Token",
      "Autoregressive Loop",
    ],
  },
  tokenization: {
    component: dynamic(() => import("./tokenization/Scene"), { ssr: false }),
    stepLabels: [
      "Raw Text",
      "Character Split",
      "Byte Pair Encoding",
      "Merge Rules",
      "Token IDs",
      "Vocabulary",
    ],
  },
  diffusion: {
    component: dynamic(() => import("./diffusion/Scene"), { ssr: false }),
    stepLabels: [
      "Original Image",
      "Forward Diffusion",
      "Pure Noise",
      "Reverse Diffusion",
      "Generated Image",
    ],
  },
  stablediffusion: {
    component: dynamic(() => import("./stablediffusion/Scene"), { ssr: false }),
    stepLabels: [
      "Text Prompt",
      "CLIP Encoding",
      "Latent Noise",
      "U-Net Denoising",
      "VAE Decode",
      "Final Image",
    ],
  },
  prompt: {
    component: dynamic(() => import("./prompt/Scene"), { ssr: false }),
    stepLabels: [
      "Raw Query",
      "System Prompt",
      "Context Injection",
      "Few-shot Examples",
      "LLM Processing",
      "Enhanced Output",
    ],
  },
  cot: {
    component: dynamic(() => import("./cot/Scene"), { ssr: false }),
    stepLabels: [
      "Question",
      "Step 1: Understand",
      "Step 2: Decompose",
      "Step 3: Reason",
      "Step 4: Verify",
      "Answer",
    ],
  },
  finetune: {
    component: dynamic(() => import("./finetune/Scene"), { ssr: false }),
    stepLabels: [
      "Pre-trained Model",
      "Task Data",
      "Training Loop",
      "Gradient Update",
      "Adapted Model",
      "Task Output",
    ],
  },
  lora: {
    component: dynamic(() => import("./lora/Scene"), { ssr: false }),
    stepLabels: [
      "Original Weights",
      "Freeze Weights",
      "Low-Rank A",
      "Low-Rank B",
      "A\u00D7B Addition",
      "Efficient Model",
    ],
  },
  agents: {
    component: dynamic(() => import("./agents/Scene"), { ssr: false }),
    stepLabels: [
      "User Task",
      "Planning",
      "Tool Selection",
      "Execution",
      "Observation",
      "Final Result",
    ],
  },
  multimodal: {
    component: dynamic(() => import("./multimodal/Scene"), { ssr: false }),
    stepLabels: [
      "Text Input",
      "Image Input",
      "Audio Input",
      "Encoder Fusion",
      "Cross-Modal Attention",
      "Unified Output",
    ],
  },
  rlhf: {
    component: dynamic(() => import("./rlhf/Scene"), { ssr: false }),
    stepLabels: [
      "LLM Generates",
      "Human Compares",
      "Reward Model",
      "PPO Training",
      "Model Updates",
      "Aligned Output",
    ],
  },
  distillation: {
    component: dynamic(() => import("./distillation/Scene"), { ssr: false }),
    stepLabels: [
      "Teacher Model",
      "Soft Labels",
      "Student Model",
      "Knowledge Transfer",
      "Training",
      "Compact Model",
    ],
  },
  vectordb: {
    component: dynamic(() => import("./vectordb/Scene"), { ssr: false }),
    stepLabels: [
      "Data Input",
      "Embedding",
      "Index Building",
      "Query Vector",
      "ANN Search",
      "Top-K Results",
    ],
  },
  imagegen: {
    component: dynamic(() => import("./imagegen/Scene"), { ssr: false }),
    stepLabels: [
      "Text Prompt",
      "Encoding",
      "Noise Init",
      "Iterative Refinement",
      "Upscaling",
      "Output Image",
    ],
  },
  texttovideo: {
    component: dynamic(() => import("./texttovideo/Scene"), { ssr: false }),
    stepLabels: [
      "Text Prompt",
      "Spatial Encoding",
      "Frame Generation",
      "Temporal Coherence",
      "Motion Refinement",
      "Video Output",
    ],
  },
  moe: {
    component: dynamic(() => import("./moe/Scene"), { ssr: false }),
    stepLabels: [
      "Input Token",
      "Router Network",
      "Expert Selection",
      "Parallel Processing",
      "Weighted Combine",
      "Output",
    ],
  },
  transformer: {
    component: dynamic(() => import("./transformer/Scene"), { ssr: false }),
    stepLabels: [
      "Tokens",
      "Position Encoding",
      "Self-Attention",
      "Feed Forward",
      "Output",
    ],
  },
  attention: {
    component: dynamic(() => import("./attention/Scene"), { ssr: false }),
    stepLabels: [
      "Input",
      "Q / K / V Split",
      "Dot Product",
      "Softmax",
      "Weighted Sum",
      "Output",
    ],
  },
};

export function getArtwork(artworkId: string): ArtworkEntry | undefined {
  return registry[artworkId];
}
