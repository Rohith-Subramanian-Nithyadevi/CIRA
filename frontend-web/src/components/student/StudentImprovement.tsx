import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, Award, BarChart2, Target } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RTooltip, Cell, Legend
} from 'recharts';
import { apiClient } from '../../lib/apiClient';

const C = { maroon: '#9B2242', good: '#2A6B4A', danger: '#C13535', warn: '#C07820', gray: '#6B6560', ink: '#1A1A1A', border: '#E7DDD0', cream: '#FAF5EE', creamEdge: '#EFE5D8' };

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border-soft rounded-lg shadow-xl px-3.5 py-2.5 text-xs">
      <p className="font-semibold text-ink mb-1.5 border-b pb-1.5" style={{ borderColor: C.border }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5" style={{ color: C.gray }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-ink">{p.value}{typeof p.value === 'number' ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
};

const Section = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="mb-5">
    <p className="text-[9px] tracking-widest uppercase font-bold" style={{ color: C.gray }}>{eyebrow}</p>
    <h3 className="text-[15px] font-semibold text-ink mt-0.5">{title}</h3>
  </div>
);

export default function StudentImprovement({ isDemo }: { isDemo?: boolean }) {
  const [sis, setSIS] = useState<any>(null);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [bands, setBands] = useState<any>(null);
  const [priority, setPriority] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setSIS({
        sis: 82,
        components: { currentPerformance: 85, improvement: 78, topicMastery: 80, consistency: 88, recovery: 75 },
        insufficientData: false,
        attemptCount: 12,
        trend: 5
      });
      setSemesters([
        { label: 'Sem 1', averageScore: 68, improvement: 0, assessmentCount: 4 },
        { label: 'Sem 2', averageScore: 72, improvement: 4, assessmentCount: 5 },
        { label: 'Sem 3', averageScore: 75, improvement: 3, assessmentCount: 6 },
        { label: 'Sem 4', averageScore: 82, improvement: 7, assessmentCount: 5 },
        { label: 'Sem 5', averageScore: 88, improvement: 6, assessmentCount: 3 }
      ]);
      setBands({
        excellent: 8, good: 12, average: 4, poor: 1, total: 25, trend: 'You are consistently scoring in the Good and Excellent bands for the last 15 assessments.'
      });
      setPriority({
        topic: 'Operating Systems - Paging', score: 45, reasons: ['Score dropped 15% in last quiz', 'Required for upcoming core assessments']
      });
      setBenchmark([
        { topic: 'Data Struct', topper: 98, classAvg: 72, you: 85 },
        { topic: 'Algorithms', topper: 95, classAvg: 68, you: 78 },
        { topic: 'OS', topper: 92, classAvg: 65, you: 55 },
        { topic: 'Networks', topper: 96, classAvg: 75, you: 88 }
      ]);
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.fetch('/api/v1/student/improvement/sis').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/improvement/semesters').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/improvement/bands').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/improvement/priority').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/improvement/benchmark').then(r => r.json()).catch(() => null),
    ]).then(([s, sem, b, p, bm]) => {
      if (s?.success) setSIS(s.data);
      if (sem?.success) setSemesters(sem.data);
      if (b?.success) setBands(b.data);
      if (p?.success) setPriority(p.data);
      if (bm?.success) setBenchmark(bm.data);
    }).finally(() => setLoading(false));
  }, [isDemo]);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.gray }} /></div>;

  const bandChartData = bands ? [
    { band: 'Excellent', count: bands.excellent, fill: C.good },
    { band: 'Good', count: bands.good, fill: C.maroon },
    { band: 'Average', count: bands.average, fill: C.warn },
    { band: 'Poor', count: bands.poor, fill: C.danger },
  ] : [];

  return (
    <div className="space-y-5">

      {/* ── SIS DETAIL ── */}
      <div className="bg-white rounded-xl border shadow-sm p-6" style={{ borderColor: C.border }}>
        <Section eyebrow="Student Improvement Score" title="How is your overall development?" />

        {!sis || sis.insufficientData ? (
          <div className="rounded-lg border border-dashed py-8 text-center" style={{ borderColor: C.border }}>
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: C.maroon }} />
            <p className="text-sm font-medium text-ink">Insufficient data</p>
            <p className="text-xs mt-1" style={{ color: C.gray }}>Complete at least 3 assessments to calculate your SIS.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Big SIS number */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-6xl font-bold" style={{ color: C.maroon }}>{sis.sis}</div>
                <div className="text-sm font-medium mt-1" style={{ color: C.gray }}>/100</div>
                <div className="mt-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#F5EAF0', color: C.maroon }}>
                    {sis.sis >= 75 ? 'Strong' : sis.sis >= 55 ? 'Developing' : 'Needs Focus'}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {([
                  ['Current Performance', sis.components.currentPerformance, '35%'],
                  ['Improvement',         sis.components.improvement,       '30%'],
                  ['Topic Mastery',       sis.components.topicMastery,      '20%'],
                  ['Consistency',         sis.components.consistency,       '10%'],
                  ['Recovery',            sis.components.recovery,          '5%'],
                ] as [string, number, string][]).map(([label, val, weight]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: C.gray }}>{label} <span className="opacity-50">({weight})</span></span>
                      <span className="font-bold text-ink">{Math.round(val)}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: C.maroon }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <div className="rounded-lg p-4 text-sm space-y-2" style={{ background: C.cream }}>
              <p className="font-semibold text-ink">Understanding your SIS</p>
              <p style={{ color: C.gray }}>Your SIS is not just your average score. It measures <strong>how much you've improved</strong>, how consistent you are, and whether you've recovered from weak areas.</p>
              {sis.trend !== 0 && (
                <p style={{ color: sis.trend > 0 ? C.good : C.danger }} className="font-semibold">
                  {sis.trend > 0 ? `▲ Improving — up ${sis.trend}% from last assessment` : `▼ Declining — down ${Math.abs(sis.trend)}% from last assessment`}
                </p>
              )}
              <p style={{ color: C.gray }}>Based on {sis.attemptCount} completed assessment{sis.attemptCount !== 1 ? 's' : ''}.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── SEMESTER JOURNEY ── */}
      <div className="bg-white rounded-xl border shadow-sm p-6" style={{ borderColor: C.border }}>
        <Section eyebrow="Semester Progression" title="How did I perform each semester?" />
        {semesters.length === 0 ? (
          <div className="py-8 text-center text-sm italic" style={{ color: C.gray }}>No semester data yet.</div>
        ) : (
          <>
            <div className="h-52 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={semesters}>
                  <defs>
                    <linearGradient id="semGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.maroon} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={C.maroon} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.creamEdge} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 11 }} dx={-6} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <RTooltip content={<CT />} />
                  <Area type="monotone" dataKey="averageScore" name="Avg Score" stroke={C.maroon} strokeWidth={2.5} fill="url(#semGrad)"
                    dot={{ r: 5, fill: C.maroon, strokeWidth: 2.5, stroke: '#fff' }} activeDot={{ r: 7 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {semesters.map((s, i) => (
                <div key={i} className="rounded-lg p-3 border text-center" style={{ borderColor: C.border, background: C.cream }}>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-1 truncate" style={{ color: C.gray }}>{s.label}</p>
                  <p className="text-2xl font-bold text-ink">{s.averageScore}<span className="text-sm font-normal text-gray-body">%</span></p>
                  {s.improvement !== null && (
                    <p className="text-xs font-semibold mt-1" style={{ color: s.improvement >= 0 ? C.good : C.danger }}>
                      {s.improvement >= 0 ? `▲ +${s.improvement}%` : `▼ ${s.improvement}%`}
                    </p>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: C.gray }}>{s.assessmentCount} quiz{s.assessmentCount !== 1 ? 'zes' : ''}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── PERFORMANCE BANDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border shadow-sm p-6" style={{ borderColor: C.border }}>
          <Section eyebrow="Performance Bands" title="How consistent am I?" />
          {!bands || bands.total === 0 ? (
            <div className="py-8 text-center text-sm italic" style={{ color: C.gray }}>No assessment data yet.</div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bandChartData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.creamEdge} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} />
                    <YAxis dataKey="band" type="category" axisLine={false} tickLine={false} tick={{ fill: C.ink, fontSize: 11, fontWeight: 600 }} width={64} />
                    <RTooltip content={<CT />} />
                    <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {bandChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 pt-4 border-t text-sm rounded-lg px-3 py-2.5" style={{ borderColor: C.border, background: C.cream }}>
                <p style={{ color: C.gray }}>{bands.trend}</p>
              </div>
            </>
          )}
        </div>

        {/* ── BENCHMARK ── */}
        <div className="bg-white rounded-xl border shadow-sm p-6" style={{ borderColor: C.border }}>
          <Section eyebrow="Peer Comparison" title="How do I compare with the class?" />
          {benchmark.length === 0 ? (
            <div className="py-8 text-center text-sm italic" style={{ color: C.gray }}>No benchmark data yet. Need more students in same quizzes.</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benchmark} layout="vertical" margin={{ left: 4, right: 16 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.creamEdge} />
                  <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: C.gray, fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} tick={{ fill: C.ink, fontSize: 10, fontWeight: 600 }} width={90} />
                  <RTooltip content={<CT />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: C.gray }} />
                  <Bar dataKey="topper"   name="Topper"    fill={C.creamEdge} radius={[0, 3, 3, 0]} barSize={7} />
                  <Bar dataKey="classAvg" name="Class Avg" fill={C.warn}      radius={[0, 3, 3, 0]} barSize={7} />
                  <Bar dataKey="you"      name="You"       fill={C.maroon}    radius={[0, 3, 3, 0]} barSize={7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── NEXT PRIORITY ── */}
      {priority && (
        <div className="bg-white rounded-xl border shadow-sm p-6" style={{ borderColor: C.border }}>
          <Section eyebrow="What Should I Work On?" title="Your next recommended focus" />
          <div className="flex flex-col md:flex-row gap-5">
            <div className="flex-1 rounded-lg p-4" style={{ background: '#FFF5F5', border: `1px solid #FECACA` }}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" style={{ color: C.danger }} />
                <span className="font-semibold text-ink">{priority.topic}</span>
                <span className="ml-auto text-sm font-bold" style={{ color: C.danger }}>{priority.score}%</span>
              </div>
              <ul className="space-y-1">
                {priority.reasons.map((r: string, i: number) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: C.gray }}>
                    <span className="mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:w-56 rounded-lg p-4" style={{ background: C.cream, border: `1px solid ${C.border}` }}>
              <p className="text-xs font-bold text-ink mb-2">Recommended Actions</p>
              {['Review your previous mistakes in this topic', 'Complete available practice questions', 'Review faculty-approved resources in Resource Hub'].map((a, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span className="text-xs font-bold w-4 shrink-0" style={{ color: C.maroon }}>{i + 1}.</span>
                  <span className="text-xs" style={{ color: C.gray }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
