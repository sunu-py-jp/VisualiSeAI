"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { getArtwork } from "@/artworks/registry";

interface ArtworkViewerProps {
  artworkId: string;
  title: string;
  onClose: () => void;
}

export default function ArtworkViewer({
  artworkId,
  title,
  onClose,
}: ArtworkViewerProps) {
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const artwork = getArtwork(artworkId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    setCompleted(false);
    setCurrentStep(0);
  }, []);

  const handleComplete = useCallback(() => {
    setPlaying(false);
    setCompleted(true);
  }, []);

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  if (!artwork) return null;

  const SceneComponent = artwork.component;
  const stepLabel =
    currentStep >= 0 && currentStep < artwork.stepLabels.length
      ? artwork.stepLabels[currentStep]
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <h2 className="text-white text-xl font-bold">{title}</h2>
          {playing && currentStep >= 0 && (
            <span className="text-sm text-zinc-400 bg-white/10 px-3 py-1 rounded-full">
              Step {currentStep + 1}/{artwork.stepLabels.length} — {stepLabel}
            </span>
          )}
          {completed && (
            <span className="text-sm text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">
              Complete
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors text-2xl leading-none p-2"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* 3D Canvas */}
      <div
        className="flex-1 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <Canvas
          camera={{ position: [-1, 3, 18], fov: 50 }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <SceneComponent
              playing={playing}
              onStepChange={handleStepChange}
              onComplete={handleComplete}
            />
          </Suspense>
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxDistance={30}
            minDistance={5}
          />
        </Canvas>

        {/* Step indicators at bottom */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {artwork.stepLabels.map((label, i) => {
            const isActive = playing && currentStep === i;
            const isDone =
              (playing && currentStep > i) || (!playing && completed);
            return (
              <div
                key={i}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                  isActive
                    ? "bg-white/20 text-white scale-110"
                    : isDone
                    ? "bg-white/10 text-zinc-400"
                    : "bg-white/5 text-zinc-600"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive
                      ? "bg-white"
                      : isDone
                      ? "bg-zinc-400"
                      : "bg-zinc-700"
                  }`}
                />
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className="flex justify-center py-4 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {!playing && !completed && (
          <button
            onClick={handlePlay}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <span>&#9654;</span> Play
          </button>
        )}
        {playing && (
          <div className="px-8 py-3 text-zinc-400 text-sm">
            Playing...
          </div>
        )}
        {!playing && completed && (
          <button
            onClick={handlePlay}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <span>&#8635;</span> Replay
          </button>
        )}
      </div>
    </div>
  );
}
