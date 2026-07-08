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
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2 text-blue-400" /> 
              Upcoming Assessments Calendar
            </h3>
            <div className="flex items-center gap-4 bg-slate-900/50 rounded-lg p-1 border border-slate-800">
              <button onClick={prevMonth} className="p-1 hover:bg-slate-800 rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-medium w-32 text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-slate-800 rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-12 rounded-lg bg-slate-900/20 opacity-50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const hasEvent = calendarEvents.includes(day) && currentDate.getMonth() === 6; // Only show events in July
              const isToday = day === 8 && currentDate.getMonth() === 6; // Mock today as July 8
              
              return (
                <div 
                  key={day} 
                  className={`relative h-12 rounded-lg flex items-center justify-center text-sm font-medium transition-colors border
                    ${isToday ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300'}`}
                >
                  {day}
                  {hasEvent && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-400" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span>Scheduled Quiz / Assessment</span>
          </div>
        </div>

        {/* To-Do List */}
        <div className="glass-card p-6 flex flex-col h-[400px]">
          <h3 className="text-lg font-bold mb-6 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-400" /> 
            Faculty To-Do List
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {todos.map(todo => (
              <div 
                key={todo.id} 
                className={`p-3 rounded-lg border transition-colors cursor-pointer flex gap-3
                  ${todo.completed ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400' : 'bg-slate-900/50 border-slate-800 text-slate-200 hover:border-slate-700'}`}
                onClick={() => toggleTodo(todo.id)}
              >
                <div className="mt-0.5 shrink-0">
                  {todo.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div>
                  <p className={`text-sm ${todo.completed ? 'line-through' : 'font-medium'}`}>{todo.task}</p>
                  <p className="text-xs text-slate-500 mt-1">Due: {todo.date}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Middle Row: Announcements */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-6 flex items-center">
          <Bell className="w-5 h-5 mr-2 text-purple-400" /> 
          Announcements Board
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Post Announcement Form */}
          <div className="lg:col-span-1 bg-slate-900/50 p-5 rounded-xl border border-slate-800 h-fit">
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Post New Announcement
            </h4>
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  placeholder="Announcement Title" 
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                />
              </div>
              <div>
                <textarea 
                  placeholder="Write your announcement regarding quizzes or results here..." 
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                  value={newAnnouncement.content}
                  onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Post Announcement
              </button>
            </form>
          </div>

          {/* Announcement Feed */}
          <div className="lg:col-span-2 space-y-4">
            {announcements.length === 0 ? (
              <div className="h-full min-h-[200px] flex items-center justify-center border border-dashed border-slate-700 rounded-xl">
                <p className="text-slate-500 text-sm">No announcements posted yet.</p>
              </div>
            ) : (
              announcements.map((ann, idx) => (
                <div key={ann.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-semibold text-slate-200">{ann.title}</h5>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{ann.date}</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{ann.content}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {ann.author.charAt(0)}
                    </div>
                    <span className="text-xs text-slate-500">Posted by {ann.author}</span>
                    {idx === 0 && <span className="ml-2 text-[10px] font-medium text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">New</span>}
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
