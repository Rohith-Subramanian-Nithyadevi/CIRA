import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';

const formatAnswer = (answer: any, type?: string) => {
  if (answer === null || answer === undefined || answer === '') return 'Not answered';
  if (type === 'MATCHING' && Array.isArray(answer)) {
    return answer.map((pair: any) => `${pair?.left ?? ''} -> ${pair?.right ?? ''}`).join('\n');
  }
  if (Array.isArray(answer)) {
    return answer.map((item: any, i: number) => (answer.length > 1 ? `Blank ${i + 1}: ${item}` : String(item))).join('\n');
  }
  return typeof answer === 'string' ? answer : JSON.stringify(answer, null, 2);
};

const answersMatch = (question: any, answer: any) => {
  if (answer === null || answer === undefined || answer === '') return false;
  const correctAnswer = question.answerKey;
  if (correctAnswer === null || correctAnswer === undefined) return false;

  if (question.type === 'NUMERICAL') return Number(answer) === Number(correctAnswer);
  if (question.type === 'MULTI_SELECT' && Array.isArray(answer) && Array.isArray(correctAnswer)) {
    return JSON.stringify([...answer].sort()) === JSON.stringify([...correctAnswer].sort());
  }
  if (question.type === 'MATCHING' && Array.isArray(answer) && Array.isArray(correctAnswer)) {
    const sortPairs = (pairs: any[]) =>
      pairs
        .map((p: any) => ({ left: String(p?.left ?? '').trim().toLowerCase(), right: String(p?.right ?? '').trim().toLowerCase() }))
        .sort((a, b) => a.left.localeCompare(b.left));
    return JSON.stringify(sortPairs(answer)) === JSON.stringify(sortPairs(correctAnswer));
  }
  if (question.type === 'FILL_BLANK') {
    const normalize = (val: any) => String(val ?? '').trim().toLowerCase();
    if (Array.isArray(correctAnswer)) {
      if (Array.isArray(answer)) {
        if (answer.length !== correctAnswer.length) return false;
        return correctAnswer.every((expected: any, idx: number) => {
          const studentVal = normalize(answer[idx]);
          if (Array.isArray(expected)) return expected.some((opt: any) => normalize(opt) === studentVal);
          return String(expected).split(',').map(normalize).includes(studentVal);
        });
      }
      const studentVal = normalize(answer);
      return correctAnswer.some((variant: any) => normalize(variant) === studentVal);
    }
    const studentVal = normalize(answer);
    return String(correctAnswer).split(',').map(normalize).includes(studentVal);
  }
  return JSON.stringify(answer) === JSON.stringify(correctAnswer);
};

export default function ExamResults() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(false);

  const loadResults = async (signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError('');
    setCanRetry(false);
    try {
      const res = await apiClient.fetch(`/api/v1/student/exam/result/${quizId}`);
      if (signal?.cancelled) return;
      const data = await res.json();
      if (signal?.cancelled) return;

      if (res?.ok !== false && data?.status === 'success') {
        setAttempt(data.data);
      } else {
        setError(data?.message || 'Failed to load results');
        setCanRetry(res?.status !== 403 && res?.status !== 404);
      }
    } catch (err) {
      console.error(err);
      if (signal?.cancelled) return;
      setError('Failed to load results');
      setCanRetry(true);
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    const signal = { cancelled: false };
    setAttempt(null);
    void loadResults(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [quizId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center gap-3 text-gray-body" role="status" aria-live="polite">
        <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" aria-hidden="true" />
        <p className="text-sm font-medium">Loading quiz results...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 text-center max-w-md w-full">
          <div className="text-red-500 font-bold mb-4">{error || 'Results not found.'}</div>
          <div className="flex items-center justify-center gap-3">
            {canRetry && (
              <button
                type="button"
                onClick={() => void loadResults()}
                className="px-5 py-2 border border-maroon text-maroon hover:bg-maroon/5 rounded-full font-bold"
              >
                Retry
              </button>
            )}
            <button 
              onClick={() => navigate('/student/dashboard?tab=quizzes')}
              className="px-6 py-2 bg-maroon text-white rounded-full font-bold"
            >
              Back to Dashboard
            </button>
          </div>
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
              onClick={() => navigate('/student/dashboard?tab=quizzes')}
              className="p-2.5 hover:bg-cream border border-transparent hover:border-border-soft rounded-full transition-colors text-gray-body"
              title="Go Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-ink">{quiz?.title} - Results</h1>
              <div className="text-sm font-semibold text-gray-body mt-1 flex flex-wrap items-center gap-2">
                <span>{quiz?.subject}</span>
                {attempt.isManualWithoutSubmission && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Manual Faculty Evaluation
                  </span>
                )}
                {attempt.resultUpdatedAt && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Result updated on {new Date(attempt.resultUpdatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
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
            const isObjective = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'MATCHING', 'NUMERICAL', 'FILL_BLANK'].includes(q.type);
            const answered = response && response.answerData !== null && response.answerData !== undefined && response.answerData !== '';
            const isCorrect = isObjective && answered ? answersMatch(q, response.answerData) : false;
            
            return (
              <div key={q.id} className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-body">{q.type}</span>
                    <h3 className="text-lg font-bold text-ink mt-1">Q{idx + 1}. {q.text}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-sm font-bold text-gray-body bg-cream px-3 py-1 rounded-md border border-border-soft whitespace-nowrap">
                      {response?.marksAwarded ?? 0} / {q.marks} Marks
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
                      !answered ? 'bg-gray-100 text-gray-600 border-gray-200' :
                      !isObjective ? (response?.marksAwarded !== null && response?.marksAwarded !== undefined ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200') :
                      isCorrect ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {!answered ? 'Not Answered' : !isObjective ? (response?.marksAwarded !== null && response?.marksAwarded !== undefined ? 'Evaluated' : 'Pending Review') : isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                </div>

                {q.image && (
                  <div className="mb-4">
                    <img src={q.image} alt={`Question ${idx + 1}`} className="max-h-60 rounded-lg border border-border-soft" />
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-cream/50 p-4 rounded-lg border border-border-soft">
                    <div className="text-xs font-bold text-gray-body mb-2 uppercase tracking-wider">Your Answer</div>
                    {response ? (
                      <div className="font-mono text-sm text-ink whitespace-pre-wrap">
                        {formatAnswer(response.answerData, q.type)}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-body italic">Not answered</div>
                    )}
                  </div>
                  
                  <div className="bg-green-50/20 p-4 rounded-lg border border-green-200">
                    <div className="text-xs font-bold text-green-700 mb-2 uppercase tracking-wider">Correct Answer</div>
                    <div className="font-mono text-sm text-green-800 whitespace-pre-wrap">
                      {formatAnswer(q.answerKey, q.type)}
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
