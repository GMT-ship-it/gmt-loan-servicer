import { ShieldAlert } from 'lucide-react';

export default function CovenantChip({
  state, // 'ok' | 'warn' | 'bad'
  children,
}: {
  state: 'ok' | 'warn' | 'bad';
  children?: React.ReactNode;
}) {
  const cls = {
    ok:   'bg-[rgb(16,185,129,0.18)] text-[#34D399] border border-[#10B981]/35',
    warn: 'bg-[rgb(245,158,11,0.18)] text-[#FBBF24] border border-[#F59E0B]/35',
    bad:  'bg-[rgb(239,68,68,0.20)] text-[#F87171] border border-[#EF4444]/35',
  }[state];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${cls}`}>
      <ShieldAlert className="h-3.5 w-3.5" />
      {children ?? 'Covenants'}
    </span>
  );
}