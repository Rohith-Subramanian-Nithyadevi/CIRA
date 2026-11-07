import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Loader2, Search } from 'lucide-react';
import { AccessibleDialog, ErrorState } from '@/components/ui/facultyPrimitives';
import { apiClient } from '@/lib/apiClient';

interface PaletteItem {
  id: string;
  label: string;
  detail: string;
  destination: 'home' | 'reports' | 'quizzes' | 'assignments';
}

interface FacultyCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (destination: PaletteItem['destination']) => void;
}

const getList = (data: any): any[] => Array.isArray(data?.data) ? data.data : data?.data?.items || [];

export default function FacultyCommandPalette({ open, onClose, onNavigate }: FacultyCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState({ quizzes: false, assignments: false, announcements: false });
  const [errors, setErrors] = useState({ quizzes: false, assignments: false, announcements: false });
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSource = async (source: 'quizzes' | 'assignments' | 'announcements') => {
    const endpoints = {
      quizzes: '/api/v1/faculty/quiz?page=1&limit=50',
      assignments: '/api/v1/assignments/faculty?page=1&limit=50',
      announcements: '/api/v1/faculty/dashboard/announcements?page=1&limit=50',
    };
    setLoading(previous => ({ ...previous, [source]: true }));
    setErrors(previous => ({ ...previous, [source]: false }));
    try {
      const response = await apiClient.fetch(endpoints[source]);
      const json = await response.json();
      const list = getList(json);
      if (source === 'quizzes') setQuizzes(list);
      if (source === 'assignments') setAssignments(list);
      if (source === 'announcements') setAnnouncements(list);
    } catch {
      setErrors(previous => ({ ...previous, [source]: true }));
    } finally {
      setLoading(previous => ({ ...previous, [source]: false }));
    }
  };

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    void Promise.all([
      quizzes.length ? Promise.resolve() : loadSource('quizzes'),
      assignments.length ? Promise.resolve() : loadSource('assignments'),
      announcements.length ? Promise.resolve() : loadSource('announcements'),
    ]);
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const destinations: PaletteItem[] = [
      { id: 'nav-home', label: 'Overview', detail: 'Faculty workspace', destination: 'home' },
      { id: 'nav-reports', label: 'Students & Reports', detail: 'Student performance and analytics', destination: 'reports' },
      { id: 'nav-quizzes', label: 'Quizzes', detail: 'Assessment management', destination: 'quizzes' },
      { id: 'nav-assignments', label: 'Assignments', detail: 'Assignment management', destination: 'assignments' },
    ];
    const normalized = query.toLowerCase();
    return [...destinations, ...quizzes.map(item => ({ id: `quiz-${item.id}`, label: item.title, detail: item.subject || 'Quiz', destination: 'quizzes' as const })), ...assignments.map(item => ({ id: `assignment-${item.id}`, label: item.title, detail: 'Assignment', destination: 'assignments' as const })), ...announcements.map(item => ({ id: `announcement-${item.id}`, label: item.title, detail: 'Announcement', destination: 'home' as const }))]
      .filter(item => `${item.label} ${item.detail}`.toLowerCase().includes(normalized));
  }, [announcements, assignments, query, quizzes]);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const selectItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    onNavigate(item.destination);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectItem(items[activeIndex]);
    }
  };

  const retry = (source: 'quizzes' | 'assignments' | 'announcements') => {
    void loadSource(source);
  };

  return (
    <AccessibleDialog open={open} title="Faculty command palette" onClose={onClose} className="max-w-2xl">
      <div className="space-y-4">
        <label className="relative block">
          <span className="sr-only">Search faculty destinations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-body" aria-hidden="true" />
          <input ref={inputRef} autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={handleKeyDown} role="combobox" aria-controls="faculty-command-results" aria-expanded="true" aria-activedescendant={items[activeIndex] ? `palette-${items[activeIndex].id}` : undefined} placeholder="Search destinations, quizzes, assignments..." className="h-11 w-full rounded-lg border border-border-soft bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20" />
        </label>
        <div id="faculty-command-results" role="listbox" aria-label="Faculty command results" className="max-h-80 space-y-1 overflow-y-auto">
          {items.map((item, index) => (
            <button key={item.id} id={`palette-${item.id}`} type="button" role="option" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectItem(item)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${index === activeIndex ? 'bg-cream text-ink' : 'text-gray-body hover:bg-cream/60'}`}>
              <span><span className="block text-sm font-semibold">{item.label}</span><span className="block text-xs text-gray-body">{item.detail}</span></span>
              <Command className="h-4 w-4 text-maroon" aria-hidden="true" />
            </button>
          ))}
          {loading.quizzes || loading.assignments || loading.announcements ? <div className="flex items-center gap-2 p-3 text-sm text-gray-body" role="status"><Loader2 className="h-4 w-4 animate-spin" />Loading faculty data...</div> : null}
          {!items.length && !loading.quizzes && !loading.assignments && !loading.announcements && <p className="p-3 text-sm text-gray-body">No matching destinations.</p>}
        </div>
        {(errors.quizzes || errors.assignments || errors.announcements) && (
          <div className="space-y-2">
            {errors.quizzes && <ErrorState message="Quizzes could not be loaded." onRetry={() => retry('quizzes')} />}
            {errors.assignments && <ErrorState message="Assignments could not be loaded." onRetry={() => retry('assignments')} />}
            {errors.announcements && <ErrorState message="Announcements could not be loaded." onRetry={() => retry('announcements')} />}
          </div>
        )}
        <p className="text-xs text-gray-body">Use arrow keys to navigate and Enter to open.</p>
      </div>
    </AccessibleDialog>
  );
}
