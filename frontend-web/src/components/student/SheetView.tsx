import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Circle, 
  Bookmark, 
  Search, 
  Activity, 
  SlidersHorizontal,
  Layers,
  Code2,
  GitBranch,
  Binary,
  Workflow,
  Network,
  Cpu,
  Zap,
  ListFilter
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface SheetViewProps {
  sheetId: string;
  onBack: () => void;
}

// ─── LeetCode SVG icon ───────────────────────────────────────────────────────
function LeetCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
    </svg>
  );
}

// Helper to choose a subtle professional icon for each topic
function getTopicIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('array') || lower.includes('hash')) return Layers;
  if (lower.includes('pointer')) return GitBranch;
  if (lower.includes('binary')) return Binary;
  if (lower.includes('window')) return SlidersHorizontal;
  if (lower.includes('linked')) return Workflow;
  if (lower.includes('tree')) return Network;
  if (lower.includes('graph')) return Network;
  if (lower.includes('dp') || lower.includes('dynamic')) return Cpu;
  if (lower.includes('greedy')) return Zap;
  return Code2;
}

const DIFF_STYLE: Record<string, string> = {
  EASY: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200/80',
  HARD: 'bg-rose-50 text-rose-700 border border-rose-200/80',
};

export default function SheetView({ sheetId, onBack }: SheetViewProps) {
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLVED' | 'UNSOLVED' | 'REVISION'>('ALL');

  useEffect(() => {
    fetchSheet();
  }, [sheetId]);

  const fetchSheet = async () => {
    setLoading(true);
    try {
      const res = await apiClient.fetch(`/api/v1/student/resources/sheet/${sheetId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSheet(data.data);
        // Expand first topic by default
        if (data.data.sheetTopics && data.data.sheetTopics.length > 0) {
          setExpandedTopics([data.data.sheetTopics[0].id]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sheet', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const expandAll = () => {
    if (sheet?.sheetTopics) {
      setExpandedTopics(sheet.sheetTopics.map((t: any) => t.id));
    }
  };

  const collapseAll = () => {
    setExpandedTopics([]);
  };

  // Optimistic UI updates with backend sync
  const updateProgress = async (questionId: string, status?: 'SOLVED' | 'UNSOLVED', markedForRevision?: boolean) => {
    if (!sheet) return;

    // Optimistically update local sheet state
    setSheet((prevSheet: any) => {
      if (!prevSheet) return prevSheet;
      const nextTopics = prevSheet.sheetTopics.map((topic: any) => ({
        ...topic,
        questions: topic.questions.map((q: any) => {
          if (q.id !== questionId) return q;
          const currentProg = q.studentProgress?.[0] || { status: 'UNSOLVED', markedForRevision: false };
          return {
            ...q,
            studentProgress: [{
              status: status !== undefined ? status : currentProg.status,
              markedForRevision: markedForRevision !== undefined ? markedForRevision : currentProg.markedForRevision
            }]
          };
        })
      }));
      return { ...prevSheet, sheetTopics: nextTopics };
    });

    try {
      const payload: any = {};
      if (status !== undefined) payload.status = status;
      if (markedForRevision !== undefined) payload.markedForRevision = markedForRevision;

      await apiClient.fetch(`/api/v1/student/resources/sheet/question/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error updating question progress:', error);
      // Re-fetch sheet on failure to maintain integrity
      fetchSheet();
    }
  };

  // Metrics
  const { totalQuestions, totalSolved, totalRevision } = useMemo(() => {
    if (!sheet?.sheetTopics) return { totalQuestions: 0, totalSolved: 0, totalRevision: 0 };
    let solved = 0;
    let revision = 0;
    let count = 0;
    sheet.sheetTopics.forEach((t: any) => {
      t.questions?.forEach((q: any) => {
        count++;
        const prog = q.studentProgress?.[0];
        if (prog?.status === 'SOLVED') solved++;
        if (prog?.markedForRevision) revision++;
      });
    });
    return {
      totalQuestions: sheet.totalQuestions || count,
      totalSolved: solved,
      totalRevision: revision
    };
  }, [sheet]);

  const progressPercent = totalQuestions > 0 ? Math.round((totalSolved / totalQuestions) * 100) : 0;

  // Filtered topics and questions
  const filteredTopics = useMemo(() => {
    if (!sheet?.sheetTopics) return [];

    return sheet.sheetTopics.map((topic: any) => {
      const matchingQuestions = (topic.questions || []).filter((q: any) => {
        // Search filter
        if (searchQuery) {
          const matchTitle = q.title.toLowerCase().includes(searchQuery.toLowerCase());
          const matchTopic = topic.name.toLowerCase().includes(searchQuery.toLowerCase());
          if (!matchTitle && !matchTopic) return false;
        }
        // Difficulty filter
        if (difficultyFilter !== 'ALL' && q.difficulty !== difficultyFilter) {
          return false;
        }
        // Status filter
        const prog = q.studentProgress?.[0];
        const isSolved = prog?.status === 'SOLVED';
        const isRevision = !!prog?.markedForRevision;

        if (statusFilter === 'SOLVED' && !isSolved) return false;
        if (statusFilter === 'UNSOLVED' && isSolved) return false;
        if (statusFilter === 'REVISION' && !isRevision) return false;

        return true;
      });

      return {
        ...topic,
        filteredQuestions: matchingQuestions
      };
    }).filter((topic: any) => {
      if (searchQuery || difficultyFilter !== 'ALL' || statusFilter !== 'ALL') {
        return topic.filteredQuestions.length > 0;
      }
      return true;
    });
  }, [sheet, searchQuery, difficultyFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Activity className="w-8 h-8 animate-spin text-maroon" />
        <p className="text-sm font-medium text-gray-body">Loading curated sheet roadmap...</p>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600 font-semibold mb-3">Failed to load sheet details.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cream/40 text-ink border border-border-soft rounded-lg text-xs font-bold hover:bg-cream/60 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Resources
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl">
      {/* ── Header ── */}
      <div className="p-6 border-b border-border-soft bg-cream/20 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button 
            onClick={onBack} 
            className="group flex items-center text-xs font-bold text-gray-body hover:text-maroon transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Resources
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-[11px] font-semibold text-gray-body hover:text-maroon px-2 py-1 rounded hover:bg-white/80 transition-colors"
            >
              Expand All
            </button>
            <span className="text-border-soft">|</span>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold text-gray-body hover:text-maroon px-2 py-1 rounded hover:bg-white/80 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-maroon/10 text-maroon border border-maroon/20">
                DSA Roadmap
              </span>
              <span className="text-xs text-gray-body/60 font-semibold">
                {sheet.sheetTopics?.length || 16} Topics
              </span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-ink tracking-tight">{sheet.title}</h2>
            <p className="text-xs text-gray-body mt-1 max-w-2xl leading-relaxed">{sheet.description}</p>
          </div>

          <div className="shrink-0 flex items-center gap-6 bg-white/70 border border-border-soft/80 px-4 py-3 rounded-xl shadow-xs">
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-bold text-maroon font-serif">{progressPercent}%</span>
                <span className="text-[11px] text-gray-body font-semibold">Completed</span>
              </div>
              <div className="text-[11px] text-gray-body/70 font-semibold mt-0.5">
                {totalSolved} of {totalQuestions} Solved · {totalRevision} in Revision
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-cream/80 border border-border-soft/60 rounded-full h-2.5 mt-5 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-maroon/80 to-maroon h-full rounded-full transition-all duration-500" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-border-soft/60">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-body/50" />
            <input
              type="text"
              placeholder="Search problems or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border-soft text-xs text-ink focus:border-maroon focus:ring-1 focus:ring-maroon outline-none transition-all bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Difficulty filter */}
            <div className="flex items-center gap-1 bg-white border border-border-soft rounded-lg p-0.5">
              {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    difficultyFilter === diff
                      ? 'bg-maroon text-white shadow-xs'
                      : 'text-gray-body hover:text-ink'
                  }`}
                >
                  {diff === 'ALL' ? 'All Diff' : diff.charAt(0) + diff.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 bg-white border border-border-soft rounded-lg p-0.5">
              {(['ALL', 'SOLVED', 'UNSOLVED', 'REVISION'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    statusFilter === st
                      ? 'bg-ink text-white shadow-xs'
                      : 'text-gray-body hover:text-ink'
                  }`}
                >
                  {st === 'ALL' ? 'All Status' : st === 'REVISION' ? 'Revision' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stepped Roadmap Body ── */}
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredTopics.length > 0 ? (
            filteredTopics.map((topic: any, index: number) => {
              const isExpanded = expandedTopics.includes(topic.id);
              const questions = topic.filteredQuestions || topic.questions || [];
              const allTopicQuestions = topic.questions || [];
              const topicSolved = allTopicQuestions.filter((q: any) => q.studentProgress?.[0]?.status === 'SOLVED').length;
              const topicTotal = allTopicQuestions.length;
              const TopicIcon = getTopicIcon(topic.name);

              const easyCount = allTopicQuestions.filter((q: any) => q.difficulty === 'EASY').length;
              const medCount = allTopicQuestions.filter((q: any) => q.difficulty === 'MEDIUM').length;
              const hardCount = allTopicQuestions.filter((q: any) => q.difficulty === 'HARD').length;

              const isCompleted = topicTotal > 0 && topicSolved === topicTotal;

              return (
                <div key={topic.id} className="relative">
                  {/* Vertical connector line */}
                  {index < filteredTopics.length - 1 && (
                    <div className="absolute left-[23px] top-full w-0.5 h-3 bg-gradient-to-b from-maroon/20 to-border-soft z-0" />
                  )}

                  <div className={`relative z-10 border rounded-xl overflow-hidden transition-all duration-200 ${
                    isExpanded 
                      ? 'border-maroon/40 shadow-xs ring-1 ring-maroon/10' 
                      : 'border-border-soft hover:border-maroon/30 hover:bg-cream/20'
                  }`}>
                    {/* Topic Header Node */}
                    <button
                      onClick={() => toggleTopic(topic.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isExpanded ? 'bg-maroon/[0.03]' : 'bg-cream/20 hover:bg-cream/40'
                      }`}
                    >
                      {/* Step Circle Indicator */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isExpanded
                          ? 'bg-maroon text-white shadow-xs'
                          : 'bg-white text-maroon border border-maroon/30'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        ) : (
                          <span>{(index + 1).toString().padStart(2, '0')}</span>
                        )}
                      </div>

                      {/* Icon + Title */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TopicIcon className="w-4 h-4 text-maroon/70 shrink-0" />
                        <span className={`font-bold text-sm truncate transition-colors ${
                          isExpanded ? 'text-maroon' : 'text-ink'
                        }`}>
                          {topic.name}
                        </span>
                      </div>

                      {/* Difficulty Pills */}
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0 mr-2">
                        {easyCount > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            {easyCount} Easy
                          </span>
                        )}
                        {medCount > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
                            {medCount} Med
                          </span>
                        )}
                        {hardCount > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80">
                            {hardCount} Hard
                          </span>
                        )}
                      </div>

                      {/* Solved Count Badge */}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : topicSolved > 0
                          ? 'bg-maroon/10 text-maroon border-maroon/20'
                          : 'bg-white text-gray-body border-border-soft'
                      }`}>
                        {topicSolved} / {topicTotal} Solved
                      </span>

                      {/* Chevron */}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-maroon shrink-0 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-body/50 shrink-0 ml-1" />
                      )}
                    </button>

                    {/* Question List inside Topic */}
                    {isExpanded && (
                      <div className="bg-white border-t border-border-soft/60 px-2 py-1.5 divide-y divide-border-soft/40">
                        {questions.length > 0 ? (
                          questions.map((q: any, qIdx: number) => {
                            const isSolved = q.studentProgress?.[0]?.status === 'SOLVED';
                            const isRevision = !!q.studentProgress?.[0]?.markedForRevision;

                            return (
                              <div
                                key={q.id}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                                  isSolved 
                                    ? 'bg-emerald-50/25 hover:bg-emerald-50/40' 
                                    : 'hover:bg-cream/40'
                                }`}
                              >
                                {/* Solved toggle checkbox */}
                                <button
                                  onClick={() => updateProgress(q.id, isSolved ? 'UNSOLVED' : 'SOLVED')}
                                  title={isSolved ? "Mark as unsolved" : "Mark as solved"}
                                  className="shrink-0 transition-transform active:scale-95"
                                >
                                  {isSolved ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-gray-body/30 hover:text-emerald-500 transition-colors" />
                                  )}
                                </button>

                                {/* Problem Number */}
                                <span className="w-5 text-[11px] font-bold text-gray-body/40 shrink-0 text-right">
                                  {qIdx + 1}
                                </span>

                                {/* Problem Title */}
                                <span className={`flex-1 text-xs font-semibold truncate transition-colors ${
                                  isSolved 
                                    ? 'text-gray-body line-through decoration-emerald-600/40' 
                                    : 'text-ink group-hover:text-maroon'
                                }`}>
                                  {q.title}
                                </span>

                                {/* Difficulty Badge */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${DIFF_STYLE[q.difficulty] || DIFF_STYLE.MEDIUM}`}>
                                  {q.difficulty}
                                </span>

                                {/* LeetCode Link */}
                                <a
                                  href={q.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open on LeetCode"
                                  className="shrink-0 p-1.5 rounded-md hover:bg-[#FFA116]/10 text-gray-body/40 hover:text-[#FFA116] transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <LeetCodeIcon className="w-3.5 h-3.5" />
                                </a>

                                {/* Bookmark / Revision Pool */}
                                <button
                                  onClick={() => updateProgress(q.id, undefined, !isRevision)}
                                  title={isRevision ? "Remove from Revision Pool" : "Add to Revision Pool"}
                                  className={`shrink-0 p-1.5 rounded-md transition-colors ${
                                    isRevision 
                                      ? 'text-maroon bg-maroon/10' 
                                      : 'text-gray-body/30 hover:text-maroon hover:bg-maroon/10'
                                  }`}
                                >
                                  <Bookmark className={`w-3.5 h-3.5 ${isRevision ? 'fill-maroon text-maroon' : ''}`} />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-xs text-gray-body/50 italic">
                            No problems match your search or filter.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-body/50 text-center">
              <ListFilter className="w-10 h-10 mb-3 stroke-1 text-gray-body/40" />
              <p className="font-semibold text-ink text-sm">No topics match your filter criteria</p>
              <p className="text-xs text-gray-body/60 mt-1">Try resetting the difficulty or status filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
