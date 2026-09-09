import { useState, useEffect } from 'react';
import { Bell, Search, Calendar, MessageSquare, CheckCircle2, Send, Loader2, RefreshCw } from 'lucide-react';
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'surveys' | 'targeted' | 'general'>('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

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

  const filteredAnnouncements = announcements.filter(ann => {
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
            className="flex items-center gap-2 px-4 py-2 border border-border-soft text-ink font-semibold rounded-lg hover:bg-cream/40 transition-colors text-sm w-fit"
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              All ({announcements.length})
            </button>
            <button
              onClick={() => setActiveFilter('surveys')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeFilter === 'surveys'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              Surveys ({announcements.filter(a => a.isSurvey).length})
            </button>
            <button
              onClick={() => setActiveFilter('targeted')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeFilter === 'targeted'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              Class Specific
            </button>
            <button
              onClick={() => setActiveFilter('general')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeFilter === 'general'
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-cream-edge/30 text-gray-body hover:text-ink'
              }`}
            >
              General
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

      {/* Announcements List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-border-soft">
          <Loader2 className="w-8 h-8 animate-spin text-maroon mb-2" />
          <p className="text-sm text-gray-body">Loading announcements...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-border-soft">
          <Bell className="w-10 h-10 mx-auto mb-3 text-maroon opacity-30" />
          <h3 className="font-bold text-ink text-base mb-1">No announcements found</h3>
          <p className="text-sm text-gray-body">
            {searchQuery
              ? `No announcements match "${searchQuery}".`
              : 'There are no notices posted for your class or batch right now.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAnnouncements.map((ann) => {
            const myResponse = ann.responses?.[0];
            const isResponding = respondingId === ann.id;

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
                  <div className="flex items-center gap-1.5 text-xs text-gray-body shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(ann.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                            className="px-3 py-1.5 text-xs text-gray-body hover:text-ink font-medium rounded-lg"
                            disabled={submittingSurvey}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSurveySubmit(ann.id)}
                            disabled={submittingSurvey || !responseText.trim()}
                            className="px-4 py-1.5 bg-maroon hover:bg-maroon-deep text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                          >
                            {submittingSurvey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Submit Response
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRespondingId(ann.id); setResponseText(''); }}
                        className="px-4 py-1.5 bg-maroon/10 hover:bg-maroon/20 text-maroon text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
