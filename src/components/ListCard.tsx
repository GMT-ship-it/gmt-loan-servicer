import { ReactNode } from 'react';

export function ListCard({ title, meta, right, muted }: { title: string; meta?: string; right?: ReactNode; muted?: string }) {
  return (
    <div className="min-w-[320px] snap-start card-surface p-4 hover:scale-[1.01] transition">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">{title}</div>
        {right && <div className="text-sm text-neutral-300">{right}</div>}
      </div>
      {meta && <div className="text-sm text-neutral-400 mt-1">{meta}</div>}
      {muted && <div className="text-xs text-neutral-500 mt-2">{muted}</div>}
    </div>
  );
}