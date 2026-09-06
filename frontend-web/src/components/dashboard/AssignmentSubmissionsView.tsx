import { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle2, Circle, Search, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

interface AssignmentSubmissionsViewProps {
  assignmentId: string;
  onBack: () => void;
}

export default function AssignmentSubmissionsView({ assignmentId, onBack }: AssignmentSubmissionsViewProps) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<'ALL' | 'SUBMITTED' | 'GRADED' | 'NOT_SUBMITTED'>('ALL');
  const [search, setSearch] = useState('');
  const [gradingState, setGradingState] = useState<{ [key: string]: { grade: string, feedback: string, saving: boolean, error: string } }>({});

  useEffect(() => {
    fetchSubmissions();
  }, [assignmentId]);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/assignments/faculty/${assignmentId}/submissions`, { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        
        // Initialize grading state
        const initialGrading: any = {};
        json.data.submissions.forEach((s: any) => {
          if (s.status === 'SUBMITTED' || s.status === 'GRADED') {
            initialGrading[s.submissionId] = {
              grade: s.grade !== null ? s.grade.toString() : '',
              feedback: s.feedback || '',
              saving: false,
              error: ''
            };
          }
        });
        setGradingState(initialGrading);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrade = async (submissionId: string) => {
    const currentState = gradingState[submissionId];
    if (!currentState) return;

    const numericGrade = parseFloat(currentState.grade);
    if (isNaN(numericGrade)) {
      setGradingState(prev => ({ ...prev, [submissionId]: { ...currentState, error: 'Grade must be a number' } }));
      return;
    }
    
    if (numericGrade < 0 || numericGrade > (data?.assignment?.maxMarks || 100)) {
      setGradingState(prev => ({ ...prev, [submissionId]: { ...currentState, error: `Grade must be between 0 and ${data?.assignment?.maxMarks || 100}` } }));
      return;
    }

    setGradingState(prev => ({ ...prev, [submissionId]: { ...currentState, saving: true, error: '' } }));

    try {
      const res = await fetch(`${baseUrl}/api/v1/assignments/faculty/${assignmentId}/submissions/${submissionId}/grade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ grade: numericGrade, feedback: currentState.feedback })
      });
      const json = await res.json();
      if (json.success) {
        setGradingState(prev => ({ ...prev, [submissionId]: { ...currentState, saving: false, error: '' } }));
        // Update local data to reflect graded status
        setData((prevData: any) => {
          const newSubmissions = prevData.submissions.map((s: any) => {
            if (s.submissionId === submissionId) {
              return { ...s, status: 'GRADED', grade: numericGrade, feedback: currentState.feedback };
            }
            return s;
          });
          
          // Re-calculate summary
          const gradedCount = newSubmissions.filter((s: any) => s.status === 'GRADED').length;
          const submittedCount = newSubmissions.filter((s: any) => s.status === 'SUBMITTED' || s.status === 'GRADED').length;
          
          return {
            ...prevData,
            summary: {
              ...prevData.summary,
              graded: gradedCount,
              submitted: submittedCount
            },
            submissions: newSubmissions
          };
        });
      } else {
        setGradingState(prev => ({ ...prev, [submissionId]: { ...currentState, saving: false, error: json.message || 'Failed to save' } }));
      }
    } catch (err) {
      setGradingState(prev => ({ ...prev, [submissionId]: { ...currentState, saving: false, error: 'Network error' } }));
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 text-maroon animate-spin mx-auto mb-4" />
        <p className="text-gray-body font-semibold">Loading submissions...</p>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-red-500">Failed to load submissions.</div>;

  const filteredSubmissions = data.submissions
    .filter((s: any) => filter === 'ALL' || s.status === filter || (filter === 'SUBMITTED' && s.status === 'GRADED'))
    .filter((s: any) => s.studentName.toLowerCase().includes(search.toLowerCase()) || s.rollNumber?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-cream rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-body" />
        </button>
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">{data.assignment.title}</h2>
          <p className="text-sm text-gray-body">Submissions & Grading</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-border-soft rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-ink">{data.summary.totalAssigned}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Assigned</div>
        </div>
        <div className="bg-white border border-border-soft rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-blue-600">{data.summary.submitted}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Submitted</div>
        </div>
        <div className="bg-white border border-border-soft rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">{data.summary.graded}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Graded</div>
        </div>
        <div className="bg-white border border-border-soft rounded-xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-orange-500">{data.summary.pending}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Pending</div>
        </div>
      </div>

      <div className="bg-white border border-border-soft shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-soft flex justify-between items-center bg-cream/20">
          <div className="flex gap-2">
            {(['ALL', 'SUBMITTED', 'GRADED', 'NOT_SUBMITTED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-maroon text-white shadow-sm' : 'bg-white text-gray-body hover:bg-cream border border-border-soft'}`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-body absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search students..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-border-soft rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-maroon/20 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream/10 text-xs text-gray-body uppercase tracking-wider">
                <th className="p-4 font-semibold border-b border-border-soft">Student</th>
                <th className="p-4 font-semibold border-b border-border-soft">Status</th>
                <th className="p-4 font-semibold border-b border-border-soft">Submission</th>
                <th className="p-4 font-semibold border-b border-border-soft">Grade & Feedback</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0 border-0">
                    <div className="py-8">
                      <EmptyState icon={<Search className="w-8 h-8 text-maroon" />} title="No Submissions Found" description="No students match the current filters." />
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((s: any) => (
                  <tr key={s.studentId} className="border-b border-border-soft hover:bg-cream/10 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-ink">{s.studentName}</div>
                      <div className="text-xs text-gray-body font-mono mt-0.5">{s.rollNumber || 'No Roll #'}</div>
                    </td>
                    <td className="p-4">
                      {s.status === 'GRADED' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> Graded</span>}
                      {s.status === 'SUBMITTED' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full"><Circle className="w-3.5 h-3.5 fill-blue-700" /> Submitted</span>}
                      {s.status === 'NOT_SUBMITTED' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-body bg-gray-100 px-2.5 py-1 rounded-full"><Circle className="w-3.5 h-3.5" /> Pending</span>}
                    </td>
                    <td className="p-4">
                      {s.status !== 'NOT_SUBMITTED' ? (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-body">Submitted: {new Date(s.submittedAt).toLocaleString()}</div>
                          {s.fileUrl && <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 hover:underline line-clamp-1 block">View Attachment</a>}
                          {s.submissionText && <div className="text-sm text-ink line-clamp-2 italic border-l-2 border-border-soft pl-2 bg-cream/30 p-1.5 rounded-r">"{s.submissionText}"</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-body italic">-</span>
                      )}
                    </td>
                    <td className="p-4 min-w-[300px]">
                      {s.status !== 'NOT_SUBMITTED' && gradingState[s.submissionId] ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              placeholder={`Grade / ${data.assignment.maxMarks}`} 
                              value={gradingState[s.submissionId].grade}
                              onChange={e => setGradingState(prev => ({ ...prev, [s.submissionId]: { ...prev[s.submissionId], grade: e.target.value, error: '' } }))}
                              className="w-24 px-3 py-1.5 border border-border-soft rounded-lg text-sm text-ink focus:outline-none focus:border-maroon"
                            />
                            <button 
                              onClick={() => handleSaveGrade(s.submissionId)}
                              disabled={gradingState[s.submissionId].saving}
                              className="px-4 py-1.5 bg-maroon text-white rounded-lg text-xs font-bold hover:bg-maroon-deep disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                              {gradingState[s.submissionId].saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                          </div>
                          <textarea 
                            placeholder="Add feedback..."
                            value={gradingState[s.submissionId].feedback}
                            onChange={e => setGradingState(prev => ({ ...prev, [s.submissionId]: { ...prev[s.submissionId], feedback: e.target.value } }))}
                            className="w-full px-3 py-1.5 border border-border-soft rounded-lg text-xs text-ink focus:outline-none focus:border-maroon"
                            rows={2}
                          />
                          {gradingState[s.submissionId].error && (
                            <div className="text-xs text-red-500 font-semibold">{gradingState[s.submissionId].error}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-body italic">Requires submission to grade</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
