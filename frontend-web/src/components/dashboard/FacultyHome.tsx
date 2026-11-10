import { useState, useEffect, useRef, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Circle, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare,
  X,
  ListTodo,
  Trash2,
  Loader2
} from 'lucide-react';
import { useBatches, useDepartments } from '@/hooks/useReferenceData';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmationDialog, ErrorState, SectionHeader, StatCard, StatusBadge } from '@/components/ui/facultyPrimitives';
import { apiClient } from '@/lib/apiClient';
import FacultyPolls from './FacultyPolls';
import { clearDraft, clearSavedFilters, getDraftStorageKey, getFilterStorageKey, getStoredUserKey, readDraft, readSavedFilters, writeDraft, writeSavedFilters } from '@/lib/facultyPersistence';
import { toast } from 'sonner';
import { useFacultyDemo } from '@/context/FacultyDemoContext';
import { facultyDemoAnnouncements, facultyDemoAssignments, facultyDemoCalendar, facultyDemoTasks } from '@/lib/facultyDemoData';

const sanitizeHtml = (value: string) => DOMPurify.sanitize(value || '', { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'ol', 'ul', 'li', 'a', 'p', 'br'], ALLOWED_ATTR: ['href', 'target', 'rel'] });

function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-[120px] w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}

interface Task { id: string; task: string; completed: boolean; date: string; }
interface CalendarEvent { id: string; title: string; date: string; }
interface Announcement { id: string; title: string; content: string; date: string; author?: string; isSurvey: boolean; audience: string; _count?: { responses: number }; facultyId?: string; }
interface AnnouncementResponse { id: string; response: string; submittedAt: string; user: { name: string; rollNumber: string } }
interface FacultyHomeProps { onNavigate?: (destination: 'home' | 'reports' | 'quizzes' | 'assignments') => void; }

