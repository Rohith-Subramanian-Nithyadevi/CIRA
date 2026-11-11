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
      className={`inline-flex items-center p-1 rounded-full bg-[#EFE5D8]/85 dark:bg-[#242429] border border-[#D8CBB8] dark:border-neutral-700 shadow-xs transition-colors duration-200 ${className}`}
    >
      <button
        type="button"
        onClick={() => toggle('light')}
        title="Switch to Light mode"
        aria-label="Light mode"
        aria-pressed={theme === 'light'}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
          theme === 'light'
            ? 'bg-white text-[#9B2242] shadow-sm ring-1 ring-[#D8CBB8]'
            : 'text-neutral-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-600' : 'text-neutral-300'}`} />
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        type="button"
        onClick={() => toggle('dark')}
        title="Switch to Dark mode"
        aria-label="Dark mode"
        aria-pressed={theme === 'dark'}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
          theme === 'dark'
            ? 'bg-[#121215] text-amber-300 shadow-sm ring-1 ring-amber-400/35'
            : 'text-[#4A433D] hover:text-[#1A1A1A] hover:bg-white/50'
        }`}
      >
        <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-amber-300' : 'text-[#4A433D]'}`} />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
