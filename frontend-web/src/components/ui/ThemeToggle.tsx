import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('cira_theme') as 'light' | 'dark') || 
      (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.theme) {
        setTheme(e.detail.theme);
      }
    };
    window.addEventListener('cira_theme_changed', handleThemeChange);
    return () => window.removeEventListener('cira_theme_changed', handleThemeChange);
  }, []);

  const toggle = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('cira_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new CustomEvent('cira_theme_changed', { detail: { theme: newTheme } }));
  };

  return (
    <div
      role="group"
      aria-label="Theme switcher"
      className={`inline-flex items-center gap-0.5 p-1 rounded-full bg-[#EFE5D8]/85 dark:bg-[#242429] border border-[#D8CBB8] dark:border-neutral-700 shadow-xs transition-colors duration-200 ${className}`}
    >
      <button
        type="button"
        onClick={() => toggle('light')}
        title="Switch to Light mode"
        aria-label="Light mode"
        aria-pressed={theme === 'light'}
        className={`flex items-center justify-center p-1.5 rounded-full transition-all duration-200 cursor-pointer ${
          theme === 'light'
            ? 'bg-white text-amber-600 shadow-sm ring-1 ring-[#D8CBB8]'
            : 'text-neutral-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Sun className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => toggle('dark')}
        title="Switch to Dark mode"
        aria-label="Dark mode"
        aria-pressed={theme === 'dark'}
        className={`flex items-center justify-center p-1.5 rounded-full transition-all duration-200 cursor-pointer ${
          theme === 'dark'
            ? 'bg-[#121215] text-amber-300 shadow-sm ring-1 ring-amber-400/40'
            : 'text-[#5A524A] hover:text-[#1A1A1A] hover:bg-white/60'
        }`}
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
