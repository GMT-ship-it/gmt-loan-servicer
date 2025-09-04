export function SkeletonLine({ h = 14, w = '100%', r = 6 }: { h?: number; w?: string | number; r?: number }) {
  return (
    <div
      className="skeleton"
      style={{
        height: h,
        width: typeof w === 'number' ? `${w}px` : w,
        borderRadius: r,
      }}
    />
  );
}

export function SkeletonCard({ w = 320, h = 120 }: { w?: number; h?: number }) {
  return (
    <div className="min-w-[320px] snap-start card-surface p-4" style={{ width: w, height: h }}>
      <div className="flex items-center justify-between">
        <SkeletonLine w="55%" h={18} />
        <SkeletonLine w={64} h={18} />
      </div>
      <div className="mt-3"><SkeletonLine w="70%" /></div>
      <div className="mt-2"><SkeletonLine w="40%" /></div>
      <div className="mt-4 flex gap-2">
        <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 9999 }} />
        <div className="skeleton" style={{ width: 100, height: 24, borderRadius: 9999 }} />
      </div>
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="min-w-[220px] snap-start card-surface p-4">
      <SkeletonLine w="50%" h={10} />
      <div className="mt-2"><SkeletonLine w="70%" h={22} /></div>
      <div className="mt-3"><SkeletonLine w="60%" h={10} /></div>
    </div>
  );
}