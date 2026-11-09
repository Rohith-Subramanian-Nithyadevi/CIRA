import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, BarChart3, CheckCircle2, Circle, Clipboard, Clock, FileText, Printer, RefreshCw, TrendingUp, User } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/lib/apiClient';

interface StudentProfileViewProps {
  studentId: string;
  onBack: () => void;
}

interface TopicScore {
  topic: string;
  score: number;
}

interface QuizHistory {
  quizId: string;
  title: string;
  score: number;
  band: string;
  date: string;
  topicScores: TopicScore[];
}

interface ProfileData {
  student: {
    id: string;
    name: string;
    rollNumber?: string;
    departmentName?: string;
    sectionName?: string;
    batchName?: string;
  };
  quizHistory: QuizHistory[];
  attendance?: { available: boolean; percentage?: number };
  assignmentCompletion: {
    completed: number;
    total: number;
    items: Array<{
      assignmentId: string;
      title: string;
      maxMarks: number;
      assignedDate: string;
      status: string;
      grade: number | null;
      feedback?: string | null;
    }>;
  };
}

const bandColor = (score: number) => score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
const bandClass = (score: number) => score >= 80
  ? 'border-green-200 bg-green-50 text-green-700'
  : score >= 60 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700';
const safeScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function MetricBar({ label, value, description }: { label: string; value: number | null; description: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-sm font-bold text-ink">{value === null ? 'Not available' : `${value}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cream dark:bg-[#302b2f]" aria-hidden="true">
        {value !== null && <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: bandColor(value) }} />}
      </div>
      <p className="mt-1 text-xs text-gray-body">{description}</p>
    </div>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = score === null ? circumference : circumference - (score / 100) * circumference;
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={score === null ? 'Overall score not available' : `Overall score ${score}%`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border-soft)" strokeWidth="10" />
        {score !== null && <circle cx="60" cy="60" r={radius} fill="none" stroke={bandColor(score)} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-ink">{score === null ? '—' : `${score}%`}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-body">Overall</span>
      </div>
    </div>
  );
}

