import { useState, useEffect } from 'react';
import { PlayCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StudentSpace from '../components/dashboard/StudentSpace';
import StudentAnnouncements from '../components/student/StudentAnnouncements';
import UserProfile from '../components/dashboard/UserProfile';
import ResourceHub from '../components/student/ResourceHub';
import StudentAnalytics from '../components/student/StudentAnalytics';
import TopicPerformance from '../components/student/TopicPerformance';
import GoalTracker from '../components/student/GoalTracker';
import { apiClient } from '../lib/apiClient';

export default function StudentDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTabState] = useState(initialTab);
  const [isDemo, setIsDemo] = useState(false);

  const [activeQuizzes, setActiveQuizzes] = useState<any[]>([]);
  const [pastQuizzes, setPastQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTabState(urlTab);
    }
  }, [searchParams]);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    if (activeTab === 'quizzes') {
      fetchQuizzes();
    }
  }, [activeTab]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const activeRes = await apiClient.fetch('/api/v1/student/exam/eligible');
      const activeData = await activeRes.json();
      if (activeData?.data) {
        setActiveQuizzes(activeData.data);
      }
      const dashboardRes = await apiClient.fetch('/api/v1/student/dashboard');
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

  return (
    <DashboardLayout 
      title="Academic Profile" 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      isDemo={isDemo}
      onToggleDemo={setIsDemo}
    >
      {activeTab === 'profile' && <UserProfile />}
      
      {(activeTab === 'overview' || activeTab === 'todo') && (
        <div className="space-y-6">
          <StudentSpace isDemo={isDemo} onNavigateTab={setActiveTab} />
        </div>
      )}

      {activeTab === 'announcements' && <StudentAnnouncements isDemo={isDemo} />}

      {activeTab === 'topics' && <TopicPerformance isDemo={isDemo} />}
      {activeTab === 'goals' && <GoalTracker />}

      {activeTab === 'analytics' && <StudentAnalytics isDemo={isDemo} />}
      {activeTab === 'resources' && <ResourceHub />}
      
      {activeTab === 'assignments' && (
        <div className="p-6 bg-white dark:bg-[#1A1A1E] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm">
          <h2 className="text-xl font-serif font-bold mb-4 text-ink dark:text-neutral-100">My Assignments</h2>
          <p className="text-gray-body dark:text-neutral-400 text-sm">You currently have no assigned tasks.</p>
        </div>
      )}
      
      {activeTab === 'quizzes' && (
        <div className="bg-white dark:bg-[#1A1A1E] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm p-6 md:p-8 min-h-[calc(100vh-8rem)]">
          <div className="space-y-10">
            <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-serif font-bold text-ink dark:text-neutral-100">Active & Upcoming Quizzes</h2>
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
                  const endDate = quiz.endDate ? new Date(quiz.endDate) : null;
                  const isLive = !startDate || startDate <= now;
                  const isExpired = Boolean(endDate && endDate < now);
                  const attempt = quiz.attempts?.[0] || null;
                  const isCompleted = attempt?.status === 'SUBMITTED' || attempt?.status === 'EVALUATED';
                  const isAbandoned =
                    attempt?.status === 'IN_PROGRESS' &&
                    attempt?.startTime &&
                    (Date.now() - new Date(attempt.startTime).getTime()) / 1000 > 60;
                  const canStartQuiz = isLive && !isExpired && !isAbandoned;
                  return (
                    <div key={quiz.id} className="bg-white dark:bg-[#222227] border border-border-soft dark:border-neutral-800 rounded-xl p-5 shadow-sm hover:border-maroon/30 dark:hover:border-rose-400/40 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-ink dark:text-neutral-100 text-lg">{quiz.title}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isCompleted
                            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                            : isLive
                            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                            : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}>
                          {isCompleted ? 'Submitted Successfully' : isLive ? 'Live' : 'Upcoming'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-body dark:text-neutral-400 space-y-1 mb-4">
                        <p>Subject: <span className="font-semibold text-ink dark:text-neutral-200">{quiz.subject}</span></p>
                        {!isLive && startDate && (
                          <p>Opens: <span className="font-semibold text-ink dark:text-neutral-200">{startDate.toLocaleString()}</span></p>
                        )}
                        <p>Duration: <span className="font-semibold text-ink dark:text-neutral-200">{quiz.durationMinutes} mins</span></p>
                      </div>
                      {isCompleted ? (
                        quiz.answersPublished ? (
                          <button
                            onClick={() => navigate(`/exam-portal/results/${quiz.id}`)}
                            className="w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors bg-maroon hover:bg-maroon-deep text-white shadow-sm cursor-pointer"
                          >
                            View Results & Answers
                          </button>
                        ) : (
                          <div className="w-full py-2 rounded-lg text-sm font-bold text-center bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50">
                            Submitted Successfully
                          </div>
                        )
                      ) : isAbandoned ? (
                        <div className="w-full py-2 rounded-lg text-sm font-bold text-center bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                          Left Exam (Cannot Resume)
                        </div>
                      ) : (
                        <button 
                          onClick={() => navigate(`/exam-portal/take/${quiz.id}`, { state: { quiz } })}
                          className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                            canStartQuiz
                              ? 'bg-maroon hover:bg-maroon-deep text-white shadow-sm cursor-pointer' 
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 cursor-not-allowed'
                          }`}
                          disabled={!canStartQuiz}
                        >
                          <PlayCircle className="w-4 h-4" />
                          {isExpired ? 'Quiz Expired' : isLive ? 'Start Quiz' : 'Not Yet Available'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-cream/40 dark:bg-neutral-900/40 p-6 rounded-xl border border-dashed border-border-soft dark:border-neutral-800 text-center text-gray-body dark:text-neutral-400 text-sm">
                No active or upcoming quizzes at the moment.
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-ink dark:text-neutral-100 mb-4">Past Quizzes & Results</h2>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" />
              </div>
            ) : pastQuizzes.length > 0 ? (
              <div className="space-y-6">
                {pastQuizzes.map(quiz => (
                  <div key={quiz.id} className="bg-white dark:bg-[#222227] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-hidden">
                    <div className="p-6 bg-cream/20 dark:bg-neutral-900/30">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                        <div>
                          <h3 className="font-bold text-ink dark:text-neutral-100 text-lg">{quiz.title}</h3>
                          <p className="text-xs text-gray-body dark:text-neutral-400 mt-1">
                            Submitted: {quiz.submittedAt ? new Date(quiz.submittedAt).toLocaleString() : 'Recorded'}
                          </p>
                        </div>
                        {quiz.answersPublished ? (
                          <div className="bg-white dark:bg-[#1A1A1E] px-4 py-2 rounded-lg border border-border-soft dark:border-neutral-700 shadow-sm text-center min-w-[100px]">
                            <div className="text-xs font-semibold text-gray-body dark:text-neutral-400 uppercase tracking-wider mb-1">Score</div>
                            <div className="text-2xl font-bold text-maroon dark:text-rose-400">
                              {quiz.totalScore}{typeof quiz.totalMarks === 'number' && quiz.totalMarks > 0 ? ` / ${quiz.totalMarks}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50">
                            Submitted Successfully
                          </span>
                        )}
                      </div>

                      {quiz.answersPublished ? (
                        <>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-white dark:bg-[#1A1A1E] p-3 rounded-lg border border-border-soft dark:border-neutral-700 shadow-sm text-center">
                              <div className="text-lg font-bold text-ink dark:text-neutral-100">{quiz.objectiveScore ?? 0}</div>
                              <div className="text-[10px] font-semibold text-gray-body dark:text-neutral-400 uppercase tracking-wider">Objective</div>
                            </div>
                            <div className="bg-white dark:bg-[#1A1A1E] p-3 rounded-lg border border-border-soft dark:border-neutral-700 shadow-sm text-center">
                              <div className="text-lg font-bold text-ink dark:text-neutral-100">{quiz.writtenScore ?? 0}</div>
                              <div className="text-[10px] font-semibold text-gray-body dark:text-neutral-400 uppercase tracking-wider">Written</div>
                            </div>
                            <div className="bg-white dark:bg-[#1A1A1E] p-3 rounded-lg border border-border-soft dark:border-neutral-700 shadow-sm text-center">
                              <div className="text-lg font-bold text-green-600 dark:text-green-400">{quiz.grade || 'Evaluated'}</div>
                              <div className="text-[10px] font-semibold text-gray-body dark:text-neutral-400 uppercase tracking-wider">Status / Grade</div>
                            </div>
                          </div>
                          {quiz.facultyFeedback && (
                            <div className="border-t border-border-soft dark:border-neutral-800 pt-3 mt-3">
                              <p className="text-xs font-bold text-ink dark:text-neutral-200 mb-1">Faculty Feedback:</p>
                              <p className="text-sm text-gray-body dark:text-neutral-400 italic leading-relaxed">"{quiz.facultyFeedback}"</p>
                            </div>
                          )}
                          <div className="border-t border-border-soft dark:border-neutral-800 pt-3 mt-3 flex justify-between items-center">
                            <span className="text-xs text-gray-body dark:text-neutral-400 font-medium">Answers and question-level evaluation are now available.</span>
                            <button onClick={() => navigate(`/exam-portal/results/${quiz.quizId}`)} className="text-maroon dark:text-rose-400 text-xs font-bold hover:underline cursor-pointer">View Answers & Results</button>
                          </div>
                        </>
                      ) : (
                        <div className="border-t border-border-soft dark:border-neutral-800 pt-3 mt-2 text-xs text-gray-body dark:text-neutral-400">
                          Your quiz has been submitted successfully. Scores, submitted answers, and answer keys will appear once your faculty publishes the answers.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-cream/40 dark:bg-neutral-900/40 p-6 rounded-xl border border-dashed border-border-soft dark:border-neutral-800 text-center text-gray-body dark:text-neutral-400 text-sm">
                No past quiz results available.
              </div>
            )}
          </section>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
