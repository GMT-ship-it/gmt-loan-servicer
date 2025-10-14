import { motion } from 'framer-motion';
import { User } from 'lucide-react';

interface TeamCardProps {
  name: string;
  role: string;
  bio: string;
  delay?: number;
}

export function TeamCard({ name, role, bio, delay = 0 }: TeamCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="card-surface p-6"
    >
      <div className="mb-4 flex justify-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
          <User className="w-12 h-12 text-accent/60" />
        </div>
      </div>
      
      <h4 className="text-xl font-semibold text-center mb-1">{name}</h4>
      <p className="text-sm text-accent text-center mb-3">{role}</p>
      <p className="text-sm text-muted-foreground text-center leading-relaxed">{bio}</p>
    </motion.div>
  );
}
