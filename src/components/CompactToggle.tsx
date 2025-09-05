import { useEffect, useState } from 'react';

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
    <label className="text-xs text-neutral-300 flex items-center gap-2 cursor-pointer">
      <input 
        type="checkbox"
        aria-label="Toggle compact mode"
        checked={on} 
        onChange={e => setOn(e.target.checked)}
        className="w-3 h-3" 
      />
      Compact mode
    </label>
  );
}