"use client";

import { GalleryItem } from "@/types";
import { useEffect } from "react";

interface LightboxProps {
  item: GalleryItem;
  onClose: () => void;
}

export default function Lightbox({ item, onClose }: LightboxProps) {
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

  return (
    <div
      className="lightbox-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <div
        className="lightbox-content max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div
          className={`bg-gradient-to-br ${item.gradient} p-8 flex flex-col items-center justify-center rounded-t-xl`}
        >
          <span className="text-7xl mb-4 drop-shadow-lg" role="img" aria-label={item.title}>
            {item.emoji}
          </span>
          <h2 className="text-white text-3xl font-bold text-center drop-shadow-md">
            {item.title}
          </h2>
          <p className="text-white/80 text-sm mt-2 font-medium">
            {item.category}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          <p className="text-gray-600 text-base leading-relaxed mb-6">
            {item.detail}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
