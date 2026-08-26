import { useState } from 'react';
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
  ListTodo
} from 'lucide-react';

// Mock Data
const TODO_ITEMS = [
  { id: 1, task: 'Grade Section A Quizzes', completed: false, date: '2026-07-09' },
  { id: 2, task: 'Prepare Midterm Assessment', completed: false, date: '2026-07-12' },
  { id: 3, task: 'Review Aptitude Scores', completed: true, date: '2026-07-07' },
  { id: 4, task: 'Upload Verbal Reasoning Materials', completed: false, date: '2026-07-10' },
];

const INITIAL_ANNOUNCEMENTS = [
  { 
    id: 1, 
    title: 'Midterm Assessment Scheduled', 
    content: 'The Aptitude midterm assessment is scheduled for next Monday. Please ensure all students are notified.', 
    date: '2026-07-08', 
    author: 'Dr. Smith',
    isSurvey: false,
    audience: 'All Students'
  },
  { 
    id: 2, 
    title: 'Student Feedback Needed', 
    content: 'Please fill out this survey regarding the new curriculum.', 
    date: '2026-07-06', 
    author: 'Prof. Johnson',
    isSurvey: true,
    audience: 'Batch 2023-2027 | Computer Science | Section A'
  },
];

interface Batch { id: string; name: string; }
interface Department { id: string; name: string; batchId: string; sections: {id: string; name: string}[] }

