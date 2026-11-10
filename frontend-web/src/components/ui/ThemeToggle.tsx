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
    <div className={`inline-flex items-center p-1 rounded-full bg-cream-edge/60 dark:bg-neutral-800 border border-border-soft dark:border-neutral-700 shadow-xs transition-colors duration-200 ${className}`}>
      <button
        type="button"
        onClick={() => toggle('light')}
        title="Switch to Light mode"
        aria-label="Light mode"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
          theme === 'light'
            ? 'bg-white text-maroon shadow-sm ring-1 ring-border-soft/80'
            : 'text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-white'
        }`}
      >
        <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-600 fill-amber-500/20' : ''}`} />
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        type="button"
        onClick={() => toggle('dark')}
        title="Switch to Dark mode"
        aria-label="Dark mode"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
          theme === 'dark'
            ? 'bg-neutral-900 text-amber-300 shadow-sm ring-1 ring-neutral-700'
            : 'text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-white'
        }`}
      >
        <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-amber-300 fill-amber-300/20' : ''}`} />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
