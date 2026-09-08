import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

const C = { maroon: '#9B2242', good: '#2A6B4A', danger: '#C13535', warn: '#C07820', gray: '#6B6560', ink: '#1A1A1A', border: '#E7DDD0', cream: '#FAF5EE', creamEdge: '#EFE5D8' };

interface TopicPerf {
  topic: string;
  currentScore: number;
  previousScore: number | null;
  improvement: number | null;
  questionsAttempted: number;
  questionsCorrect: number;
  assessmentCount: number;
  masteryLabel: string;
  lastAttemptAt: string | null;
  trend: 'up' | 'down' | 'stable';
}

function MasteryBadge({ label }: { label: string }) {
  const style =
    label === 'Strong'   ? { bg: '#EBF5EE', color: C.good }   :
    label === 'Developing' ? { bg: '#FDF5E8', color: C.warn } :
    { bg: '#FAEAEA', color: C.danger };
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <ChevronUp className="w-3.5 h-3.5 inline" style={{ color: C.good }} />;
  if (trend === 'down') return <ChevronDown className="w-3.5 h-3.5 inline" style={{ color: C.danger }} />;
  return <Minus className="w-3.5 h-3.5 inline" style={{ color: C.gray }} />;
}

export default function TopicPerformance({ isDemo }: { isDemo?: boolean }) {
  const [topics, setTopics] = useState<TopicPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      setTopics([
        { topic: 'Data Structures - Arrays', currentScore: 95, previousScore: 88, improvement: 7, questionsAttempted: 40, questionsCorrect: 38, assessmentCount: 4, masteryLabel: 'Strong', lastAttemptAt: new Date().toISOString(), trend: 'up' },
        { topic: 'Data Structures - Trees', currentScore: 88, previousScore: 82, improvement: 6, questionsAttempted: 25, questionsCorrect: 22, assessmentCount: 3, masteryLabel: 'Strong', lastAttemptAt: new Date().toISOString(), trend: 'up' },
        { topic: 'Algorithms - Sorting', currentScore: 78, previousScore: 75, improvement: 3, questionsAttempted: 30, questionsCorrect: 23, assessmentCount: 3, masteryLabel: 'Developing', lastAttemptAt: new Date().toISOString(), trend: 'up' },
        { topic: 'Algorithms - Graphs', currentScore: 68, previousScore: 70, improvement: -2, questionsAttempted: 20, questionsCorrect: 13, assessmentCount: 2, masteryLabel: 'Developing', lastAttemptAt: new Date().toISOString(), trend: 'down' },
        { topic: 'Operating Systems - Paging', currentScore: 45, previousScore: 60, improvement: -15, questionsAttempted: 15, questionsCorrect: 6, assessmentCount: 2, masteryLabel: 'Needs Improvement', lastAttemptAt: new Date().toISOString(), trend: 'down' },
        { topic: 'Networking - TCP/IP', currentScore: 55, previousScore: 55, improvement: 0, questionsAttempted: 20, questionsCorrect: 11, assessmentCount: 2, masteryLabel: 'Needs Improvement', lastAttemptAt: new Date().toISOString(), trend: 'stable' },
      ]);
      setLoading(false);
      return;
    }

    apiClient.fetch('/api/v1/student/improvement/topics')
      .then(r => r.json())
      .then(d => { if (d?.success) setTopics(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isDemo]);

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin" style={{ color: C.gray }} /></div>;

  if (topics.length === 0) {
    return (
      <div className="bg-cream rounded-xl border border-dashed py-12 text-center" style={{ borderColor: C.border }}>
        <p className="text-sm font-medium text-ink">No topic data yet.</p>
        <p className="text-xs mt-1" style={{ color: C.gray }}>Topic analytics appear once your quiz questions have topic tags and you've completed assessments.</p>
      </div>
    );
  }

  const strengths = topics.filter(t => t.currentScore >= 80);
  const developing = topics.filter(t => t.currentScore >= 65 && t.currentScore < 80);
  const weak = topics.filter(t => t.currentScore < 65);

  const renderGroup = (label: string, items: TopicPerf[], barColor: string) => {
    if (!items.length) return null;
    return (
      <div className="mb-6">
        <p className="text-[9px] uppercase tracking-widest font-bold mb-3" style={{ color: C.gray }}>{label}</p>
        <div className="space-y-2">
          {items.map(t => (
            <div key={t.topic} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
              {/* Row */}
              <button
                onClick={() => setExpanded(expanded === t.topic ? null : t.topic)}
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-cream/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-ink truncate">{t.topic}</span>
                    <TrendIcon trend={t.trend} />
                    <MasteryBadge label={t.masteryLabel} />
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${t.currentScore}%`, background: barColor }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xl font-bold tabular-nums" style={{ color: barColor }}>{t.currentScore}<span className="text-sm font-normal text-gray-body">%</span></div>
                  {t.improvement !== null && (
                    <div className="text-[10px] font-semibold" style={{ color: t.improvement >= 0 ? C.good : C.danger }}>
                      {t.improvement >= 0 ? `▲ +${t.improvement}%` : `▼ ${t.improvement}%`} vs prev
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === t.topic && (
                <div className="border-t px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4" style={{ borderColor: C.border, background: C.cream }}>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: C.gray }}>Previous Score</p>
                    <p className="text-base font-bold text-ink">{t.previousScore ?? '—'}{t.previousScore !== null ? '%' : ''}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: C.gray }}>Assessments</p>
                    <p className="text-base font-bold text-ink">{t.assessmentCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: C.gray }}>Last Assessed</p>
                    <p className="text-base font-bold text-ink">
                      {t.lastAttemptAt ? new Date(t.lastAttemptAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: C.gray }}>Status</p>
                    <MasteryBadge label={t.masteryLabel} />
                  </div>
                  {t.masteryLabel === 'Needs Improvement' && (
                    <div className="col-span-2 md:col-span-4 rounded-lg p-3 text-xs" style={{ background: '#FFF5F5', border: `1px solid #FECACA`, color: C.danger }}>
                      <strong>Recommended:</strong> Review previous mistakes in this topic, then practice available questions in the Resource Hub.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-ink">Topic Performance</h2>
        <p className="text-xs mt-0.5" style={{ color: C.gray }}>Click any topic to expand details. Data from all graded assessments.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          ['Strong', strengths.length, C.good],
          ['Developing', developing.length, C.warn],
          ['Needs Work', weak.length, C.danger],
        ].map(([label, count, color]) => (
          <div key={label as string} className="bg-white rounded-xl border text-center p-4 shadow-sm" style={{ borderColor: C.border }}>
            <div className="text-2xl font-bold" style={{ color: color as string }}>{count as number}</div>
            <div className="text-[10px] uppercase tracking-widest font-semibold mt-0.5" style={{ color: C.gray }}>{label as string}</div>
          </div>
        ))}
      </div>

      {renderGroup('Strong (80%+)', strengths, C.good)}
      {renderGroup('Developing (65–79%)', developing, C.warn)}
      {renderGroup('Needs Improvement (<65%)', weak, C.danger)}
    </div>
  );
}
