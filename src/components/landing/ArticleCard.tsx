import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface ArticleCardProps {
  category: string;
  title: string;
  date: string;
  delay?: number;
}

export function ArticleCard({ category, title, date, delay = 0 }: ArticleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="card-surface p-6 group cursor-pointer"
    >
      <div className="mb-4">
        <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider">
          {category}
        </span>
      </div>
      
      <h4 className="text-lg font-semibold mb-3 group-hover:text-accent transition-colors">
        {title}
      </h4>
      
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{date}</span>
        <ArrowRight className="w-4 h-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );
}
