import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function ExamResults() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const token = localStorage.getItem('cira_token');
        const res = await fetch(`${baseUrl}/api/v1/student/exam/result/${quizId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data?.status === 'success') {
          setAttempt(data.data);
        } else {
          setError(data.message || 'Failed to load results');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [quizId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 text-center max-w-md w-full">
          <div className="text-red-500 font-bold mb-4">{error || 'Results not found.'}</div>
          <button 
            onClick={() => navigate('/exam-portal')}
            className="px-6 py-2 bg-maroon text-white rounded-full font-bold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const quiz = attempt.quiz;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-ink p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/exam-portal')}
              className="p-2.5 hover:bg-cream border border-transparent hover:border-border-soft rounded-full transition-colors text-gray-body"
              title="Go Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-ink">{quiz?.title} - Results</h1>
              <div className="text-sm font-semibold text-gray-body mt-1">{quiz?.subject}</div>
            </div>
          </div>
          
          <div className="bg-white px-6 py-3 rounded-xl border border-border-soft shadow-sm flex items-center space-x-6">
            <div>
              <div className="text-xs text-gray-body font-bold">Auto Score</div>
              <div className="text-xl font-bold text-maroon">{attempt.objectiveScore}</div>
            </div>
            <div>
              <div className="text-xs text-gray-body font-bold">Written Score</div>
              <div className="text-xl font-bold text-maroon">{attempt.writtenScore}</div>
            </div>
            <div className="pl-6 border-l border-border-soft">
              <div className="text-xs text-gray-body font-bold">Total Score</div>
              <div className="text-2xl font-bold text-green-700">{attempt.totalScore}</div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {quiz.questions?.map((q: any, idx: number) => {
            const response = attempt.responses?.find((r: any) => r.questionId === q.id);
            const isObjective = ['MCQ', 'MULTI_SELECT', 'NUMERICAL', 'MATCHING'].includes(q.type);
            
            return (
              <div key={q.id} className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-ink">Q{idx + 1}. {q.text}</h3>
                  <div className="text-sm font-bold text-gray-body bg-cream px-3 py-1 rounded-md border border-border-soft">
                    {response?.marksAwarded || 0} / {q.marks} Marks
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-cream/50 p-4 rounded-lg border border-border-soft">
                    <div className="text-xs font-bold text-gray-body mb-2 uppercase tracking-wider">Your Answer</div>
                    {response ? (
                      <div className="font-mono text-sm text-ink whitespace-pre-wrap">
                        {JSON.stringify(response.answerData, null, 2)}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-body italic">Not answered</div>
                    )}
                  </div>
                  
                  <div className="bg-green-50/20 p-4 rounded-lg border border-green-200">
                    <div className="text-xs font-bold text-green-700 mb-2 uppercase tracking-wider">Correct Answer</div>
                    <div className="font-mono text-sm text-green-800 whitespace-pre-wrap">
                      {JSON.stringify(q.answerKey, null, 2)}
                    </div>
                  </div>
                </div>

                {!isObjective && response?.marksAwarded !== undefined && (
                  <div className="mt-4 pt-4 border-t border-border-soft">
                    <div className="text-sm text-gray-body font-bold">Faculty Feedback / Evaluation</div>
                    <div className="text-sm mt-1">{attempt.facultyFeedback || 'No specific feedback provided.'}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
