export function SkeletonCard() {
  return (
    <div className="bg-white p-4 rounded-2xl flex items-center justify-between card-shadow animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        <div className="space-y-2">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-3 w-16 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="h-6 w-12 bg-slate-100 rounded-full" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="glass p-5 rounded-3xl card-shadow animate-pulse">
        <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
        <div className="h-8 w-12 bg-slate-200 rounded" />
      </div>
      <div className="bg-brand-primary/20 p-5 rounded-3xl animate-pulse">
        <div className="h-3 w-16 bg-white/40 rounded mb-2" />
        <div className="h-8 w-12 bg-white/40 rounded" />
      </div>
    </div>
  );
}
