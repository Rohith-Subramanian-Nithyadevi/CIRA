import { useState, useEffect } from 'react';
import { TrendingUp, Bell, Loader2, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface SISData {
  sis: number;
  components: { currentPerformance: number; improvement: number; topicMastery: number; consistency: number; recovery: number };
  insufficientData: boolean;
  attemptCount: number;
  trend: number;
  latestScore: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  faculty: { name: string };
  isSurvey: boolean;
}

// Color palette (matches site)
const C = { maroon: '#9B2242', good: '#2A6B4A', danger: '#C13535', warn: '#C07820', gray: '#6B6560', ink: '#1A1A1A', border: '#E7DDD0', cream: '#FAF5EE', creamEdge: '#EFE5D8' };

function SISRing({ sis, insufficient }: { sis: number; insufficient: boolean }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const dash = insufficient ? 0 : (sis / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke={C.creamEdge} strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={C.maroon} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute text-center">
        {insufficient ? (
          <span className="text-xs text-gray-body font-medium">No data</span>
        ) : (
          <>
            <div className="text-3xl font-bold text-ink leading-none">{sis}</div>
            <div className="text-[10px] text-gray-body font-semibold">/100</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function StudentSpace({ onTabChange, isDemo }: { onTabChange?: (tab: string) => void, isDemo?: boolean }) {
  const [sis, setSIS] = useState<SISData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setSIS({
        sis: 82,
        components: { currentPerformance: 85, improvement: 78, topicMastery: 80, consistency: 88, recovery: 75 },
        insufficientData: false,
        attemptCount: 12,
        trend: 5,
        latestScore: 88
      });
      setAnnouncements([
        { id: '1', title: 'Midterm schedule updated', content: 'The midterm for Data Structures has been moved to Friday. Please check the portal for exact timings.', date: new Date().toISOString(), faculty: { name: 'Dr. Smith' }, isSurvey: false },
        { id: '2', title: 'Course Feedback Required', content: 'Please fill out the feedback survey for the recent module on algorithms.', date: new Date(Date.now() - 86400000).toISOString(), faculty: { name: 'Prof. Johnson' }, isSurvey: true }
      ]);
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.fetch('/api/v1/student/improvement/sis').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/announcements').then(r => r.json()).catch(() => null),
    ]).then(([sisRes, annRes]) => {
      if (sisRes?.success) setSIS(sisRes.data);
      if (annRes?.success) setAnnouncements(annRes.data);
    }).finally(() => setLoading(false));
  }, [isDemo]);

  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-gray-body" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── WELCOME ── */}
      <div className="bg-transparent">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          
          {/* Welcome text + stats */}
          <div className="flex-1">
            <h2 className="text-3xl font-serif font-bold text-ink">{greeting}, {user.name?.split(' ')[0] ?? 'Student'}</h2>
            <p className="text-base mt-1" style={{ color: C.gray }}>Here is your overview for today.</p>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-transparent border-l-2 pl-4 py-1" style={{ borderColor: C.maroon }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: C.gray }}>Performance</p>
                <p className="text-2xl font-bold text-ink">{sis?.latestScore ?? 0}<span className="text-sm font-normal text-gray-body">%</span></p>
              </div>
              <div className="bg-transparent border-l-2 pl-4 py-1" style={{ borderColor: C.border }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: C.gray }}>Assessments</p>
                <p className="text-2xl font-bold text-ink">{sis?.attemptCount ?? 0}</p>
              </div>
              <div className="bg-transparent border-l-2 pl-4 py-1" style={{ borderColor: C.border }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: C.gray }}>Improvement</p>
                <p className="text-2xl font-bold" style={{ color: (sis?.trend ?? 0) >= 0 ? C.good : C.danger }}>
                  {(sis?.trend ?? 0) >= 0 ? '+' : ''}{sis?.trend ?? 0}%
                </p>
              </div>
            </div>
          </div>

          {/* SIS Ring */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <SISRing sis={sis?.sis ?? 0} insufficient={!sis || sis.insufficientData} />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.gray }}>Improvement Score</p>
              {sis && !sis.insufficientData && sis.trend !== 0 && (
                <span className="text-sm font-semibold mt-1 block" style={{ color: sis.trend > 0 ? C.good : C.danger }}>
                  {sis.trend > 0 ? `▲ +${sis.trend}` : `▼ ${sis.trend}`} pts vs last
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ANNOUNCEMENTS ── */}
      <div className="mt-8">
        <h3 className="text-lg font-serif font-bold text-ink mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" style={{ color: C.maroon }} />
          Announcements
        </h3>
        
        {announcements.length === 0 ? (
          <div className="py-8 text-center rounded-xl border border-dashed bg-cream/30" style={{ borderColor: C.border }}>
            <p className="text-sm" style={{ color: C.gray }}>No announcements for your batch right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 rounded-xl border bg-white shadow-sm flex gap-4 items-start" style={{ borderColor: C.border }}>
                <div className="p-2 rounded-lg shrink-0" style={{ background: C.creamEdge }}>
                  <Calendar className="w-5 h-5" style={{ color: C.maroon }} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-ink">{ann.title}</h4>
                    {ann.isSurvey && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: C.maroon, color: '#fff' }}>Survey</span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: C.gray }}>{ann.content}</p>
                  <p className="text-xs font-semibold mt-3" style={{ color: C.gray }}>
                    From {ann.faculty?.name} • {new Date(ann.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* ── EMPTY STATE for new students ── */}
      {!sis || sis.insufficientData ? (
        <div className="bg-cream/40 rounded-xl border border-dashed p-8 text-center mt-8" style={{ borderColor: C.border }}>
          <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: C.maroon, opacity: 0.4 }} />
          <h3 className="font-semibold text-ink mb-1">Your analytics will appear here</h3>
          <p className="text-sm" style={{ color: C.gray }}>
            Complete {sis ? `${3 - sis.attemptCount} more` : 'at least 3'} assessments to unlock your full improvement dashboard.
          </p>
        </div>
      ) : null}
    </div>
  );
}
