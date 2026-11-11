import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import StudentProfileView from './StudentProfileView';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient, getApiErrorMessage } from '@/lib/apiClient';
import { useFacultyDemo } from '@/context/FacultyDemoContext';
import { facultyDemoDepartments, facultyDemoStudents } from '@/lib/facultyDemoData';

interface StudentRow {
  id: string;
  name: string;
  rollNumber: string | null;
  department: string;
  departmentId: string | null;
  year: number | null;
  section: string;
  sectionId: string | null;
}

interface FilterOptions {
  years: number[];
  departments: { id: string; name: string; batchId: string }[];
  sections: { id: string; name: string; departmentId: string }[];
}

const EMPTY_OPTIONS: FilterOptions = { years: [], departments: [], sections: [] };
const PAGE_SIZE = 20;

export default function FacultyStudentsDirectory() {
  const isDemo = useFacultyDemo();
  const [options, setOptions] = useState<FilterOptions>(EMPTY_OPTIONS);
  const [optionsLoading, setOptionsLoading] = useState(!isDemo);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [year, setYear] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');

  useEffect(() => {
    if (isDemo) {
      const demoOptions = facultyDemoDepartments.map((department) => ({
        id: department.id,
        name: department.name,
        batchId: department.batchId,
      }));
      setOptions({ years: [2024], departments: demoOptions, sections: facultyDemoDepartments.flatMap((department) => department.sections) });
      setOptionsLoading(false);
      setOptionsError(null);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (departmentId) params.set('departmentId', departmentId);
    setOptionsLoading(true);
    setOptionsError(null);
    apiClient.fetch(`/api/v1/faculty/students/filter-options?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => {
        if (!controller.signal.aborted) setOptions(json.data || EMPTY_OPTIONS);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setOptionsError(getApiErrorMessage(err, 'Could not load your assigned classes.'));
      })
      .finally(() => { if (!controller.signal.aborted) setOptionsLoading(false); });
    return () => controller.abort();
  }, [isDemo, year, departmentId, retry]);

  const filterKey = useMemo(() => JSON.stringify([year, departmentId, sectionId, search, page, isDemo]), [year, departmentId, sectionId, search, page, isDemo]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRows([]);
    setLoadedKey('');

    if (isDemo) {
      const filtered = facultyDemoStudents.filter((student) =>
        (!year || year === '2024') &&
        (!departmentId || student.departmentId === departmentId) &&
        (!sectionId || student.sectionId === sectionId) &&
        (!search || `${student.name} ${student.rollNumber}`.toLowerCase().includes(search.trim().toLowerCase()))
      );
      const start = (page - 1) * PAGE_SIZE;
      setRows(filtered.slice(start, start + PAGE_SIZE).map((student) => ({
        id: student.id, name: student.name, rollNumber: student.rollNumber,
        department: student.departmentName, departmentId: student.departmentId,
        year: 2024, section: student.sectionName, sectionId: student.sectionId,
      })));
      setTotalPages(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
      setLoadedKey(filterKey);
      setLoading(false);
      return () => controller.abort();
    }

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (year) params.set('year', year);
    if (departmentId) params.set('departmentId', departmentId);
    if (sectionId) params.set('sectionId', sectionId);
    if (search.trim()) params.set('search', search.trim());
    apiClient.fetch(`/api/v1/faculty/students?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        setRows(json.data?.students || []);
        setTotalPages(Math.max(1, json.data?.pagination?.pages || 1));
        setLoadedKey(filterKey);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(err, 'Could not load students.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filterKey, retry]);

  const resetFilters = () => { setYear(''); setDepartmentId(''); setSectionId(''); setSearch(''); setPage(1); };
  const handleResetPassword = async (student: StudentRow) => {
    if (resettingStudentId || isDemo) return;
    if (!window.confirm(`Send password reset instructions to ${student.name}?`)) return;
    setResettingStudentId(student.id);
    try {
      const response = await apiClient.fetch(`/api/v1/faculty/students/${student.id}/reset-password`, { method: 'POST' });
      const result = await response.json();
      toast.success(result.message || 'Password reset instructions sent.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not initiate the password reset.'));
    } finally {
      setResettingStudentId(null);
    }
  };

  if (profileStudentId) return <StudentProfileView studentId={profileStudentId} onBack={() => setProfileStudentId(null)} />;

  const visibleRows = loadedKey === filterKey ? rows : [];
  return (
    <div className="space-y-6 text-ink">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-maroon">Faculty workspace</p>
        <h1 className="mt-1 font-serif text-2xl font-bold">Students</h1>
        <p className="mt-1 text-sm text-gray-body">Browse students in your assigned classes and send secure reset instructions.</p>
      </div>

      <section className="rounded-2xl border border-border-soft bg-white p-4 shadow-sm md:p-5" aria-label="Student filters">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold text-gray-body">Year
            <select value={year} onChange={(event) => { setYear(event.target.value); setDepartmentId(''); setSectionId(''); setPage(1); }} disabled={optionsLoading || Boolean(optionsError)} className="h-10 w-full rounded-lg border border-border-soft bg-white px-3 text-sm text-ink disabled:opacity-60">
              <option value="">All assigned years</option>{options.years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-gray-body">Department
            <select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setSectionId(''); setPage(1); }} disabled={optionsLoading || Boolean(optionsError)} className="h-10 w-full rounded-lg border border-border-soft bg-white px-3 text-sm text-ink disabled:opacity-60">
              <option value="">All assigned departments</option>{options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-gray-body">Section
            <select value={sectionId} onChange={(event) => { setSectionId(event.target.value); setPage(1); }} disabled={!departmentId || optionsLoading || Boolean(optionsError)} className="h-10 w-full rounded-lg border border-border-soft bg-white px-3 text-sm text-ink disabled:opacity-60">
              <option value="">All assigned sections</option>{options.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-gray-body">Search students
            <span className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-body/70" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Name or roll number" className="h-10 w-full rounded-lg border border-border-soft bg-white pl-9 pr-3 text-sm text-ink placeholder:text-gray-body/70" /></span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {year && <button onClick={() => { setYear(''); setDepartmentId(''); setSectionId(''); setPage(1); }} className="inline-flex items-center gap-1 rounded-full border border-maroon/20 bg-cream px-3 py-1 text-xs font-semibold text-maroon">Year {year}<X className="h-3 w-3" /></button>}
          {departmentId && <button onClick={() => { setDepartmentId(''); setSectionId(''); setPage(1); }} className="inline-flex items-center gap-1 rounded-full border border-maroon/20 bg-cream px-3 py-1 text-xs font-semibold text-maroon">{options.departments.find((item) => item.id === departmentId)?.name || 'Department'}<X className="h-3 w-3" /></button>}
          {sectionId && <button onClick={() => { setSectionId(''); setPage(1); }} className="inline-flex items-center gap-1 rounded-full border border-maroon/20 bg-cream px-3 py-1 text-xs font-semibold text-maroon">Section {options.sections.find((item) => item.id === sectionId)?.name || sectionId}<X className="h-3 w-3" /></button>}
          {search.trim() && <button onClick={() => { setSearch(''); setPage(1); }} className="inline-flex items-center gap-1 rounded-full border border-maroon/20 bg-cream px-3 py-1 text-xs font-semibold text-maroon">Search: {search.trim()}<X className="h-3 w-3" /></button>}
          {(year || departmentId || sectionId || search) && <button onClick={resetFilters} className="ml-auto text-xs font-semibold text-gray-body underline">Clear filters</button>}
        </div>
      </section>

      {optionsError && <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-300"><span>{optionsError}</span><button onClick={() => setRetry((value) => value + 1)} className="inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" />Retry</button></div>}
      {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-300"><span>{error}</span><button onClick={() => setRetry((value) => value + 1)} className="inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" />Retry</button></div>}

      <section className="overflow-hidden rounded-2xl border border-border-soft bg-white shadow-sm" aria-label="Assigned students">
        {loading || optionsLoading ? <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-body"><Loader2 className="h-5 w-5 animate-spin text-maroon" />Loading students…</div> : error || optionsError ? null : visibleRows.length === 0 ? <EmptyState icon={<UserRound className="h-8 w-8 text-maroon" />} title="No students found" description="No students match these filters in your assigned classes." /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-cream/60 text-xs uppercase tracking-wide text-gray-body"><tr><th className="p-4">Student</th><th className="p-4">Roll number</th><th className="p-4">Department</th><th className="p-4">Year</th><th className="p-4">Section</th><th className="p-4">Actions</th></tr></thead>
              <tbody>{visibleRows.map((student) => <tr key={student.id} className="border-t border-border-soft hover:bg-cream/20"><td className="p-4 font-semibold">{student.name}</td><td className="p-4 text-gray-body">{student.rollNumber || '—'}</td><td className="p-4 text-gray-body">{student.department}</td><td className="p-4 text-gray-body">{student.year ?? '—'}</td><td className="p-4 text-gray-body">{student.section}</td><td className="p-4"><div className="flex items-center gap-2"><button onClick={() => setProfileStudentId(student.id)} className="rounded-lg border border-border-soft px-3 py-1.5 text-xs font-semibold hover:bg-cream">Profile</button><button onClick={() => handleResetPassword(student)} disabled={isDemo || resettingStudentId !== null} className="inline-flex min-w-28 items-center justify-center gap-1.5 rounded-lg bg-maroon px-3 py-1.5 text-xs font-semibold text-white hover:bg-maroon-deep disabled:cursor-not-allowed disabled:opacity-60">{resettingStudentId === student.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{resettingStudentId === student.id ? 'Sending…' : 'Reset password'}</button></div></td></tr>)}</tbody>
            </table></div>
            <div className="flex items-center justify-between border-t border-border-soft px-4 py-3 text-xs text-gray-body"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-lg border border-border-soft p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button aria-label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded-lg border border-border-soft p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
          </>
        )}
      </section>
    </div>
  );
}
