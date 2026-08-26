import { useState } from 'react';
import { PlayCircle, Eye, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import StudentSpace from '../components/dashboard/StudentSpace';
import UserProfile from '../components/dashboard/UserProfile';

// Mock Quizzes Data
const ACTIVE_QUIZZES = [
  { id: 101, title: 'Quiz 4: Operating Systems', status: 'Live', closesAt: '2026-07-22 23:59', duration: '30 mins' },
  { id: 102, title: 'Quiz 5: Networks', status: 'Upcoming', opensAt: '2026-07-25 09:00', duration: '45 mins' },
];

const PAST_QUIZZES = [
  {
    id: 1,
    title: 'Midterm Examination: Data Structures',
    submittedAt: '2026-06-25',
    totalScore: 92,
    objective: 40,
    written: 52,
    grade: 'A+',
    facultyFeedback: 'Excellent understanding of algorithmic complexities. Keep up the good work on your written explanations.',
    answerKey: [
      { q: 'What is the time complexity of QuickSort in the worst case?', yourAns: 'O(n^2)', correctAns: 'O(n^2)', isCorrect: true },
      { q: 'Which data structure is used for BFS?', yourAns: 'Queue', correctAns: 'Queue', isCorrect: true },
      { q: 'Number of edges in a tree with N nodes?', yourAns: 'N', correctAns: 'N-1', isCorrect: false },
    ]
  },
  {
    id: 2,
    title: 'Quiz 2: Database Systems',
    submittedAt: '2026-06-10',
    totalScore: 78,
    objective: 78,
    written: 0,
    grade: 'B+',
    facultyFeedback: 'Good effort, but review normalization concepts.',
    answerKey: [
      { q: 'What does ACID stand for?', yourAns: 'Atomicity, Consistency, Isolation, Durability', correctAns: 'Atomicity, Consistency, Isolation, Durability', isCorrect: true },
      { q: 'Which normal form eliminates transitive dependency?', yourAns: '2NF', correctAns: '3NF', isCorrect: false },
    ]
  }
];

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('progress');
  const [expandedAnswerKey, setExpandedAnswerKey] = useState<number | null>(null);

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
            <h2 className="text-2xl font-serif font-bold text-ink mb-4">Active & Upcoming Quizzes</h2>
            {ACTIVE_QUIZZES.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ACTIVE_QUIZZES.map(quiz => (
                  <div key={quiz.id} className="bg-white border border-border-soft rounded-xl p-5 shadow-sm hover:border-maroon/30 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-ink text-lg">{quiz.title}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        quiz.status === 'Live' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}>
                        {quiz.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-body space-y-1 mb-4">
                      {quiz.status === 'Live' ? (
                        <p>Closes: <span className="font-semibold text-ink">{quiz.closesAt}</span></p>
                      ) : (
                        <p>Opens: <span className="font-semibold text-ink">{quiz.opensAt}</span></p>
                      )}
                      <p>Duration: <span className="font-semibold text-ink">{quiz.duration}</span></p>
                    </div>
                    <button 
                      className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                        quiz.status === 'Live' 
                          ? 'bg-maroon hover:bg-maroon-deep text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      disabled={quiz.status !== 'Live'}
                    >
                      <PlayCircle className="w-4 h-4" />
                      {quiz.status === 'Live' ? 'Start Quiz' : 'Not Yet Available'}
                    </button>
                  </div>
                ))}
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
            <div className="space-y-6">
              {PAST_QUIZZES.map(quiz => (
                <div key={quiz.id} className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
                  <div className="p-6 bg-cream/20">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                      <div>
                        <h3 className="font-bold text-ink text-lg">{quiz.title}</h3>
                        <p className="text-xs text-gray-body mt-1">Submitted: {quiz.submittedAt}</p>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-lg border border-border-soft shadow-sm text-center min-w-[100px]">
                        <div className="text-xs font-semibold text-gray-body uppercase tracking-wider mb-1">Score</div>
                        <div className="text-2xl font-bold text-maroon">{quiz.totalScore}<span className="text-sm text-gray-body/70">/100</span></div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm text-center">
                        <div className="text-lg font-bold text-ink">{quiz.objective}</div>
                        <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Objective</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm text-center">
                        <div className="text-lg font-bold text-ink">{quiz.written}</div>
                        <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Written</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm text-center">
                        <div className="text-lg font-bold text-green-600">{quiz.grade}</div>
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
                  
                  {/* Answer Key Section */}
                  <div className="border-t border-border-soft bg-white">
                    <button 
                      onClick={() => toggleAnswerKey(quiz.id)}
                      className="w-full p-4 flex items-center justify-center gap-2 text-sm font-semibold text-maroon hover:bg-maroon/5 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      {expandedAnswerKey === quiz.id ? 'Hide Answer Key' : 'View Answer Key'}
                      {expandedAnswerKey === quiz.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {expandedAnswerKey === quiz.id && (
                      <div className="p-6 border-t border-border-soft bg-gray-50/50">
                        <h4 className="font-bold text-ink mb-4">Review Your Answers</h4>
                        <div className="space-y-4">
                          {quiz.answerKey.map((ans, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-lg border border-border-soft shadow-sm">
                              <p className="font-medium text-ink mb-3 text-sm"><span className="text-maroon mr-2">Q{idx + 1}.</span>{ans.q}</p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`p-3 rounded border ${ans.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <p className="text-xs font-semibold text-gray-body mb-1 flex items-center gap-1">
                                    Your Answer:
                                    {ans.isCorrect ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                                  </p>
                                  <p className={`text-sm font-medium ${ans.isCorrect ? 'text-green-800' : 'text-red-800'}`}>{ans.yourAns}</p>
                                </div>
                                <div className="p-3 rounded border bg-blue-50 border-blue-200">
                                  <p className="text-xs font-semibold text-gray-body mb-1">Correct Answer:</p>
                                  <p className="text-sm font-medium text-blue-800">{ans.correctAns}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      )}
    </DashboardLayout>
  );
}
