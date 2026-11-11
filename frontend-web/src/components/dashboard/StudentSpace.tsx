import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, Bell, Loader2, ArrowRight, Trash2, X, MessageSquare, CheckCircle2, Send, Calendar } from 'lucide-react';
import DOMPurify from 'dompurify';
import { apiClient } from '@/lib/apiClient';
import StudyPlanner from '../student/StudyPlanner';

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
  isPoll?: boolean;
  pollOptions?: string[];
  pollStartsAt?: string | null;
  pollExpiresAt?: string | null;
  responses?: AnnouncementResponse[];
}

interface StudentSpaceProps {
  isDemo?: boolean;
  onNavigateTab?: (tab: string) => void;
}

// Color palette helper
const C = { maroon: '#9B2242', good: '#2A6B4A', danger: '#C13535', warn: '#C07820' };

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
        <circle cx="60" cy="60" r={r} fill="none" className="stroke-cream-edge dark:stroke-neutral-800" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" className="stroke-maroon dark:stroke-red-400" strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute text-center">
        {insufficient ? (
          <span className="text-xs text-gray-body dark:text-neutral-400 font-medium">No data</span>
        ) : (
          <>
            <div className="text-3xl font-bold text-ink dark:text-neutral-100 leading-none">{sis}</div>
            <div className="text-[10px] text-gray-body dark:text-neutral-400 font-semibold">/100</div>
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAnnouncement(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-gray-body dark:text-neutral-400" /></div>;
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-sm p-6 sm:p-8 w-full space-y-10 transition-colors duration-200">
      {/* ── WELCOME ── */}
      <div>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          
          {/* Welcome text + stats */}
          <div className="flex-1">
            <h2 className="text-3xl font-serif font-bold text-ink dark:text-neutral-100 mb-1">{greeting}, {user.name?.split(' ')[0] ?? 'Student'}</h2>
            <p className="text-base mb-8 text-gray-body dark:text-neutral-400">Here is your overview for today.</p>

            <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
              <div className="border-l-2 pl-4 py-1 border-maroon dark:border-red-400">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1 text-gray-body dark:text-neutral-400">Performance</p>
                <p className="text-2xl font-bold text-ink dark:text-neutral-100 leading-none">{sis?.latestScore ?? 0}<span className="text-sm font-normal text-gray-body dark:text-neutral-400 ml-0.5">%</span></p>
              </div>
              <div className="border-l-2 pl-4 py-1 border-border-soft dark:border-neutral-700">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1 text-gray-body dark:text-neutral-400">Assessments</p>
                <p className="text-2xl font-bold text-ink dark:text-neutral-100 leading-none">{sis?.attemptCount ?? 0}</p>
              </div>
              <div className="border-l-2 pl-4 py-1 border-border-soft dark:border-neutral-700">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1 text-gray-body dark:text-neutral-400">Improvement</p>
                <p className="text-2xl font-bold leading-none" style={{ color: (sis?.trend ?? 0) >= 0 ? C.good : C.danger }}>
                  {(sis?.trend ?? 0) >= 0 ? '+' : ''}{sis?.trend ?? 0}%
                </p>
              </div>
            </div>
          </div>

          {/* SIS Ring */}
          <div className="flex flex-col items-center shrink-0 bg-cream/30 dark:bg-neutral-900/40 p-6 rounded-2xl border border-cream-edge dark:border-neutral-800">
            <SISRing sis={sis?.sis ?? 0} insufficient={!sis || sis.insufficientData} />
            <div className="text-center mt-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-body dark:text-neutral-400">Improvement Score</p>
              {sis && !sis.insufficientData && sis.trend !== 0 && (
                <span className="text-sm font-semibold mt-1 block" style={{ color: sis.trend > 0 ? C.good : C.danger }}>
                  {sis.trend > 0 ? `▲ +${sis.trend}` : `▼ ${sis.trend}`} pts vs last
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-border-soft dark:bg-neutral-800" />

      {/* ── ANNOUNCEMENTS ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cream-edge/60 dark:bg-neutral-800 text-maroon dark:text-red-400 flex items-center justify-center">
              <Bell className="w-5 h-5 text-maroon dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-ink dark:text-neutral-100 leading-tight">Announcements & Notices</h3>
              <p className="text-xs text-gray-body dark:text-neutral-400">Recent updates and notices targeted for your class</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {announcements.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cream-edge/40 dark:bg-neutral-800 text-gray-body dark:text-neutral-300 border border-border-soft dark:border-neutral-700">
                {announcements.length} {announcements.length === 1 ? 'Notice' : 'Notices'}
              </span>
            )}
            {onNavigateTab && (
              <button 
                onClick={() => onNavigateTab('announcements')} 
                className="text-xs font-bold text-maroon dark:text-red-400 hover:text-maroon-deep dark:hover:text-red-300 flex items-center gap-1 group py-1 px-2.5 rounded-lg hover:bg-cream-edge/40 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
        
        {announcements.length === 0 ? (
          <div className="py-6 px-6 text-center rounded-xl border border-dashed border-border-soft dark:border-neutral-800 bg-cream/30 dark:bg-neutral-900/30 flex items-center justify-center gap-3">
            <Bell className="w-4 h-4 text-gray-body/50 dark:text-neutral-500" />
            <p className="text-sm font-medium text-gray-body dark:text-neutral-400">No announcements for your batch right now.</p>
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
                  className="group relative flex items-center justify-between gap-4 p-4 rounded-xl border border-border-soft dark:border-neutral-800 bg-white dark:bg-[#202020] hover:bg-cream/20 dark:hover:bg-neutral-800/60 hover:border-maroon/30 dark:hover:border-red-400/30 transition-all duration-150 shadow-xs cursor-pointer"
                >
                  {/* Left: Indicator + Title + Meta */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-maroon dark:bg-red-400 shadow-xs ring-4 ring-maroon/10 dark:ring-red-400/10" />
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink dark:text-neutral-100 text-sm group-hover:text-maroon dark:group-hover:text-red-400 transition-colors line-clamp-1">
                          {ann.title}
                        </span>

                        {ann.isSurvey && (
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            hasResponded ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-maroon text-white'
                          }`}>
                            {hasResponded ? 'Responded' : 'Survey'}
                          </span>
                        )}

                        {ann.audience && ann.audience !== 'ALL' && ann.audience !== 'All Students' && (
                          <span className="text-[10px] font-semibold text-gray-body dark:text-neutral-400 border border-border-soft dark:border-neutral-700 px-2 py-0.5 rounded-full bg-cream/60 dark:bg-neutral-800 truncate max-w-[200px]" title={ann.audience}>
                            {ann.audience}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-body dark:text-neutral-400 mt-1">
                        <span>From <strong className="text-ink/80 dark:text-neutral-200">{ann.faculty?.name || 'Faculty'}</strong></span>
                        <span className="text-gray-body/40 dark:text-neutral-600">•</span>
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
                      className="px-2.5 py-1 text-xs font-semibold text-gray-body dark:text-neutral-400 group-hover:text-maroon dark:group-hover:text-red-400 hover:bg-cream-edge/40 dark:hover:bg-neutral-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(ann.id, e)}
                      className="p-1.5 text-gray-body/60 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-transparent hover:border-red-100 transition-colors cursor-pointer"
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

      <div className="h-px w-full bg-border-soft dark:bg-neutral-800" />

      {/* ── THE WHOLE ACTION PLAN (EMBEDDED DIRECTLY) ── */}
      <div>
        <StudyPlanner />
      </div>

      {/* ── EMPTY STATE for new students ── */}
      {!sis || sis.insufficientData ? (
        <div className="bg-cream/40 dark:bg-neutral-900/40 rounded-xl border border-dashed border-border-soft dark:border-neutral-800 p-8 text-center mt-8">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-maroon dark:text-red-400 opacity-60" />
          <h3 className="font-semibold text-ink dark:text-neutral-100 mb-1">Your analytics will appear here</h3>
          <p className="text-sm text-gray-body dark:text-neutral-400">
            Complete {sis ? `${3 - sis.attemptCount} more` : 'at least 3'} assessments to unlock your full improvement dashboard.
          </p>
        </div>
      ) : null}

      {/* ── ANNOUNCEMENT DETAIL MODAL (PORTALED TO BODY, NO HEADER CLIPPING OR BLACKOUT) ── */}
      {selectedAnnouncement && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/15 dark:bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4 transition-all duration-200"
          onClick={() => setSelectedAnnouncement(null)}
          role="presentation"
        >
          <div 
            className="bg-white dark:bg-[#1E1E22] rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col border border-border-soft dark:border-neutral-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border-soft dark:border-neutral-800 flex items-start justify-between gap-4 bg-cream/30 dark:bg-neutral-900/60">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h3 className="font-bold font-serif text-lg text-ink dark:text-white leading-snug">
                    {selectedAnnouncement.title}
                  </h3>
                  {selectedAnnouncement.isSurvey && (
                    <span className="text-[10px] uppercase font-bold bg-maroon text-white px-2 py-0.5 rounded-full">
                      Survey
                    </span>
                  )}
                  {selectedAnnouncement.audience && (
                    <span className="text-[10px] font-semibold text-gray-body dark:text-neutral-300 border border-border-soft dark:border-neutral-700 px-2 py-0.5 rounded-md bg-white dark:bg-neutral-800">
                      {selectedAnnouncement.audience}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-body dark:text-neutral-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-maroon dark:text-rose-400" />
                    {new Date(selectedAnnouncement.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span>•</span>
                  <span>From <strong className="text-ink dark:text-neutral-200">{selectedAnnouncement.faculty?.name || 'Faculty Member'}</strong></span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAnnouncement(null)} 
                className="p-1.5 text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-white hover:bg-cream-edge/50 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-ink dark:text-neutral-200">
              <div 
                className="text-sm leading-relaxed text-ink/90 dark:text-neutral-200 rich-text-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedAnnouncement.content) || '<p>No content provided.</p>' }}
              />

              {/* Survey Section */}
              {selectedAnnouncement.isSurvey && (
                <div className="pt-4 border-t border-border-soft dark:border-neutral-800">
                  {selectedAnnouncement.responses?.[0] ? (
                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/60 text-xs flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-green-800 dark:text-green-300 mb-0.5">{selectedAnnouncement.isPoll ? 'Your Poll Response:' : 'Your Submitted Feedback:'}</p>
                        <p className="text-green-950 dark:text-green-200">{selectedAnnouncement.responses[0].response}</p>
                        {selectedAnnouncement.responses[0].submittedAt && (
                          <p className="text-[10px] text-green-700 dark:text-green-400 mt-1">
                            Submitted on {new Date(selectedAnnouncement.responses[0].submittedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-cream/20 dark:bg-neutral-900/40 p-4 rounded-xl border border-border-soft dark:border-neutral-800">
                      <p className="text-xs font-bold text-ink dark:text-neutral-200 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-maroon dark:text-rose-400" />
                        {selectedAnnouncement.isPoll ? 'Choose one option:' : 'Provide Your Feedback / Response:'}
                      </p>
                      {selectedAnnouncement.isPoll ? (
                        <div role="radiogroup" aria-label="Poll options" className="space-y-2">
                          {(selectedAnnouncement.pollOptions || []).map((option) => <label key={option} className="flex items-center gap-2 rounded-lg border border-border-soft bg-white p-3 text-sm">
                            <input type="radio" name={`poll-${selectedAnnouncement.id}`} value={option} checked={responseText === option} onChange={() => setResponseText(option)} />{option}
                          </label>)}
                        </div>
                      ) : <textarea
                        rows={3}
                        placeholder="Type your feedback or survey response here..."
                        className="w-full text-xs p-3 rounded-lg border border-border-soft dark:border-neutral-700 focus:outline-none focus:border-maroon resize-none bg-white dark:bg-[#25252A] text-ink dark:text-neutral-100 shadow-xs"
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                      />}
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
            <div className="p-4 border-t border-border-soft dark:border-neutral-800 bg-cream/10 dark:bg-neutral-900/40 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDismiss(selectedAnnouncement.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 rounded-lg transition-colors cursor-pointer"
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
                    className="px-3.5 py-1.5 text-xs font-semibold text-maroon dark:text-rose-400 hover:bg-cream-edge/30 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Go to Announcements Tab
                  </button>
                )}
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-ink dark:text-neutral-200 bg-white dark:bg-[#25252A] hover:bg-cream-edge/40 dark:hover:bg-neutral-800 border border-border-soft dark:border-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
