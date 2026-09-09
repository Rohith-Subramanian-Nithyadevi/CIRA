import { useState, useEffect } from 'react';
import { TrendingUp, Bell, Loader2, Calendar, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import DOMPurify from 'dompurify';
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

// Color palette (matches site)
const C = { maroon: '#9B2242', good: '#2A6B4A', danger: '#C13535', warn: '#C07820', gray: '#6B6560', ink: '#1A1A1A', border: '#E7DDD0', cream: '#FAF5EE', creamEdge: '#EFE5D8' };

const sanitizeHtml = (value: string) => DOMPurify.sanitize(value || '', {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'ol', 'ul', 'li', 'a', 'p', 'br', 'span', 'h1', 'h2', 'h3', 'h4'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
});

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

export default function StudentSpace({ isDemo }: { isDemo?: boolean }) {
  const [sis, setSIS] = useState<SISData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

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

    Promise.all([
      apiClient.fetch('/api/v1/student/improvement/sis').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/announcements').then(r => r.json()).catch(() => null),
    ]).then(([sisRes, annRes]) => {
      if (sisRes?.success) setSIS(sisRes.data);
      if (annRes?.success) setAnnouncements(annRes.data || []);
    }).finally(() => setLoading(false));
  }, [isDemo]);

  const handleSurveySubmit = async (announcementId: string) => {
    if (!responseText.trim()) return;
    setSubmittingSurvey(true);
    try {
      const res = await apiClient.fetch('/api/v1/student/announcements/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId, response: responseText.trim() })
      });
      const data = await res.json();
      if (data?.success) {
        setAnnouncements(prev => prev.map(ann => {
          if (ann.id === announcementId) {
            return {
              ...ann,
              responses: [{ response: responseText.trim(), submittedAt: new Date().toISOString() }]
            };
          }
          return ann;
        }));
        setRespondingId(null);
        setResponseText('');
      }
    } catch (err) {
      console.error('Failed to submit survey response:', err);
    } finally {
      setSubmittingSurvey(false);
    }
  };

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
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-serif font-bold text-ink flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: C.maroon }} />
            Announcements & Notices
          </h3>
          {announcements.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cream-edge/40 text-gray-body border border-border-soft">
              {announcements.length} {announcements.length === 1 ? 'Notice' : 'Notices'}
            </span>
          )}
        </div>
        
        {announcements.length === 0 ? (
          <div className="py-8 text-center rounded-xl border border-dashed bg-cream/30" style={{ borderColor: C.border }}>
            <p className="text-sm" style={{ color: C.gray }}>No announcements for your batch right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {announcements.map((ann) => {
              const myResponse = ann.responses?.[0];
              const isResponding = respondingId === ann.id;

              return (
                <div key={ann.id} className="p-5 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between" style={{ borderColor: C.border }}>
                  <div className="flex gap-4 items-start mb-3">
                    <div className="p-2 rounded-lg shrink-0 mt-0.5" style={{ background: C.creamEdge }}>
                      <Calendar className="w-5 h-5" style={{ color: C.maroon }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                        <h4 className="font-bold text-ink leading-tight text-base">{ann.title}</h4>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ann.isSurvey && (
                            <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: C.maroon, color: '#fff' }}>
                              Survey
                            </span>
                          )}
                          {ann.audience && ann.audience !== 'ALL' && ann.audience !== 'All Students' && (
                            <span className="text-[9px] font-semibold text-gray-body border px-1.5 py-0.5 rounded bg-cream/50 truncate max-w-[150px]" title={ann.audience}>
                              {ann.audience}
                            </span>
                          )}
                        </div>
                      </div>
                      <div 
                        className="text-sm leading-relaxed rich-text-content text-ink/80 my-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.content) || '<p>No announcement content.</p>' }}
                      />
                    </div>
                  </div>

                  {/* Survey Response Area */}
                  {ann.isSurvey && (
                    <div className="mt-2 pt-3 border-t border-border-soft/60">
                      {myResponse ? (
                        <div className="p-2.5 rounded-lg bg-green-50/80 border border-green-200/80 text-xs flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold text-green-800">Your Response: </span>
                            <span className="text-green-900">{myResponse.response}</span>
                          </div>
                        </div>
                      ) : isResponding ? (
                        <div className="space-y-2 mt-1">
                          <textarea
                            rows={2}
                            placeholder="Type your response here..."
                            className="w-full text-xs p-2 rounded-lg border border-border-soft focus:outline-none focus:border-maroon resize-none bg-white"
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setRespondingId(null); setResponseText(''); }}
                              className="px-2.5 py-1 text-xs text-gray-body hover:text-ink font-medium rounded"
                              disabled={submittingSurvey}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSurveySubmit(ann.id)}
                              disabled={submittingSurvey || !responseText.trim()}
                              className="px-3 py-1 bg-maroon hover:bg-maroon-deep text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm disabled:opacity-50"
                            >
                              {submittingSurvey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Submit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRespondingId(ann.id); setResponseText(''); }}
                          className="text-xs font-bold text-maroon hover:underline flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Submit Response
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-border-soft/60 pt-2.5 mt-2 text-xs font-medium" style={{ color: C.gray }}>
                    <span>From <span className="text-ink font-semibold">{ann.faculty?.name || 'Faculty'}</span></span>
                    <span>{new Date(ann.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
