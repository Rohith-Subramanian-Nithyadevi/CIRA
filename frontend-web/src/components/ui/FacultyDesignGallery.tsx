import { useState } from 'react';
import { Bell, Users } from 'lucide-react';
import { EmptyState } from './EmptyState';
import {
  AccessibleDialog,
  ChartCard,
  ConfirmationDialog,
  ErrorState,
  FilterBar,
  LoadingState,
  ProgressIndicator,
  SearchInput,
  SectionHeader,
  StatCard,
  StatusBadge,
} from './facultyPrimitives';

export default function FacultyDesignGallery() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  return (
    <div className="min-h-screen space-y-8 bg-cream p-6 text-ink">
      <SectionHeader eyebrow="Faculty foundations" title="Design system gallery" description="Development-only preview of faculty primitives and data states." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Open tasks" value="12" description="From the faculty task endpoint" icon={<Bell className="h-5 w-5" />} />
        <StatCard label="Students" value="Unavailable" description="No aggregate endpoint confirmed" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Completion" value={<ProgressIndicator value={68} />} />
      </div>
      <FilterBar><SearchInput value={search} onChange={setSearch} /><StatusBadge status="info">Filtered</StatusBadge></FilterBar>
      <ChartCard title="Performance preview" description="Chart container only; no fabricated data."><EmptyState title="No chart data" description="Connect this panel to a verified faculty response." /></ChartCard>
      <div className="grid gap-4 md:grid-cols-3"><LoadingState /><ErrorState message="Example error state" onRetry={() => undefined} /><EmptyState title="No records" description="Example empty state" /></div>
      <div className="flex gap-3"><button type="button" onClick={() => setDialogOpen(true)} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white">Open dialog</button><button type="button" onClick={() => setConfirmOpen(true)} className="rounded-lg border border-border-soft px-4 py-2 text-sm font-semibold">Confirm action</button></div>
      <AccessibleDialog open={dialogOpen} title="Example dialog" onClose={() => setDialogOpen(false)}><p className="text-sm text-gray-body">This gallery is not imported by production routes.</p></AccessibleDialog>
      <ConfirmationDialog open={confirmOpen} title="Confirm example action" description="This is an isolated gallery fixture." onCancel={() => setConfirmOpen(false)} onConfirm={() => setConfirmOpen(false)} />
    </div>
  );
}
