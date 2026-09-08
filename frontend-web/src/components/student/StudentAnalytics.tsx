import { useState, useEffect } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend, Cell, ReferenceLine, Area, AreaChart,
  PieChart, Pie
} from 'recharts';
import { TrendingUp, AlertTriangle, Award, FlaskConical, BookOpen, Target, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

// Site accent palette
const C = {
  maroon:      '#9B2242',
  maroonDeep:  '#8A1E3A',
  maroonFaint: '#F5EAF0',
  maroonMid:   '#C85A7A',
  ink:         '#1A1A1A',
  gray:        '#6B6560',
  border:      '#E7DDD0',
  cream:       '#FAF5EE',
  creamEdge:   '#EFE5D8',
  danger:      '#C13535',
  warn:        '#C07820',
  good:        '#2A6B4A',
};

// ─── DEMO SEED DATA ───────────────────────────────────────────────────────────
const DEMO_DATA = {
  timeline: [
    { name: 'Sem 3', score: 61, assessmentCount: 4 },
    { name: 'Sem 4', score: 68, assessmentCount: 5 },
    { name: 'Sem 5', score: 74, assessmentCount: 6 },
    { name: 'Sem 6', score: 83, assessmentCount: 5 },
  ],
  strengthsWeaknesses: {
    strengths: [
      { topic: 'DSA: Trees & Graphs',    score: 88 },
      { topic: 'Aptitude: Quantitative', score: 84 },
      { topic: 'Logical Reasoning',      score: 79 },
    ],
    weaknesses: [
      { topic: 'Verbal Comprehension',   score: 48 },
      { topic: 'Group Discussion',       score: 54 },
      { topic: 'System Design',          score: 62 },
    ],
  },
  radar: [
    { subject: 'DSA',       A: 88, fullMark: 100 },
    { subject: 'Aptitude',  A: 84, fullMark: 100 },
    { subject: 'Soft Skills', A: 67, fullMark: 100 },
    { subject: 'Verbal',    A: 51, fullMark: 100 },
    { subject: 'Core CS',   A: 76, fullMark: 100 },
  ],
  heatmap: [
    { topic: 'DSA: Arrays & Strings',    s1: 55, s2: 63, s3: 74, s4: 88 },
    { topic: 'Aptitude: Quants',         s1: 62, s2: 70, s3: 78, s4: 84 },
    { topic: 'Soft Skills: Leadership',  s1: 50, s2: 58, s3: 67, s4: 73 },
    { topic: 'Verbal: Grammar',          s1: 40, s2: 44, s3: 48, s4: 51 },
    { topic: 'DBMS Fundamentals',        s1: 58, s2: 69, s3: 76, s4: 80 },
    { topic: 'OS Concepts',              s1: 52, s2: 61, s3: 70, s4: 77 },
  ],
  benchmark: [
    { topic: 'DSA',         you: 88, classAvg: 67, topper: 96 },
    { topic: 'Aptitude',    you: 84, classAvg: 71, topper: 93 },
    { topic: 'Soft Skills', you: 67, classAvg: 73, topper: 91 },
    { topic: 'Verbal',      you: 51, classAvg: 68, topper: 87 },
    { topic: 'Core CS',     you: 76, classAvg: 70, topper: 94 },
  ],
  distribution: [
    { range: '0–20',   count: 1 },
    { range: '21–40',  count: 3 },
    { range: '41–60',  count: 8 },
    { range: '61–70',  count: 14 },
    { range: '71–80',  count: 22 },
    { range: '81–90',  count: 17 },
    { range: '91–100', count: 6 },
  ],
  sisDetails: {
    sis: 82,
    components: { currentPerformance: 85, improvement: 78, topicMastery: 80, consistency: 88, recovery: 75 },
    insufficientData: false,
    attemptCount: 12,
    trend: 5
  },
  priority: {
    topic: 'Verbal Comprehension', score: 48, reasons: ['Score dropped 10% in last quiz', 'Required for placement assessments']
  },
  // Resource Analytics mock data
  resourceImpact: [
    { name: 'Video Lectures', value: 45, fill: C.maroon },
    { name: 'Practice Questions', value: 35, fill: '#D38A4E' },
    { name: 'Reading Material', value: 20, fill: C.good },
  ],
  resourceTopics: [
    { topic: 'DSA: Trees & Graphs', completed: 120, learned: 88 },
    { topic: 'System Design', completed: 85, learned: 62 },
    { topic: 'OS Concepts', completed: 40, learned: 77 },
    { topic: 'Verbal Comprehension', completed: 15, learned: 48 },
  ]
};

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }} className="bg-white border border-border-soft rounded-lg shadow-xl px-3.5 py-2.5 text-xs min-w-[130px]">
      <p className="font-semibold text-ink mb-1.5 pb-1.5 border-b border-border-soft">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-gray-body">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color || p.payload?.fill || C.maroon }} />
            {p.name}
          </span>
          <span className="font-bold text-ink tabular-nums">
            {p.value}{typeof p.value === 'number' && p.name !== 'count' && p.name !== 'completed' && p.name !== 'learned' ? '%' : ''}
          </span>
        </div>
      ))}
    </div>
  );
};

