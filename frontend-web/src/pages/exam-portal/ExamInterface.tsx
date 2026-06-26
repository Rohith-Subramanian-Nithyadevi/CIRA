import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type QuestionStatus = 'NOT_VISITED' | 'NOT_ANSWERED' | 'ANSWERED' | 'MARKED_FOR_REVIEW' | 'ANSWERED_AND_MARKED_FOR_REVIEW';

interface Question {
  id: string;
  type: string;
  text: string;
  marks: number;
  options?: any;
}

export default function ExamInterface() {
  // const { quizId } = useParams();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, { data: any, status: QuestionStatus }>>({});
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 1 hour mock
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Mock load quiz
    setQuestions([
      { id: 'q1', type: 'MCQ', text: 'What is the time complexity of binary search?', marks: 2, options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'] },
      { id: 'q2', type: 'SHORT_WRITTEN', text: 'Explain Polymorphism in your own words.', marks: 5 },
      { id: 'q3', type: 'MCQ', text: 'Which of the following is not a NoSQL database?', marks: 2, options: ['MongoDB', 'Cassandra', 'PostgreSQL', 'Redis'] },
    ]);
    
    // Initialize responses
    const initialResponses: Record<string, { data: any, status: QuestionStatus }> = {};
    // q1 is visited, others not visited
    initialResponses['q1'] = { data: null, status: 'NOT_ANSWERED' };
    setResponses(initialResponses);
    
    // Timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSaveResponse = async (questionId: string, answerData: any, status: QuestionStatus) => {
    setResponses(prev => ({ ...prev, [questionId]: { data: answerData, status } }));
    setSaving(true);
    // Mock API call to auto-save
    setTimeout(() => setSaving(false), 500);
  };

  const handleNext = () => {
    const qId = questions[currentQuestionIdx].id;
    const currentResp = responses[qId];
    
    if (!currentResp || currentResp.status === 'NOT_VISITED') {
      handleSaveResponse(qId, null, 'NOT_ANSWERED');
    }

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      const nextQId = questions[currentQuestionIdx + 1].id;
      if (!responses[nextQId]) {
        handleSaveResponse(nextQId, null, 'NOT_ANSWERED');
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const handleMarkReview = () => {
    const qId = questions[currentQuestionIdx].id;
    const currentResp = responses[qId];
    const isAnswered = currentResp?.data !== null && currentResp?.data !== undefined && currentResp?.data !== '';
    const status = isAnswered ? 'ANSWERED_AND_MARKED_FOR_REVIEW' : 'MARKED_FOR_REVIEW';
    handleSaveResponse(qId, currentResp?.data, status);
    handleNext();
  };

  const handleClear = () => {
    const qId = questions[currentQuestionIdx].id;
    handleSaveResponse(qId, null, 'NOT_ANSWERED');
  };

  const handleSubmit = () => {
    // API Call to submit
    alert('Examination Submitted Successfully!');
    navigate('/exam-portal');
  };

  if (questions.length === 0) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>;

  const currentQ = questions[currentQuestionIdx];
  const currentResp = responses[currentQ.id];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status?: QuestionStatus) => {
    switch (status) {
      case 'ANSWERED': return 'bg-green-500';
      case 'NOT_ANSWERED': return 'bg-red-500';
      case 'MARKED_FOR_REVIEW': return 'bg-purple-500';
      case 'ANSWERED_AND_MARKED_FOR_REVIEW': return 'bg-purple-500 border-2 border-green-400';
      default: return 'bg-slate-300 text-slate-800'; // NOT_VISITED
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl font-bold">Midterm Examination: Data Structures</h1>
          <div className="text-sm text-slate-400">Student: John Doe (Roll: CS2024-001)</div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            {saving ? (
              <span className="text-yellow-400 text-sm flex items-center"><span className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full mr-2"></span> Saving...</span>
            ) : (
              <span className="text-green-400 text-sm flex items-center"><span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span> Saved</span>
            )}
          </div>
          <div className="text-2xl font-mono font-bold text-red-400 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Question Area */}
        <div className="flex-1 flex flex-col border-r border-slate-200">
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Question {currentQuestionIdx + 1}</h2>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {currentQ.marks} Marks
              </span>
            </div>
            
            <div className="prose max-w-none mb-8 text-slate-700 text-lg">
              {currentQ.text}
            </div>

            {/* Answer Input Area */}
            <div className="space-y-4">
              {currentQ.type === 'MCQ' && currentQ.options?.map((opt: string, idx: number) => (
                <label key={idx} className={`block p-4 border rounded-lg cursor-pointer transition-colors ${currentResp?.data === opt ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center space-x-3">
                    <input 
                      type="radio" 
                      name={`q-${currentQ.id}`} 
                      className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                      checked={currentResp?.data === opt}
                      onChange={() => handleSaveResponse(currentQ.id, opt, 'ANSWERED')}
                    />
                    <span className="text-slate-700 text-lg">{opt}</span>
                  </div>
                </label>
              ))}

              {currentQ.type === 'SHORT_WRITTEN' && (
                <textarea 
                  className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-700"
                  placeholder="Type your answer here..."
                  value={currentResp?.data || ''}
                  onChange={(e) => handleSaveResponse(currentQ.id, e.target.value, 'ANSWERED')}
                />
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="space-x-3">
              <button onClick={handleMarkReview} className="px-5 py-2.5 border border-yellow-500 text-yellow-600 hover:bg-yellow-50 font-medium rounded-lg transition-colors">Mark for Review & Next</button>
              <button onClick={handleClear} className="px-5 py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors">Clear Response</button>
            </div>
            <div className="space-x-3 flex items-center">
              <button onClick={handlePrevious} disabled={currentQuestionIdx === 0} className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 font-medium rounded-lg transition-colors">Previous</button>
              <button onClick={handleNext} disabled={currentQuestionIdx === questions.length - 1} className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium rounded-lg transition-colors">Save & Next</button>
              {currentQuestionIdx === questions.length - 1 && (
                <button onClick={handleSubmit} className="px-6 py-2.5 bg-green-600 text-white hover:bg-green-700 font-bold rounded-lg transition-colors ml-4 shadow-md hover:shadow-lg">Submit</button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Question Palette */}
        <div className="w-80 bg-white flex flex-col shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800 text-lg">Question Palette</h3>
          </div>
          
          {/* Legend */}
          <div className="p-4 border-b border-slate-200 text-sm space-y-3 bg-white">
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2"><div className="w-6 h-6 bg-green-500 rounded text-white flex items-center justify-center text-xs">1</div><span>Answered</span></div>
              <div className="flex items-center space-x-2"><div className="w-6 h-6 bg-red-500 rounded text-white flex items-center justify-center text-xs">2</div><span>Not Answered</span></div>
            </div>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2"><div className="w-6 h-6 bg-slate-300 rounded text-slate-800 flex items-center justify-center text-xs">3</div><span>Not Visited</span></div>
              <div className="flex items-center space-x-2"><div className="w-6 h-6 bg-purple-500 rounded text-white flex items-center justify-center text-xs">4</div><span>Review</span></div>
            </div>
          </div>

          <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
            <div className="grid grid-cols-4 gap-3">
              {questions.map((q, idx) => {
                const status = responses[q.id]?.status;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`w-12 h-12 rounded-lg font-medium flex items-center justify-center transition-all shadow-sm hover:shadow-md
                      ${getStatusColor(status)}
                      ${currentQuestionIdx === idx ? 'ring-2 ring-blue-600 ring-offset-2 scale-110' : ''}
                      ${status !== 'NOT_VISITED' && !status ? 'text-white' : ''}
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
