import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

const C = { maroon: '#9B2242', good: '#2A6B4A', danger: '#C13535', gray: '#6B6560', ink: '#1A1A1A', border: '#E7DDD0', cream: '#FAF5EE', creamEdge: '#EFE5D8' };

interface Mistake {
  id: string;
  questionId: string;
  questionText: string;
  topic: string;
  quizTitle: string;
  quizId: string;
  attemptId: string;
  answersPublished: boolean;
  correctAnswer: any;
  reviewed: boolean;
  reviewedAt: string | null;
  date: string;
}

export default function MistakeNotebook() {
  const [grouped, setGrouped] = useState<Record<string, Mistake[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const fetchMistakes = () => {
    apiClient.fetch('/api/v1/student/improvement/mistakes')
      .then(r => r.json())
      .then(d => {
        if (d?.success) {
          setGrouped(d.data.grouped);
          setTotal(d.data.total);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMistakes(); }, []);

  const handleReview = async (m: Mistake) => {
    setReviewing(m.id);
    try {
      await apiClient.fetch(`/api/v1/student/improvement/mistakes/${m.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: m.questionId, attemptId: m.attemptId, quizId: m.quizId }),
      });
      fetchMistakes();
    } catch (e) {
      console.error(e);
    } finally {
      setReviewing(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-gray-body dark:text-neutral-400" /></div>;

  if (total === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-dashed border-border-soft dark:border-neutral-800 py-12 text-center">
        <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-600 dark:text-emerald-400 opacity-60" />
        <p className="text-sm font-medium text-ink dark:text-neutral-100">Great! You have no pending mistakes to review.</p>
        <p className="text-xs mt-1 text-gray-body dark:text-neutral-400">Mistakes from graded quizzes will appear here for review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-neutral-100">Mistake Notebook</h2>
          <p className="text-xs mt-0.5 text-gray-body dark:text-neutral-400">{total} mistake{total !== 1 ? 's' : ''} from graded quizzes • Grouped by topic</p>
        </div>
      </div>

      {Object.entries(grouped).map(([topic, mistakes]) => {
        const reviewed = mistakes.filter(m => m.reviewed).length;
        const isOpen = expanded === topic;
        return (
          <div key={topic} className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : topic)}
              className="w-full p-4 flex items-center justify-between hover:bg-cream/40 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cream-edge dark:bg-neutral-800">
                  <BookOpen className="w-4 h-4 text-maroon dark:text-rose-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-ink dark:text-neutral-100">{topic}</p>
                  <p className="text-xs text-gray-body dark:text-neutral-400">{mistakes.length} mistake{mistakes.length !== 1 ? 's' : ''} • {reviewed} reviewed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-24 rounded-full overflow-hidden bg-cream-edge dark:bg-neutral-800">
                  <div className="h-full rounded-full" style={{ width: `${(reviewed / mistakes.length) * 100}%`, background: C.good }} />
                </div>
                <span className="text-xs font-semibold text-gray-body dark:text-neutral-400">{Math.round((reviewed / mistakes.length) * 100)}%</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-body dark:text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-gray-body dark:text-neutral-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border-soft dark:border-neutral-800 divide-y divide-border-soft dark:divide-neutral-800">
                {mistakes.map(m => (
                  <div key={m.id} className={`p-4 ${m.reviewed ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-cream-edge dark:bg-neutral-800 text-gray-body dark:text-neutral-300">
                            {m.quizTitle}
                          </span>
                          <span className="text-[10px] text-gray-body dark:text-neutral-400">
                            {new Date(m.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </span>
                          {m.reviewed && (
                            <span className="text-[10px] font-semibold flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle className="w-3 h-3" /> Reviewed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink dark:text-neutral-200 leading-relaxed">{m.questionText}</p>
                        {m.answersPublished && m.correctAnswer && (
                          <div className="mt-2 px-3 py-2 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50">
                            <span className="font-bold">Correct Answer: </span>
                            {typeof m.correctAnswer === 'object' ? JSON.stringify(m.correctAnswer) : String(m.correctAnswer)}
                          </div>
                        )}
                        {!m.answersPublished && (
                          <p className="text-xs mt-1 italic text-gray-body dark:text-neutral-400">Answer key not yet published by faculty.</p>
                        )}
                      </div>
                      {!m.reviewed && (
                        <button
                          onClick={() => handleReview(m)}
                          disabled={reviewing === m.id}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-soft dark:border-neutral-700 text-maroon dark:text-rose-400 hover:bg-cream-edge/30 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          {reviewing === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Mark Reviewed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
