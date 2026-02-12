import { GalleryItem } from "@/types";

interface GalleryCardProps {
  item: GalleryItem;
  onClick: (item: GalleryItem) => void;
}

export default function GalleryCard({ item, onClick }: GalleryCardProps) {
  return (
    <div
      className={`masonry-item card-animate`}
      onClick={() => onClick(item)}
    >
      <div
        className={`glass-card cursor-pointer overflow-hidden card-height-${item.height}`}
      >
        {/* Gradient visual area */}
        <div
          className={`bg-gradient-to-br ${item.gradient} p-6 flex flex-col items-center justify-center`}
          style={{ minHeight: "60%" }}
        >
          <span className="text-5xl mb-3 drop-shadow-lg" role="img" aria-label={item.title}>
            {item.emoji}
          </span>
          <h3 className="text-white text-xl font-bold text-center drop-shadow-md">
            {item.title}
          </h3>
        </div>

        {/* Info area */}
        <div className="p-4">
          <p className="text-zinc-300 text-sm leading-relaxed mb-3">
            {item.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
