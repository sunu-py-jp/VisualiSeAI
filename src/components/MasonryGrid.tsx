import { memo } from "react";
import { GalleryItem } from "@/types";
import GalleryCard from "./GalleryCard";

interface MasonryGridProps {
  items: GalleryItem[];
  onCardClick: (item: GalleryItem) => void;
}

export default memo(function MasonryGrid({ items, onCardClick }: MasonryGridProps) {
  return (
    <div className="gallery-grid px-4 md:px-8 max-w-[1400px] mx-auto">
      {items.map((item) => (
        <GalleryCard key={item.id} item={item} onClick={onCardClick} />
      ))}
    </div>
  );
});
