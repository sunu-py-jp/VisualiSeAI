"use client";

import { useState } from "react";
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

  const filteredItems =
    activeCategory === "All"
      ? galleryItems
      : galleryItems.filter((item) => item.category === activeCategory);

  return (
    <div className="min-h-screen relative">
      <BackgroundDecoration />
      <Header />
      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />
      <main className="pb-12">
        <MasonryGrid items={filteredItems} onCardClick={setLightboxItem} />
      </main>
      <Footer />
      {lightboxItem && lightboxItem.artworkId && (
        <ArtworkViewer
          artworkId={lightboxItem.artworkId}
          title={lightboxItem.title}
          onClose={() => setLightboxItem(null)}
        />
      )}
      {lightboxItem && !lightboxItem.artworkId && (
        <Lightbox
          item={lightboxItem}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </div>
  );
}
