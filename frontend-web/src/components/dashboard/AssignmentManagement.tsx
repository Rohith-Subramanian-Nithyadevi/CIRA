import { useState, useEffect } from 'react';
import { Trash2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Batch { id: string; name: string; }
interface Department { id: string; name: string; batchId: string; sections: Section[] }
interface Section { id: string; name: string; }

export default function AssignmentManagement() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token');

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetBatchId, setTargetBatchId] = useState<string>('all');
  const [targetDeptId, setTargetDeptId] = useState<string>('all');
  const [targetSectionId, setTargetSectionId] = useState<string>('all');

  useEffect(() => {
    fetchAssignments();
    fetchBatches();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/assignments/faculty`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.success) setAssignments(data.data);
    } catch (err) {} finally { setLoading(false); }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/batches`);
      const data = await res.json();
      if (data?.data?.batches) setBatches(data.data.batches);
    } catch (err) {}
  };

  useEffect(() => {
    if (targetBatchId === 'all') {
      setDepartments([]);
      setTargetDeptId('all');
      setTargetSectionId('all');
      return;
    }
    const fetchDepartments = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/departments?batchId=${targetBatchId}`);
        const data = await res.json();
        if (data?.data?.departments) setDepartments(data.data.departments);
      } catch (err) {}
    };
    fetchDepartments();
  }, [targetBatchId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    
    const payload = {
      title,
      description,
      targetBatches: targetBatchId !== 'all' ? [targetBatchId] : [],
      targetDepartments: targetDeptId !== 'all' ? [targetDeptId] : [],
      targetSections: targetSectionId !== 'all' ? [targetSectionId] : []
    };

    try {
      const res = await fetch(`${baseUrl}/api/v1/assignments/faculty`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success) {
        setAssignments([data.data, ...assignments]);
        setIsCreating(false);
        setTitle(''); setDescription(''); setTargetBatchId('all'); setTargetDeptId('all'); setTargetSectionId('all');
      }
    } catch (err) {}
  };

  const handleDelete = async (id: string) => {
    setAssignments(assignments.filter(a => a.id !== id));
    try {
      await fetch(`${baseUrl}/api/v1/assignments/faculty/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (err) {}
  };

  return (
    <Card className="bg-white border border-border-soft text-ink shadow-sm rounded-xl">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-bold text-ink">Assignment Management</h2>
          {!isCreating && (
            <button onClick={() => setIsCreating(true)} className="px-5 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full text-sm font-bold transition-all shadow-sm">
              + Create Assignment
            </button>
          )}
        </div>

        {isCreating && (
          <div className="bg-cream/30 p-5 rounded-xl border border-border-soft mb-8">
            <h3 className="font-bold mb-4 text-ink">New Assignment</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-body mb-1">Title</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm" placeholder="Assignment Title" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-body mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm" placeholder="Details/Instructions" rows={3}></textarea>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-body mb-1">Target Batch</label>
                  <select value={targetBatchId} onChange={e => setTargetBatchId(e.target.value)} className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm">
                    <option value="all">All Batches</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                {targetBatchId !== 'all' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-body mb-1">Target Department</label>
                    <select value={targetDeptId} onChange={e => {setTargetDeptId(e.target.value); setTargetSectionId('all');}} className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm">
                      <option value="all">All Departments in Batch</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {targetDeptId !== 'all' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-body mb-1">Target Section</label>
                    <select value={targetSectionId} onChange={e => setTargetSectionId(e.target.value)} className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm">
                      <option value="all">All Sections in Department</option>
                      {departments.find(d => d.id === targetDeptId)?.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-soft">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 border border-border-soft rounded-lg text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-maroon text-white rounded-lg text-sm font-semibold hover:bg-maroon-deep">Publish Assignment</button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
             Array.from({length: 3}).map((_, i) => <div key={i} className="h-20 bg-cream/40 rounded-xl animate-pulse" />)
          ) : assignments.length === 0 ? (
            <div className="text-center py-10 text-gray-body italic border border-dashed rounded-xl border-border-soft bg-cream/10">No assignments created.</div>
          ) : (
            assignments.map(a => (
              <div key={a.id} className="p-5 border border-border-soft rounded-xl hover:bg-cream/20 flex justify-between items-start group transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-maroon" />
                    <h4 className="font-bold text-ink">{a.title}</h4>
                  </div>
                  <p className="text-sm text-gray-body mb-3">{a.description}</p>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="text-maroon bg-maroon/10 px-2 py-1 rounded-md">Assigned: {new Date(a.createdAt).toLocaleDateString()}</span>
                    <span className="text-gray-body border border-border-soft px-2 py-1 rounded-md bg-white">Submissions: {a._count?.submissions || 0}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(a.id)} className="text-red-500 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded transition-all"><Trash2 className="w-5 h-5"/></button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
