import { useEffect, useState } from 'react';

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
      <input
        type="checkbox"
        aria-label="Toggle dark theme"
        checked={dark}
        onChange={e=>setDark(e.target.checked)}
      />
      {dark ? 'Dark' : 'Light'}
    </label>
  );
}