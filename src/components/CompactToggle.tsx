import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export default function CompactToggle() {
  const [on, setOn] = useState<boolean>(() => localStorage.getItem('compact') === '1');

  useEffect(() => {
    const root = document.documentElement;
    if (on) { 
      root.classList.add('compact'); 
      localStorage.setItem('compact','1'); 
    } else { 
      root.classList.remove('compact'); 
      localStorage.removeItem('compact'); 
    }
  }, [on]);

  return (
    <label className="text-xs text-foreground/80 hover:text-foreground transition-colors flex items-center gap-2 cursor-pointer">
      <Checkbox 
        aria-label="Toggle compact mode"
        checked={on} 
        onCheckedChange={(checked) => setOn(checked === true)}
      />
      Compact mode
    </label>
  );
}