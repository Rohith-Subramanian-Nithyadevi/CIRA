import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExamDashboard() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // In a real app, fetch from /api/v1/student/exam/eligible
    // Using mock data for UI visualization right now
    setTimeout(() => {
      setQuizzes([
        {
          id: 'mock-quiz-1',
          title: 'Midterm Examination: Data Structures',
          subject: 'Computer Science',
          durationMinutes: 90,
          totalMarks: 100
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleStart = (quizId: string) => {
    navigate(`/exam-portal/take/${quizId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Active Examinations</h1>
        
        {quizzes.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <div className="text-slate-400 text-lg mb-2">No Active Exams</div>
            <p className="text-slate-500">You currently have no examinations scheduled.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">{quiz.title}</h2>
                  <div className="flex space-x-4 text-sm text-slate-400">
                    <span>Subject: {quiz.subject}</span>
                    <span>Duration: {quiz.durationMinutes} mins</span>
                    <span>Marks: {quiz.totalMarks}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleStart(quiz.id)}
                  className="mt-4 md:mt-0 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                >
                  Start Examination
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