export default function StudentProfileView({ studentId, onBack }: StudentProfileViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'assessments' | 'assignments'>('overview');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.fetch(`/api/v1/faculty/students/${studentId}/profile`);
      const json = await response.json();
      if (!json?.data) throw new Error(json?.message || 'Student profile data could not be loaded.');
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/\s*\([^)]*\)$/, '') : 'Student profile data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [studentId]);

  const derived = useMemo(() => {
    if (!data) return null;
    const quizzes = data.quizHistory
      .filter(quiz => safeScore(quiz.score) !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const scores = quizzes.map(quiz => quiz.score);
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
    const latest = quizzes.length ? quizzes[quizzes.length - 1].score : null;
    const previous = quizzes.length > 1 ? quizzes[quizzes.length - 2].score : null;
    const trend = latest !== null && previous !== null ? latest - previous : null;
    const topicMap = new Map<string, number[]>();
    quizzes.forEach(quiz => quiz.topicScores.forEach(topic => {
      const score = safeScore(topic.score);
      if (score !== null) topicMap.set(topic.topic, [...(topicMap.get(topic.topic) || []), score]);
    }));
    const topics = Array.from(topicMap, ([topic, values]) => ({ topic, score: Math.round(values.reduce((sum, score) => sum + score, 0) / values.length), attempts: values.length }))
      .sort((a, b) => b.score - a.score);
    const periods = Array.from(new Map(quizzes.map(quiz => {
      const date = new Date(quiz.date);
      return [date.getFullYear().toString(), { period: date.getFullYear().toString(), score: quiz.score }];
    })).values());
    const distribution = [
      { range: '0–20', count: scores.filter(score => score <= 20).length },
      { range: '21–40', count: scores.filter(score => score >= 21 && score <= 40).length },
      { range: '41–60', count: scores.filter(score => score >= 41 && score <= 60).length },
      { range: '61–70', count: scores.filter(score => score >= 61 && score <= 70).length },
      { range: '71–80', count: scores.filter(score => score >= 71 && score <= 80).length },
      { range: '81–90', count: scores.filter(score => score >= 81 && score <= 90).length },
      { range: '91–100', count: scores.filter(score => score >= 91).length },
    ];
    const evolution = topics.map(topic => {
      const values = quizzes.map(quiz => ({
        period: new Date(quiz.date).getFullYear().toString(),
        score: quiz.topicScores.find(item => item.topic === topic.topic)?.score ?? null,
      })).filter(item => item.score !== null);
      const first = values[0]?.score ?? null;
      const last = values[values.length - 1]?.score ?? null;
      return { ...topic, values, netChange: first !== null && last !== null ? last - first : null };
    });
    return { quizzes, average, latest, trend, topics, strengths: topics.slice(0, 4), improvements: [...topics].reverse().slice(0, 4), periods, distribution, evolution };
  }, [data]);

  if (loading) {
    return <div className="space-y-5 animate-pulse"><div className="h-6 w-40 rounded bg-cream/70" /><div className="h-44 rounded-2xl border border-border-soft bg-white/80" /><div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 rounded-xl bg-cream/60" />)}</div><div className="h-80 rounded-2xl bg-white/80" /></div>;
  }

  if (error || !data || !derived) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-500" /><h2 className="text-lg font-bold text-red-800">Unable to load student profile</h2><p className="mt-2 text-sm text-red-700">{error || 'No profile data was returned.'}</p><div className="mt-5 flex justify-center gap-2"><button type="button" onClick={fetchProfile} className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Retry</button><button type="button" onClick={onBack} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">Go back</button></div></div>;
  }

  const assignmentPercentage = data.assignmentCompletion.total > 0 ? Math.round((data.assignmentCompletion.completed / data.assignmentCompletion.total) * 100) : null;
  const initials = data.student.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const chartData = derived.quizzes.map(quiz => ({ period: formatDate(quiz.date), score: quiz.score, title: quiz.title }));
  const periods = Array.from(new Set(derived.evolution.flatMap(item => item.values.map(value => value.period))));

  return (
    <div className="space-y-6 text-ink print:bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-maroon hover:text-maroon-deep"><ArrowLeft className="h-4 w-4" /> Back to Students & Reports</button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border-soft bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-cream"><Printer className="h-4 w-4" /> Print profile</button>
      </div>

      <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-maroon/10 text-2xl font-bold text-maroon">{initials || <User className="h-8 w-8" />}</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-body">Student academic profile</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-ink">{data.student.name}</h1>
              <p className="mt-1 text-sm text-gray-body">Roll number: <span className="font-mono font-semibold text-ink">{data.student.rollNumber || 'Not available'}</span></p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-lg border border-border-soft bg-cream/70 px-2.5 py-1">Batch: {data.student.batchName || 'Not available'}</span><span className="rounded-lg border border-border-soft bg-cream/70 px-2.5 py-1">Department: {data.student.departmentName || 'Not available'}</span><span className="rounded-lg border border-border-soft bg-cream/70 px-2.5 py-1">Section: {data.student.sectionName || 'Not available'}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-border-soft bg-cream/30 px-4 py-3 text-sm"><p className="font-semibold text-ink">Authorized faculty view</p><p className="mt-1 text-xs text-gray-body">Academic records returned by the existing faculty profile endpoint.</p></div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-border-soft bg-white/90 p-5 shadow-sm"><ScoreRing score={derived.average} /><div><p className="text-xs font-bold uppercase tracking-wider text-gray-body">Overall average</p><p className="mt-1 text-sm text-gray-body">{derived.quizzes.length ? `Across ${derived.quizzes.length} evaluated assessment${derived.quizzes.length === 1 ? '' : 's'}` : 'No evaluated assessments'}</p></div></div>
        <div className="rounded-xl border border-border-soft bg-white/90 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-gray-body">Academic summary</p><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-2xl font-bold text-ink">{derived.quizzes.length}</p><p className="text-xs text-gray-body">Assessments</p></div><div><p className="text-2xl font-bold text-ink">{data.assignmentCompletion.total}</p><p className="text-xs text-gray-body">Assignments</p></div></div><p className="mt-4 text-xs text-gray-body">{derived.trend === null ? 'Improvement trend needs at least two scores.' : `${derived.trend >= 0 ? '+' : ''}${derived.trend} points from the previous evaluated assessment.`}</p></div>
        <div className="rounded-xl border border-border-soft bg-white/90 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-gray-body">Assignment progress</p><p className="mt-3 text-3xl font-bold text-ink">{assignmentPercentage === null ? '—' : `${assignmentPercentage}%`}</p><p className="mt-1 text-sm text-gray-body">{data.assignmentCompletion.total ? `${data.assignmentCompletion.completed} of ${data.assignmentCompletion.total} assigned items submitted` : 'No assignment records returned'}</p><div className="mt-4 h-2 rounded-full bg-cream dark:bg-[#302b2f]">{assignmentPercentage !== null && <div className="h-full rounded-full bg-green-600" style={{ width: `${assignmentPercentage}%` }} />}</div></div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border-soft print:hidden">
        {(['overview', 'assessments', 'assignments'] as const).map(tab => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 px-4 py-3 text-sm font-bold capitalize ${activeTab === tab ? 'border-maroon text-maroon' : 'border-transparent text-gray-body hover:text-ink'}`}>{tab === 'overview' ? 'Academic overview' : tab === 'assessments' ? 'Assessment history' : 'Assignments'}</button>)}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-ink">Student performance trend</h2><p className="mt-1 text-xs text-gray-body">Actual evaluated assessment scores ordered by submission date.</p>{chartData.length < 2 ? <EmptyState icon={<TrendingUp className="h-7 w-7 text-maroon" />} title={chartData.length ? 'One assessment returned' : 'No trend data'} description={chartData.length ? 'A trend requires at least two evaluated assessments.' : 'No evaluated assessment scores are available.'} /> : <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="studentTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9B2242" stopOpacity={0.28} /><stop offset="100%" stopColor="#9B2242" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--gray-body)' }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} /><RechartsTooltip content={({ active, payload }) => active && payload?.length ? <div className="rounded-lg border border-border-soft bg-white p-3 text-xs shadow-lg"><p className="font-semibold text-ink">{payload[0].payload.title}</p><p className="mt-1 text-maroon">{payload[0].value}%</p></div> : null} /><Area type="monotone" dataKey="score" stroke="#9B2242" fill="url(#studentTrendFill)" strokeWidth={3} /></AreaChart></ResponsiveContainer></div>}</section>
            <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-ink">Topic performance balance</h2><p className="mt-1 text-xs text-gray-body">Average scores calculated from topic scores returned with evaluated assessments.</p>{derived.topics.length === 0 ? <EmptyState icon={<BarChart3 className="h-7 w-7 text-maroon" />} title="No topic data" description="Topic-level scores are not available for this student." /> : <div className="mt-5 space-y-4">{derived.topics.slice(0, 6).map(topic => <MetricBar key={topic.topic} label={topic.topic} value={topic.score} description={`Average across ${topic.attempts} returned assessment${topic.attempts === 1 ? '' : 's'}`} />)}</div>}</section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-ink">Student strengths</h2><p className="mt-1 text-xs text-gray-body">Highest observed topic averages from returned assessment responses.</p><div className="mt-5 space-y-3">{derived.strengths.length ? derived.strengths.map(topic => <MetricBar key={topic.topic} label={topic.topic} value={topic.score} description="Observed topic average" />) : <EmptyState title="No strengths available" description="Topic scores are not available." />}</div></section>
            <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-ink">Areas for improvement</h2><p className="mt-1 text-xs text-gray-body">Lower observed topic averages that may benefit from review.</p><div className="mt-5 space-y-3">{derived.improvements.length ? derived.improvements.map(topic => <MetricBar key={topic.topic} label={topic.topic} value={topic.score} description={topic.score < 60 ? 'Needs improvement under existing performance bands' : 'Area to strengthen'} />) : <EmptyState title="No improvement areas available" description="Topic scores are not available." />}</div></section>
          </div>

          <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-ink">Student score distribution</h2><p className="mt-1 text-xs text-gray-body">Count of this student&apos;s evaluated assessments in each score range.</p>{derived.quizzes.length === 0 ? <EmptyState icon={<BarChart3 className="h-7 w-7 text-maroon" />} title="No score distribution" description="No evaluated assessment scores are available." /> : <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={derived.distribution}><CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--gray-body)' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} /><RechartsTooltip /><Bar dataKey="count" name="Assessments" fill="#9B2242" radius={[5, 5, 0, 0]}>{derived.distribution.map(item => <Cell key={item.range} fill={item.count ? '#9B2242' : 'var(--border-soft)'} />)}</Bar></BarChart></ResponsiveContainer></div>}</section>

          <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-ink">How does this student compare?</h2><div className="mt-4 rounded-xl border border-dashed border-border-soft bg-cream/30 p-5 text-sm text-gray-body">Cohort comparison is not available from the current authorized student profile response. No peer scores or unsupported benchmark values are shown.</div></section>

          <section className="rounded-2xl border border-border-soft bg-white/90 p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-ink">How have skills changed over available periods?</h2><p className="mt-1 text-xs text-gray-body">Periods are grouped by the year present in actual assessment dates; semester labels are not returned by the current API.</p>{derived.evolution.length === 0 ? <EmptyState title="No skill history" description="Topic history is not available." /> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-border-soft text-xs uppercase tracking-wide text-gray-body"><th className="p-3">Topic</th>{periods.map(period => <th key={period} className="p-3">{period}</th>)}<th className="p-3">Net change</th></tr></thead><tbody>{derived.evolution.map(topic => <tr key={topic.topic} className="border-b border-border-soft last:border-0"><td className="p-3 font-semibold text-ink">{topic.topic}</td>{periods.map(period => { const value = topic.values.find(item => item.period === period)?.score ?? null; return <td key={period} className="p-3">{value === null ? <span className="text-gray-body">—</span> : <span className={`rounded-md border px-2 py-1 text-xs font-bold ${bandClass(value)}`}>{value}%</span>}</td>; })}<td className="p-3 font-bold">{topic.netChange === null ? <span className="text-gray-body">—</span> : <span className={topic.netChange >= 0 ? 'text-green-700' : 'text-red-700'}>{topic.netChange >= 0 ? '+' : ''}{topic.netChange} pts</span>}</td></tr>)}</tbody></table></div>}</section>
        </>
      )}

      {activeTab === 'assessments' && <section className="overflow-hidden rounded-2xl border border-border-soft bg-white/90 shadow-sm"><div className="border-b border-border-soft bg-cream/30 p-5"><h2 className="font-serif text-lg font-bold text-ink">Assessment history</h2><p className="mt-1 text-xs text-gray-body">Completed and evaluated quiz attempts returned by the faculty profile endpoint.</p></div>{derived.quizzes.length === 0 ? <EmptyState icon={<FileText className="h-8 w-8 text-maroon" />} title="No assessment history" description="No evaluated assessments were returned for this student." /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-border-soft text-xs uppercase tracking-wide text-gray-body"><th className="p-4">Assessment</th><th className="p-4">Date</th><th className="p-4">Score</th><th className="p-4">Band</th><th className="p-4">Topics</th></tr></thead><tbody>{derived.quizzes.map(quiz => <tr key={quiz.quizId} className="border-b border-border-soft last:border-0 hover:bg-cream/20"><td className="p-4 font-semibold text-ink">{quiz.title}</td><td className="p-4 text-gray-body">{formatDate(quiz.date)}</td><td className="p-4 font-bold text-ink">{quiz.score}%</td><td className="p-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${bandClass(quiz.score)}`}>{quiz.band}</span></td><td className="p-4 text-gray-body">{quiz.topicScores.length ? quiz.topicScores.map(topic => `${topic.topic}: ${topic.score}%`).join(', ') : 'Not available'}</td></tr>)}</tbody></table></div>}</section>}

      {activeTab === 'assignments' && <section className="overflow-hidden rounded-2xl border border-border-soft bg-white/90 shadow-sm"><div className="border-b border-border-soft bg-cream/30 p-5"><h2 className="font-serif text-lg font-bold text-ink">Assignment history</h2><p className="mt-1 text-xs text-gray-body">Assignment records and submission statuses returned for this student.</p></div>{data.assignmentCompletion.items.length === 0 ? <EmptyState icon={<Clipboard className="h-8 w-8 text-maroon" />} title="No assignment history" description="No assignment records were returned." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border-soft text-xs uppercase tracking-wide text-gray-body"><th className="p-4">Assignment</th><th className="p-4">Assigned</th><th className="p-4">Status</th><th className="p-4">Grade</th></tr></thead><tbody>{data.assignmentCompletion.items.map(item => <tr key={item.assignmentId} className="border-b border-border-soft last:border-0 hover:bg-cream/20"><td className="p-4 font-semibold text-ink">{item.title}</td><td className="p-4 text-gray-body">{formatDate(item.assignedDate)}</td><td className="p-4">{item.status === 'GRADED' ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Graded</span> : item.status === 'SUBMITTED' ? <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700"><Circle className="h-3.5 w-3.5 fill-blue-700" /> Submitted</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600"><Clock className="h-3.5 w-3.5" /> Pending</span>}</td><td className="p-4 font-bold text-ink">{item.grade === null ? <span className="font-normal italic text-gray-body">Not graded</span> : `${item.grade} / ${item.maxMarks}`}</td></tr>)}</tbody></table></div>}</section>}
    </div>
  );
}
