import { useState, useEffect } from 'react';
import { Bell, Search, Calendar, MessageSquare, CheckCircle2, Send, Loader2, RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import DOMPurify from 'dompurify';
import { apiClient } from '@/lib/apiClient';

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

const sanitizeHtml = (value: string) => DOMPurify.sanitize(value || '', {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'ol', 'ul', 'li', 'a', 'p', 'br', 'span', 'h1', 'h2', 'h3', 'h4'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
});

export default function StudentAnnouncements({ isDemo }: { isDemo?: boolean }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'surveys' | 'targeted' | 'general' | 'dismissed'>('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);
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

  const [dismissedIds, setDismissedIds] = useState<string[]>(getDismissedIds);

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this announcement from your notices?')) return;
    const current = getDismissedIds();
    if (!current.includes(id)) {
      const updated = [...current, id];
      setDismissedIds(updated);
      localStorage.setItem(userStorageKey, JSON.stringify(updated));
      window.dispatchEvent(new Event('cira_announcements_updated'));
    }
  };

  const handleRestore = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const current = getDismissedIds();
    const updated = current.filter(dId => dId !== id);
    setDismissedIds(updated);
    localStorage.setItem(userStorageKey, JSON.stringify(updated));
    window.dispatchEvent(new Event('cira_announcements_updated'));
  };

  const handleRestoreAll = () => {
    if (!window.confirm('Restore all dismissed notices back to your active feed?')) return;
    setDismissedIds([]);
    localStorage.removeItem(userStorageKey);
    window.dispatchEvent(new Event('cira_announcements_updated'));
  };

  const fetchAnnouncements = async () => {
    if (isDemo) {
      setAnnouncements([
        {
          id: '1',
          title: 'Midterm schedule updated',
          content: '<p>The midterm for Data Structures has been moved to Friday. Please check the exam portal for exact room allocations and timings.</p>',
          date: new Date().toISOString(),
          faculty: { name: 'Dr. Smith' },
          isSurvey: false,
          audience: 'All Students'
        },
        {
          id: '2',
          title: 'Course Feedback Required',
          content: '<p>Please fill out the feedback survey for the recent module on Advanced Algorithms. Your input directly influences tutorial sessions.</p>',
          date: new Date(Date.now() - 86400000).toISOString(),
          faculty: { name: 'Prof. Johnson' },
          isSurvey: true,
          audience: 'Batch 2024 | Computer Science | Section A'
        },
        {
          id: '3',
          title: 'Guest Lecture: Scalable Systems in Production',
          content: '<p>Distinguished speaker from industry will cover distributed architectures on Tuesday at 4:00 PM in Main Auditorium.</p>',
          date: new Date(Date.now() - 2 * 86400000).toISOString(),
          faculty: { name: 'Dr. Emily Watson' },
          isSurvey: false,
          audience: 'Computer Science'
        }
      ]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.fetch('/api/v1/student/announcements');
      const data = await res.json();
      if (data?.success) {
        setAnnouncements(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    const handleSync = () => {
      setDismissedIds(getDismissedIds());
    };
    window.addEventListener('cira_announcements_updated', handleSync);
    return () => window.removeEventListener('cira_announcements_updated', handleSync);
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

  const activeAnnouncements = announcements.filter(a => !dismissedIds.includes(a.id));
  const dismissedAnnouncements = announcements.filter(a => dismissedIds.includes(a.id));

  const filteredAnnouncements = announcements.filter(ann => {
    // Dismissed filtering
    if (activeFilter === 'dismissed') {
      if (!dismissedIds.includes(ann.id)) return false;
    } else {
      if (dismissedIds.includes(ann.id)) return false;
    }

    // Search query filter
    const titleMatch = ann.title.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = ann.content.toLowerCase().includes(searchQuery.toLowerCase());
    const facultyMatch = (ann.faculty?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!titleMatch && !contentMatch && !facultyMatch) return false;

    // Type filter
    if (activeFilter === 'surveys') return ann.isSurvey;
    if (activeFilter === 'general') {
      const aud = (ann.audience || '').trim().toLowerCase();
      return aud === 'all' || aud === 'all students' || aud === 'all batches' || aud === '';
    }
    if (activeFilter === 'targeted') {
      const aud = (ann.audience || '').trim().toLowerCase();
      return aud !== 'all' && aud !== 'all students' && aud !== 'all batches' && aud !== '';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-border-soft p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-ink flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-maroon" />
              Announcements & Notices
            </h2>
            <p className="text-sm text-gray-body mt-1">
              Official circulars, class notices, and surveys targeted to your academic program.
            </p>
          </div>
          <button
            onClick={fetchAnnouncements}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-border-soft text-ink font-semibold rounded-lg hover:bg-cream/40 transition-colors text-sm w-fit cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-maroon ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter Bar */}
        <div className="mt-6 pt-6 border-t border-border-soft flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              All ({activeAnnouncements.length})
            </button>
            <button
              onClick={() => setActiveFilter('surveys')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === 'surveys'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              Surveys ({activeAnnouncements.filter(a => a.isSurvey).length})
            </button>
            <button
              onClick={() => setActiveFilter('targeted')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === 'targeted'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              Class Specific
            </button>
            <button
              onClick={() => setActiveFilter('general')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === 'general'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveFilter('dismissed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === 'dismissed'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              Dismissed ({dismissedAnnouncements.length})
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-gray-body absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-cream/30 border border-border-soft rounded-lg focus:outline-none focus:border-maroon"
            />
          </div>
        </div>
      </div>

      {/* Dismissed Filter Notice Banner */}
      {activeFilter === 'dismissed' && dismissedAnnouncements.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="font-bold">Viewing Dismissed Notices ({dismissedAnnouncements.length})</p>
            <p className="text-amber-800">These announcements were hidden from your dashboard. You can restore them to your active feed anytime.</p>
          </div>
          <button
            onClick={handleRestoreAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors shrink-0 w-fit cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore All
          </button>
        </div>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-border-soft">
          <Loader2 className="w-8 h-8 animate-spin text-maroon mb-2" />
          <p className="text-sm text-gray-body">Loading announcements...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-border-soft">
          <Bell className="w-10 h-10 mx-auto mb-3 text-maroon opacity-30" />
          <h3 className="font-bold text-ink text-base mb-1">
            {activeFilter === 'dismissed' ? 'No dismissed notices' : 'No announcements found'}
          </h3>
          <p className="text-sm text-gray-body">
            {activeFilter === 'dismissed'
              ? 'You have not dismissed or deleted any announcements.'
              : searchQuery
              ? `No announcements match "${searchQuery}".`
              : 'There are no notices posted for your class or batch right now.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAnnouncements.map((ann) => {
            const myResponse = ann.responses?.[0];
            const isResponding = respondingId === ann.id;
            const isDismissed = dismissedIds.includes(ann.id);

            return (
              <div
                key={ann.id}
                className={`p-6 rounded-xl border transition-all ${
                  ann.isSurvey
                    ? 'bg-gradient-to-br from-white to-maroon/[0.02] border-maroon/20 shadow-sm'
                    : 'bg-white border-border-soft shadow-sm hover:border-maroon/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-bold text-ink text-lg">{ann.title}</h3>
                      {ann.isSurvey && (
                        <span className="text-[10px] uppercase font-bold bg-maroon text-white px-2.5 py-0.5 rounded-full shadow-xs">
                          Survey
                        </span>
                      )}
                    </div>
                    {ann.audience && (
                      <span className="text-[10px] font-semibold text-gray-body uppercase border border-border-soft px-2 py-0.5 rounded bg-cream/60 inline-block">
                        Target: {ann.audience}
                      </span>
                    )}
                  </div>

                  {/* Header Actions: Date + Delete/Restore */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-gray-body">
                      <Calendar className="w-3.5 h-3.5 text-maroon" />
                      <span>{new Date(ann.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {isDismissed ? (
                      <button
                        onClick={(e) => handleRestore(ann.id, e)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-maroon hover:bg-maroon/10 border border-maroon/30 rounded-lg transition-colors cursor-pointer"
                        title="Restore notice"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleDismiss(ann.id, e)}
                        className="p-1.5 text-gray-body/60 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors cursor-pointer"
                        title="Delete notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div
                  className="text-sm leading-relaxed rich-text-content text-ink/85 my-4"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.content) || '<p>No content.</p>' }}
                />

                {/* Survey Response Form */}
                {ann.isSurvey && (
                  <div className="mt-4 pt-4 border-t border-border-soft/60">
                    {myResponse ? (
                      <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-xs flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-bold text-green-800 mb-0.5">Your Response:</p>
                          <p className="text-green-900">{myResponse.response}</p>
                          {myResponse.submittedAt && (
                            <p className="text-[10px] text-green-700/80 mt-1">
                              Submitted on {new Date(myResponse.submittedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : isResponding ? (
                      <div className="space-y-3 bg-cream/20 p-4 rounded-xl border border-border-soft">
                        <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-maroon" />
                          Provide Your Feedback / Response:
                        </p>
                        <textarea
                          rows={3}
                          placeholder="Type your feedback or survey answers here..."
                          className="w-full text-xs p-3 rounded-lg border border-border-soft focus:outline-none focus:border-maroon resize-none bg-white shadow-xs"
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setRespondingId(null); setResponseText(''); }}
                            className="px-3 py-1.5 text-xs text-gray-body hover:text-ink font-medium rounded-lg cursor-pointer"
                            disabled={submittingSurvey}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSurveySubmit(ann.id)}
                            disabled={submittingSurvey || !responseText.trim()}
                            className="px-4 py-1.5 bg-maroon hover:bg-maroon-deep text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {submittingSurvey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Submit Response
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRespondingId(ann.id); setResponseText(''); }}
                        className="px-4 py-1.5 bg-maroon/10 hover:bg-maroon/20 text-maroon text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Respond to Survey
                      </button>
                    )}
                  </div>
                )}

                {/* Footer metadata */}
                <div className="flex items-center justify-between border-t border-border-soft/60 pt-3 mt-3 text-xs text-gray-body">
                  <span>
                    Posted by <span className="font-semibold text-ink">{ann.faculty?.name || 'Faculty Member'}</span>
                  </span>
                  {isDismissed && (
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded">
                      Dismissed from your notices
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
