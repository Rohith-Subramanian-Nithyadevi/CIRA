import { useState, useEffect } from 'react';
import { PlayCircle, Eye, CheckCircle2, XCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StudentSpace from '../components/dashboard/StudentSpace';
import UserProfile from '../components/dashboard/UserProfile';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('progress');
  const [expandedAnswerKey, setExpandedAnswerKey] = useState<number | null>(null);
  
  const [activeQuizzes, setActiveQuizzes] = useState<any[]>([]);
  const [pastQuizzes, setPastQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (activeTab === 'quizzes') {
      fetchQuizzes();
    }
  }, [activeTab]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const token = localStorage.getItem('cira_token');
      
      // Fetch active quizzes
      const activeRes = await fetch(`${baseUrl}/api/v1/student/exam/eligible`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const activeData = await activeRes.json();
      if (activeData?.data) {
        setActiveQuizzes(activeData.data);
      }

      // Fetch past quizzes via dashboard data
      const dashboardRes = await fetch(`${baseUrl}/api/v1/student/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dashboardData = await dashboardRes.json();
      if (dashboardData?.success && dashboardData.data?.pastQuizzes) {
        setPastQuizzes(dashboardData.data.pastQuizzes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAnswerKey = (id: number) => {
    if (expandedAnswerKey === id) {
      setExpandedAnswerKey(null);
    } else {
      setExpandedAnswerKey(id);
    }
  };

  return (
    <DashboardLayout title="Academic Profile" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      
      {activeTab === 'progress' && <StudentSpace />}
      
      {activeTab === 'assignments' && (
        <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
          <h2 className="text-xl font-serif font-bold mb-4 text-ink">My Assignments</h2>
          <p className="text-gray-body text-sm">You currently have no assigned tasks.</p>
        </div>
      )}
      
      {activeTab === 'quizzes' && (
        <div className="space-y-8">
          
          {/* Active and Upcoming Quizzes */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-serif font-bold text-ink">Active & Upcoming Quizzes</h2>
              <button 
                onClick={() => navigate('/exam-portal')}
                className="bg-maroon hover:bg-maroon-deep text-white px-5 py-2 rounded-lg font-sans font-semibold text-sm transition-colors flex items-center shadow-sm"
              >
                Go to Exam Portal
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
            
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" />
              </div>
            ) : activeQuizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeQuizzes.map(quiz => {
                  const now = new Date();
                  const startDate = quiz.startDate ? new Date(quiz.startDate) : null;
                  const isLive = !startDate || startDate <= now;
                  
                  return (
                    <div key={quiz.id} className="bg-white border border-border-soft rounded-xl p-5 shadow-sm hover:border-maroon/30 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-ink text-lg">{quiz.title}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isLive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
                          {isLive ? 'Live' : 'Upcoming'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-body space-y-1 mb-4">
                        <p>Subject: <span className="font-semibold text-ink">{quiz.subject}</span></p>
                        {!isLive && startDate && (
                          <p>Opens: <span className="font-semibold text-ink">{startDate.toLocaleString()}</span></p>
                        )}
                        <p>Duration: <span className="font-semibold text-ink">{quiz.durationMinutes} mins</span></p>
                      </div>
                      <button 
                        onClick={() => navigate('/exam-portal')}
                        className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                          isLive 
                            ? 'bg-maroon hover:bg-maroon-deep text-white shadow-sm' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!isLive}
                      >
                        <PlayCircle className="w-4 h-4" />
                        {isLive ? 'Start in Portal' : 'Not Yet Available'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-cream/40 p-6 rounded-xl border border-dashed border-border-soft text-center text-gray-body text-sm">
                No active or upcoming quizzes at the moment.
              </div>
            )}
          </section>

          {/* Past Quizzes */}
          <section>
            <h2 className="text-2xl font-serif font-bold text-ink mb-4">Past Quizzes & Results</h2>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" />
              </div>
            ) : pastQuizzes.length > 0 ? (
              <div className="space-y-6">
                {pastQuizzes.map(quiz => (
                  <div key={quiz.id} className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
                    <div className="p-6 bg-cream/20">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                        <div>
                          <h3 className="font-bold text-ink text-lg">{quiz.title}</h3>
                          <p className="text-xs text-gray-body mt-1">Submitted: {quiz.submittedAt}</p>
                        </div>
                        <div className="bg-white px-4 py-2 rounded-lg border border-border-soft shadow-sm text-center min-w-[100px]">
                          <div className="text-xs font-semibold text-gray-body uppercase tracking-wider mb-1">Score</div>
                          <div className="text-2xl font-bold text-maroon">{quiz.totalScore}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm text-center">
                          <div className="text-lg font-bold text-ink">{quiz.objectiveScore || 0}</div>
                          <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Objective</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm text-center">
                          <div className="text-lg font-bold text-ink">{quiz.writtenScore || 0}</div>
                          <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Written</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm text-center">
                          <div className="text-lg font-bold text-green-600">{quiz.grade || 'N/A'}</div>
                          <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Grade</div>
                        </div>
                      </div>
                      
                      {quiz.facultyFeedback && (
                        <div className="border-t border-border-soft pt-3">
                          <p className="text-xs font-bold text-ink mb-1">Faculty Feedback:</p>
                          <p className="text-sm text-gray-body italic leading-relaxed">"{quiz.facultyFeedback}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-cream/40 p-6 rounded-xl border border-dashed border-border-soft text-center text-gray-body text-sm">
                No past quiz results available.
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

