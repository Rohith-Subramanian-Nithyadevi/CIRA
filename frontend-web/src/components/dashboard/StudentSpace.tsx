import { useState, useEffect } from 'react';
import { TrendingUp, Bell, Loader2, ArrowRight, Trash2, X, MessageSquare, CheckCircle2, Send, Calendar } from 'lucide-react';
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

interface StudentSpaceProps {
  isDemo?: boolean;
  onNavigateTab?: (tab: string) => void;
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

export default function StudentSpace({ isDemo, onNavigateTab }: StudentSpaceProps) {
  const [sis, setSIS] = useState<SISData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const userStorageKey = `cira_dismissed_announcements_${user.id || 'default'}`;

  const getDismissedIds = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(userStorageKey) || '[]');
    } catch {
      return [];
    }
  };

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this announcement from your notices?')) return;
    const current = getDismissedIds();
    if (!current.includes(id)) {
      const updated = [...current, id];
      localStorage.setItem(userStorageKey, JSON.stringify(updated));
    }
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    if (selectedAnnouncement?.id === id) {
      setSelectedAnnouncement(null);
    }
    window.dispatchEvent(new Event('cira_announcements_updated'));
  };

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
        const updatedResponses = [{ response: responseText.trim(), submittedAt: new Date().toISOString() }];
        setAnnouncements(prev => prev.map(ann => {
          if (ann.id === announcementId) {
            return { ...ann, responses: updatedResponses };
          }
          return ann;
        }));
        if (selectedAnnouncement?.id === announcementId) {
          setSelectedAnnouncement(prev => prev ? { ...prev, responses: updatedResponses } : null);
        }
        setResponseText('');
      }
    } catch (err) {
      console.error('Failed to submit survey:', err);
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const fetchOverviewData = () => {
    Promise.all([
      apiClient.fetch('/api/v1/student/improvement/sis').then(r => r.json()).catch(() => null),
      apiClient.fetch('/api/v1/student/announcements').then(r => r.json()).catch(() => null),
    ]).then(([sisRes, annRes]) => {
      if (sisRes?.success) setSIS(sisRes.data);
      if (annRes?.success) {
        const dismissed = getDismissedIds();
        const active = (annRes.data || []).filter((a: any) => !dismissed.includes(a.id));
        setAnnouncements(active);
      }
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
      const demoAnn = [
        { id: '1', title: 'Midterm schedule updated', content: '<p>The midterm for Data Structures has been moved to Friday. Please check the portal for exact timings.</p>', date: new Date().toISOString(), faculty: { name: 'Dr. Smith' }, isSurvey: false, audience: 'All Students' },
        { id: '2', title: 'Course Feedback Required', content: '<p>Please fill out the feedback survey for the recent module on algorithms.</p>', date: new Date(Date.now() - 86400000).toISOString(), faculty: { name: 'Prof. Johnson' }, isSurvey: true, audience: 'Computer Science' }
      ];
      const dismissed = getDismissedIds();
      setAnnouncements(demoAnn.filter(a => !dismissed.includes(a.id)));
      setLoading(false);
      return;
    }

    fetchOverviewData();

    const handleUpdate = () => fetchOverviewData();
    window.addEventListener('cira_user_updated', handleUpdate);
    window.addEventListener('cira_announcements_updated', handleUpdate);
    return () => {
      window.removeEventListener('cira_user_updated', handleUpdate);
      window.removeEventListener('cira_announcements_updated', handleUpdate);
    };
  }, [isDemo]);

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
                  onClick={() => setSelectedAnnouncement(ann)}
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

                  {/* Right: Quick actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnouncement(ann);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-gray-body group-hover:text-maroon hover:bg-cream-edge/40 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(ann.id, e)}
                      className="p-1.5 text-gray-body/60 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
                      title="Delete notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

      {/* ── ANNOUNCEMENT DETAIL MODAL ── */}
      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedAnnouncement(null)}
          role="presentation"
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col border border-border-soft overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border-soft flex items-start justify-between gap-4 bg-cream/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h3 className="font-bold font-serif text-lg text-ink leading-snug">
                    {selectedAnnouncement.title}
                  </h3>
                  {selectedAnnouncement.isSurvey && (
                    <span className="text-[10px] uppercase font-bold bg-maroon text-white px-2 py-0.5 rounded-full">
                      Survey
                    </span>
                  )}
                  {selectedAnnouncement.audience && (
                    <span className="text-[10px] font-semibold text-gray-body border border-border-soft px-2 py-0.5 rounded-md bg-white">
                      {selectedAnnouncement.audience}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-body flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-maroon" />
                    {new Date(selectedAnnouncement.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span>•</span>
                  <span>From <strong className="text-ink">{selectedAnnouncement.faculty?.name || 'Faculty Member'}</strong></span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAnnouncement(null)} 
                className="p-1.5 text-gray-body hover:text-ink hover:bg-cream-edge/50 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div 
                className="text-sm leading-relaxed text-ink/90 rich-text-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedAnnouncement.content) || '<p>No content provided.</p>' }}
              />

              {/* Survey Section */}
              {selectedAnnouncement.isSurvey && (
                <div className="pt-4 border-t border-border-soft">
                  {selectedAnnouncement.responses?.[0] ? (
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-green-800 mb-0.5">Your Submitted Feedback:</p>
                        <p className="text-green-950">{selectedAnnouncement.responses[0].response}</p>
                        {selectedAnnouncement.responses[0].submittedAt && (
                          <p className="text-[10px] text-green-700 mt-1">
                            Submitted on {new Date(selectedAnnouncement.responses[0].submittedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-cream/20 p-4 rounded-xl border border-border-soft">
                      <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-maroon" />
                        Provide Your Feedback / Response:
                      </p>
                      <textarea
                        rows={3}
                        placeholder="Type your feedback or survey response here..."
                        className="w-full text-xs p-3 rounded-lg border border-border-soft focus:outline-none focus:border-maroon resize-none bg-white"
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSurveySubmit(selectedAnnouncement.id)}
                          disabled={submittingSurvey || !responseText.trim()}
                          className="px-4 py-1.5 bg-maroon hover:bg-maroon-deep text-white text-xs font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                        >
                          {submittingSurvey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Submit Response
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-soft bg-cream/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDismiss(selectedAnnouncement.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete from My Notices
              </button>
              <div className="flex items-center gap-2">
                {onNavigateTab && (
                  <button
                    onClick={() => {
                      setSelectedAnnouncement(null);
                      onNavigateTab('announcements');
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-maroon hover:bg-cream-edge/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Go to Announcements Tab
                  </button>
                )}
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-ink bg-white hover:bg-cream-edge/40 border border-border-soft rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
