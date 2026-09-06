import { useState, useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';
import { Trash2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBatches, useDepartments } from '@/hooks/useReferenceData';
import AssignmentSubmissionsView from './AssignmentSubmissionsView';

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

export default function AssignmentManagement() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token');

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [selectedAssignmentForSubmissions, setSelectedAssignmentForSubmissions] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetBatchId, setTargetBatchId] = useState<string>('all');
  const [targetDeptId, setTargetDeptId] = useState<string>('all');
  const [targetSectionId, setTargetSectionId] = useState<string>('all');

  // Cached Reference Data
  const { batches } = useBatches();
  const { departments } = useDepartments(targetBatchId, { enabled: targetBatchId !== 'all' });

  useEffect(() => {
    fetchAssignments(1);
  }, []);

  const fetchAssignments = async (pageNumber = 1) => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/assignments/faculty?page=${pageNumber}&limit=10`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.success) {
        const fetchedAssignments = Array.isArray(data.data) ? data.data : data.data.items;
        if (pageNumber === 1) {
          setAssignments(fetchedAssignments);
        } else {
          setAssignments(prev => [...prev, ...fetchedAssignments]);
        }
        if (!Array.isArray(data.data)) {
          setHasMore(data.data.hasMore);
          setPage(data.data.page);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {} finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const cleanDescription = sanitizeHtml(description).trim();
    if (!cleanDescription) {
      alert('Assignment description is required.');
      return;
    }
    
    const payload = {
      title,
      description: cleanDescription,
      targetBatches: targetBatchId !== 'all' ? [targetBatchId] : [],
      targetDepartments: targetDeptId !== 'all' ? [targetDeptId] : [],
      targetSections: targetSectionId !== 'all' ? [targetSectionId] : []
    };

    try {
      let res;
      if (activeAssignmentId) {
        res = await fetch(`${baseUrl}/api/v1/assignments/faculty/${activeAssignmentId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${baseUrl}/api/v1/assignments/faculty`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
      }
      
      const data = await res.json();
      if (data?.success) {
        if (activeAssignmentId) {
          setAssignments(assignments.map(a => a.id === activeAssignmentId ? { ...a, ...payload } : a));
          // Refresh fully to get updated target counts
          fetchAssignments();
        } else {
          setAssignments([data.data, ...assignments]);
        }
        setIsCreating(false);
        setActiveAssignmentId(null);
        setTitle(''); setDescription(''); setTargetBatchId('all'); setTargetDeptId('all'); setTargetSectionId('all');
      } else {
         alert(data.message || 'Failed to save assignment');
      }
    } catch (err) {}
  };

  const handleEdit = (assignment: any) => {
    if (assignment._count?.submissions > 0) {
      alert('Cannot edit an assignment that already has student submissions.');
      return;
    }
    
    setTitle(assignment.title || '');
    setDescription(assignment.description || '');
    
    setTargetBatchId(assignment.targetBatches?.[0]?.batchId || 'all');
    setTargetDeptId(assignment.targetDepartments?.[0]?.departmentId || 'all');
    setTargetSectionId(assignment.targetSections?.[0]?.sectionId || 'all');
    
    setActiveAssignmentId(assignment.id);
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    setAssignments(assignments.filter(a => a.id !== id));
    try {
      await fetch(`${baseUrl}/api/v1/assignments/faculty/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (err) {}
  };

  if (selectedAssignmentForSubmissions) {
    return (
      <AssignmentSubmissionsView 
        assignmentId={selectedAssignmentForSubmissions} 
        onBack={() => setSelectedAssignmentForSubmissions(null)} 
      />
    );
  }

  return (
    <Card className="bg-white border border-border-soft text-ink shadow-sm rounded-xl">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-bold text-ink">Assignment Management</h2>
          {!isCreating && (
            <button onClick={() => {
              setActiveAssignmentId(null);
              setTitle(''); setDescription(''); setTargetBatchId('all'); setTargetDeptId('all'); setTargetSectionId('all');
              setIsCreating(true);
            }} className="px-5 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full text-sm font-bold transition-all shadow-sm">
              + Create Assignment
            </button>
          )}
        </div>

        {isCreating && (
          <div className="bg-cream/30 p-5 rounded-xl border border-border-soft mb-8">
            <h3 className="font-bold mb-4 text-ink">{activeAssignmentId ? 'Edit Assignment' : 'New Assignment'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-body mb-1">Title</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-border-soft rounded-lg text-sm" placeholder="Assignment Title" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-body mb-1">Description</label>
                <RichTextEditor value={description} onChange={setDescription} />
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
                      {departments.find(d => d.id === targetDeptId)?.sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border-soft">
                <button type="button" onClick={() => { setIsCreating(false); setActiveAssignmentId(null); }} className="px-4 py-2 border border-border-soft rounded-lg text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-maroon text-white rounded-lg text-sm font-semibold hover:bg-maroon-deep">{activeAssignmentId ? 'Save Changes' : 'Publish Assignment'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
             Array.from({length: 3}).map((_, i) => <div key={i} className="h-20 bg-cream/40 rounded-xl animate-pulse" />)
          ) : assignments.length === 0 ? (
            <EmptyState icon={<FileText className="w-8 h-8 text-maroon" />} title="No Assignments" description="You haven't created any assignments yet." />
          ) : (
            assignments.map(a => (
              <div key={a.id} className="p-5 border border-border-soft rounded-xl hover:bg-cream/20 flex justify-between items-start group transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-maroon" />
                    <h4 className="font-bold text-ink">{a.title}</h4>
                  </div>
                  <div
                    className="text-sm text-gray-body mb-3 rich-text-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.description) || '<p>No description provided.</p>' }}
                  />
                  <div className="flex items-center gap-4 text-xs font-semibold mt-3">
                    <span className="text-maroon bg-maroon/10 px-2 py-1 rounded-md">Assigned: {new Date(a.createdAt).toLocaleDateString()}</span>
                    <button 
                      onClick={() => setSelectedAssignmentForSubmissions(a.id)}
                      className="text-gray-body border border-border-soft hover:bg-cream hover:text-ink px-3 py-1 rounded-md bg-white transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Submissions ({a._count?.submissions || 0})
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(a)} className="text-gray-body opacity-0 group-hover:opacity-100 p-2 hover:bg-cream rounded transition-all">Edit</button>
                  <button onClick={() => handleDelete(a.id)} className="text-red-500 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded transition-all"><Trash2 className="w-5 h-5"/></button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <button onClick={() => fetchAssignments(page + 1)} className="border border-maroon text-maroon hover:bg-maroon hover:text-white rounded-full px-8 py-2 font-bold transition-all shadow-sm text-sm">
              Load More
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
