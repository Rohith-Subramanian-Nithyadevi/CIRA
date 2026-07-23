import { useState } from 'react';
import { Calendar as CalendarIcon, CheckCircle2, Circle, Bell, Plus, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

// Mock Data
const TODO_ITEMS = [
  { id: 1, task: 'Grade Section A Quizzes', completed: false, date: '2026-07-09' },
  { id: 2, task: 'Prepare Midterm Assessment', completed: false, date: '2026-07-12' },
  { id: 3, task: 'Review Aptitude Scores', completed: true, date: '2026-07-07' },
  { id: 4, task: 'Upload Verbal Reasoning Materials', completed: false, date: '2026-07-10' },
];

const INITIAL_ANNOUNCEMENTS = [
  { id: 1, title: 'Midterm Assessment Scheduled', content: 'The Aptitude midterm assessment is scheduled for next Monday. Please ensure all students are notified.', date: '2026-07-08', author: 'Dr. Smith' },
  { id: 2, title: 'Quiz 3 Results Published', content: 'Results for the Verbal Reasoning Quiz 3 have been published to the student portal.', date: '2026-07-06', author: 'Prof. Johnson' },
];

export default function FacultyHome() {
  const [todos, setTodos] = useState(TODO_ITEMS);
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 8)); // July 2026

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  };

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) return;
    
    const newAnn = {
      id: Date.now(),
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      date: new Date().toISOString().split('T')[0],
      author: 'You'
    };
    
    setAnnouncements([newAnn, ...announcements]);
    setNewAnnouncement({ title: '', content: '' });
  };

  // Simple Calendar Logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Mock events for the calendar (dots)
  const calendarEvents = [9, 12, 15, 22, 28]; // Days with quizzes/assessments in July

  return (
    <div className="space-y-6">
      
      {/* Top Row: Calendar & To-Do List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calendar */}
        <div className="bg-white border border-border-soft p-6 lg:col-span-2 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center text-ink font-serif">
              <CalendarIcon className="w-5 h-5 mr-2 text-maroon" /> 
              Upcoming Assessments Calendar
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
              <div key={`empty-${i}`} className="h-12 rounded-lg bg-cream/30 opacity-50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const hasEvent = calendarEvents.includes(day) && currentDate.getMonth() === 6; // Only show events in July
              const isToday = day === 8 && currentDate.getMonth() === 6; // Mock today as July 8
              
              return (
                <div 
                  key={day} 
                  className={`relative h-12 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors border
                    ${isToday ? 'bg-maroon/10 border-maroon text-maroon' : 'bg-white border-border-soft hover:border-maroon/20 hover:bg-cream/20 text-ink'}`}
                >
                  {day}
                  {hasEvent && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-maroon" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-body">
            <div className="w-2 h-2 rounded-full bg-maroon" />
            <span>Scheduled Quiz / Assessment</span>
          </div>
        </div>

        {/* To-Do List */}
        <div className="bg-white border border-border-soft p-6 flex flex-col h-[400px] rounded-xl shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center text-ink font-serif">
            <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" /> 
            Faculty To-Do List
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
                <div>
                  <p className={`text-sm ${todo.completed ? 'line-through text-gray-body/60' : 'font-semibold text-ink'}`}>{todo.task}</p>
                  <p className="text-xs text-gray-body mt-1">Due: {todo.date}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2.5 flex items-center justify-center gap-2 bg-cream hover:bg-cream-edge/60 border border-border-soft text-ink rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Middle Row: Announcements */}
      <div className="bg-white border border-border-soft p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold mb-6 flex items-center text-ink font-serif">
          <Bell className="w-5 h-5 mr-2 text-maroon" /> 
          Announcements Board
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Post Announcement Form */}
          <div className="lg:col-span-1 bg-cream/40 p-5 rounded-xl border border-border-soft h-fit">
            <h4 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-maroon" />
              Post New Announcement
            </h4>
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  placeholder="Announcement Title" 
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                />
              </div>
              <div>
                <textarea 
                  placeholder="Write your announcement regarding quizzes or results here..." 
                  rows={4}
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon resize-none"
                  value={newAnnouncement.content}
                  onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full text-sm font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
              >
                Post Announcement
              </button>
            </form>
          </div>

          {/* Announcement Feed */}
          <div className="lg:col-span-2 space-y-4">
            {announcements.length === 0 ? (
              <div className="h-full min-h-[200px] flex items-center justify-center border border-dashed border-border-soft rounded-xl">
                <p className="text-gray-body text-sm">No announcements posted yet.</p>
              </div>
            ) : (
              announcements.map((ann, idx) => (
                <div key={ann.id} className="p-4 rounded-xl border border-border-soft bg-cream/20 hover:bg-cream/40 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-semibold text-ink">{ann.title}</h5>
                    <span className="text-xs text-gray-body bg-cream border border-border-soft px-2 py-0.5 rounded-full">{ann.date}</span>
                  </div>
                  <p className="text-sm text-gray-body mb-3">{ann.content}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-maroon to-maroon-deep flex items-center justify-center text-[10px] font-bold text-white">
                      {ann.author.charAt(0)}
                    </div>
                    <span className="text-xs text-gray-body">Posted by {ann.author}</span>
                    {idx === 0 && <span className="ml-2 text-[10px] font-medium text-maroon bg-maroon/10 px-1.5 py-0.5 rounded">New</span>}
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
