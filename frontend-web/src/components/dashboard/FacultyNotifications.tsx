import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, Bell, BookOpen, Check, ClipboardList, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { facultyDemoNotifications } from '@/lib/facultyDemoData';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/facultyPrimitives';

export type FacultyNotification = { id: string; type: string; message: string; createdAt: string; read: boolean; entityId?: string | null };
type ContextValue = { notifications: FacultyNotification[]; loading: boolean; error: string | null; refresh: () => Promise<void>; markRead: (id: string) => Promise<boolean>; navigateTo: (id: string) => void };
const Context = createContext<ContextValue | null>(null);
const endpoint = '/api/v1/faculty/dashboard/notifications';

export function FacultyNotificationsProvider({ children, isDemo, onNavigate }: { children: ReactNode; isDemo: boolean; onNavigate: (tab: string) => void }) {
  const [notifications, setNotifications] = useState<FacultyNotification[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setLoading(true); setError(null);
      if (isDemo) { setNotifications(facultyDemoNotifications); return; }
      const response = await apiClient.fetch(endpoint);
      const body = await response.json();
      if (!response.ok || body?.success !== true || !Array.isArray(body.data)) throw new Error(body?.message || 'Notifications could not be loaded.');
      setNotifications(body.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notifications could not be loaded.'); }
    finally { inFlight.current = false; setLoading(false); }
  }, [isDemo]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { void refresh(); }, 30000); return () => window.clearInterval(timer); }, [refresh]);
  const markRead = useCallback(async (id: string) => {
    if (isDemo) { setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item)); return true; }
    try {
      const response = await apiClient.fetch(`${endpoint}/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not mark notification as read.');
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item)); setError(null); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark notification as read.'); return false; }
  }, [isDemo]);
  const navigateTo = useCallback((id: string) => {
    const item = notifications.find((notification) => notification.id === id);
    if (!item) return;
    const destination = notificationMeta(item.type).destination;
    if (destination) onNavigate(destination);
  }, [notifications, onNavigate]);
  const value = useMemo(() => ({ notifications, loading, error, refresh, markRead, navigateTo }), [notifications, loading, error, refresh, markRead, navigateTo]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useFacultyNotifications = () => useContext(Context);

export const notificationMeta = (type: string) => {
  const normalized = type.toUpperCase();
  if (normalized.includes('ASSIGNMENT')) return { title: 'Assignment update', category: 'Assignment', destination: 'assignments', Icon: ClipboardList };
  if (normalized.includes('QUIZ') || normalized.includes('ASSESSMENT')) return { title: 'Assessment update', category: 'Assessment', destination: 'quizzes', Icon: BookOpen };
  if (normalized.includes('SURVEY') || normalized.includes('POLL') || normalized.includes('ANNOUNCEMENT')) return { title: 'Announcement response', category: 'Announcement', destination: 'home', Icon: MessageSquare };
  return { title: type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Notification', category: 'General', destination: null, Icon: Activity };
};

export function FacultyNotificationBell({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const state = useFacultyNotifications(); const [open, setOpen] = useState(false);
  if (!state) return null;
  const unread = state.notifications.filter((item) => !item.read).length;
  const openItem = async (item: FacultyNotification) => { const ok = item.read || await state.markRead(item.id); if (ok) { state.navigateTo(item.id); setOpen(false); } };
  return <div className="relative">
    <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-controls="faculty-notification-popover" onClick={() => { setOpen((value) => !value); if (!state.notifications.length) void state.refresh(); }} className="relative rounded-lg border border-border-soft bg-white p-2 text-gray-body hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 dark:bg-[#242124] dark:hover:bg-[#302b2f] dark:hover:text-cream">
      <Bell className="h-4 w-4" aria-hidden="true" />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full border-2 border-white bg-red-600 px-1 text-center text-[9px] font-bold leading-3 text-white dark:border-[#1A1A1A]">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <section id="faculty-notification-popover" role="region" aria-label="Recent notifications" className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border-soft bg-white shadow-lg dark:border-gray-700 dark:bg-[#1A1A1A]">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3"><div><h3 className="text-sm font-bold text-ink dark:text-white">Notifications</h3><p className="text-xs text-gray-body">{unread} unread</p></div><button type="button" aria-label="Refresh notifications" onClick={() => void state.refresh()} className="rounded p-1.5 text-gray-body hover:bg-cream"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /></button></div>
      {state.error && <ErrorState message={state.error} onRetry={state.refresh} className="m-3 min-h-20" />}
      {state.loading && !state.notifications.length ? <div role="status" className="flex items-center gap-2 p-5 text-sm text-gray-body"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div> : !state.notifications.length ? <div className="p-4"><EmptyState icon={<Bell className="h-6 w-6 text-maroon" />} title="No notifications" description="You're all caught up." className="min-h-28 p-3" /></div> : <div className="max-h-[60vh] divide-y divide-border-soft overflow-y-auto">{state.notifications.slice(0, 5).map((item) => { const meta = notificationMeta(item.type); const Icon = meta.Icon; return <article key={item.id} className={`flex gap-3 px-4 py-3 ${item.read ? '' : 'bg-cream/50 dark:bg-gray-800/60'}`}><Icon className="mt-0.5 h-4 w-4 shrink-0 text-maroon" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink dark:text-white">{meta.title}</p><p className="mt-0.5 text-xs text-gray-body">{item.message}</p><p className="mt-1 text-[10px] text-gray-body">{meta.category} · {new Date(item.createdAt).toLocaleString()}</p><div className="mt-2 flex gap-3">{meta.destination && <button type="button" onClick={() => void openItem(item)} className="text-xs font-semibold text-maroon underline">Open</button>}{!item.read && <button type="button" onClick={() => void state.markRead(item.id)} className="text-xs font-semibold text-gray-body underline">Mark read</button>}</div></div></article>; })}</div>}
      <div className="border-t border-border-soft p-3"><button type="button" onClick={() => { onNavigate('notifications'); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-maroon hover:bg-cream">View all notifications</button></div>
    </section>}
  </div>;
}

export function FacultyNotificationsPage() {
  const state = useFacultyNotifications(); const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  if (!state) return null;
  const visible = state.notifications.filter((item) => filter === 'ALL' || (filter === 'UNREAD' ? !item.read : item.read));
  const openItem = async (item: FacultyNotification) => { const ok = item.read || await state.markRead(item.id); if (ok) state.navigateTo(item.id); };
  return <section className="mx-auto w-full max-w-5xl space-y-5 rounded-xl border border-border-soft bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-[#1A1A1A]" aria-labelledby="notifications-page-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 id="notifications-page-title" className="font-serif text-2xl font-bold text-ink dark:text-white">Notifications</h1><p className="mt-1 text-sm text-gray-body">Updates from your faculty workflows.</p></div><Button variant="outline" onClick={() => void state.refresh()}><RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />Refresh</Button></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notifications">{(['ALL', 'UNREAD', 'READ'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${filter === value ? 'border-maroon bg-maroon text-white' : 'border-border-soft text-ink hover:bg-cream dark:text-cream'}`}>{value[0] + value.slice(1).toLowerCase()}</button>)}</div>
    {state.error && <ErrorState message={state.error} onRetry={state.refresh} />}
    {state.loading && !state.notifications.length ? <div role="status" className="flex items-center gap-2 p-8 text-sm text-gray-body"><Loader2 className="h-5 w-5 animate-spin" />Loading notifications…</div> : visible.length === 0 ? <EmptyState icon={<Bell className="h-8 w-8 text-maroon" />} title={state.notifications.length ? `No ${filter.toLowerCase()} notifications` : 'No notifications yet'} description={state.notifications.length ? 'Try another filter to see your notifications.' : 'New updates will appear here.'} /> : <div className="divide-y divide-border-soft">{visible.map((item) => { const meta = notificationMeta(item.type); const Icon = meta.Icon; return <article key={item.id} className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-start ${item.read ? '' : 'bg-cream/30 dark:bg-gray-800/40'} sm:px-3`}><div className="flex min-w-0 flex-1 gap-3"><div className="rounded-full bg-maroon/10 p-2 text-maroon"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-ink dark:text-white">{meta.title}</h2><span className="rounded-full border border-border-soft px-2 py-0.5 text-[10px] font-semibold text-gray-body">{meta.category}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.read ? 'bg-cream text-gray-body' : 'bg-maroon/10 text-maroon'}`}>{item.read ? 'Read' : 'Unread'}</span></div><p className="mt-1 break-words text-sm text-gray-body">{item.message}</p><time className="mt-2 block text-xs text-gray-body" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time><div className="mt-3 flex flex-wrap gap-4">{meta.destination && <button type="button" onClick={() => void openItem(item)} className="text-sm font-semibold text-maroon underline">Open workflow</button>}{!item.read && <button type="button" onClick={() => void state.markRead(item.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-body underline"><Check className="h-4 w-4" />Mark as read</button>}</div></div></div></article>; })}</div>}
  </section>;
}
