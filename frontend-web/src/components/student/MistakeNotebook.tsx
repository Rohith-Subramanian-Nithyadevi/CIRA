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

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin" style={{ color: C.gray }} /></div>;

  if (total === 0) {
    return (
      <div className="bg-cream rounded-xl border border-dashed py-12 text-center" style={{ borderColor: C.border }}>
        <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: C.good, opacity: 0.5 }} />
        <p className="text-sm font-medium text-ink">Great! You have no pending mistakes to review.</p>
        <p className="text-xs mt-1" style={{ color: C.gray }}>Mistakes from graded quizzes will appear here for review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Mistake Notebook</h2>
          <p className="text-xs mt-0.5" style={{ color: C.gray }}>{total} mistake{total !== 1 ? 's' : ''} from graded quizzes • Grouped by topic</p>
        </div>
      </div>

      {Object.entries(grouped).map(([topic, mistakes]) => {
        const reviewed = mistakes.filter(m => m.reviewed).length;
        const isOpen = expanded === topic;
        return (
          <div key={topic} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
            <button
              onClick={() => setExpanded(isOpen ? null : topic)}
              className="w-full p-4 flex items-center justify-between hover:bg-cream/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: C.creamEdge }}>
                  <BookOpen className="w-4 h-4" style={{ color: C.maroon }} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-ink">{topic}</p>
                  <p className="text-xs" style={{ color: C.gray }}>{mistakes.length} mistake{mistakes.length !== 1 ? 's' : ''} • {reviewed} reviewed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
                  <div className="h-full rounded-full" style={{ width: `${(reviewed / mistakes.length) * 100}%`, background: C.good }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: C.gray }}>{Math.round((reviewed / mistakes.length) * 100)}%</span>
                {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: C.gray }} /> : <ChevronDown className="w-4 h-4" style={{ color: C.gray }} />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t divide-y" style={{ borderColor: C.border }}>
                {mistakes.map(m => (
                  <div key={m.id} className={`p-4 ${m.reviewed ? 'opacity-60' : ''}`} style={{ borderColor: C.creamEdge }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: C.creamEdge, color: C.gray }}>
                            {m.quizTitle}
                          </span>
                          <span className="text-[10px]" style={{ color: C.gray }}>
                            {new Date(m.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </span>
                          {m.reviewed && (
                            <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: C.good }}>
                              <CheckCircle className="w-3 h-3" /> Reviewed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink leading-relaxed">{m.questionText}</p>
                        {m.answersPublished && m.correctAnswer && (
                          <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#EBF5EE', color: C.good }}>
                            <span className="font-bold">Correct Answer: </span>
                            {typeof m.correctAnswer === 'object' ? JSON.stringify(m.correctAnswer) : String(m.correctAnswer)}
                          </div>
                        )}
                        {!m.answersPublished && (
                          <p className="text-xs mt-1 italic" style={{ color: C.gray }}>Answer key not yet published by faculty.</p>
                        )}
                      </div>
                      {!m.reviewed && (
                        <button
                          onClick={() => handleReview(m)}
                          disabled={reviewing === m.id}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                          style={{ borderColor: C.border, color: C.maroon }}
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
