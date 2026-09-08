import { useState, useEffect } from 'react';
import { Trash2, CheckCircle2, Circle, GripVertical, TrendingUp, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, Play, Pause, RotateCcw, Target } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface Task {
  id: string;
  title: string;
  description?: string;
  estimatedTime?: number;
  completed: boolean;
  date: string;
}

interface Habit {
  id: string;
  title: string;
  completedDates: string[];
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
}

const getLocalDateString = (d: Date | string): string => {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function StudyPlanner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEstimatedTime, setNewEstimatedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  // Habits
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');

  // Calendar
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');

  // Pomodoro
  const [pomodoroTask, setPomodoroTask] = useState<Task | null>(() => {
    const saved = localStorage.getItem('pomodoroTask');
    return saved ? JSON.parse(saved) : null;
  });
  const [timerMode, setTimerMode] = useState<'work' | 'break'>(() => {
    return (localStorage.getItem('pomodoroMode') as 'work' | 'break') || 'work';
  });
  const [timerActive, setTimerActive] = useState(() => {
    return localStorage.getItem('pomodoroActive') === 'true';
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    const savedTime = localStorage.getItem('pomodoroTimeLeft');
    const savedEndTime = localStorage.getItem('pomodoroEndTime');
    if (localStorage.getItem('pomodoroActive') === 'true' && savedEndTime) {
      const remaining = Math.floor((parseInt(savedEndTime, 10) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    return savedTime ? parseInt(savedTime, 10) : 25 * 60;
  });
  
  const todayStr = getLocalDateString(new Date());

  // Sync state to local storage
  useEffect(() => {
    if (pomodoroTask) {
      localStorage.setItem('pomodoroTask', JSON.stringify(pomodoroTask));
    } else {
      localStorage.removeItem('pomodoroTask');
    }
    localStorage.setItem('pomodoroMode', timerMode);
    localStorage.setItem('pomodoroActive', timerActive.toString());
    localStorage.setItem('pomodoroTimeLeft', timeLeft.toString());
  }, [pomodoroTask, timerMode, timerActive, timeLeft]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      // Set end time if it doesn't exist
      if (!localStorage.getItem('pomodoroEndTime')) {
        localStorage.setItem('pomodoroEndTime', (Date.now() + timeLeft * 1000).toString());
      }
      
      interval = setInterval(() => {
        const endTimeStr = localStorage.getItem('pomodoroEndTime');
        if (endTimeStr) {
          const remaining = Math.floor((parseInt(endTimeStr, 10) - Date.now()) / 1000);
          if (remaining <= 0) {
            setTimeLeft(0);
            setTimerActive(false);
            localStorage.removeItem('pomodoroEndTime');
            if (timerMode === 'work') {
              setTimerMode('break');
              setTimeLeft(5 * 60);
            } else {
              setTimerMode('work');
              setTimeLeft(25 * 60);
            }
          } else {
            setTimeLeft(remaining);
          }
        }
      }, 1000);
    } else if (timeLeft <= 0 && timerActive) {
      setTimerActive(false);
      localStorage.removeItem('pomodoroEndTime');
      if (timerMode === 'work') {
        setTimerMode('break');
        setTimeLeft(5 * 60);
      } else {
        setTimerMode('work');
        setTimeLeft(25 * 60);
      }
    } else {
      // Paused or inactive, clear end time so it recalculates on resume
      if (!timerActive) {
        localStorage.removeItem('pomodoroEndTime');
      }
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, timerMode]);

  const toggleTimer = () => setTimerActive(!timerActive);
  
  const resetTimer = () => {
    setTimerActive(false);
    localStorage.removeItem('pomodoroEndTime');
    setTimeLeft(timerMode === 'work' ? 25 * 60 : 5 * 60);
  };
  
  const startPomodoroSession = (task: Task) => {
    setPomodoroTask(task);
    setTimerMode('work');
    setTimeLeft(25 * 60);
    setTimerActive(false);
    localStorage.removeItem('pomodoroEndTime');
  };

  const closePomodoro = () => {
    setPomodoroTask(null);
    setTimerActive(false);
    localStorage.removeItem('pomodoroEndTime');
    localStorage.removeItem('pomodoroTask');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, habitsRes, calRes] = await Promise.all([
        apiClient.fetch('/api/v1/student-features/tasks'),
        apiClient.fetch('/api/v1/student-features/habits'),
        apiClient.fetch('/api/v1/student-features/calendar')
      ]);
      
      const tasksData = await tasksRes.json();
      const habitsData = await habitsRes.json();
      const calData = await calRes.json();

      setTasks(tasksData.tasks || []);
      if (tasksData.streak !== undefined) setStreak(tasksData.streak);
      
      setHabits(habitsData || []);
      if (calData?.success) {
        setCalendarEvents(calData.data.map((e: any) => ({ ...e, date: getLocalDateString(e.date) })));
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  // --- TASKS ---
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const res = await apiClient.fetch('/api/v1/student-features/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask,
          description: newDesc,
          estimatedTime: newEstimatedTime ? parseInt(newEstimatedTime, 10) : undefined,
          date: new Date().toISOString()
        })
      });
      const data = await res.json();
      setTasks([...tasks, data]);
      setNewTask('');
      setNewDesc('');
      setNewEstimatedTime('');
    } catch (error) {
      console.error('Failed to add task', error);
    }
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    try {
      const res = await apiClient.fetch(`/api/v1/student-features/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentStatus })
      });
      const data = await res.json();
      setTasks(tasks.map(t => t.id === id ? data : t));
      
      if (!currentStatus) {
        fetchData(); // Refetch to get updated streak
      }
    } catch (error) {
      console.error('Failed to toggle task', error);
      fetchData();
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await apiClient.fetch(`/api/v1/student-features/tasks/${id}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== id));
      if (pomodoroTask?.id === id) setPomodoroTask(null);
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  // --- HABITS ---
  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.trim()) return;
    try {
      const res = await apiClient.fetch('/api/v1/student-features/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newHabit })
      });
      const data = await res.json();
      setHabits([...habits, data]);
      setNewHabit('');
    } catch (error) {}
  };

  const toggleHabit = async (id: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    
    // Optimistic
    const isCompleted = habit.completedDates.includes(todayStr);
    const newDates = isCompleted ? habit.completedDates.filter(d => d !== todayStr) : [...habit.completedDates, todayStr];
    setHabits(habits.map(h => h.id === id ? { ...h, completedDates: newDates } : h));

    try {
      await apiClient.fetch(`/api/v1/student-features/habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr })
      });
    } catch (error) {
      fetchData();
    }
  };

  const deleteHabit = async (id: string) => {
    try {
      await apiClient.fetch(`/api/v1/student-features/habits/${id}`, { method: 'DELETE' });
      setHabits(habits.filter(h => h.id !== id));
    } catch (error) {}
  };

  // --- CALENDAR ---
  const handleAddEvent = async () => {
    if (!selectedDate || !newEventTitle.trim()) return;
    const title = newEventTitle.trim();
    const localDateStr = getLocalDateString(selectedDate);
    const date = `${localDateStr}T12:00:00.000Z`;
    setNewEventTitle(''); setShowEventForm(false);
    try {
      const res = await apiClient.fetch('/api/v1/student-features/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date })
      });
      const data = await res.json();
      if (data?.success) setCalendarEvents([...calendarEvents, { ...data.data, date: getLocalDateString(data.data.date) }]);
    } catch (err) {}
  };

  const deleteCalendarEvent = async (id: string) => {
    setCalendarEvents(calendarEvents.filter(e => e.id !== id));
    try {
      await apiClient.fetch(`/api/v1/student-features/calendar/${id}`, { method: 'DELETE' });
    } catch (err) {}
  };

  // --- DRAG DROP ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5';
    }, 0);
  };
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newTasks = [...tasks];
    const draggedItem = newTasks[draggedIndex];
    newTasks.splice(draggedIndex, 1);
    newTasks.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setTasks(newTasks);
  };
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedIndex(null);
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
  };

  if (loading) {
    return <div className="animate-pulse bg-white rounded-xl h-64 border border-border-soft"></div>;
  }

  const completedCount = tasks.filter(t => t.completed).length;
  const totalEstimatedTime = tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
  const completedTime = tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.estimatedTime || 0), 0);

  // Calendar Helpers
  const today = new Date();
  today.setHours(0,0,0,0);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[calc(100vh-14rem)]">
      
      {/* Left Column: Planner & Pomodoro */}
      <div className="xl:col-span-8 flex flex-col gap-6">
        
        {/* Pomodoro Widget */}
        {pomodoroTask && (
          <div className={`p-6 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${timerMode === 'work' ? 'bg-maroon text-white border-maroon-deep shadow-lg' : 'bg-green-600 text-white border-green-700 shadow-lg'}`}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm shrink-0">
                {timerMode === 'work' ? <Target className="w-6 h-6 text-white" /> : <Clock className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h3 className="text-xl font-bold font-serif">{timerMode === 'work' ? 'Focus Time' : 'Break Time'}</h3>
                <p className="text-white/90 text-sm font-medium mt-0.5 line-clamp-1">Currently on: {pomodoroTask.title}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <span className="text-4xl font-mono font-bold tracking-tight">{formatTime(timeLeft)}</span>
              <div className="flex items-center gap-2">
                <button onClick={toggleTimer} className="p-3 bg-white text-ink rounded-full hover:bg-cream transition-colors shadow-sm">
                  {timerActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button onClick={resetTimer} className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button onClick={closePomodoro} className="p-2 ml-2 text-white/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-border-soft shadow-sm flex flex-col flex-1 min-h-[500px]">
          <div className="p-6 border-b border-border-soft bg-cream/20 shrink-0 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h2 className="text-xl font-serif font-bold text-ink">Daily Action Plan</h2>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-body">
                <span className="font-medium">{tasks.length === 0 ? "You have no tasks yet." : `${completedCount} of ${tasks.length} tasks completed`}</span>
                {totalEstimatedTime > 0 && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-border-soft" />
                    <span className="flex items-center gap-1.5 font-bold"><Clock className="w-4 h-4 text-maroon/80" /> {completedTime} / {totalEstimatedTime} mins</span>
                  </>
                )}
              </div>
            </div>
            
            {streak > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-maroon/5 border border-maroon/10 text-maroon transition-all hover:bg-maroon/10 shrink-0">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {streak} Day Streak
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-white">
            {tasks.map((task, index) => (
              <div 
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`flex items-start justify-between p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing group ${
                  task.completed ? 'bg-cream/40 border-transparent opacity-60' : 'bg-white border-border-soft shadow-sm hover:border-maroon/30'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 overflow-hidden">
                  <GripVertical className="w-5 h-5 text-gray-body/50 hover:text-gray-body shrink-0 mt-0.5 cursor-grab" />
                  <button onClick={() => toggleTask(task.id, task.completed)} className="shrink-0 text-maroon hover:text-maroon-deep transition-colors mt-0.5">
                    {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold line-clamp-1 ${task.completed ? 'line-through text-gray-body' : 'text-ink'}`}>
                        {task.title}
                      </span>
                      {task.estimatedTime && (
                        <span className="shrink-0 text-[10px] font-bold tracking-wider uppercase text-maroon/70 bg-maroon/5 border border-maroon/10 px-2 py-0.5 rounded">
                          {task.estimatedTime}m
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className={`text-xs mt-1 pr-4 ${task.completed ? 'text-gray-body/70' : 'text-gray-body'}`}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="shrink-0 flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!task.completed && (
                    <button 
                      onClick={() => startPomodoroSession(task)}
                      className="text-gray-400 hover:text-maroon transition-colors p-1.5 rounded hover:bg-maroon/5 mr-1"
                      title="Start Pomodoro"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteTask(task.id)} 
                    className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-body/60 pb-8 min-h-[200px]">
                <CheckCircle2 className="w-12 h-12 mb-3 stroke-1" />
                <p>All caught up! Add a new task below.</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border-soft bg-cream/10 shrink-0">
            <form onSubmit={addTask} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Action Item (e.g., Complete 2 Graphs problems...)"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon outline-none transition-all text-sm font-medium"
                />
                <input
                  type="number"
                  value={newEstimatedTime}
                  onChange={(e) => setNewEstimatedTime(e.target.value)}
                  placeholder="Mins"
                  min="1"
                  className="w-24 px-4 py-2.5 rounded-lg border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon outline-none transition-all text-sm font-medium"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Description (e.g., Focus on BFS approach...)"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon outline-none transition-all text-sm text-gray-body bg-white/60"
                />
                <button 
                  type="submit"
                  disabled={!newTask.trim()}
                  className="bg-maroon hover:bg-maroon-deep text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 text-sm"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right Column: Calendar & Habits */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        
        {/* Calendar Widget */}
        <div className="bg-white border border-border-soft p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold flex items-center text-ink font-serif"><CalendarIcon className="w-4 h-4 mr-2 text-maroon" /> Calendar</h3>
            <div className="flex items-center gap-2 bg-cream rounded-md p-1 border border-border-soft">
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-0.5 hover:bg-cream-edge/30 rounded text-ink"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="text-xs font-medium w-24 text-center text-ink">{monthNames[currentDate.getMonth()].slice(0,3)} {currentDate.getFullYear()}</span>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-0.5 hover:bg-cream-edge/30 rounded text-ink"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <div key={i} className="text-center text-[10px] font-bold text-gray-body uppercase py-1">{day}</div>)}
          </div>
          
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-8 rounded" />)}
            
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
                  className={`relative h-8 rounded flex items-center justify-center transition-all border ${
                    isPast 
                      ? 'bg-gray-50/40 border-transparent opacity-40 cursor-not-allowed' 
                      : 'cursor-pointer'
                  } ${
                    isSelected 
                      ? 'border-maroon bg-maroon/5 ring-1 ring-maroon' 
                      : isToday 
                      ? 'border-maroon/50 bg-maroon/5'
                      : 'bg-white border-border-soft hover:border-maroon/40'
                  }`}
                >
                  {hasEvents && (
                    <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-maroon" />
                  )}
                  <span className={`text-[11px] ${isToday || isSelected ? 'font-bold text-maroon' : 'font-medium text-ink'}`}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-4 pt-4 border-t border-border-soft">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-semibold text-ink">Events: {selectedDate.toLocaleDateString()}</h4>
                <button onClick={() => setSelectedDate(null)} className="text-gray-body hover:text-ink"><X className="w-3.5 h-3.5" /></button>
              </div>
              
              <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto custom-scrollbar">
                {calendarEvents.filter(e => e.date === getLocalDateString(selectedDate)).length === 0 && !showEventForm && (
                  <p className="text-[11px] text-gray-body italic">No events.</p>
                )}
                {calendarEvents.filter(e => e.date === getLocalDateString(selectedDate)).map(ev => (
                  <div key={ev.id} className="text-[11px] bg-cream/30 p-2 rounded border border-border-soft flex items-center justify-between group">
                    <div className="flex items-center"><div className="w-1 h-1 rounded-full bg-maroon mr-2 shrink-0" />{ev.title}</div>
                    <button onClick={(e) => { e.stopPropagation(); deleteCalendarEvent(ev.id); }} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3"/></button>
                  </div>
                ))}
              </div>

              {!showEventForm ? (
                <button onClick={() => setShowEventForm(true)} className="w-full py-1.5 bg-white border border-border-soft hover:border-maroon/30 text-ink rounded text-[11px] font-medium transition-colors">+ Add Event</button>
              ) : (
                <div className="flex gap-1.5">
                  <input autoFocus type="text" placeholder="Title..." className="flex-1 px-2 py-1 text-[11px] border border-border-soft rounded focus:outline-none focus:border-maroon" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddEvent()} />
                  <button onClick={handleAddEvent} className="px-2 py-1 bg-maroon text-white text-[11px] font-semibold rounded hover:bg-maroon-deep">Save</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Core Habits Widget */}
        <div className="bg-white border border-border-soft p-5 rounded-xl shadow-sm flex-1 flex flex-col min-h-[300px]">
          <h3 className="text-base font-bold mb-4 flex items-center text-ink font-serif"><TrendingUp className="w-4 h-4 mr-2 text-maroon" /> Daily Core Habits</h3>
          
          <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
            {habits.length === 0 ? (
              <p className="text-[11px] text-gray-body/70 italic text-center mt-4">Add daily recurring habits here to build consistency.</p>
            ) : habits.map(habit => {
              const isCompleted = habit.completedDates.includes(todayStr);
              return (
                <div key={habit.id} className="group flex items-center justify-between p-2.5 rounded-lg border border-border-soft bg-cream/10 hover:bg-cream/30 transition-colors">
                  <button onClick={() => toggleHabit(habit.id)} className="flex items-center gap-3 flex-1 text-left">
                    <div className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-md border ${isCompleted ? 'bg-maroon border-maroon text-white' : 'bg-white border-border-soft text-transparent'} transition-colors`}>
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`text-xs font-semibold ${isCompleted ? 'line-through text-gray-body/70' : 'text-ink'}`}>{habit.title}</span>
                  </button>
                  <button onClick={() => deleteHabit(habit.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )
            })}
          </div>

          <form onSubmit={addHabit} className="mt-4 pt-4 border-t border-border-soft flex gap-2">
            <input
              type="text"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              placeholder="E.g., Read Tech News (15m)"
              className="flex-1 px-3 py-1.5 text-xs border border-border-soft rounded-lg focus:outline-none focus:border-maroon"
            />
            <button type="submit" disabled={!newHabit.trim()} className="px-3 py-1.5 bg-maroon text-white rounded-lg text-xs font-semibold hover:bg-maroon-deep disabled:opacity-50">Add</button>
          </form>
        </div>

      </div>
    </div>
  );
}
