export default function Loading() {
  return (
    <main aria-busy aria-label="Cargando el panel" className="flex flex-col gap-6">
      <div className="h-9 w-1/2 max-w-sm animate-pulse rounded-control bg-ink/[0.07] motion-reduce:animate-none" />
      <div className="h-[84px] animate-pulse rounded-surface bg-ink/[0.05] motion-reduce:animate-none" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-surface bg-ink/[0.05] motion-reduce:animate-none" />
        ))}
      </div>
    </main>
  );
}
