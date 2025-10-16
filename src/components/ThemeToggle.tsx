import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('theme-dark');
      localStorage.setItem('theme','dark');
    } else {
      root.classList.remove('theme-dark');
      localStorage.setItem('theme','light');
    }
  }, [dark]);

  return (
    <label className="text-xs text-foreground/80 hover:text-foreground transition-colors flex items-center gap-2 cursor-pointer">
      <Checkbox
        aria-label="Toggle dark theme"
        checked={dark}
        onCheckedChange={(checked) => setDark(checked === true)}
      />
      {dark ? 'Dark' : 'Light'}
    </label>
  );
}