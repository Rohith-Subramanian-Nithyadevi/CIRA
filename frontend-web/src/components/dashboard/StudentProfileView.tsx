import { useState, useEffect } from 'react';
import { ArrowLeft, User, Loader2, AlertTriangle, CheckCircle2, Circle, Clock, FileText, Clipboard } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

interface StudentProfileViewProps {
  studentId: string;
  onBack: () => void;
}

export default function StudentProfileView({ studentId, onBack }: StudentProfileViewProps) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token') || localStorage.getItem('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'quizzes' | 'assignments'>('quizzes');

  useEffect(() => {
    fetchProfile();
  }, [studentId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${baseUrl}/api/v1/faculty/students/${studentId}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to fetch student profile');
      }
      if (json.success || json.status === 'success' || json.data) {
        setData(json.data || json);
      } else {
        throw new Error(json.message || 'No profile data received');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-maroon mb-4" />
        <p className="text-gray-body font-semibold">Loading full profile...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-xl text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-700 mb-2">Error Loading Profile</h3>
        <p className="text-red-600 mb-6">{error || 'Student profile data could not be loaded.'}</p>
        <button onClick={onBack} className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg font-semibold hover:bg-red-100">
          Go Back
        </button>
      </div>
    );
  }

  const { student, quizHistory, assignmentCompletion } = data;
  
  // Calculate average quiz score
  const avgQuizScore = quizHistory.length > 0 
    ? Math.round(quizHistory.reduce((acc: number, q: any) => acc + q.score, 0) / quizHistory.length) 
    : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-ink">
      <button 
        onClick={onBack}
        className="flex items-center text-maroon hover:text-maroon-deep mb-6 transition-colors font-bold text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Analytics
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-xl p-6 border border-border-soft shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 bg-maroon/10 border-2 border-maroon/20 rounded-full flex items-center justify-center shrink-0">
            <User className="w-12 h-12 text-maroon" />
          </div>
          <div>
            <h2 className="text-3xl font-serif font-bold text-ink mb-1">{student.name}</h2>
            <p className="text-gray-body text-base mb-2">
              Roll Number: <span className="text-ink font-mono font-bold">{student.rollNumber}</span>
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="bg-cream border border-border-soft px-2.5 py-1 rounded-md">Batch: {student.batchName}</span>
              <span className="bg-cream border border-border-soft px-2.5 py-1 rounded-md">Dept: {student.departmentName}</span>
              <span className="bg-cream border border-border-soft px-2.5 py-1 rounded-md">Sec: {student.sectionName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-body uppercase tracking-wider mb-2">Quiz Performance</h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-ink">{avgQuizScore}%</span>
            <span className="text-sm font-semibold text-gray-body mb-1">Average</span>
          </div>
          <p className="text-xs text-gray-body mt-2">Across {quizHistory.length} completed assessments</p>
        </div>

        <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-body uppercase tracking-wider mb-2">Assignment Completion</h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-ink">{assignmentCompletion.completed}/{assignmentCompletion.total}</span>
          </div>
          <div className="w-full bg-cream rounded-full h-2 mt-3">
            <div 
              className="bg-green-600 h-2 rounded-full" 
              style={{ width: `${assignmentCompletion.total > 0 ? (assignmentCompletion.completed / assignmentCompletion.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm relative overflow-hidden">
          <h3 className="text-xs font-bold text-gray-body uppercase tracking-wider mb-2">Attendance</h3>
          <div className="flex items-center justify-center h-16 border border-dashed border-gray-300 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-body flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-gray-400" />
              Data Not Available
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Tabs */}
      <div className="bg-white border border-border-soft rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-border-soft bg-cream/20 px-4">
          <button 
            onClick={() => setActiveTab('quizzes')}
            className={`px-6 py-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'quizzes' ? 'border-maroon text-maroon' : 'border-transparent text-gray-body hover:text-ink'}`}
          >
            Quiz History
          </button>
          <button 
            onClick={() => setActiveTab('assignments')}
            className={`px-6 py-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'assignments' ? 'border-maroon text-maroon' : 'border-transparent text-gray-body hover:text-ink'}`}
          >
            Assignments
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'quizzes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-cream/10 text-xs text-gray-body uppercase tracking-wider border-b border-border-soft">
                    <th className="p-4 font-semibold">Quiz</th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Score</th>
                    <th className="p-4 font-semibold">Performance Band</th>
                    <th className="p-4 font-semibold">Topic Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {quizHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-0 border-0">
                        <div className="py-8">
                          <EmptyState icon={<FileText className="w-8 h-8 text-maroon" />} title="No Quizzes" description="No quizzes completed yet." />
                        </div>
                      </td>
                    </tr>
                  ) : (
                    quizHistory.map((q: any) => (
                      <tr key={q.quizId} className="border-b border-border-soft hover:bg-cream/10">
                        <td className="p-4 font-bold text-ink">{q.title}</td>
                        <td className="p-4 text-sm text-gray-body">{new Date(q.date).toLocaleDateString()}</td>
                        <td className="p-4 font-bold text-ink">{q.score}%</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            q.band === 'Excellent' ? 'bg-green-50 text-green-700 border-green-200' :
                            q.band === 'Average' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {q.band}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {q.topicScores.map((t: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                <span className="text-gray-body">{t.topic}</span>
                                <span className="font-semibold text-ink ml-4">{t.score}%</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-cream/10 text-xs text-gray-body uppercase tracking-wider border-b border-border-soft">
                    <th className="p-4 font-semibold">Assignment</th>
                    <th className="p-4 font-semibold">Assigned Date</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentCompletion.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-0 border-0">
                        <div className="py-8">
                          <EmptyState icon={<Clipboard className="w-8 h-8 text-maroon" />} title="No Assignments" description="No assignments found." />
                        </div>
                      </td>
                    </tr>
                  ) : (
                    assignmentCompletion.items.map((a: any) => (
                      <tr key={a.assignmentId} className="border-b border-border-soft hover:bg-cream/10">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-maroon" />
                            <span className="font-bold text-ink">{a.title}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-body">{new Date(a.assignedDate).toLocaleDateString()}</td>
                        <td className="p-4">
                          {a.status === 'GRADED' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> Graded</span>}
                          {a.status === 'SUBMITTED' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full"><Circle className="w-3.5 h-3.5 fill-blue-700" /> Submitted</span>}
                          {a.status === 'NOT_SUBMITTED' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-body bg-gray-100 px-2.5 py-1 rounded-full"><Clock className="w-3.5 h-3.5" /> Pending</span>}
                        </td>
                        <td className="p-4">
                          {a.status === 'GRADED' ? (
                            <span className="font-bold text-ink">{a.grade} <span className="text-gray-body font-normal">/ {a.maxMarks}</span></span>
                          ) : (
                            <span className="text-gray-body italic text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
