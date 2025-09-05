export function Chip({ text, tone }: { text: string; tone: 'ok'|'warn'|'bad'|'muted' }) {
  const map = {
    ok: 'bg-[rgb(16,185,129,0.18)] text-[#34D399] border border-[#10B981]/35',
    warn: 'bg-[rgb(245,158,11,0.18)] text-[#FBBF24] border border-[#F59E0B]/35',
    bad: 'bg-[rgb(239,68,68,0.20)] text-[#F87171] border border-[#EF4444]/35',
    muted: 'bg-white/5 text-neutral-300 border border-white/10',
  } as const;
  return <span className={`px-2 py-0.5 rounded text-xs ${map[tone]}`}>{text}</span>;
}