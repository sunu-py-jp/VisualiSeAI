export type Category =
  | "All"
  | "Foundation"
  | "Training"
  | "Generation"
  | "Application"
  | "Architecture";

export interface GalleryItem {
  id: number;
  title: string;
  description: string;
  category: Exclude<Category, "All">;
  gradient: string;
  emoji: string;
  tags: string[];
  height: "sm" | "md" | "lg" | "xl";
  detail: string;
  artworkId?: string;
}
