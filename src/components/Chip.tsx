export function Chip({ text, tone }: { text: string; tone: 'ok'|'warn'|'bad'|'muted' }) {
  const map = {
    ok: 'bg-[rgb(16,185,129,0.15)] text-[#10B981] border border-[#10B981]/30',
    warn: 'bg-[rgb(245,158,11,0.15)] text-[#F59E0B] border border-[#F59E0B]/30',
    bad: 'bg-[rgb(239,68,68,0.15)] text-[#EF4444] border border-[#EF4444]/30',
    muted: 'bg-white/5 text-neutral-300 border border-white/10',
  } as const;
  return <span className={`px-2 py-0.5 rounded text-xs ${map[tone]}`}>{text}</span>;
}