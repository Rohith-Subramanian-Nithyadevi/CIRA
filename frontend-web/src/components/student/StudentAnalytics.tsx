import { useState, useEffect } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend, Cell, ReferenceLine, Area, AreaChart
} from 'recharts';
import { TrendingUp, AlertTriangle, Award, FlaskConical } from 'lucide-react';
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
  // Semantic — kept close to maroon family
  danger:      '#C13535',  // warm red
  warn:        '#C07820',  // warm amber
  good:        '#2A6B4A',  // muted forest green (neutral, not neon)
};

// ─── DEMO SEED DATA ───────────────────────────────────────────────────────────
const DEMO_DATA = {
  timeline: [
    { name: 'Sem 3', score: 61 },
    { name: 'Sem 4', score: 68 },
    { name: 'Sem 5', score: 74 },
    { name: 'Sem 6', score: 83 },
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
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-ink tabular-nums">
            {p.value}{typeof p.value === 'number' && p.name !== 'count' ? '%' : ''}
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

// Stat block used inside cards
const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div>
    <p className="text-[9px] tracking-[0.1em] uppercase font-semibold text-gray-body/70">{label}</p>
    <p className={`text-sm font-bold mt-0.5 ${accent ? 'text-maroon' : 'text-ink'}`}>{value}</p>
  </div>
);

// Mini progress bar using the maroon palette
const MiniBar = ({ value, danger }: { value: number; danger?: boolean }) => (
  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
    <div
      className="h-full rounded-full transition-all duration-700"
      style={{ width: `${value}%`, background: danger ? C.danger : C.maroon }}
    />
  </div>
);

// Heatmap cell colour — all in the same warm family
const heatBg = (s: number) => {
  if (s >= 85) return { bg: '#2A6B4A', text: '#fff' };           // forest green — good
  if (s >= 70) return { bg: '#9B6B1A', text: '#fff' };           // warm ochre
  if (s >= 50) return { bg: '#B84020', text: '#fff' };           // terracotta
  return         { bg: '#8A1E1E', text: '#fff' };                 // deep red
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function StudentAnalytics() {
  const [isDemo, setIsDemo]         = useState(false);
  const [liveTimeline, setLT]       = useState<any[]>([]);
  const [liveSW, setLSW]            = useState<{ strengths: any[]; weaknesses: any[] }>({ strengths: [], weaknesses: [] });
  const [liveRadar, setLR]          = useState<any[]>([]);
  const [liveHeatmap, setLH]        = useState<any[]>([]);
  const [liveBenchmark, setLB]      = useState<any[]>([]);
  const [liveDist, setLD]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [tR, swR, hR, rR, bR, dR] = await Promise.all([
        apiClient.fetch('/api/v1/student-features/analytics/timeline'),
        apiClient.fetch('/api/v1/student-features/analytics/strengths-weaknesses'),
        apiClient.fetch('/api/v1/student-features/analytics/heatmap'),
        apiClient.fetch('/api/v1/student-features/analytics/radar'),
        apiClient.fetch('/api/v1/student-features/analytics/benchmark'),
        apiClient.fetch('/api/v1/student-features/analytics/distribution'),
      ]);
      setLT(await tR.json());
      setLSW(await swR.json());
      setLH(await hR.json());
      setLR(await rR.json());
      setLB(await bR.json());
      setLD(await dR.json());
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
    <div className="space-y-5">

      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-xs" style={{ background: '#FDF5E8', borderColor: '#E0C88A', color: '#7A5A10' }}>
          <FlaskConical className="w-3.5 h-3.5 shrink-0" style={{ color: C.warn }} />
          <span><span className="font-bold">Demo mode.</span> Showing a sample 4-semester student profile. Your real data populates once assessments are graded.</span>
        </div>
      )}

      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Performance Analytics</h2>
          <p className="text-xs mt-0.5" style={{ color: C.gray }}>Aggregated from all quiz attempts and assessments</p>
        </div>
        <button
          onClick={() => setIsDemo(!isDemo)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all"
          style={isDemo
            ? { background: C.maroon, borderColor: C.maroonDeep, color: '#fff' }
            : { background: '#fff', borderColor: C.border, color: C.gray }
          }
        >
          <FlaskConical className="w-3.5 h-3.5" />
          {isDemo ? 'Exit Demo' : 'Preview with Sample Data'}
        </button>
      </div>

      {/* ── CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card 1 — Overall */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${C.maroon}, ${C.maroonMid})` }} />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] tracking-[0.12em] uppercase font-bold" style={{ color: C.gray }}>Overall Performance</p>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: C.ink }}>{latestScore}</span>
                  <span className="text-sm mb-0.5" style={{ color: C.gray }}>%</span>
                </div>
              </div>
              <div className="p-2 rounded-lg mt-0.5" style={{ background: C.maroonFaint }}>
                <TrendingUp className="w-4 h-4" style={{ color: C.maroon }} />
              </div>
            </div>
            <div className="mt-3 mb-4">
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: trend > 0 ? '#EBF5EE' : trend < 0 ? '#FAEAEA' : C.cream, color: trend > 0 ? C.good : trend < 0 ? C.danger : C.gray }}
              >
                {trend > 0 ? `▲ +${trend}%` : trend < 0 ? `▼ ${trend}%` : '─  Stable'} vs last period
              </span>
            </div>
            <div className="pt-3.5 border-t grid grid-cols-2 gap-x-4" style={{ borderColor: C.border }}>
              <Stat label="Sessions" value={timelineData.length ? String(timelineData.length) : '—'} />
              <Stat label="Best Period" value={bestPeriod} />
            </div>
          </div>
        </div>

        {/* Card 2 — Priority Focus */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${C.danger}, #E07050)` }} />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-3 min-w-0">
                <p className="text-[9px] tracking-[0.12em] uppercase font-bold" style={{ color: C.gray }}>Priority Focus</p>
                <p className="text-[15px] font-semibold leading-snug mt-2 line-clamp-2" style={{ color: C.ink }}>
                  {topWeakness?.topic || 'No data yet'}
                </p>
              </div>
              <div className="p-2 rounded-lg mt-0.5 shrink-0" style={{ background: '#FAEAEA' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: C.danger }} />
              </div>
            </div>
            {topWeakness ? (
              <>
                <div className="mt-3 mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px]" style={{ color: C.gray }}>Your score</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: C.danger }}>{topWeakness.score}%</span>
                  </div>
                  <MiniBar value={topWeakness.score} danger />
                </div>
                <div className="pt-3.5 border-t grid grid-cols-2 gap-x-4" style={{ borderColor: C.border }}>
                  <Stat label="Gap to 70%" value={`+${Math.max(0, 70 - topWeakness.score)}% needed`} accent />
                  <Stat label="Action" value="→ Resource Hub" accent />
                </div>
              </>
            ) : (
              <p className="text-xs mt-3 italic" style={{ color: C.gray }}>Complete assessments to reveal weak areas.</p>
            )}
          </div>
        </div>

        {/* Card 3 — Strongest */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${C.good}, #4A9B6A)` }} />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-3 min-w-0">
                <p className="text-[9px] tracking-[0.12em] uppercase font-bold" style={{ color: C.gray }}>Strongest Skill</p>
                <p className="text-[15px] font-semibold leading-snug mt-2 line-clamp-2" style={{ color: C.ink }}>
                  {topStrength?.topic || 'No data yet'}
                </p>
              </div>
              <div className="p-2 rounded-lg mt-0.5 shrink-0" style={{ background: '#EBF5EE' }}>
                <Award className="w-4 h-4" style={{ color: C.good }} />
              </div>
            </div>
            {topStrength ? (
              <>
                <div className="mt-3 mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px]" style={{ color: C.gray }}>Mastery</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: C.good }}>{topStrength.score}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${topStrength.score}%`, background: C.good }} />
                  </div>
                </div>
                <div className="pt-3.5 border-t grid grid-cols-2 gap-x-4" style={{ borderColor: C.border }}>
                  <Stat label="vs Class Avg" value={`+${Math.max(0, topStrength.score - yourAvg)}% above`} accent />
                  <Stat label="Status" value="✓ Keep it up" />
                </div>
              </>
            ) : (
              <p className="text-xs mt-3 italic" style={{ color: C.gray }}>Complete assessments to see top skills.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 1: Area Line + Radar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
          <Eyebrow label="Performance Trend" title="Am I improving over time?" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.maroon} stopOpacity={0.12}/>
                    <stop offset="95%" stopColor={C.maroon} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.creamEdge} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 11 }} dx={-6} domain={[40, 100]} tickFormatter={v => `${v}%`} />
                <RechartsTooltip content={<CT />} />
                <ReferenceLine y={classAvgVal} stroke={C.border} strokeDasharray="4 4" label={{ value: 'Class Avg', position: 'insideTopRight', fontSize: 9, fill: C.gray }} />
                <Area type="monotone" dataKey="score" name="Score" stroke={C.maroon} strokeWidth={2.5} fill="url(#sg)" dot={{ r: 5, fill: C.maroon, strokeWidth: 2.5, stroke: '#fff' }} activeDot={{ r: 7 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
          <Eyebrow label="Skill Balance" title="What is my skill profile?" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: C.ink, fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="A" stroke={C.maroon} fill={C.maroon} fillOpacity={0.15} strokeWidth={2} dot />
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
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.score}%`, background: C.good }} />
                  </div>
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
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.score}%`, background: C.danger }} />
                  </div>
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
              <BarChart data={benchmarkData} layout="vertical" margin={{ left: 4, right: 16 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.creamEdge} />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} tick={{ fill: C.ink, fontSize: 10, fontWeight: 600 }} width={90} />
                <RechartsTooltip content={<CT />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: C.gray }} />
                <Bar dataKey="topper"   name="Topper"    fill={C.creamEdge}  radius={[0,3,3,0]} barSize={7} />
                <Bar dataKey="classAvg" name="Class Avg" fill={C.warn}       radius={[0,3,3,0]} barSize={7} />
                <Bar dataKey="you"      name="You"       fill={C.maroon}     radius={[0,3,3,0]} barSize={7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
          <Eyebrow label="Score Distribution" title="How consistent am I?" />
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.creamEdge} />
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} dx={-4} />
                <RechartsTooltip content={<CT />} />
                <Bar dataKey="count" name="count" radius={[4,4,0,0]} maxBarSize={36}>
                  {distributionData.map((entry, i) => {
                    const peak = entry.range === '71–80' || entry.range === '81–90' || entry.range === '71-80' || entry.range === '81-90';
                    return <Cell key={i} fill={peak ? C.maroon : C.creamEdge} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-center mt-3" style={{ color: C.gray }}>Highlighted = your most frequent score range.</p>
        </div>
      </div>

      {/* ── HEATMAP ── */}
      <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
        <div className="flex items-start justify-between mb-5">
          <Eyebrow label="Skill Evolution" title="How have skills changed each semester?" />
          <div className="flex items-center gap-4 text-[10px] font-semibold shrink-0" style={{ color: C.gray }}>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#8A1E1E' }}/>&lt;50</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#B84020' }}/>50–69</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#9B6B1A' }}/>70–84</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C.good }}/>85+</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-semibold pb-3 pr-6 w-1/4" style={{ color: C.gray }}>Topic</th>
                {['Sem 3','Sem 4','Sem 5','Sem 6'].map(s => (
                  <th key={s} className="text-center text-[11px] font-semibold pb-3 px-2" style={{ color: C.gray }}>{s}</th>
                ))}
                <th className="text-center text-[11px] font-semibold pb-3 px-2" style={{ color: C.gray }}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {heatmapData.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-sm italic" style={{ color: C.gray }}>No data yet. Use sample data to preview.</td></tr>
              ) : heatmapData.map((row: any, i) => {
                const delta = (row.s4 || 0) - (row.s1 || 0);
                return (
                  <tr key={i} className="border-t" style={{ borderColor: C.border }}>
                    <td className="py-2 pr-6 text-xs font-medium" style={{ color: C.ink }}>{row.topic}</td>
                    {[row.s1, row.s2, row.s3, row.s4].map((score: number, j: number) => {
                      const { bg, text } = heatBg(score || 0);
                      return (
                        <td key={j} className="py-1.5 px-2">
                          <div className="h-8 rounded-md flex items-center justify-center text-[11px] font-bold" style={{ background: bg, color: text }}>
                            {score || 0}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-center">
                      <span className="text-xs font-bold" style={{ color: delta > 0 ? C.good : delta < 0 ? C.danger : C.gray }}>
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

      {/* ── SEMESTER BARS ── */}
      <div className="bg-white p-6 rounded-xl border shadow-sm" style={{ borderColor: C.border }}>
        <Eyebrow label="Semester Report" title="How did I perform each semester?" />
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.creamEdge} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 12, fontWeight: 600 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 11 }} dx={-6} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <RechartsTooltip content={<CT />} />
              <ReferenceLine y={75} stroke={C.border} strokeDasharray="4 4" label={{ value: 'Target', position: 'insideTopRight', fontSize: 9, fill: C.gray }} />
              <Bar dataKey="score" name="Score" radius={[5,5,0,0]} maxBarSize={64}>
                {timelineData.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 80 ? C.good : entry.score >= 65 ? C.maroon : C.danger} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-4 justify-center">
          {([[C.good, '≥80% Excellent'], [C.maroon, '65–79% Good'], [C.danger, '<65% Needs Work']] as [string, string][]).map(([col, label]) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: C.gray }}>
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: col }} />
              {label}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
