import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExamDashboard() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const token = localStorage.getItem('cira_token');
        const res = await fetch(`${baseUrl}/api/v1/student/exam/eligible`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data?.data) {
          setQuizzes(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  const handleStart = (quizId: string) => {
    navigate(`/exam-portal/take/${quizId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-ink p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center space-x-4 mb-8">
          <button 
            onClick={() => navigate('/student/dashboard')}
            className="p-2.5 hover:bg-cream border border-transparent hover:border-border-soft rounded-full transition-colors text-gray-body"
            title="Go Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h1 className="text-3xl font-serif font-bold text-ink">Active Examinations</h1>
        </div>
        
        {quizzes.length === 0 ? (
          <div className="bg-white border border-border-soft rounded-xl p-12 text-center shadow-sm">
            <div className="text-gray-body text-lg font-bold mb-2">No Active Exams</div>
            <p className="text-gray-body/70 text-sm">You currently have no examinations scheduled.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {quizzes.map((quiz) => {
              const attempt = quiz.attempts && quiz.attempts.length > 0 ? quiz.attempts[0] : null;
              const isCompleted = attempt?.status === 'SUBMITTED' || attempt?.status === 'EVALUATED';
              const isInProgress = attempt?.status === 'IN_PROGRESS';

              const now = new Date();
              const startDate = quiz.startDate ? new Date(quiz.startDate) : null;
              const isUpcoming = startDate && startDate > now;

              return (
                <div key={quiz.id} className="bg-white border border-border-soft rounded-xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm hover:border-maroon/20 transition-colors">
                  <div>
                    <h2 className="text-xl font-bold text-ink mb-2">{quiz.title}</h2>
                    <div className="flex space-x-4 text-xs font-semibold text-gray-body">
                      <span>Subject: {quiz.subject}</span>
                      <span>Duration: {quiz.durationMinutes} mins</span>
                      <span>Marks: {quiz.totalMarks}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-0">
                    {isCompleted ? (
                      quiz.answersPublished ? (
                        <button
                          onClick={() => navigate(`/exam-portal/results/${quiz.id}`)}
                          className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm shadow-sm hover:scale-105 active:scale-95 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                          View Results
                        </button>
                      ) : (
                        <div className="px-5 py-2.5 bg-green-50/10 text-green-700 font-bold rounded-full border border-green-200 flex items-center text-sm">
                          <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          Completed
                        </div>
                      )
                    ) : isInProgress ? (
                      <div className="px-5 py-2.5 bg-red-50 text-red-700 font-bold rounded-full border border-red-200 flex items-center text-sm">
                        <svg className="w-4 h-4 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        Left Exam (Cannot Resume)
                      </div>
                    ) : isUpcoming ? (
                      <div className="px-5 py-2.5 bg-cream text-gray-body font-bold rounded-full border border-border-soft flex items-center text-sm">
                        <svg className="w-4 h-4 mr-2 text-gray-body" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Starts {startDate?.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStart(quiz.id)}
                        className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm shadow-sm hover:scale-105 active:scale-95"
                      >
                        Start Examination
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
