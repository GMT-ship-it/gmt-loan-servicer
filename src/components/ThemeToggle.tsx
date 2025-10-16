import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export default function ThemeToggle() {
  const [light, setLight] = useState<boolean>(() => localStorage.getItem('theme') === 'light');

  useEffect(() => {
    const root = document.documentElement;
    if (light) {
      root.classList.add('theme-light');
      localStorage.setItem('theme','light');
    } else {
      root.classList.remove('theme-light');
      localStorage.setItem('theme','dark');
    }
  }, [light]);

  return (
    <label className="text-xs text-foreground/80 hover:text-foreground transition-colors flex items-center gap-2 cursor-pointer">
      <Checkbox
        aria-label="Toggle light theme"
        checked={light}
        onCheckedChange={(checked) => setLight(checked === true)}
      />
      {light ? 'Light' : 'Dark'}
    </label>
  );
}