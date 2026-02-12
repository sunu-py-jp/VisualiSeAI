"use client";

import { useState, useMemo, useCallback } from "react";
import { Category, GalleryItem } from "@/types";
import { galleryItems, categories } from "@/data/galleryItems";
import BackgroundDecoration from "@/components/BackgroundDecoration";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryFilter from "@/components/CategoryFilter";
import MasonryGrid from "@/components/MasonryGrid";
import Lightbox from "@/components/Lightbox";
import ArtworkViewer from "@/components/ArtworkViewer";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  const filteredItems = useMemo(
    () =>
      activeCategory === "All"
        ? galleryItems
        : galleryItems.filter((item) => item.category === activeCategory),
    [activeCategory]
  );

  const closeLightbox = useCallback(() => setLightboxItem(null), []);

  return (
    <div className="min-h-screen relative bg-[#f7f7f7]">
      <BackgroundDecoration />
      <Header />
      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />
      <main className="py-8">
        <MasonryGrid items={filteredItems} onCardClick={setLightboxItem} />
      </main>
      <Footer />
      {lightboxItem && lightboxItem.artworkId && (
        <ArtworkViewer
          artworkId={lightboxItem.artworkId}
          title={lightboxItem.title}
          onClose={closeLightbox}
        />
      )}
      {lightboxItem && !lightboxItem.artworkId && (
        <Lightbox
          item={lightboxItem}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}
