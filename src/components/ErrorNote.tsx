export function ErrorNote({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="card-surface p-4 border border-red-500/30">
      <div className="text-red-400 font-semibold">{title}</div>
      {detail && <div className="text-neutral-300 text-sm mt-1">{detail}</div>}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return <div className="text-red-400 text-xs mt-1">{message}</div>;
}