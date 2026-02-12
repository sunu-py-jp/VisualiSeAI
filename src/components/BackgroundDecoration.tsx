export default function BackgroundDecoration() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div
        className="blob absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, oklch(0.5 0.2 300) 0%, transparent 70%)",
        }}
      />
      <div
        className="blob blob-delay-1 absolute top-[40%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-15"
        style={{
          background:
            "radial-gradient(circle, oklch(0.5 0.15 200) 0%, transparent 70%)",
        }}
      />
      <div
        className="blob blob-delay-2 absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full opacity-15"
        style={{
          background:
            "radial-gradient(circle, oklch(0.5 0.18 250) 0%, transparent 70%)",
        }}
      />
      <div
        className="blob blob-delay-3 absolute top-[20%] left-[50%] w-[350px] h-[350px] rounded-full opacity-10"
        style={{
          background:
            "radial-gradient(circle, oklch(0.6 0.2 330) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
