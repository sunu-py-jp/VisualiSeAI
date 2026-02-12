import { Category } from "@/types";

interface CategoryFilterProps {
  categories: Category[];
  activeCategory: Category;
  onSelect: (category: Category) => void;
}

const categoryLabels: Record<Category, string> = {
  All: "All",
  Foundation: "Foundation",
  Architecture: "Architecture",
  Training: "Training",
  Generation: "Generation",
  Application: "Application",
};

export default function CategoryFilter({
  categories,
  activeCategory,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="py-6 px-4">
      <div className="flex justify-center">
        <div className="filter-scroll flex gap-2 overflow-x-auto pb-2 px-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`filter-pill whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium border transition-all ${
                activeCategory === cat
                  ? "filter-pill-active border-transparent"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
