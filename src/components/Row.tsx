import { PropsWithChildren } from 'react';

export function Row({ title, children, action }: PropsWithChildren<{ title: string; action?: React.ReactNode }>) {
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
        {action}
      </div>
      <div className="group relative">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent pb-2">
          {children}
        </div>
      </div>
    </section>
  );
}