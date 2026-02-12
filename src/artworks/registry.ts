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
};

export function getArtwork(artworkId: string): ArtworkEntry | undefined {
  return registry[artworkId];
}
