import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface SolutionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
}

export function SolutionCard({ icon: Icon, title, description, delay = 0 }: SolutionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="card-surface p-6 text-center"
    >
      <div className="mb-4 flex justify-center">
        <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center icon-glow">
          <Icon className="w-7 h-7 text-accent" />
        </div>
      </div>
      
      <h4 className="text-xl font-semibold mb-3">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}
