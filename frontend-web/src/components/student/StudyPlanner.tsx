import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, GripVertical, TrendingUp } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  date: string;
}

export default function StudyPlanner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await apiClient.fetch('/api/v1/student-features/tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
      if (data.streak !== undefined) setStreak(data.streak);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

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
          date: new Date().toISOString()
        })
      });
      const data = await res.json();
      setTasks([...tasks, data]);
      setNewTask('');
      setNewDesc('');
      fetchTasks();
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
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to toggle task', error);
      fetchTasks();
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await apiClient.fetch(`/api/v1/student-features/tasks/${id}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== id));
      fetchTasks();
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
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
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-white rounded-xl h-64 border border-border-soft"></div>;
  }

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm flex flex-col min-h-[calc(100vh-14rem)]">
      <div className="p-6 border-b border-border-soft bg-cream/20 shrink-0 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">Daily Action Plan</h2>
          <p className="text-sm text-gray-body mt-1">
            {tasks.length === 0 ? "You have no tasks yet." : `${completedCount} of ${tasks.length} tasks completed`}
          </p>
        </div>
        
        {streak > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-maroon/5 border border-maroon/10 text-maroon transition-all hover:bg-maroon/10">
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
            className={`flex items-start justify-between p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
              task.completed ? 'bg-cream/40 border-transparent opacity-60' : 'bg-white border-border-soft shadow-sm hover:border-maroon/30'
            }`}
          >
            <div className="flex items-start gap-3 flex-1 overflow-hidden">
              <GripVertical className="w-5 h-5 text-gray-body/50 hover:text-gray-body shrink-0 mt-0.5 cursor-grab" />
              <button onClick={() => toggleTask(task.id, task.completed)} className="shrink-0 text-maroon hover:text-maroon-deep transition-colors mt-0.5">
                {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </button>
              <div className="flex flex-col">
                <span className={`text-sm font-bold truncate ${task.completed ? 'line-through text-gray-body' : 'text-ink'}`}>
                  {task.title}
                </span>
                {task.description && (
                  <p className={`text-xs mt-1 ${task.completed ? 'text-gray-body/70' : 'text-gray-body'}`}>
                    {task.description}
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={() => deleteTask(task.id)} 
              className="shrink-0 ml-3 text-gray-400 hover:text-red-500 transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-body/60 pb-8">
            <CheckCircle2 className="w-12 h-12 mb-3 stroke-1" />
            <p>All caught up! Add a new task below.</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border-soft bg-cream/10 shrink-0">
        <form onSubmit={addTask} className="flex flex-col gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Action Item (e.g., Complete 2 Graphs problems...)"
            className="w-full px-4 py-2.5 rounded-lg border border-border-soft focus:border-maroon focus:ring-1 focus:ring-maroon outline-none transition-all text-sm font-medium"
          />
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
  );
}
