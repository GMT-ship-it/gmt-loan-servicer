import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function MotionRow({ title, action, children }: PropsWithChildren<{ title: string; action?: React.ReactNode }>) {
  return (
    <section className="mt-5 sm:mt-8">
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
        {action}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <motion.div
          className="flex gap-3 sm:gap-4 compact-gap overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent pb-2"
          variants={{
            show: {
              transition: { staggerChildren: 0.06, when: 'beforeChildren' }
            }
          }}
          initial="hidden"
          animate="show"
        >
          {children}
        </motion.div>
      </motion.div>
    </section>
  );
}