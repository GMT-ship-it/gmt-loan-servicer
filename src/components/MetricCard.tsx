export function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[220px] snap-start card-surface p-4 hover:scale-[1.01] transition">
      <div className="text-neutral-400 text-xs uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-neutral-400 text-sm mt-2">{sub}</div>}
    </div>
  );
}