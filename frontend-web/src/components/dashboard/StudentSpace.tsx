import { useState, useEffect } from 'react';
import { TrendingUp, Bell, Loader2, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface SISData {
  sis: number;
  components: { currentPerformance: number; improvement: number; topicMastery: number; consistency: number; recovery: number };
  insufficientData: boolean;
  attemptCount: number;
  trend: number;
  latestScore: number;
}

interface AnnouncementResponse {
  id?: string;
  response: string;
  submittedAt?: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  audience?: string;
  faculty?: { name?: string; email?: string } | null;
  isSurvey: boolean;
  responses?: AnnouncementResponse[];
}

interface StudentSpaceProps {
  isDemo?: boolean;
  onNavigateTab?: (tab: string) => void;
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

export default function StudentSpace({ isDemo, onNavigateTab }: StudentSpaceProps) {
  const [sis, setSIS] = useState<SISData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverviewData = () => {
    Promise.all([
      apiClient.fetch('/api/v1/student/improvement/sis').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/announcements').then(r => r.json()).catch(() => null),
    ]).then(([sisRes, annRes]) => {
      if (sisRes?.success) setSIS(sisRes.data);
      if (annRes?.success) setAnnouncements(annRes.data || []);
    }).finally(() => setLoading(false));
  };

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
        { id: '1', title: 'Midterm schedule updated', content: '<p>The midterm for Data Structures has been moved to Friday. Please check the portal for exact timings.</p>', date: new Date().toISOString(), faculty: { name: 'Dr. Smith' }, isSurvey: false, audience: 'All Students' },
        { id: '2', title: 'Course Feedback Required', content: '<p>Please fill out the feedback survey for the recent module on algorithms.</p>', date: new Date(Date.now() - 86400000).toISOString(), faculty: { name: 'Prof. Johnson' }, isSurvey: true, audience: 'Computer Science' }
      ]);
      setLoading(false);
      return;
    }

    fetchOverviewData();

    const handleUpdate = () => fetchOverviewData();
    window.addEventListener('cira_user_updated', handleUpdate);
    return () => window.removeEventListener('cira_user_updated', handleUpdate);
  }, [isDemo]);

  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-gray-body" /></div>;
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-8 w-full space-y-10" style={{ borderColor: C.border }}>
      {/* ── WELCOME ── */}
      <div>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          
          {/* Welcome text + stats */}
          <div className="flex-1">
            <h2 className="text-3xl font-serif font-bold text-ink mb-1">{greeting}, {user.name?.split(' ')[0] ?? 'Student'}</h2>
            <p className="text-base mb-8" style={{ color: C.gray }}>Here is your overview for today.</p>

            <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
              <div className="border-l-2 pl-4 py-1" style={{ borderColor: C.maroon }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: C.gray }}>Performance</p>
                <p className="text-2xl font-bold text-ink leading-none">{sis?.latestScore ?? 0}<span className="text-sm font-normal text-gray-body ml-0.5">%</span></p>
              </div>
              <div className="border-l-2 pl-4 py-1" style={{ borderColor: C.border }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: C.gray }}>Assessments</p>
                <p className="text-2xl font-bold text-ink leading-none">{sis?.attemptCount ?? 0}</p>
              </div>
              <div className="border-l-2 pl-4 py-1" style={{ borderColor: C.border }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: C.gray }}>Improvement</p>
                <p className="text-2xl font-bold leading-none" style={{ color: (sis?.trend ?? 0) >= 0 ? C.good : C.danger }}>
                  {(sis?.trend ?? 0) >= 0 ? '+' : ''}{sis?.trend ?? 0}%
                </p>
              </div>
            </div>
          </div>

          {/* SIS Ring */}
          <div className="flex flex-col items-center shrink-0 bg-cream/30 p-6 rounded-2xl border" style={{ borderColor: C.creamEdge }}>
            <SISRing sis={sis?.sis ?? 0} insufficient={!sis || sis.insufficientData} />
            <div className="text-center mt-4">
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

      <div className="h-px w-full" style={{ background: C.creamEdge }} />

      {/* ── ANNOUNCEMENTS ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cream-edge/60 text-maroon flex items-center justify-center">
              <Bell className="w-5 h-5" style={{ color: C.maroon }} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-ink leading-tight">Announcements & Notices</h3>
              <p className="text-xs text-gray-body">Recent updates and notices targeted for your class</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {announcements.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cream-edge/40 text-gray-body border border-border-soft">
                {announcements.length} {announcements.length === 1 ? 'Notice' : 'Notices'}
              </span>
            )}
            {onNavigateTab && (
              <button 
                onClick={() => onNavigateTab('announcements')} 
                className="text-xs font-bold text-maroon hover:text-maroon-deep flex items-center gap-1 group py-1 px-2.5 rounded-lg hover:bg-cream-edge/40 transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
        
        {announcements.length === 0 ? (
          <div className="py-6 px-6 text-center rounded-xl border border-dashed bg-cream/30 flex items-center justify-center gap-3" style={{ borderColor: C.border }}>
            <Bell className="w-4 h-4 text-gray-body/50" />
            <p className="text-sm font-medium" style={{ color: C.gray }}>No announcements for your batch right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {announcements.map((ann) => {
              const formattedDate = new Date(ann.date).toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric' 
              });
              const hasResponded = !!ann.responses?.[0];

              return (
                <div 
                  key={ann.id} 
                  onClick={() => onNavigateTab?.('announcements')}
                  className="group relative flex items-center justify-between gap-4 p-4 rounded-xl border bg-white hover:bg-cream/20 hover:border-maroon/30 transition-all duration-150 shadow-sm cursor-pointer"
                  style={{ borderColor: C.border }}
                >
                  {/* Left: Indicator + Title + Meta */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-maroon shadow-sm ring-4 ring-maroon/10" />
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink text-sm group-hover:text-maroon transition-colors line-clamp-1">
                          {ann.title}
                        </span>

                        {ann.isSurvey && (
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            hasResponded ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-maroon text-white'
                          }`}>
                            {hasResponded ? 'Responded' : 'Survey'}
                          </span>
                        )}

                        {ann.audience && ann.audience !== 'ALL' && ann.audience !== 'All Students' && (
                          <span className="text-[10px] font-semibold text-gray-body border border-border-soft px-2 py-0.5 rounded-full bg-cream/60 truncate max-w-[200px]" title={ann.audience}>
                            {ann.audience}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-body mt-1">
                        <span>From <strong className="text-ink/80">{ann.faculty?.name || 'Faculty'}</strong></span>
                        <span className="text-gray-body/40">•</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick action */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-body group-hover:text-maroon flex items-center gap-1 transition-colors">
                      View
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
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
