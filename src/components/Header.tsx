export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            Visualise AI
          </h1>
          <span className="hidden sm:inline-block text-xs text-gray-400 border-l border-gray-200 pl-3">
            生成AI技術ギャラリー
          </span>
        </div>
        <p className="hidden md:block text-sm text-gray-400">
          Explore Generative AI Technologies
        </p>
      </div>
    </header>
  );
}
