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
    <nav className="py-5 px-4 bg-white border-b border-gray-100" aria-label="Category filter">
      <div className="max-w-[1400px] mx-auto flex justify-center">
        <div className="filter-scroll flex gap-1 overflow-x-auto pb-1 px-2" role="tablist">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              role="tab"
              aria-selected={activeCategory === cat}
              className={`filter-pill whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? "filter-pill-active"
                  : "text-gray-500 bg-transparent hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
