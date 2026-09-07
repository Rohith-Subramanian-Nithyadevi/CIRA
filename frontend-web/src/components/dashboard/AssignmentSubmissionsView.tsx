import { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle2, Circle, Search, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/lib/apiClient';

interface AssignmentSubmissionsViewProps {
  assignmentId: string;
  onBack: () => void;
}

export default function AssignmentSubmissionsView({ assignmentId, onBack }: AssignmentSubmissionsViewProps) {
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
      const res = await apiClient.fetch(`/api/v1/assignments/faculty/${assignmentId}/submissions`);
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
      const res = await apiClient.fetch(`/api/v1/assignments/faculty/${assignmentId}/submissions/${submissionId}/grade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-cream/70 animate-pulse" />
          <div className="space-y-2"><div className="h-6 w-56 rounded-lg bg-cream/70 animate-pulse" /><div className="h-4 w-36 rounded-lg bg-cream/70 animate-pulse" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-xl border border-border-soft bg-cream/40 animate-pulse" />)}
        </div>
        <div className="h-96 rounded-2xl border border-border-soft bg-white/80 animate-pulse" />
      </div>
    );
  }

  if (!data) return <div className="rounded-2xl border border-red-200 bg-red-50/90 p-8 text-center font-semibold text-red-700 shadow-sm">Failed to load submissions. Please try again.</div>;

  const filteredSubmissions = data.submissions
    .filter((s: any) => filter === 'ALL' || s.status === filter || (filter === 'SUBMITTED' && s.status === 'GRADED'))
    .filter((s: any) => s.studentName.toLowerCase().includes(search.toLowerCase()) || s.rollNumber?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="rounded-full border border-border-soft bg-white/80 p-2 shadow-xs transition-all hover:-translate-x-0.5 hover:bg-cream hover:shadow-sm">
          <ChevronLeft className="w-6 h-6 text-gray-body" />
        </button>
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">{data.assignment.title}</h2>
          <p className="text-sm text-gray-body">Submissions & Grading</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-soft bg-white/90 p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-bold text-ink">{data.summary.totalAssigned}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Assigned</div>
        </div>
        <div className="rounded-xl border border-border-soft bg-white/90 p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-bold text-blue-600">{data.summary.submitted}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Submitted</div>
        </div>
        <div className="rounded-xl border border-border-soft bg-white/90 p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-bold text-green-600">{data.summary.graded}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Graded</div>
        </div>
        <div className="rounded-xl border border-border-soft bg-white/90 p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-bold text-orange-500">{data.summary.pending}</div>
          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider">Pending</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-soft bg-white/90 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col items-start justify-between gap-3 border-b border-border-soft bg-cream/30 p-4 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            {(['ALL', 'SUBMITTED', 'GRADED', 'NOT_SUBMITTED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 ${filter === f ? 'border-maroon bg-maroon text-white shadow-sm' : 'border-border-soft bg-white text-gray-body hover:-translate-y-0.5 hover:bg-cream hover:text-ink'}`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-body absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="submission-search" className="sr-only">Search submissions by student name or roll number</label>
            <input id="submission-search"
              type="text" 
              placeholder="Search students..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64 rounded-full border border-border-soft bg-white/90 py-1.5 pl-9 pr-4 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:shadow-sm"
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
                  <tr key={s.studentId} className="border-b border-border-soft transition-colors hover:bg-cream/30">
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
                            <label htmlFor={`grade-${s.submissionId}`} className="sr-only">Grade for {s.studentName}</label>
                            <input id={`grade-${s.submissionId}`}
                              type="number" 
                              placeholder={`Grade / ${data.assignment.maxMarks}`} 
                              value={gradingState[s.submissionId].grade}
                              onChange={e => setGradingState(prev => ({ ...prev, [s.submissionId]: { ...prev[s.submissionId], grade: e.target.value, error: '' } }))}
                              className="w-24 rounded-lg border border-border-soft bg-white px-3 py-1.5 text-sm text-ink transition-shadow focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/10"
                            />
                            <button 
                              onClick={() => handleSaveGrade(s.submissionId)}
                              disabled={gradingState[s.submissionId].saving}
                              className="flex items-center gap-2 rounded-lg bg-maroon px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-maroon-deep hover:shadow-md disabled:opacity-50"
                            >
                              {gradingState[s.submissionId].saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                          </div>
                          <label htmlFor={`feedback-${s.submissionId}`} className="sr-only">Feedback for {s.studentName}</label>
                          <textarea id={`feedback-${s.submissionId}`}
                            placeholder="Add feedback..."
                            value={gradingState[s.submissionId].feedback}
                            onChange={e => setGradingState(prev => ({ ...prev, [s.submissionId]: { ...prev[s.submissionId], feedback: e.target.value } }))}
                            className="w-full rounded-lg border border-border-soft bg-white px-3 py-1.5 text-xs text-ink transition-shadow focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/10"
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