export default function FacultyHome() {
  const [todos, setTodos] = useState(TODO_ITEMS);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [newAnnouncement, setNewAnnouncement] = useState({ 
    title: '', 
    content: '',
    isSurvey: false,
    batch: 'All Batches',
    department: 'All Departments',
    section: 'All Sections'
  });

  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  
  // Initialize some mock events based on current month so they show up
  const [calendarEvents, setCalendarEvents] = useState(() => {
    const d = new Date();
    return [
      { id: 1, date: new Date(d.getFullYear(), d.getMonth(), 12).toISOString().split('T')[0], title: 'Midterm Assessment' },
      { id: 2, date: new Date(d.getFullYear(), d.getMonth(), 15).toISOString().split('T')[0], title: 'Quiz 3' },
    ];
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'New assignment submission from Section A', unread: true, time: '2h ago' },
    { id: 2, text: 'Faculty meeting at 3 PM', unread: true, time: '5h ago' },
    { id: 3, text: 'System maintenance scheduled', unread: false, time: '1d ago' },
  ]);

  import('react').then(({ useEffect }) => {
    useEffect(() => {
      const fetchBatches = async () => {
        try {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
          const res = await fetch(`${baseUrl}/api/v1/batches`);
          const data = await res.json();
          if (data?.data?.batches) setBatches(data.data.batches);
        } catch (err) {}
      };
      fetchBatches();
    }, []);

    useEffect(() => {
      if (newAnnouncement.batch === 'All Batches') {
        setDepartments([]);
        return;
      }
      const fetchDepartments = async () => {
        try {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
          // Find batch id by name
          const selectedBatch = batches.find(b => b.name === newAnnouncement.batch);
          if (!selectedBatch) return;
          const res = await fetch(`${baseUrl}/api/v1/departments?batchId=${selectedBatch.id}`);
          const data = await res.json();
          if (data?.data?.departments) setDepartments(data.data.departments);
        } catch (err) {}
      };
      fetchDepartments();
    }, [newAnnouncement.batch, batches]);
  });

  // Tasks Logic
  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  };

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const newTask = {
      id: Date.now(),
      task: newTaskText,
      completed: false,
      date: new Date().toISOString().split('T')[0]
    };
    setTodos([newTask, ...todos]);
    setNewTaskText('');
    setIsAddingTask(false);
  };

  // Announcements Logic
  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) return;
    
    let audienceStr = '';
    if (newAnnouncement.batch === 'All Batches') {
      audienceStr = 'All Students';
    } else {
      audienceStr = `${newAnnouncement.batch}`;
      if (newAnnouncement.department !== 'All Departments') audienceStr += ` | ${newAnnouncement.department}`;
      if (newAnnouncement.section !== 'All Sections') audienceStr += ` | Section ${newAnnouncement.section}`;
    }

    const newAnn = {
      id: Date.now(),
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      date: new Date().toISOString().split('T')[0],
      author: 'You',
      isSurvey: newAnnouncement.isSurvey,
      audience: audienceStr
    };
    
    setAnnouncements([newAnn, ...announcements]);
    setNewAnnouncement({ 
      title: '', 
      content: '', 
      isSurvey: false, 
      batch: 'All Batches', 
      department: 'All Departments', 
      section: 'All Sections' 
    });
  };

  // Calendar Logic
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (clickedDate < today) return; // Block past dates
    
    if (selectedDate && selectedDate.getTime() === clickedDate.getTime()) {
      setSelectedDate(null);
      setShowEventForm(false);
    } else {
      setSelectedDate(clickedDate);
      setShowEventForm(false);
    }
  };

  const handleAddEvent = () => {
    if (!selectedDate || !newEventTitle.trim()) return;
    
    const newEvent = {
      id: Date.now(),
      date: selectedDate.toISOString().split('T')[0],
      title: newEventTitle
    };
    setCalendarEvents([...calendarEvents, newEvent]);
    setNewEventTitle('');
    setShowEventForm(false);
    // setSelectedDate(null); // Keep selected to see the new event immediately
  };

  // Notification Logic
  const unreadCount = notifications.filter(n => n.unread).length;
  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Notifications */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-border-soft shadow-sm">
        <h2 className="text-xl font-serif font-bold text-ink">Dashboard</h2>
        
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-cream rounded-full relative transition-colors"
          >
            <Bell className="w-5 h-5 text-ink" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-border-soft z-50 overflow-hidden">
              <div className="p-3 border-b border-border-soft flex justify-between items-center bg-cream/30">
                <h4 className="font-semibold text-ink text-sm">Notifications</h4>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-maroon hover:underline font-medium">Mark all read</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-body">No notifications</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className={`p-3 border-b border-border-soft hover:bg-cream/40 transition-colors ${notif.unread ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex items-start gap-2">
                        {notif.unread && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0"></div>}
                        <div>
                          <p className={`text-sm ${notif.unread ? 'font-semibold text-ink' : 'text-gray-body'}`}>{notif.text}</p>
                          <span className="text-xs text-gray-body/70 mt-1 block">{notif.time}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Layout Adjustment */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Calendar (Span 7 or 8) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Calendar */}
          <div className="bg-white border border-border-soft p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center text-ink font-serif">
                <CalendarIcon className="w-5 h-5 mr-2 text-maroon" /> 
                Calendar
              </h3>
              <div className="flex items-center gap-4 bg-cream rounded-lg p-1 border border-border-soft">
                <button onClick={prevMonth} className="p-1 hover:bg-cream-edge/30 rounded transition-colors text-ink"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-medium w-32 text-center text-ink">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-cream-edge/30 rounded transition-colors text-ink"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-body uppercase py-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14 rounded-lg bg-cream/30 opacity-50" />
              ))}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                // Adjust for timezone differences to correctly compare dates as string if needed, 
                // but formatting locally is fine:
                const dateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const dayEvents = calendarEvents.filter(e => e.date === dateStr);
                
                const isPast = dateObj < today;
                const isToday = dateObj.getTime() === today.getTime();
                const isSelected = selectedDate && selectedDate.getTime() === dateObj.getTime();
                
                return (
                  <div 
                    key={day} 
                    onClick={() => handleDateClick(day)}
                    className={`relative h-14 p-1 rounded-lg flex flex-col transition-colors border
                      ${isPast ? 'bg-gray-50/50 border-transparent opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      ${isSelected ? 'ring-2 ring-maroon border-transparent' : ''}
                      ${!isPast && !isSelected ? 'bg-white border-border-soft hover:border-maroon/40 hover:bg-cream/20' : ''}
                      ${isToday ? 'bg-maroon/5 border-maroon/50' : ''}
                    `}
                  >
                    <span className={`text-xs font-semibold px-1 ${isToday ? 'text-maroon' : 'text-ink'}`}>{day}</span>
                    
                    <div className="mt-auto flex flex-wrap gap-1 px-1 pb-1">
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <div key={idx} className="w-full h-1.5 rounded-full bg-maroon/80" title={ev.title} />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] font-bold text-gray-body leading-none">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Event Adding Form */}
            {selectedDate && (
              <div className="mt-6 p-4 bg-cream/30 rounded-xl border border-border-soft flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-ink">
                    Events for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h4>
                  <button onClick={() => setSelectedDate(null)} className="text-gray-body hover:text-ink"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="space-y-2 mb-2">
                  {calendarEvents.filter(e => e.date === new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0]).map(ev => (
                    <div key={ev.id} className="text-sm bg-white p-2 rounded border border-border-soft flex items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-maroon mr-2 shrink-0" />
                      {ev.title}
                    </div>
                  ))}
                  {calendarEvents.filter(e => e.date === new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0]).length === 0 && (
                    <p className="text-xs text-gray-body italic">No events scheduled.</p>
                  )}
                </div>

                {!showEventForm ? (
                  <button 
                    onClick={() => setShowEventForm(true)}
                    className="w-full py-2 bg-white border border-border-soft hover:border-maroon/30 text-ink rounded-lg text-sm font-medium transition-colors"
                  >
                    + Add Event
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      autoFocus
                      placeholder="Event Title..." 
                      className="flex-1 px-3 py-1.5 text-sm border border-border-soft rounded-lg focus:outline-none focus:border-maroon"
                      value={newEventTitle}
                      onChange={e => setNewEventTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                    />
                    <button onClick={handleAddEvent} className="px-3 py-1.5 bg-maroon text-white text-sm font-semibold rounded-lg hover:bg-maroon-deep transition-colors">
                      Save
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-body">
              <div className="w-2 h-2 rounded-full bg-maroon" />
              <span>Scheduled Event</span>
              <div className="w-2 h-2 rounded-full bg-gray-300 ml-4" />
              <span>Past Date</span>
            </div>
          </div>
        </div>

        {/* Right Column: Tasks (Span 4 or 5) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-border-soft p-6 flex flex-col h-[500px] rounded-xl shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center text-ink font-serif">
              <ListTodo className="w-5 h-5 mr-2 text-maroon" /> 
              Tasks
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {todos.map(todo => (
                <div 
                  key={todo.id} 
                  className={`p-3 rounded-lg border transition-colors cursor-pointer flex gap-3
                    ${todo.completed ? 'bg-green-50/5 border-green-500/20 text-gray-body/70' : 'bg-cream/20 border-border-soft text-ink hover:border-maroon/20 hover:bg-cream/40'}`}
                  onClick={() => toggleTodo(todo.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {todo.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-body/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${todo.completed ? 'line-through text-gray-body/60' : 'font-medium text-ink'}`}>{todo.task}</p>
                    <p className="text-[10px] text-gray-body mt-1 uppercase tracking-wider">{todo.date}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4">
              {!isAddingTask ? (
                <button 
                  onClick={() => setIsAddingTask(true)}
                  className="w-full py-2.5 flex items-center justify-center gap-2 bg-cream hover:bg-cream-edge/60 border border-border-soft text-ink rounded-lg text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Task description..." 
                    className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAddTask} className="flex-1 py-1.5 bg-maroon text-white text-sm font-semibold rounded-lg hover:bg-maroon-deep transition-colors">
                      Save
                    </button>
                    <button onClick={() => { setIsAddingTask(false); setNewTaskText(''); }} className="flex-1 py-1.5 bg-white border border-border-soft text-ink text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Announcements (Full Width) */}
      <div className="bg-white border border-border-soft p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold mb-6 flex items-center text-ink font-serif">
          <MessageSquare className="w-5 h-5 mr-2 text-maroon" /> 
          Announcements
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Post Announcement Form */}
          <div className="lg:col-span-1 bg-cream/40 p-5 rounded-xl border border-border-soft h-fit">
            <h4 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
              New Announcement
            </h4>
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  placeholder="Title" 
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon font-medium"
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-body uppercase">Target Audience</p>
                <select 
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon"
                  value={newAnnouncement.batch}
                  onChange={e => setNewAnnouncement({...newAnnouncement, batch: e.target.value, department: 'All Departments', section: 'All Sections'})}
                >
                  <option value="All Batches">All Batches</option>
                  {batches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
                
                {newAnnouncement.batch !== 'All Batches' && (
                  <select 
                    className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon"
                    value={newAnnouncement.department}
                    onChange={e => setNewAnnouncement({...newAnnouncement, department: e.target.value, section: 'All Sections'})}
                  >
                    <option value="All Departments">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                )}
                
                {newAnnouncement.batch !== 'All Batches' && newAnnouncement.department !== 'All Departments' && (
                  <select 
                    className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon"
                    value={newAnnouncement.section}
                    onChange={e => setNewAnnouncement({...newAnnouncement, section: e.target.value})}
                  >
                    <option value="All Sections">All Sections</option>
                    {departments.find(d => d.name === newAnnouncement.department)?.sections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <textarea 
                  placeholder="Message..." 
                  rows={4}
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon resize-none"
                  value={newAnnouncement.content}
                  onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                />
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-border-soft text-maroon focus:ring-maroon"
                  checked={newAnnouncement.isSurvey}
                  onChange={e => setNewAnnouncement({...newAnnouncement, isSurvey: e.target.checked})}
                />
                <span className="text-sm font-medium text-ink">Mark as Survey / Feedback Request</span>
              </label>

              <button 
                type="submit" 
                className="w-full py-2 bg-maroon hover:bg-maroon-deep text-white rounded-lg text-sm font-bold transition-all shadow-sm"
              >
                Post
              </button>
            </form>
          </div>

          {/* Announcement Feed */}
          <div className="lg:col-span-2 space-y-4">
            {announcements.length === 0 ? (
              <div className="h-full min-h-[200px] flex items-center justify-center border border-dashed border-border-soft rounded-xl bg-cream/10">
                <p className="text-gray-body text-sm font-medium">No announcements posted yet.</p>
              </div>
            ) : (
              announcements.map((ann, idx) => (
                <div key={ann.id} className={`p-5 rounded-xl border transition-colors ${ann.isSurvey ? 'bg-maroon/5 border-maroon/20 hover:border-maroon/40' : 'border-border-soft bg-white hover:bg-cream/20'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-ink text-base">{ann.title}</h5>
                        {ann.isSurvey && (
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-maroon text-white px-2 py-0.5 rounded-md">Survey</span>
                        )}
                        {idx === 0 && <span className="text-[10px] uppercase tracking-wider font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-md">New</span>}
                      </div>
                      <span className="text-[10px] font-semibold text-gray-body uppercase tracking-wider border border-border-soft px-2 py-0.5 rounded bg-cream/50 inline-block">
                        Target: {ann.audience}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-gray-body shrink-0">{ann.date}</span>
                  </div>
                  
                  <p className="text-sm text-ink/80 mb-4 leading-relaxed">{ann.content}</p>
                  
                  <div className="flex items-center justify-between border-t border-border-soft/60 pt-3 mt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                        {ann.author.charAt(0)}
                      </div>
                      <span className="text-xs font-medium text-gray-body">Posted by <span className="text-ink">{ann.author}</span></span>
                    </div>
                    {ann.isSurvey && (
                      <button className="text-xs font-bold text-maroon hover:text-maroon-deep hover:underline transition-colors">
                        View Responses
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
