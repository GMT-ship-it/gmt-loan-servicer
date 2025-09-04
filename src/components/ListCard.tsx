import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function ListCard({ title, meta, right, muted }: { title: string; meta?: string; right?: ReactNode; muted?: string }) {
  return (
    <motion.div
      className="min-w-[320px] snap-start card-surface p-4"
      variants={{
        hidden: { opacity: 0, y: 6 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
      }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20, mass: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">{title}</div>
        {right && <div className="text-sm text-neutral-300">{right}</div>}
      </div>
      {meta && <div className="text-sm text-neutral-400 mt-1">{meta}</div>}
      {muted && <div className="text-xs text-neutral-500 mt-2">{muted}</div>}
    </motion.div>
  );
}