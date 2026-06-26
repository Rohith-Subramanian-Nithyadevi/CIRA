import { useState } from 'react';

export default function QuizManagement() {
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');

  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    description: '',
    totalMarks: '',
    passingMarks: '',
    durationMinutes: '60',
    startDate: '',
    endDate: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    // API call to /api/v1/faculty/quiz/create
    alert('Quiz created successfully!');
    setActiveView('list');
  };

  if (activeView === 'create') {
    return (
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Create New Quiz</h2>
          <button onClick={() => setActiveView('list')} className="text-blue-500 hover:text-blue-400">Cancel</button>
        </div>
        
        <form onSubmit={handleCreate} className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Quiz Title</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Subject</label>
              <input value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Description / Instructions</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={4} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"></textarea>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Total Marks</label>
              <input value={formData.totalMarks} onChange={e => setFormData({...formData, totalMarks: e.target.value})} type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Passing Marks</label>
              <input value={formData.passingMarks} onChange={e => setFormData({...formData, passingMarks: e.target.value})} type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Duration (mins)</label>
              <input value={formData.durationMinutes} onChange={e => setFormData({...formData, durationMinutes: e.target.value})} type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Start Time</label>
              <input value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} type="datetime-local" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">End Time</label>
              <input value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} type="datetime-local" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Dummy placeholders for Target Audience & Performance Bands */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <p className="text-sm text-slate-400 mb-2">Target Audience & Performance Bands</p>
            <p className="text-xs text-slate-500">Configured via separate modal in full implementation.</p>
          </div>

          <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
            Save & Add Questions
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Quiz Management</h2>
        <button onClick={() => setActiveView('create')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          + Create New Quiz
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-sm">
              <th className="pb-3 font-medium">Title</th>
              <th className="pb-3 font-medium">Subject</th>
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Mock Data */}
            <tr className="border-b border-slate-800/50">
              <td className="py-4">Midterm Examination: Data Structures</td>
              <td className="py-4 text-slate-400">Computer Science</td>
              <td className="py-4 text-slate-400">2026-06-25</td>
              <td className="py-4"><span className="px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs font-medium">Active</span></td>
              <td className="py-4 space-x-3 text-sm">
                <button className="text-blue-500 hover:text-blue-400">Edit</button>
                <button className="text-purple-500 hover:text-purple-400">Grade</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
