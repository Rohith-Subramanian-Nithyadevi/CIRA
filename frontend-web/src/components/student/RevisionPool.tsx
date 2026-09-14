import { useState, useEffect } from 'react';
import { X, ExternalLink, Star } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

export default function RevisionPool({ onClose }: { onClose: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevisionQuestions();
  }, []);

  const fetchRevisionQuestions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.fetch('/api/v1/student/resources/sheet/revision?limit=10');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch revision pool', error);
    } finally {
      setLoading(false);
    }
  };

  const removeMark = async (questionId: string) => {
    try {
      await apiClient.fetch(`/api/v1/student/resources/sheet/question/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markedForRevision: false })
      });
      setQuestions(q => q.filter(item => item.questionId !== questionId));
    } catch (error) {
      console.error('Error updating progress', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-6 border-b border-border-soft bg-cream/20">
          <div>
            <h2 className="text-xl font-serif font-bold text-ink flex items-center gap-2">
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
              Revision Pool
            </h2>
            <p className="text-xs text-gray-body mt-1">10 random questions you marked for revision.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-body hover:text-ink hover:bg-cream rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12 text-maroon animate-pulse">Loading...</div>
          ) : questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((item, i) => {
                const q = item.question;
                return (
                  <div key={item.id} className="p-4 border border-border-soft rounded-lg hover:border-maroon/30 bg-cream/10 flex items-start gap-4 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          q.difficulty === 'EASY' ? 'text-green-700 bg-green-50 border-green-200' : 
                          q.difficulty === 'MEDIUM' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 
                          'text-red-700 bg-red-50 border-red-200'
                        }`}>
                          {q.difficulty}
                        </span>
                        <span className="text-xs text-gray-body font-semibold">{q.topic?.resource?.title} &middot; {q.topic?.name}</span>
                      </div>
                      <a href={q.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-maroon text-sm flex items-center group mt-2">
                        {i + 1}. {q.title}
                        <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                    <button 
                      onClick={() => removeMark(q.id)}
                      className="text-xs font-semibold text-maroon hover:underline whitespace-nowrap"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-body text-sm font-medium">Your revision pool is empty.</p>
              <p className="text-xs text-gray-body mt-1">Mark questions with a star while practicing to add them here.</p>
            </div>
          )}
        </div>
        
        {questions.length > 0 && (
          <div className="p-4 border-t border-border-soft bg-cream/20 flex justify-end">
            <button 
              onClick={fetchRevisionQuestions}
              className="px-4 py-2 bg-white border border-border-soft rounded-lg text-sm font-semibold hover:border-maroon/50 transition-colors"
            >
              Shuffle New Set
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