const Eyebrow = ({ label, title }: { label: string; title: string }) => (
  <div className="mb-5">
    <p className="text-[9px] tracking-[0.12em] uppercase font-bold text-gray-body mb-0.5">{label}</p>
    <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
  </div>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div>
    <p className="text-[9px] tracking-[0.1em] uppercase font-semibold text-gray-body/70">{label}</p>
    <p className={`text-sm font-bold mt-0.5 ${accent ? 'text-maroon' : 'text-ink'}`}>{value}</p>
  </div>
);

const MiniBar = ({ value, danger, color }: { value: number; danger?: boolean; color?: string }) => (
  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
    <div
      className="h-full rounded-full transition-all duration-700"
      style={{ width: `${value}%`, background: color || (danger ? C.danger : C.maroon) }}
    />
  </div>
);

const heatBg = (s: number) => {
  if (s >= 85) return { bg: '#2A6B4A', text: '#fff' };
  if (s >= 70) return { bg: '#9B6B1A', text: '#fff' };
  if (s >= 50) return { bg: '#B84020', text: '#fff' };
  return         { bg: '#8A1E1E', text: '#fff' };
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function StudentAnalytics({ isDemo }: { isDemo?: boolean }) {
  const [activeTab, setActiveTab]   = useState<'quiz' | 'resource'>('quiz');
  
  const [liveTimeline, setLT]       = useState<any[]>([]);
  const [liveSW, setLSW]            = useState<{ strengths: any[]; weaknesses: any[] }>({ strengths: [], weaknesses: [] });
  const [liveRadar, setLR]          = useState<any[]>([]);
  const [liveHeatmap, setLH]        = useState<any[]>([]);
  const [liveBenchmark, setLB]      = useState<any[]>([]);
  const [liveDist, setLD]           = useState<any[]>([]);
  const [liveSIS, setLSIS]          = useState<any>(null);
  const [livePriority, setLP]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [tR, swR, hR, rR, bR, dR, sR, pR] = await Promise.all([
        apiClient.fetch('/api/v1/student-features/analytics/timeline').catch(() => null),
        apiClient.fetch('/api/v1/student-features/analytics/strengths-weaknesses').catch(() => null),
        apiClient.fetch('/api/v1/student-features/analytics/heatmap').catch(() => null),
        apiClient.fetch('/api/v1/student-features/analytics/radar').catch(() => null),
        apiClient.fetch('/api/v1/student-features/analytics/benchmark').catch(() => null),
        apiClient.fetch('/api/v1/student-features/analytics/distribution').catch(() => null),
        apiClient.fetch('/api/v1/student/improvement/sis').catch(() => null),
        apiClient.fetch('/api/v1/student/improvement/priority').catch(() => null),
      ]);
      if (tR) setLT(await tR.json());
      if (swR) setLSW(await swR.json());
      if (hR) setLH(await hR.json());
      if (rR) setLR(await rR.json());
      if (bR) setLB(await bR.json());
      if (dR) setLD(await dR.json());
      
      const sData = sR ? await sR.json() : null;
      if (sData?.success) setLSIS(sData.data);
      
      const pData = pR ? await pR.json() : null;
      if (pData?.success) setLP(pData.data);
      
    } catch (e) {
      console.error('Analytics fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  const timelineData        = isDemo ? DEMO_DATA.timeline : liveTimeline;
  const strengthsWeaknesses = isDemo ? DEMO_DATA.strengthsWeaknesses : liveSW;
  const radarData           = isDemo ? DEMO_DATA.radar : liveRadar;
  const heatmapData         = isDemo ? DEMO_DATA.heatmap : liveHeatmap;
  const benchmarkData       = isDemo ? DEMO_DATA.benchmark : liveBenchmark;
  const distributionData    = isDemo ? DEMO_DATA.distribution : liveDist;
  const sis                 = isDemo ? DEMO_DATA.sisDetails : liveSIS;
  const priority            = isDemo ? DEMO_DATA.priority : livePriority;

  const latestScore  = timelineData.length ? timelineData[timelineData.length - 1]?.score : 0;
  const prevScore    = timelineData.length > 1 ? timelineData[timelineData.length - 2]?.score : latestScore;
  const trend        = latestScore - prevScore;
  const topStrength  = strengthsWeaknesses.strengths[0];
  const topWeakness  = strengthsWeaknesses.weaknesses[0];
  const yourAvg      = benchmarkData.length ? Math.round(benchmarkData.reduce((s, d) => s + d.you, 0) / benchmarkData.length) : 0;
  const classAvgVal  = benchmarkData.length ? Math.round(benchmarkData.reduce((s, d) => s + d.classAvg, 0) / benchmarkData.length) : 70;
  const bestPeriod   = timelineData.length ? timelineData.reduce((b, d) => d.score > b.score ? d : b, timelineData[0]).name : '—';

  if (loading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: C.cream }} />)}</div>
      <div className="grid grid-cols-2 gap-5">{[1,2,3,4].map(i => <div key={i} className="h-60 rounded-xl animate-pulse" style={{ background: C.cream }} />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header and Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">Analytics Dashboard</h2>
          <p className="text-sm mt-0.5" style={{ color: C.gray }}>Aggregated insights across all assessments and resources</p>
        </div>
        
        <div className="flex p-1 bg-cream-edge/40 rounded-lg border border-border-soft shrink-0">
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'quiz' ? 'bg-white text-maroon shadow-sm border border-border-soft' : 'text-gray-body hover:text-ink hover:bg-cream-edge/20 border border-transparent'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Quiz Analytics
          </button>
          <button
            onClick={() => setActiveTab('resource')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'resource' ? 'bg-white text-maroon shadow-sm border border-border-soft' : 'text-gray-body hover:text-ink hover:bg-cream-edge/20 border border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Resource Analytics
          </button>
        </div>
      </div>

      {activeTab === 'quiz' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* ── PRIORITY ALERT ── */}
          {priority && (
            <div className="bg-[#FFF5F5] rounded-xl border p-5 flex flex-col md:flex-row gap-5 items-center justify-between shadow-sm" style={{ borderColor: '#FECACA' }}>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-full shrink-0 shadow-sm">
                  <Target className="w-6 h-6" style={{ color: C.danger }} />
                </div>
                <div>
                  <h3 className="font-bold text-ink mb-1">Priority Focus: {priority.topic}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm" style={{ color: C.gray }}>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-danger" style={{ color: C.danger }}>{priority.score}%</span> Current Mastery
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>{priority.reasons[0]}</span>
                  </div>
                </div>
              </div>
              <button className="w-full md:w-auto px-5 py-2.5 bg-danger text-white rounded-lg text-sm font-semibold shadow-sm transition-colors shrink-0" style={{ background: C.danger }}>
                Review Topic Now
              </button>
            </div>
          )}

          {/* ── SIS & SUMMARY CARDS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* SIS Card (Takes up 2 columns) */}
            <div className="md:col-span-2 bg-white rounded-xl border shadow-sm p-6" style={{ borderColor: C.border }}>
              <Eyebrow label="Improvement Index" title="Student Improvement Score (SIS)" />
              
              {!sis || sis.insufficientData ? (
                <div className="py-8 text-center text-sm italic" style={{ color: C.gray }}>Need more data to calculate SIS.</div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="text-center shrink-0">
                    <div className="relative flex items-center justify-center w-28 h-28">
                      <svg width="112" height="112" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="56" cy="56" r="46" fill="none" stroke={C.creamEdge} strokeWidth="10" />
                        <circle cx="56" cy="56" r="46" fill="none" stroke={C.maroon} strokeWidth="10"
                          strokeDasharray={`${(sis.sis / 100) * (2 * Math.PI * 46)} ${(2 * Math.PI * 46)}`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute text-center">
                        <div className="text-3xl font-bold text-ink leading-none">{sis.sis}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EBF5EE', color: C.good }}>
                        {sis.trend > 0 ? `▲ +${sis.trend}% Improved` : 'Stable'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-3">
                    {([
                      ['Current Performance', sis.components.currentPerformance, '35%'],
                      ['Improvement Trend',   sis.components.improvement,       '30%'],
                      ['Topic Mastery',       sis.components.topicMastery,      '20%'],
                    ] as [string, number, string][]).map(([label, val, weight]) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: C.gray }}>{label}</span>
                          <span className="font-bold text-ink">{Math.round(val)}</span>
                        </div>
                        <MiniBar value={val} color={val >= 75 ? C.good : val >= 55 ? C.maroon : C.danger} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col" style={{ borderColor: C.border }}>
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${C.maroon}, ${C.maroonMid})` }} />
              <div className="p-6 flex flex-col justify-between flex-1">
                <Eyebrow label="Performance" title="Overall Snapshot" />
                <div>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: C.ink }}>{latestScore}</span>
                    <span className="text-sm mb-0.5 font-medium" style={{ color: C.gray }}>% avg</span>
                  </div>
                  <div className="mt-2.5">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: trend > 0 ? '#EBF5EE' : trend < 0 ? '#FAEAEA' : C.cream, color: trend > 0 ? C.good : trend < 0 ? C.danger : C.gray }}
                    >
                      {trend > 0 ? `▲ +${trend}%` : trend < 0 ? `▼ ${trend}%` : '─  Stable'} vs last period
                    </span>
                  </div>
                </div>
                <div className="pt-4 mt-auto border-t grid grid-cols-2 gap-x-4" style={{ borderColor: C.border }}>
                  <Stat label="Total Quizzes" value={timelineData.reduce((acc, curr) => acc + (curr.assessmentCount || 0), 0).toString() || '—'} />
                  <Stat label="Best Period" value={bestPeriod} />
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 1: Area Line + Radar ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Performance Trend" title="Am I improving over time?" />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.maroon} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={C.maroon} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.creamEdge} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 11 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 11 }} domain={[40, 100]} tickFormatter={v => `${v}%`} />
                    <RechartsTooltip content={<CT />} />
                    <ReferenceLine y={classAvgVal} stroke={C.border} strokeDasharray="4 4" label={{ value: 'Class Avg', position: 'insideTopRight', fontSize: 10, fill: C.gray }} />
                    <Area type="monotone" dataKey="score" name="Score" stroke={C.maroon} strokeWidth={3} fill="url(#sg)" dot={{ r: 5, fill: C.maroon, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Skill Balance" title="What is my skill profile?" />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke={C.border} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: C.ink, fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Score" dataKey="A" stroke={C.maroon} fill={C.maroon} fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: C.maroon }} />
                    <RechartsTooltip content={<CT />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── ROW 2: Strengths + Weaknesses ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Top Strengths" title="What am I good at?" />
              <div className="space-y-4">
                {!strengthsWeaknesses.strengths.length
                  ? <p className="text-sm italic" style={{ color: C.gray }}>No data yet.</p>
                  : strengthsWeaknesses.strengths.map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium" style={{ color: C.ink }}>{item.topic}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: C.good }}>{item.score}%</span>
                      </div>
                      <MiniBar value={item.score} color={C.good} />
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Needs Work" title="What am I weak at?" />
              <div className="space-y-4">
                {!strengthsWeaknesses.weaknesses.length
                  ? <p className="text-sm italic" style={{ color: C.gray }}>No data yet.</p>
                  : strengthsWeaknesses.weaknesses.map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium" style={{ color: C.ink }}>{item.topic}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: C.danger }}>{item.score}%</span>
                      </div>
                      <MiniBar value={item.score} danger />
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ── ROW 3: Benchmark + Distribution ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Peer Comparison" title="How do I compare?" />
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={benchmarkData} layout="vertical" margin={{ left: -20, right: 10 }} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.creamEdge} />
                    <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} tick={{ fill: C.ink, fontSize: 10, fontWeight: 600 }} />
                    <RechartsTooltip content={<CT />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: C.gray }} />
                    <Bar dataKey="topper"   name="Topper"    fill={C.creamEdge}  radius={[0,4,4,0]} barSize={8} />
                    <Bar dataKey="classAvg" name="Class Avg" fill={C.warn}       radius={[0,4,4,0]} barSize={8} />
                    <Bar dataKey="you"      name="You"       fill={C.maroon}     radius={[0,4,4,0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Score Distribution" title="How consistent am I?" />
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ left: -20 }} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.creamEdge} />
                    <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} />
                    <RechartsTooltip content={<CT />} />
                    <Bar dataKey="count" name="count" radius={[4,4,0,0]} maxBarSize={40}>
                      {distributionData.map((entry, i) => {
                        const peak = entry.range === '71–80' || entry.range === '81–90';
                        return <Cell key={i} fill={peak ? C.maroon : C.creamEdge} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── HEATMAP ── */}
          <div className="bg-white p-6 rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <Eyebrow label="Skill Evolution" title="How have skills changed each semester?" />
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold" style={{ color: C.gray }}>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#8A1E1E' }}/>&lt;50</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#B84020' }}/>50–69</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#9B6B1A' }}/>70–84</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: C.good }}/>85+</span>
              </div>
            </div>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: C.creamEdge }}>
                    <th className="text-left text-[11px] font-semibold pb-3 pr-6" style={{ color: C.gray }}>Topic</th>
                    {['Sem 3','Sem 4','Sem 5','Sem 6'].map(s => (
                      <th key={s} className="text-center text-[11px] font-semibold pb-3 px-2" style={{ color: C.gray }}>{s}</th>
                    ))}
                    <th className="text-center text-[11px] font-semibold pb-3 pl-4" style={{ color: C.gray }}>Net Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: C.creamEdge }}>
                  {heatmapData.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-sm italic" style={{ color: C.gray }}>No data yet. Use sample data to preview.</td></tr>
                  ) : heatmapData.map((row: any, i) => {
                    const delta = (row.s4 || 0) - (row.s1 || 0);
                    return (
                      <tr key={i} className="hover:bg-cream/30 transition-colors">
                        <td className="py-3 pr-6 text-xs font-semibold" style={{ color: C.ink }}>{row.topic}</td>
                        {[row.s1, row.s2, row.s3, row.s4].map((score: number, j: number) => {
                          const { bg, text } = heatBg(score || 0);
                          return (
                            <td key={j} className="py-3 px-2">
                              <div className="h-7 w-12 mx-auto rounded flex items-center justify-center text-[11px] font-bold shadow-sm" style={{ background: bg, color: text }}>
                                {score || 0}
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-3 pl-4 text-center">
                          <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: delta > 0 ? '#EBF5EE' : delta < 0 ? '#FAEAEA' : C.cream, color: delta > 0 ? C.good : delta < 0 ? C.danger : C.gray }}>
                            {delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ── RESOURCE ANALYTICS TAB ── */}
      {activeTab === 'resource' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-maroon/10 rounded-full">
                  <CheckCircle2 className="w-8 h-8 text-maroon" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-body uppercase tracking-wider">Total Practice Qns</p>
                  <p className="text-3xl font-bold text-ink mt-1">452</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-green-700/10 rounded-full">
                  <BookOpen className="w-8 h-8 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-body uppercase tracking-wider">Resources Viewed</p>
                  <p className="text-3xl font-bold text-ink mt-1">38</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-amber-600/10 rounded-full">
                  <TrendingUp className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-body uppercase tracking-wider">Avg Score Impact</p>
                  <p className="text-3xl font-bold text-ink mt-1">+14%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Resource Effectiveness" title="Where are you learning the most?" />
              <div className="h-64 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={DEMO_DATA.resourceImpact}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={80}
                      paddingAngle={5} dataKey="value"
                      stroke="none"
                    >
                      {DEMO_DATA.resourceImpact.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CT />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-36px]">
                  <span className="text-2xl font-bold text-ink">38</span>
                  <span className="text-xs text-gray-body">Total</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
              <Eyebrow label="Practice by Topic" title="Questions Attempted vs Mastered" />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DEMO_DATA.resourceTopics} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.creamEdge} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} />
                    <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} width={120} tick={{ fill: C.ink, fontSize: 11, fontWeight: 500 }} />
                    <RechartsTooltip content={<CT />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="completed" name="Questions Completed" fill={C.creamEdge} radius={[0,3,3,0]} barSize={10} />
                    <Bar dataKey="learned" name="Successfully Learned" fill={C.maroon} radius={[0,3,3,0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
