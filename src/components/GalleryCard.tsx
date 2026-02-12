import { memo, useCallback } from "react";
import { GalleryItem } from "@/types";

interface GalleryCardProps {
  item: GalleryItem;
  onClick: (item: GalleryItem) => void;
}

export default memo(function GalleryCard({ item, onClick }: GalleryCardProps) {
  const handleClick = useCallback(() => onClick(item), [onClick, item]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(item);
      }
    },
    [onClick, item]
  );

  return (
    <div
      className="card-animate"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${item.title} - ${item.description}`}
    >
      <div className="gallery-card cursor-pointer">
        {/* Gradient visual area — uniform aspect ratio */}
        <div
          className={`bg-gradient-to-br ${item.gradient} relative flex flex-col items-center justify-center`}
          style={{ aspectRatio: "16 / 10" }}
        >
          {item.artworkId && (
            <span className="absolute top-2.5 right-2.5 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/30 text-white backdrop-blur-sm">
              3D Interactive
            </span>
          )}
          <span className="text-5xl mb-2 drop-shadow-lg" role="img" aria-label={item.title}>
            {item.emoji}
          </span>
          <h3 className="text-white text-lg font-bold text-center drop-shadow-md px-4">
            {item.title}
          </h3>
        </div>

        {/* Info area */}
        <div className="p-4">
          <p className="text-gray-500 text-sm leading-relaxed mb-3 line-clamp-2">
            {item.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
