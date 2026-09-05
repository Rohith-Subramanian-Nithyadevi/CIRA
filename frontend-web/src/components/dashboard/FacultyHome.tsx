import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Circle, 
  Bell, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare,
  X,
  ListTodo,
  Trash2,
  Loader2
} from 'lucide-react';

interface Batch { id: string; name: string; }
interface Department { id: string; name: string; batchId: string; sections: {id: string; name: string}[] }
interface Task { id: string; task: string; completed: boolean; date: string; }
interface CalendarEvent { id: string; title: string; date: string; }
interface Announcement { id: string; title: string; content: string; date: string; author?: string; isSurvey: boolean; audience: string; _count?: { responses: number }; facultyId?: string; }
interface AnnouncementResponse { id: string; response: string; submittedAt: string; user: { name: string; rollNumber: string } }

export default function FacultyHome() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token');

  // Loading States
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // Data States
  const [todos, setTodos] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

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

  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications] = useState([
    { id: 1, text: 'New assignment submission from Section A', unread: true, time: '2h ago' }
  ]);
  
  const [viewingResponsesFor, setViewingResponsesFor] = useState<string | null>(null);
  const [announcementResponses, setAnnouncementResponses] = useState<AnnouncementResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchCalendarEvents();
    fetchAnnouncements();
    fetchBatches();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/dashboard/tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.success) setTodos(data.data);
    } catch (err) {} finally { setLoadingTasks(false); }
  };

  const fetchCalendarEvents = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/dashboard/calendar`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.success) setCalendarEvents(data.data.map((e: any) => ({ ...e, date: e.date.split('T')[0] })));
    } catch (err) {} finally { setLoadingCalendar(false); }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/dashboard/announcements`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.success) setAnnouncements(data.data.map((a: any) => ({ ...a, date: a.date.split('T')[0], author: 'You' })));
    } catch (err) {} finally { setLoadingAnnouncements(false); }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/batches`);
      const data = await res.json();
      if (data?.data?.batches) setBatches(data.data.batches);
    } catch (err) {}
  };

  useEffect(() => {
    if (newAnnouncement.batch === 'All Batches') {
      setDepartments([]);
      return;
    }
    const fetchDepartments = async () => {
      try {
        const selectedBatch = batches.find(b => b.name === newAnnouncement.batch);
        if (!selectedBatch) return;
        const res = await fetch(`${baseUrl}/api/v1/departments?batchId=${selectedBatch.id}`);
        const data = await res.json();
        if (data?.data?.departments) setDepartments(data.data.departments);
      } catch (err) {}
    };
    fetchDepartments();
  }, [newAnnouncement.batch, batches]);


  // --- TASKS LOGIC ---
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    const t = newTaskText;
    setNewTaskText(''); setIsAddingTask(false);
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/dashboard/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task: t, date: new Date().toISOString() })
      });
      const data = await res.json();
      if (data?.success) setTodos([...todos, data.data]);
    } catch (err) {}
  };

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    try {
      await fetch(`${baseUrl}/api/v1/faculty/dashboard/tasks/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ completed: !currentStatus })
      });
    } catch (err) {}
  };

  const deleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTodos(todos.filter(t => t.id !== id));
    try {
      await fetch(`${baseUrl}/api/v1/faculty/dashboard/tasks/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (err) {}
  };

  // --- CALENDAR LOGIC ---
  const handleAddEvent = async () => {
    if (!selectedDate || !newEventTitle.trim()) return;
    const title = newEventTitle;
    const date = selectedDate.toISOString();
    setNewEventTitle(''); setShowEventForm(false);
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/dashboard/calendar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, date })
      });
      const data = await res.json();
      if (data?.success) setCalendarEvents([...calendarEvents, { ...data.data, date: data.data.date.split('T')[0] }]);
    } catch (err) {}
  };

  const deleteCalendarEvent = async (id: string) => {
    setCalendarEvents(calendarEvents.filter(e => e.id !== id));
    try {
      await fetch(`${baseUrl}/api/v1/faculty/dashboard/calendar/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (err) {}
  };

  // --- ANNOUNCEMENTS LOGIC ---
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) return;
    
    let audienceStr = 'All Students';
    if (newAnnouncement.batch !== 'All Batches') {
      audienceStr = `${newAnnouncement.batch}`;
      if (newAnnouncement.department !== 'All Departments') audienceStr += ` | ${newAnnouncement.department}`;
      if (newAnnouncement.section !== 'All Sections') audienceStr += ` | Section ${newAnnouncement.section}`;
    }

    const payload = {
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      isSurvey: newAnnouncement.isSurvey,
      audience: audienceStr,
      date: new Date().toISOString()
    };

    setNewAnnouncement({ title: '', content: '', isSurvey: false, batch: 'All Batches', department: 'All Departments', section: 'All Sections' });
    
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/dashboard/announcements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success) setAnnouncements([{...data.data, date: data.data.date.split('T')[0], author: 'You'}, ...announcements]);
    } catch (err) {}
  };

  const deleteAnnouncement = async (id: string) => {
    setAnnouncements(announcements.filter(a => a.id !== id));
    try {
      await fetch(`${baseUrl}/api/v1/faculty/dashboard/announcements/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (err) {}
  };

  const openSurveyResponses = async (id: string) => {
    setViewingResponsesFor(id);
    setLoadingResponses(true);
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/dashboard/announcements/${id}/responses`, { headers: { 'Authorization': `Bearer ${token}` } });
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
  
  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="space-y-6 relative">
      {viewingResponsesFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="font-bold font-serif text-ink">Survey Responses</h3>
              <button onClick={() => setViewingResponsesFor(null)}><X className="w-5 h-5 text-gray-body" /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {loadingResponses ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-maroon" /></div>
              ) : announcementResponses.length === 0 ? (
                <p className="text-gray-body text-center py-8">No responses yet.</p>
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
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-border-soft shadow-sm">
        <h2 className="text-xl font-serif font-bold text-ink">Dashboard</h2>
        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 hover:bg-cream rounded-full relative transition-colors">
            <Bell className="w-5 h-5 text-ink" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Calendar */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white border border-border-soft p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center text-ink font-serif"><CalendarIcon className="w-5 h-5 mr-2 text-maroon" /> Calendar</h3>
              <div className="flex items-center gap-4 bg-cream rounded-lg p-1 border border-border-soft">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-cream-edge/30 rounded text-ink"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-medium w-32 text-center text-ink">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-cream-edge/30 rounded text-ink"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-center text-xs font-semibold text-gray-body uppercase py-2">{day}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-14 rounded-lg bg-cream/30 opacity-50" />)}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const dayEvents = calendarEvents.filter(e => e.date === dateStr);
                
                const isPast = dateObj < today;
                const isToday = dateObj.getTime() === today.getTime();
                const isSelected = selectedDate && selectedDate.getTime() === dateObj.getTime();
                
                return (
                  <div key={day} onClick={() => { if(!isPast) setSelectedDate(selectedDate?.getTime() === dateObj.getTime() ? null : dateObj); setShowEventForm(false); }} className={`relative h-14 p-1 rounded-lg flex flex-col transition-colors border ${isPast ? 'bg-gray-50/50 border-transparent opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'ring-2 ring-maroon border-transparent' : ''} ${!isPast && !isSelected ? 'bg-white border-border-soft hover:border-maroon/40 hover:bg-cream/20' : ''} ${isToday ? 'bg-maroon/5 border-maroon/50' : ''}`}>
                    <span className={`text-xs font-semibold px-1 ${isToday ? 'text-maroon' : 'text-ink'}`}>{day}</span>
                    <div className="mt-auto flex flex-wrap gap-1 px-1 pb-1">
                      {loadingCalendar ? null : dayEvents.slice(0, 3).map((ev, idx) => <div key={idx} className="w-full h-1.5 rounded-full bg-maroon/80" title={ev.title} />)}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {selectedDate && (
              <div className="mt-6 p-4 bg-cream/30 rounded-xl border border-border-soft flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-ink">Events for {selectedDate.toLocaleDateString()}</h4>
                  <button onClick={() => setSelectedDate(null)} className="text-gray-body hover:text-ink"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="space-y-2 mb-2">
                  {calendarEvents.filter(e => e.date === new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0]).map(ev => (
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
              {loadingTasks ? (
                Array.from({length: 4}).map((_, i) => <div key={i} className="h-16 bg-cream/40 rounded-lg animate-pulse" />)
              ) : todos.length === 0 ? (
                <p className="text-sm text-gray-body text-center mt-10">No tasks created yet.</p>
              ) : todos.map(todo => (
                <div key={todo.id} className={`p-3 rounded-lg border transition-colors flex gap-3 group ${todo.completed ? 'bg-green-50/5 border-green-500/20 text-gray-body/70' : 'bg-cream/20 border-border-soft text-ink hover:border-maroon/20 hover:bg-cream/40'}`}>
                  <div className="mt-0.5 shrink-0 cursor-pointer" onClick={() => toggleTodo(todo.id, todo.completed)}>
                    {todo.completed ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-gray-body/60" />}
                  </div>
                  <div className="flex-1 cursor-pointer" onClick={() => toggleTodo(todo.id, todo.completed)}>
                    <p className={`text-sm ${todo.completed ? 'line-through text-gray-body/60' : 'font-medium text-ink'}`}>{todo.task}</p>
                    <p className="text-[10px] text-gray-body mt-1 uppercase tracking-wider">{new Date(todo.date).toLocaleDateString()}</p>
                  </div>
                  <button onClick={(e) => deleteTask(todo.id, e)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
                    {departments.find(d => d.name === newAnnouncement.department)?.sections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <textarea required placeholder="Message..." rows={4} className="w-full px-3 py-2 bg-white border rounded-lg text-sm resize-none" value={newAnnouncement.content} onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-maroon" checked={newAnnouncement.isSurvey} onChange={e => setNewAnnouncement({...newAnnouncement, isSurvey: e.target.checked})} />
                <span className="text-sm font-medium text-ink">Mark as Survey / Feedback Request</span>
              </label>
              <button type="submit" className="w-full py-2 bg-maroon hover:bg-maroon-deep text-white rounded-lg text-sm font-bold">Post</button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {loadingAnnouncements ? (
              Array.from({length: 3}).map((_, i) => <div key={i} className="h-32 bg-cream/40 rounded-xl animate-pulse" />)
            ) : announcements.length === 0 ? (
              <div className="h-full min-h-[200px] flex items-center justify-center border border-dashed border-border-soft rounded-xl bg-cream/10"><p className="text-gray-body text-sm">No announcements yet.</p></div>
            ) : announcements.map((ann) => (
              <div key={ann.id} className={`p-5 rounded-xl border relative group ${ann.isSurvey ? 'bg-maroon/5 border-maroon/20' : 'bg-white border-border-soft'}`}>
                <button onClick={() => deleteAnnouncement(ann.id)} className="absolute top-4 right-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2 pr-8">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-bold text-ink text-base">{ann.title}</h5>
                      {ann.isSurvey && <span className="text-[10px] uppercase font-bold bg-maroon text-white px-2 py-0.5 rounded-md">Survey</span>}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-body uppercase border px-2 py-0.5 rounded bg-cream/50 inline-block">Target: {ann.audience}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-body shrink-0">{new Date(ann.date).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-ink/80 mb-4">{ann.content}</p>
                <div className="flex items-center justify-between border-t border-border-soft/60 pt-3 mt-3">
                  <span className="text-xs font-medium text-gray-body">Posted by <span className="text-ink">{ann.author || 'Faculty'}</span></span>
                  {ann.isSurvey && (
                    <button onClick={() => openSurveyResponses(ann.id)} className="text-xs font-bold text-maroon hover:underline">
                      View Responses ({ann._count?.responses || 0})
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