export default function FacultyHome({ onNavigate }: FacultyHomeProps) {
  const isDemo = useFacultyDemo();
  // Loading States
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [loadingAgendaAssignments, setLoadingAgendaAssignments] = useState(true);
  const [agendaAssignments, setAgendaAssignments] = useState<any[]>([]);
  const [agendaAssignmentsError, setAgendaAssignmentsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Data States
  const [todos, setTodos] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const announcementFilterKey = getFilterStorageKey('announcements', getStoredUserKey());
  const savedAnnouncementFilters = readSavedFilters<{ search?: string; surveysOnly?: boolean }>(announcementFilterKey);
  const [announcementSearch, setAnnouncementSearch] = useState(savedAnnouncementFilters?.search || '');
  const [surveysOnly, setSurveysOnly] = useState(Boolean(savedAnnouncementFilters?.surveysOnly));
  
  // UI States
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  
  const [newAnnouncement, setNewAnnouncement] = useState({ 
    title: '', 
    content: '',
    isSurvey: false,
    batch: 'All Batches',
    department: 'All Departments',
    section: 'All Sections'
  });

  // Cached Reference Data
  const { batches } = useBatches();
  const selectedBatchId = batches.find(b => b.name === newAnnouncement.batch)?.id;
  const { departments } = useDepartments(selectedBatchId, { 
    enabled: newAnnouncement.batch !== 'All Batches' && !!selectedBatchId 
  });

  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  
  
  const [viewingResponsesFor, setViewingResponsesFor] = useState<string | null>(null);
  const [announcementResponses, setAnnouncementResponses] = useState<AnnouncementResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [viewingAnnouncement, setViewingAnnouncement] = useState<Announcement | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);
  const [restoredAnnouncementDraft, setRestoredAnnouncementDraft] = useState(false);
  const skipAnnouncementDraftWrite = useRef(false);
  const announcementDraftKey = getDraftStorageKey('announcement', 'new', getStoredUserKey());

  useEffect(() => {
    const draft = readDraft<typeof newAnnouncement>(announcementDraftKey);
    if (draft) {
      setNewAnnouncement({
        title: typeof draft.title === 'string' ? draft.title : '',
        content: typeof draft.content === 'string' ? draft.content : '',
        isSurvey: Boolean(draft.isSurvey),
        batch: typeof draft.batch === 'string' ? draft.batch : 'All Batches',
        department: typeof draft.department === 'string' ? draft.department : 'All Departments',
        section: typeof draft.section === 'string' ? draft.section : 'All Sections',
      });
      setRestoredAnnouncementDraft(true);
    }
  }, [announcementDraftKey]);

  useEffect(() => {
    if (skipAnnouncementDraftWrite.current) {
      skipAnnouncementDraftWrite.current = false;
      return;
    }
    const timeout = window.setTimeout(() => writeDraft(announcementDraftKey, newAnnouncement), 500);
    return () => window.clearTimeout(timeout);
  }, [announcementDraftKey, newAnnouncement]);

  useEffect(() => {
    writeSavedFilters(announcementFilterKey, { search: announcementSearch, surveysOnly });
  }, [announcementFilterKey, announcementSearch, surveysOnly]);

  useEffect(() => {
    fetchTasks();
    fetchCalendarEvents();
    fetchAnnouncements(1);
    fetchAgendaAssignments();
  }, [isDemo]);

  // Helper to convert Date or ISO string to local 'YYYY-MM-DD'
  const getLocalDateString = (d: Date | string): string => {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchTasks = async () => {
    try {
      setLoadingTasks(true);
      setTasksError(null);
      if (isDemo) {
        setTodos(facultyDemoTasks);
        return;
      }
      const res = await apiClient.fetch('/api/v1/faculty/dashboard/tasks');
      const data = await res.json();
      if (data?.success) setTodos(data.data);
    } catch (err) {
      setTasksError('Tasks could not be loaded.');
    } finally { setLoadingTasks(false); }
  };

  const fetchCalendarEvents = async () => {
    try {
      setLoadingCalendar(true);
      setCalendarError(null);
      if (isDemo) {
        setCalendarEvents(facultyDemoCalendar);
        return;
      }
      const res = await apiClient.fetch('/api/v1/faculty/dashboard/calendar');
      const data = await res.json();
      if (data?.success) setCalendarEvents(data.data.map((e: any) => ({ ...e, date: getLocalDateString(e.date) })));
    } catch (err) {
      setCalendarError('Calendar events could not be loaded.');
    } finally { setLoadingCalendar(false); }
  };

  const fetchAgendaAssignments = async () => {
    try {
      setLoadingAgendaAssignments(true);
      setAgendaAssignmentsError(null);
      if (isDemo) {
        setAgendaAssignments(facultyDemoAssignments);
        return;
      }
      const res = await apiClient.fetch('/api/v1/assignments/faculty?page=1&limit=50');
      const data = await res.json();
      if (data?.success) {
        setAgendaAssignments(Array.isArray(data.data) ? data.data : data.data?.items || []);
      }
    } catch (err) {
      setAgendaAssignmentsError('Assignment due dates could not be loaded.');
    } finally {
      setLoadingAgendaAssignments(false);
    }
  };

  const fetchAnnouncements = async (pageNumber = 1) => {
    try {
      if (isDemo) {
        setAnnouncements(pageNumber === 1 ? facultyDemoAnnouncements : []);
        setHasMore(false);
        return;
      }
      const res = await apiClient.fetch(`/api/v1/faculty/dashboard/announcements?page=${pageNumber}&limit=10`);
      const data = await res.json();
      if (data?.success) {
        const fetchedAnnouncements = Array.isArray(data.data) ? data.data : data.data.items;
        const formatted = fetchedAnnouncements.map((a: any) => ({ ...a, date: getLocalDateString(a.date), author: 'You' }));
        if (pageNumber === 1) {
          setAnnouncements(formatted);
        } else {
          setAnnouncements(prev => [...prev, ...formatted]);
        }
        if (!Array.isArray(data.data)) {
          setHasMore(data.data.hasMore);
          setPage(data.data.page);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {} finally { setLoadingAnnouncements(false); }
  };

  // --- TASKS LOGIC ---
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    const t = newTaskText;
    setNewTaskText(''); setIsAddingTask(false);
    if (isDemo) {
      setTodos(previous => [...previous, { id: `demo-task-${Date.now()}`, task: t, completed: false, date: getLocalDateString(new Date()) }]);
      toast.success('Demo task added locally.');
      return;
    }
    try {
      const res = await apiClient.fetch('/api/v1/faculty/dashboard/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: t, date: new Date().toISOString() })
      });
      const data = await res.json();
      if (data?.success) setTodos([...todos, data.data]);
    } catch (err) {}
  };

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    if (isDemo) {
      toast.success('Demo task updated locally.');
      return;
    }
    try {
      await apiClient.fetch(`/api/v1/faculty/dashboard/tasks/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentStatus })
      });
    } catch (err) {}
  };

  const deleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTodos(todos.filter(t => t.id !== id));
    if (isDemo) {
      toast.success('Demo task deleted locally.');
      return;
    }
    try {
      await apiClient.fetch(`/api/v1/faculty/dashboard/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {}
  };

  // --- CALENDAR LOGIC ---
  const handleAddEvent = async () => {
    if (!selectedDate || !newEventTitle.trim()) return;
    const title = newEventTitle.trim();
    const localDateStr = getLocalDateString(selectedDate);
    // Send with noon UTC timestamp so date never shifts across timezones
    const date = `${localDateStr}T12:00:00.000Z`;
    setNewEventTitle(''); setShowEventForm(false);
    if (isDemo) {
      setCalendarEvents(previous => [...previous, { id: `demo-event-${Date.now()}`, title, date: localDateStr }]);
      toast.success('Demo event added locally.');
      return;
    }
    try {
      const res = await apiClient.fetch('/api/v1/faculty/dashboard/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date })
      });
      const data = await res.json();
      if (data?.success) setCalendarEvents([...calendarEvents, { ...data.data, date: getLocalDateString(data.data.date) }]);
    } catch (err) {}
  };

  const deleteCalendarEvent = async (id: string) => {
    setCalendarEvents(calendarEvents.filter(e => e.id !== id));
    if (isDemo) {
      toast.success('Demo event deleted locally.');
      return;
    }
    try {
      await apiClient.fetch(`/api/v1/faculty/dashboard/calendar/${id}`, { method: 'DELETE' });
    } catch (err) {}
  };

  // --- ANNOUNCEMENTS LOGIC ---
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title) return;

    const cleanedContent = sanitizeHtml(newAnnouncement.content).trim();
    if (!cleanedContent) {
      alert('Announcement message is required.');
      return;
    }
    
    let audienceStr = 'All Students';
    const audienceParts: string[] = [];
    if (newAnnouncement.batch && newAnnouncement.batch !== 'All Batches') audienceParts.push(newAnnouncement.batch);
    if (newAnnouncement.department && newAnnouncement.department !== 'All Departments') audienceParts.push(newAnnouncement.department);
    if (newAnnouncement.section && newAnnouncement.section !== 'All Sections') audienceParts.push(`Section ${newAnnouncement.section}`);
    if (audienceParts.length > 0) {
      audienceStr = audienceParts.join(' | ');
    }

    const payload = {
      title: newAnnouncement.title,
      content: cleanedContent,
      isSurvey: newAnnouncement.isSurvey,
      audience: audienceStr,
      date: new Date().toISOString()
    };

    if (isDemo) {
      setAnnouncements(previous => [{
        id: `demo-announcement-${Date.now()}`,
        ...payload,
        date: payload.date.slice(0, 10),
        author: 'You',
        audience: audienceStr,
      }, ...previous]);
      clearDraft(announcementDraftKey);
      skipAnnouncementDraftWrite.current = true;
      setRestoredAnnouncementDraft(false);
      setNewAnnouncement({ title: '', content: '', isSurvey: false, batch: 'All Batches', department: 'All Departments', section: 'All Sections' });
      toast.success('Demo announcement published locally.');
      return;
    }

    try {
      const res = await apiClient.fetch('/api/v1/faculty/dashboard/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success) {
        clearDraft(announcementDraftKey);
        skipAnnouncementDraftWrite.current = true;
        setRestoredAnnouncementDraft(false);
        setNewAnnouncement({ title: '', content: '', isSurvey: false, batch: 'All Batches', department: 'All Departments', section: 'All Sections' });
        setAnnouncements([{...data.data, date: data.data.date.split('T')[0], author: 'You'}, ...announcements]);
      } else {
        toast.error(data?.message || 'Failed to post announcement.');
      }
    } catch (err) {
      toast.error('Failed to post announcement. Your draft was kept.');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement? It will be permanently removed for all students.')) {
      return;
    }
    const previous = [...announcements];
    setAnnouncements(announcements.filter(a => a.id !== id));
    if (viewingAnnouncement?.id === id) {
      setViewingAnnouncement(null);
    }
    if (isDemo) {
      toast.success('Demo announcement deleted locally.');
      return;
    }
    try {
      const res = await apiClient.fetch(`/api/v1/faculty/dashboard/announcements/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data?.success) {
        alert(data?.message || 'Failed to delete announcement');
        setAnnouncements(previous);
      }
    } catch (err) {
      alert('Network error while deleting announcement');
      setAnnouncements(previous);
    }
  };

  const visibleAnnouncements = announcements.filter(announcement =>
    (!surveysOnly || announcement.isSurvey) &&
    `${announcement.title || ''} ${announcement.content || ''}`.toLowerCase().includes(announcementSearch.toLowerCase())
  );

  const openSurveyResponses = async (id: string) => {
    setViewingResponsesFor(id);
    setLoadingResponses(true);
    if (isDemo) {
      setAnnouncementResponses([]);
      setLoadingResponses(false);
      return;
    }
    try {
      const res = await apiClient.fetch(`/api/v1/faculty/dashboard/announcements/${id}/responses`);
      const data = await res.json();
      if (data?.success) setAnnouncementResponses(data.data);
    } catch (err) {} finally { setLoadingResponses(false); }
  };


  // Helpers
  const today = new Date();
  today.setHours(0,0,0,0);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const upcomingEventCount = calendarEvents.filter((event) => {
    const eventDate = new Date(`${event.date}T00:00:00`);
    const daysFromToday = Math.floor((eventDate.getTime() - today.getTime()) / 86400000);
    return daysFromToday >= 0 && daysFromToday <= 7;
  }).length;
  const openTaskCount = todos.filter((todo) => !todo.completed).length;
  const storedUser = JSON.parse(localStorage.getItem('cira_user') || '{}') as { name?: string };
  const userName = storedUser.name || 'Faculty';
  const agenda = useMemo(() => {
    const items: Array<{ id: string; title: string; date: string; source: string; destination: 'home' | 'assignments' }> = [];
    todos.filter(todo => !todo.completed && todo.date).forEach(todo => items.push({ id: `task-${todo.id}`, title: todo.task, date: todo.date, source: 'Task', destination: 'home' }));
    calendarEvents.filter(event => event.date).forEach(event => items.push({ id: `event-${event.id}`, title: event.title, date: event.date, source: 'Calendar', destination: 'home' }));
    agendaAssignments.forEach(assignment => {
      const dueKey = ['dueDate', 'dueAt', 'deadline'].find(key => typeof assignment[key] === 'string' && assignment[key]);
      if (dueKey) items.push({ id: `assignment-${assignment.id}`, title: assignment.title, date: getLocalDateString(assignment[dueKey]), source: 'Assignment due date', destination: 'assignments' });
    });
    return items
      .map(item => ({ ...item, date: getLocalDateString(item.date), timestamp: new Date(`${getLocalDateString(item.date)}T00:00:00`).getTime() }))
      .filter(item => {
        const difference = Math.floor((item.timestamp - today.getTime()) / 86400000);
        return difference >= 0 && difference <= 7;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [agendaAssignments, calendarEvents, todos, today]);
  const agendaGroups = ['Today', 'Tomorrow', 'This week'] as const;
  const groupedAgenda = agendaGroups.map(group => ({
    group,
    items: agenda.filter(item => {
      const difference = Math.floor((item.timestamp - today.getTime()) / 86400000);
      return group === 'Today' ? difference === 0 : group === 'Tomorrow' ? difference === 1 : difference > 1;
    }),
  }));
  const assignmentDueDatesAvailable = agendaAssignments.some(assignment => ['dueDate', 'dueAt', 'deadline'].some(key => typeof assignment[key] === 'string' && assignment[key]));

  return (
    <div className="space-y-6 relative">
      {viewingResponsesFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[80vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="survey-responses-title">
            <div className="p-4 border-b border-border-soft flex justify-between items-center">
              <h3 id="survey-responses-title" className="font-bold font-serif text-ink">Survey Responses</h3>
              <button aria-label="Close survey responses" onClick={() => setViewingResponsesFor(null)}><X className="w-5 h-5 text-gray-body" /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {loadingResponses ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-maroon" /></div>
              ) : announcementResponses.length === 0 ? (
                <EmptyState icon={<MessageSquare className="w-8 h-8 text-maroon" />} title="No responses yet" description="There are no survey responses for this announcement." />
              ) : (
                <div className="space-y-4">
                  {announcementResponses.map(r => (
                    <div key={r.id} className="bg-cream/30 border border-border-soft p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-sm text-ink">{r.user.name}</p>
                          <p className="text-xs text-gray-body">{r.user.rollNumber || 'N/A'}</p>
                        </div>
                        <span className="text-xs text-gray-body">{new Date(r.submittedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-ink">{r.response}</p>
                    </div>
                  ))}
                </div>
              )}

              <ConfirmationDialog
                open={Boolean(announcementToDelete)}
                title="Delete announcement?"
                description="This announcement will be permanently removed for all targeted students."
                confirmLabel="Delete announcement"
                onCancel={() => setAnnouncementToDelete(null)}
                onConfirm={() => {
                  if (announcementToDelete) deleteAnnouncement(announcementToDelete);
                  setAnnouncementToDelete(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Announcement Details Modal */}
      {viewingAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs" role="presentation" onClick={() => setViewingAnnouncement(null)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[85vh] flex flex-col border border-border-soft overflow-hidden" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border-soft flex justify-between items-start gap-4 bg-cream/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h3 className="font-bold font-serif text-lg text-ink leading-snug">{viewingAnnouncement.title}</h3>
                  {viewingAnnouncement.isSurvey && (
                    <span className="text-[10px] uppercase font-bold bg-maroon text-white px-2 py-0.5 rounded-full">
                      Survey
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-gray-body uppercase border px-2 py-0.5 rounded bg-white">
                    Target: {viewingAnnouncement.audience}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-body">
                  <CalendarIcon className="w-3.5 h-3.5 text-maroon" />
                  <span>Posted on {new Date(viewingAnnouncement.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>Author: {viewingAnnouncement.author || 'You'}</span>
                </div>
              </div>
              <button aria-label="Close" onClick={() => setViewingAnnouncement(null)} className="p-1.5 text-gray-body hover:text-ink hover:bg-cream-edge/50 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div
                className="text-sm leading-relaxed text-ink/90 rich-text-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingAnnouncement.content) || '<p>No content.</p>' }}
              />
            </div>

            <div className="p-4 border-t border-border-soft bg-cream/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAnnouncementToDelete(viewingAnnouncement.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Announcement
              </button>
              <div className="flex items-center gap-2">
                {viewingAnnouncement.isSurvey && (
                  <button
                    onClick={() => {
                      const id = viewingAnnouncement.id;
                      setViewingAnnouncement(null);
                      openSurveyResponses(id);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-maroon hover:bg-cream-edge/40 border border-maroon/20 rounded-lg transition-colors cursor-pointer"
                  >
                    View Responses ({viewingAnnouncement._count?.responses || 0})
                  </button>
                )}
                <button
                  onClick={() => setViewingAnnouncement(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-ink bg-white hover:bg-cream-edge/40 border border-border-soft rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-5">
        <SectionHeader
          eyebrow="Faculty workspace"
          title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${userName}`}
          description="Manage your academic operations from one place."
          action={<StatusBadge status="info">Live workspace data</StatusBadge>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open tasks" value={loadingTasks ? '—' : openTaskCount} description="Incomplete tasks returned by the faculty task service" />
          <StatCard label="Upcoming events" value={loadingCalendar ? '—' : upcomingEventCount} description="Events scheduled in the next seven days" />
          <StatCard label="Announcements shown" value={loadingAnnouncements ? '—' : announcements.length} description="Announcements in the currently loaded page" />
        </div>
      </section>

      <section className="rounded-xl border border-border-soft bg-white p-5 shadow-sm" aria-labelledby="today-agenda-title">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="today-agenda-title" className="font-serif text-xl font-bold text-ink">Today agenda</h2>
            <p className="mt-1 text-sm text-gray-body">A unified view of open tasks, calendar events, and available assignment due dates.</p>
          </div>
          <StatusBadge status="info">{agenda.length} scheduled</StatusBadge>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-lg bg-cream/40 p-3 text-xs text-gray-body">{loadingTasks ? 'Loading tasks...' : tasksError ? 'Tasks unavailable' : todos.length ? `${todos.length} task${todos.length === 1 ? '' : 's'} available` : 'No tasks scheduled'}</div>
          <div className="rounded-lg bg-cream/40 p-3 text-xs text-gray-body">{loadingCalendar ? 'Loading calendar...' : calendarError ? 'Calendar unavailable' : calendarEvents.length ? `${calendarEvents.length} event${calendarEvents.length === 1 ? '' : 's'} scheduled` : 'No calendar events scheduled'}</div>
          <div className="rounded-lg bg-cream/40 p-3 text-xs text-gray-body">
            {loadingAgendaAssignments ? 'Loading assignments...' : agendaAssignmentsError ? <><span>Assignments unavailable.</span> <button type="button" onClick={fetchAgendaAssignments} className="font-semibold text-maroon underline">Retry</button></> : assignmentDueDatesAvailable ? 'Assignment due dates included' : 'Assignment deadlines unavailable'}
          </div>
        </div>
        {groupedAgenda.every(group => group.items.length === 0) && !loadingTasks && !loadingCalendar && !loadingAgendaAssignments ? (
          <EmptyState icon={<CalendarIcon className="h-7 w-7 text-maroon" />} title="Nothing scheduled" description="No tasks, events, or available assignment due dates fall within the next week." />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {groupedAgenda.map(group => (
              <div key={group.group} className="rounded-lg border border-border-soft bg-cream/20 p-3">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-body">{group.group}</h3>
                {group.items.length === 0 ? <p className="text-sm text-gray-body">No items</p> : (
                  <div className="space-y-2">
                    {group.items.map(item => (
                      <button key={item.id} type="button" onClick={() => onNavigate?.(item.destination)} className="w-full rounded-lg border border-border-soft bg-white p-3 text-left hover:border-maroon/40">
                        <span className="block text-sm font-semibold text-ink">{item.title}</span>
                        <span className="mt-1 block text-xs text-gray-body">{item.source} · {new Date(`${item.date}T00:00:00`).toLocaleDateString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Calendar */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white border border-border-soft p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold flex items-center text-ink font-serif"><CalendarIcon className="w-5 h-5 mr-2 text-maroon" /> Calendar</h3>
              <div className="flex items-center gap-2 sm:gap-4 bg-cream rounded-lg p-1 border border-border-soft">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-cream-edge/30 rounded text-ink"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-medium w-32 text-center text-ink">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-cream-edge/30 rounded text-ink"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            
            {calendarError ? (
              <ErrorState message={calendarError} onRetry={fetchCalendarEvents} />
            ) : loadingCalendar ? (
              <div className="space-y-2">
                <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-center text-xs font-semibold text-gray-body uppercase py-2">{day}</div>)}
                </div>
                <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2">
                  {Array.from({ length: 35 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-cream/40 animate-pulse" />)}
                </div>
              </div>
            ) : (
              <>
                <div className="grid min-w-0 grid-cols-7 gap-1 mb-2 sm:gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-center text-xs font-semibold text-gray-body uppercase py-2">{day}</div>)}
                </div>
                
                <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-14 rounded-lg" />)}
                  
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dateStr = getLocalDateString(dateObj);
                    const dayEvents = calendarEvents.filter(e => e.date === dateStr);
                    const hasEvents = dayEvents.length > 0;
                    
                    const isPast = dateObj < today;
                    const isToday = dateObj.getTime() === today.getTime();
                    const isSelected = selectedDate && selectedDate.getTime() === dateObj.getTime();
                    
                    return (
                      <div 
                        key={day} 
                        onClick={() => { if(!isPast) setSelectedDate(selectedDate?.getTime() === dateObj.getTime() ? null : dateObj); setShowEventForm(false); }} 
                        className={`relative h-14 min-w-0 p-1.5 rounded-lg flex flex-col items-center justify-center transition-colors border ${
                          isPast 
                            ? 'bg-gray-50/40 border-transparent opacity-40 cursor-not-allowed' 
                            : 'cursor-pointer'
                        } ${
                          isSelected 
                            ? 'border-maroon bg-maroon/5 ring-1 ring-maroon shadow-2xs' 
                            : isToday 
                            ? 'border-maroon/50 bg-maroon/5'
                            : 'bg-white border-border-soft/70 hover:border-maroon/40 hover:bg-cream/20'
                        }`}
                      >
                        {/* Event dot in the top right corner of the date box */}
                        {hasEvents && (
                          <span 
                            className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-maroon" 
                            title={`${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`}
                          />
                        )}

                        <span className={`text-xs ${
                          isToday || isSelected ? 'font-bold text-maroon' : 'font-medium text-ink'
                        }`}>
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {selectedDate && (
              <div className="mt-6 p-4 bg-cream/30 rounded-xl border border-border-soft flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-ink">Events for {selectedDate.toLocaleDateString()}</h4>
                  <button onClick={() => setSelectedDate(null)} className="text-gray-body hover:text-ink"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="space-y-2 mb-2">
                  {calendarEvents.filter(e => e.date === getLocalDateString(selectedDate)).map(ev => (
                    <div key={ev.id} className="text-sm bg-white p-2 rounded border border-border-soft flex items-center justify-between group">
                      <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-maroon mr-2 shrink-0" />{ev.title}</div>
                      <button onClick={(e) => { e.stopPropagation(); deleteCalendarEvent(ev.id); }} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  ))}
                </div>

                {!showEventForm ? (
                  <button onClick={() => setShowEventForm(true)} className="w-full py-2 bg-white border border-border-soft hover:border-maroon/30 text-ink rounded-lg text-sm font-medium transition-colors">+ Add Event</button>
                ) : (
                  <div className="flex gap-2">
                    <input autoFocus type="text" placeholder="Event Title..." className="flex-1 px-3 py-1.5 text-sm border border-border-soft rounded-lg focus:outline-none focus:border-maroon" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddEvent()} />
                    <button onClick={handleAddEvent} className="px-3 py-1.5 bg-maroon text-white text-sm font-semibold rounded-lg hover:bg-maroon-deep transition-colors">Save</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-border-soft p-6 flex flex-col h-[500px] rounded-xl shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center text-ink font-serif"><ListTodo className="w-5 h-5 mr-2 text-maroon" /> Tasks</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {tasksError ? (
                <ErrorState message={tasksError} onRetry={fetchTasks} />
              ) : loadingTasks ? (
                Array.from({length: 4}).map((_, i) => <div key={i} className="h-16 bg-cream/40 rounded-lg animate-pulse" />)
              ) : todos.length === 0 ? (
                <EmptyState icon={<ListTodo className="w-8 h-8 text-maroon" />} title="No tasks" description="You have no tasks created yet. Add one below!" />
              ) : todos.map(todo => (
                <div key={todo.id} className={`p-3 rounded-lg border transition-colors flex gap-3 group ${todo.completed ? 'bg-green-50/5 border-green-500/20 text-gray-body/70' : 'bg-cream/20 border-border-soft text-ink hover:border-maroon/20 hover:bg-cream/40'}`}>
                  <button type="button" aria-label={`${todo.completed ? 'Mark incomplete' : 'Mark complete'}: ${todo.task}`} className="mt-0.5 shrink-0" onClick={() => toggleTodo(todo.id, todo.completed)}>
                    {todo.completed ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-gray-body/60" />}
                  </button>
                  <button type="button" aria-label={`Toggle task: ${todo.task}`} className="flex-1 text-left" onClick={() => toggleTodo(todo.id, todo.completed)}>
                    <p className={`text-sm ${todo.completed ? 'line-through text-gray-body/60' : 'font-medium text-ink'}`}>{todo.task}</p>
                    <p className="text-[10px] text-gray-body mt-1 uppercase tracking-wider">{new Date(todo.date).toLocaleDateString()}</p>
                  </button>
                  <button aria-label={`Delete task: ${todo.task}`} onClick={(e) => deleteTask(todo.id, e)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-4">
              {!isAddingTask ? (
                <button onClick={() => setIsAddingTask(true)} className="w-full py-2.5 flex items-center justify-center gap-2 bg-cream hover:bg-cream-edge/60 border border-border-soft text-ink rounded-lg text-sm font-semibold transition-colors"><Plus className="w-4 h-4" /> Add Task</button>
              ) : (
                <div className="flex flex-col gap-2">
                  <input autoFocus type="text" placeholder="Task description..." className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm focus:outline-none focus:border-maroon" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
                  <div className="flex gap-2">
                    <button onClick={handleAddTask} className="flex-1 py-1.5 bg-maroon text-white text-sm font-semibold rounded-lg hover:bg-maroon-deep transition-colors">Save</button>
                    <button onClick={() => { setIsAddingTask(false); setNewTaskText(''); }} className="flex-1 py-1.5 bg-white border border-border-soft text-ink text-sm font-semibold rounded-lg">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-white border border-border-soft p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold mb-6 flex items-center text-ink font-serif"><MessageSquare className="w-5 h-5 mr-2 text-maroon" /> Announcements</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-cream/40 p-5 rounded-xl border border-border-soft h-fit">
            <h4 className="text-sm font-bold text-ink mb-4">New Announcement</h4>
            {restoredAnnouncementDraft && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-sm text-ink" role="status">
                <span>Restored draft from this device.</span>
                <button type="button" className="font-semibold text-maroon underline" onClick={() => {
                  clearDraft(announcementDraftKey);
                  skipAnnouncementDraftWrite.current = true;
                  setNewAnnouncement({ title: '', content: '', isSurvey: false, batch: 'All Batches', department: 'All Departments', section: 'All Sections' });
                  setRestoredAnnouncementDraft(false);
                }}>Discard</button>
              </div>
            )}
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <input required type="text" placeholder="Title" className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm" value={newAnnouncement.title} onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})} />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-body uppercase">Target Audience</p>
                <select className="w-full px-3 py-2 bg-white border rounded-lg text-sm" value={newAnnouncement.batch} onChange={e => setNewAnnouncement({...newAnnouncement, batch: e.target.value, department: 'All Departments', section: 'All Sections'})}>
                  <option value="All Batches">All Batches</option>
                  {batches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
                {newAnnouncement.batch !== 'All Batches' && (
                  <select className="w-full px-3 py-2 bg-white border rounded-lg text-sm" value={newAnnouncement.department} onChange={e => setNewAnnouncement({...newAnnouncement, department: e.target.value, section: 'All Sections'})}>
                    <option value="All Departments">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                )}
                {newAnnouncement.batch !== 'All Batches' && newAnnouncement.department !== 'All Departments' && (
                  <select className="w-full px-3 py-2 bg-white border rounded-lg text-sm" value={newAnnouncement.section} onChange={e => setNewAnnouncement({...newAnnouncement, section: e.target.value})}>
                    <option value="All Sections">All Sections</option>
                    {departments.find(d => d.name === newAnnouncement.department)?.sections?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <RichTextEditor
                value={newAnnouncement.content}
                onChange={(value) => setNewAnnouncement({ ...newAnnouncement, content: value })}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-maroon" checked={newAnnouncement.isSurvey} onChange={e => setNewAnnouncement({...newAnnouncement, isSurvey: e.target.checked})} />
                <span className="text-sm font-medium text-ink">Mark as Survey / Feedback Request</span>
              </label>
              <button type="submit" className="w-full py-2 bg-maroon hover:bg-maroon-deep text-white rounded-lg text-sm font-bold">Post</button>
            </form>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Search announcements" value={announcementSearch} onChange={event => setAnnouncementSearch(event.target.value)} placeholder="Search announcements..." className="h-10 w-full max-w-sm rounded-lg border border-border-soft bg-white px-3 text-sm text-ink outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20" />
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={surveysOnly} onChange={event => setSurveysOnly(event.target.checked)} />
                Surveys only
              </label>
              <button type="button" onClick={() => { clearSavedFilters(announcementFilterKey); setAnnouncementSearch(''); setSurveysOnly(false); }} className="rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold text-ink hover:bg-cream">Reset filters</button>
            </div>
            {loadingAnnouncements ? (
              Array.from({length: 3}).map((_, i) => <div key={i} className="h-32 bg-cream/40 rounded-xl animate-pulse" />)
            ) : visibleAnnouncements.length === 0 ? (
              <EmptyState icon={<MessageSquare className="w-8 h-8 text-maroon" />} title="No announcements" description="You haven't posted any announcements yet." />
            ) : visibleAnnouncements.map((ann) => (
              <div key={ann.id} className={`p-5 rounded-xl border relative transition-all ${ann.isSurvey ? 'bg-maroon/5 border-maroon/20 shadow-xs' : 'bg-white border-border-soft shadow-xs'}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h5 
                        onClick={() => setViewingAnnouncement(ann)} 
                        className="font-bold text-ink text-base hover:text-maroon transition-colors cursor-pointer"
                        title="Click to view full announcement"
                      >
                        {ann.title}
                      </h5>
                      {ann.isSurvey && <span className="text-[10px] uppercase font-bold bg-maroon text-white px-2 py-0.5 rounded-full">Survey</span>}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-body uppercase border px-2 py-0.5 rounded bg-cream/50 inline-block">Target: {ann.audience}</span>
                  </div>

                  {/* Header Actions: Date + View Details + Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-gray-body">{new Date(ann.date).toLocaleDateString()}</span>
                    <button
                      type="button"
                      onClick={() => setViewingAnnouncement(ann)}
                      className="text-xs font-bold text-maroon hover:bg-cream-edge/50 px-2.5 py-1 rounded-lg border border-border-soft transition-colors cursor-pointer"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAnnouncement(ann.id)}
                      className="text-gray-body/60 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-100 transition-colors cursor-pointer"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  className="text-sm text-ink/80 mb-4 rich-text-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.content) || '<p>No announcement content.</p>' }}
                />
                <div className="flex items-center justify-between border-t border-border-soft/60 pt-3 mt-3">
                  <span className="text-xs font-medium text-gray-body">Posted by <span className="text-ink">{ann.author || 'Faculty'}</span></span>
                  {ann.isSurvey && (
                    <button onClick={() => openSurveyResponses(ann.id)} className="text-xs font-bold text-maroon hover:underline cursor-pointer">
                      View Responses ({ann._count?.responses || 0})
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {hasMore && (
              <div className="flex justify-center mt-4 pt-2">
                <button onClick={() => fetchAnnouncements(page + 1)} className="border border-maroon text-maroon hover:bg-maroon hover:text-white rounded-full px-6 py-1.5 font-bold transition-all shadow-sm text-xs">
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
        <FacultyPolls isDemo={isDemo} />
      </div>
    </div>
  );
}
