import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronUp, Minus, Target } from 'lucide-react';
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
  const cls =
    label === 'Strong'
      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-[#2A6B4A] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50'
      : label === 'Developing'
      ? 'bg-amber-50 dark:bg-amber-950/50 text-[#C07820] dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50'
      : 'bg-red-50 dark:bg-red-950/50 text-[#C13535] dark:text-red-300 border border-red-200/60 dark:border-red-800/50';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
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
  const [priority, setPriority] = useState<any>(null);
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
      setPriority({
        topic: 'Verbal Comprehension', score: 48, reasons: ['Score dropped 10% in last quiz', 'Required for placement assessments']
      });
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.fetch('/api/v1/student/improvement/topics').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/improvement/priority').then(r => r.json()).catch(() => null)
    ]).then(([topicsRes, priorityRes]) => {
      if (topicsRes?.success) setTopics(topicsRes.data);
      if (priorityRes?.success) setPriority(priorityRes.data);
    }).finally(() => setLoading(false));
  }, [isDemo]);

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-gray-body dark:text-neutral-400" /></div>;

  if (topics.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-dashed border-border-soft dark:border-neutral-800 py-12 text-center">
        <p className="text-sm font-medium text-ink dark:text-neutral-100">No topic data yet.</p>
        <p className="text-xs mt-1 text-gray-body dark:text-neutral-400">Topic analytics appear once your quiz questions have topic tags and you've completed assessments.</p>
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
        <p className="text-[9px] uppercase tracking-widest font-bold mb-3 text-gray-body dark:text-neutral-400">{label}</p>
        <div className="space-y-2">
          {items.map(t => (
            <div key={t.topic} className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-hidden">
              {/* Row */}
              <button
                onClick={() => setExpanded(expanded === t.topic ? null : t.topic)}
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-cream/50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-ink dark:text-neutral-100 truncate">{t.topic}</span>
                    <TrendIcon trend={t.trend} />
                    <MasteryBadge label={t.masteryLabel} />
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-cream-edge dark:bg-neutral-800">
                    <div className="h-full rounded-full transition-all" style={{ width: `${t.currentScore}%`, background: barColor }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xl font-bold tabular-nums" style={{ color: barColor }}>{t.currentScore}<span className="text-sm font-normal text-gray-body dark:text-neutral-400">%</span></div>
                  {t.improvement !== null && (
                    <div className={`text-[10px] font-semibold ${t.improvement >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {t.improvement >= 0 ? `▲ +${t.improvement}%` : `▼ ${t.improvement}%`} vs prev
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === t.topic && (
                <div className="border-t border-border-soft dark:border-neutral-800 bg-cream/40 dark:bg-neutral-900/40 px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5 text-gray-body dark:text-neutral-400">Previous Score</p>
                    <p className="text-base font-bold text-ink dark:text-neutral-100">{t.previousScore ?? '—'}{t.previousScore !== null ? '%' : ''}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5 text-gray-body dark:text-neutral-400">Assessments</p>
                    <p className="text-base font-bold text-ink dark:text-neutral-100">{t.assessmentCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5 text-gray-body dark:text-neutral-400">Last Assessed</p>
                    <p className="text-base font-bold text-ink dark:text-neutral-100">
                      {t.lastAttemptAt ? new Date(t.lastAttemptAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5 text-gray-body dark:text-neutral-400">Status</p>
                    <MasteryBadge label={t.masteryLabel} />
                  </div>
                  {t.masteryLabel === 'Needs Improvement' && (
                    <div className="col-span-2 md:col-span-4 rounded-lg p-3 text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300">
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
        <h2 className="text-lg font-semibold text-ink dark:text-neutral-100">Topic Performance</h2>
        <p className="text-xs mt-0.5 text-gray-body dark:text-neutral-400">Click any topic to expand details. Data from all graded assessments.</p>
      </div>

      {priority && (
        <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 p-5 flex flex-col md:flex-row gap-5 items-center justify-between shadow-sm mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full shrink-0 bg-cream-edge dark:bg-neutral-800">
              <Target className="w-6 h-6 text-maroon dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-ink dark:text-neutral-100 mb-0.5">Priority Focus: {priority.topic}</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm text-gray-body dark:text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <span className="font-bold tabular-nums text-red-600 dark:text-red-400">{priority.score}%</span> Current Mastery
                </span>
                <span className="hidden sm:inline">•</span>
                <span>{priority.reasons[0]}</span>
              </div>
            </div>
          </div>
          <button className="w-full md:w-auto px-6 py-2 border border-border-soft dark:border-neutral-700 text-maroon dark:text-rose-400 rounded-lg text-sm font-bold shadow-sm transition-colors shrink-0 hover:bg-cream/50 dark:hover:bg-neutral-800 cursor-pointer">
            Review Topic Now
          </button>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          ['Strong', strengths.length, C.good],
          ['Developing', developing.length, C.warn],
          ['Needs Work', weak.length, C.danger],
        ].map(([label, count, color]) => (
          <div key={label as string} className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 text-center p-4 shadow-sm">
            <div className="text-2xl font-bold" style={{ color: color as string }}>{count as number}</div>
            <div className="text-[10px] uppercase tracking-widest font-semibold mt-0.5 text-gray-body dark:text-neutral-400">{label as string}</div>
          </div>
        ))}
      </div>

      {renderGroup('Strong (80%+)', strengths, C.good)}
      {renderGroup('Developing (65–79%)', developing, C.warn)}
      {renderGroup('Needs Improvement (<65%)', weak, C.danger)}
    </div>
  );
}
