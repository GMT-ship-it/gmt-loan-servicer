import { motion } from 'framer-motion';

export function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <motion.div
      className="min-w-[220px] snap-start card-surface p-4"
      variants={{
        hidden: { opacity: 0, y: 6 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
      }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20, mass: 0.4 }}
    >
      <div className="text-neutral-400 text-xs uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-neutral-400 text-sm mt-2">{sub}</div>}
    </motion.div>
  );
}