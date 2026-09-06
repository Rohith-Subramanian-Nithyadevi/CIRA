import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Search, 
  ChevronRight, 
  ChevronDown,
  GraduationCap,
  Check,
  ArrowLeft,
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Download,
  BookOpen,
  Lightbulb,
  Target,
  Users,
  TrendingUp,
  Info
} from 'lucide-react';
import { useBatches, useDepartments } from '../../hooks/useReferenceData';
import StudentProfileView from './StudentProfileView';
import { EmptyState } from '@/components/ui/EmptyState';

export const StudentReports = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token');

  // Shared Reference Data (cached with TanStack Query)
  const { batches } = useBatches();
  const { departments } = useDepartments();

  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  
  // Custom Batch Dropdown Popover state
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const batchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target as Node)) {
        setIsBatchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatch(batchId);
    setSelectedDept(null);
    setSelectedSection(null);
    setSelectedQuiz(null);
    setIsBatchDropdownOpen(false);
  };

  const handleResetToBatch = () => {
    setSelectedDept(null);
    setSelectedSection(null);
    setSelectedQuiz(null);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [searchedStudentId, setSearchedStudentId] = useState<string | null>(null);
  
  const [subjectFilter, setSubjectFilter] = useState<string>('All Subjects');

  // Auto-select initial batch once loaded from cache
  useEffect(() => {
    if (batches.length > 0 && !selectedBatch) {
      setSelectedBatch(batches[0].id);
    }
  }, [batches, selectedBatch]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostedQuizzes = async () => {
    try {
      const params = new URLSearchParams({ posted: 'true' });
      if (selectedDept) params.set('departmentId', selectedDept);
      if (selectedSection) params.set('sectionId', selectedSection);
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.data) setQuizzes(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPostedQuizzes();
  }, [selectedDept, selectedSection]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent, overrideRoll?: string) => {
    e.preventDefault();
    const queryRoll = (overrideRoll || searchTerm).trim();
    if (!queryRoll) return;

    try {
      setSearchLoading(true);
      setSearchError(null);

      const res = await fetch(`${baseUrl}/api/v1/faculty/students/search?rollNumber=${encodeURIComponent(queryRoll)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setSearchError(`No student matches roll number "${queryRoll}".`);
          setSearchedStudentId(null);
          return;
        }
        if (res.status === 403) {
          setSearchError(`Student "${queryRoll}" is outside your authorized department scope.`);
          setSearchedStudentId(null);
          return;
        }
        throw new Error(json.message || 'Error occurred while searching for student.');
      }

      if (json?.data?.student?.id) {
        setSearchedStudentId(json.data.student.id);
        setSearchError(null);
      }
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'Unable to connect to the search service.');
      setSearchedStudentId(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    // Extract headers dynamically from the first object
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add header row
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        // Escape quotes and wrap in quotes to handle commas in values
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // API-backed states for real performance band analytics
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [reportSubjects, setReportSubjects] = useState<string[]>([]);
  const [quizAnalytics, setQuizAnalytics] = useState<any>(null);
  const [quizAnalyticsLoading, setQuizAnalyticsLoading] = useState(false);
  const [quizAnalyticsError, setQuizAnalyticsError] = useState<string | null>(null);
  const [yearData, setYearData] = useState<any[]>([
    { band: 'Poor' },
    { band: 'Average' },
    { band: 'Excellent' }
  ]);
  const [deptData, setDeptData] = useState<any[]>([]);

  const fetchPerformanceBands = async () => {
    try {
      setReportsLoading(true);
      setReportsError(null);

      const params = new URLSearchParams();
      if (selectedBatch) params.append('batchId', selectedBatch);
      if (selectedDept) params.append('departmentId', selectedDept);
      if (selectedSection) params.append('sectionId', selectedSection);

      const res = await fetch(`${baseUrl}/api/v1/faculty/reports/performance-bands?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('You are not authorized to view reports for this selection.');
        }
        throw new Error('Failed to load performance analytics.');
      }

      const json = await res.json();
      if (json?.data) {
        setReportSummary(json.data.summary || null);
        setReportSubjects(json.data.subjects || []);
        if (json.data.yearData && json.data.yearData.length > 0) {
          setYearData(json.data.yearData);
        } else {
          setYearData([{ band: 'Poor' }, { band: 'Average' }, { band: 'Excellent' }]);
        }
        setDeptData(json.data.deptData || []);
      }
    } catch (err: any) {
      console.error(err);
      setReportsError(err.message || 'An error occurred while fetching report data.');
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatch || selectedDept) {
      fetchPerformanceBands();
    }
  }, [selectedBatch, selectedDept, selectedSection]);

  useEffect(() => {
    if (!selectedQuiz) {
      setQuizAnalytics(null);
      return;
    }

    const fetchQuizAnalytics = async () => {
      try {
        setQuizAnalyticsLoading(true);
        setQuizAnalyticsError(null);
        const res = await fetch(`${baseUrl}/api/v1/faculty/reports/quiz/${selectedQuiz}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load quiz analytics.');
        setQuizAnalytics(json.data || null);
      } catch (err: any) {
        setQuizAnalytics(null);
        setQuizAnalyticsError(err.message || 'Failed to load quiz analytics.');
      } finally {
        setQuizAnalyticsLoading(false);
      }
    };

    fetchQuizAnalytics();
  }, [selectedQuiz]);

  const activeDepartments = departments.filter(d => d.batchId === selectedBatch || !selectedBatch);
  const subjectsToShow = subjectFilter === 'All Subjects' ? reportSubjects : [subjectFilter];
  const selectedBatchName = batches.find(b => b.id === selectedBatch)?.name || 'your selected batch';
  const summaryPercentages = reportSummary?.percentages || { poor: 0, average: 0, excellent: 0 };
  const reportHasData = (reportSummary?.totalAttempts || 0) > 0;
  const primaryInsight = !reportHasData
    ? 'There are no completed quiz attempts in this scope yet.'
    : summaryPercentages.poor >= 40
      ? 'A large group is below 60%. Prioritise a targeted revision session and a short re-check assessment.'
      : summaryPercentages.excellent >= 50
        ? 'Most completed attempts are above 80%. Extend the strongest learners with application-level questions.'
        : 'The cohort is mixed. Use the topic and section views below to target support where it will have the most impact.';

  const quizDetails = useMemo(() => {
    if (!selectedDept || !selectedSection || !selectedQuiz) return null;
    
    const quizMetadata = quizzes.find(q => q.id === selectedQuiz);
    
    const analytics = quizAnalytics?.quiz?.id === selectedQuiz ? quizAnalytics : null;
    const pieData = [
      { name: 'Excellent (80+)', value: analytics?.distribution?.excellent || 0 },
      { name: 'Average (60-79)', value: analytics?.distribution?.average || 0 },
      { name: 'Needs support (<60)', value: analytics?.distribution?.poor || 0 },
    ];

    return {
      pieData,
      leaderboard: analytics?.leaderboard || [],
      topicAverages: analytics?.topicAverages || [],
      summary: analytics?.summary,
      title: quizMetadata?.title
    };
  }, [selectedDept, selectedSection, selectedQuiz, quizzes, quizAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-maroon" />
      </div>
    );
  }

  // RENDER STUDENT PROFILE
  if (searchedStudentId) {
    return (
      <StudentProfileView 
        studentId={searchedStudentId}
        onBack={() => { setSearchedStudentId(null); setSearchTerm(''); setSearchError(null); }}
      />
    );
  }

  return (
    <div className="text-ink">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        {/* Left: Enhanced Batch Dropdown and Breadcrumbs */}
        <div className="flex items-center flex-wrap gap-2 text-sm">
          {/* Custom Attractive Batch Dropdown */}
          <div className="relative" ref={batchDropdownRef}>
            <button
              type="button"
              onClick={() => setIsBatchDropdownOpen(prev => !prev)}
              className="flex items-center space-x-2.5 bg-white hover:bg-cream/70 border border-border-soft hover:border-maroon/50 shadow-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer group"
              title="Click to switch or return to any batch"
            >
              <div className="w-7 h-7 rounded-lg bg-maroon/10 text-maroon flex items-center justify-center group-hover:bg-maroon group-hover:text-white transition-colors">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-[10px] uppercase font-bold text-gray-body/70 tracking-wider leading-none">Batch</span>
                <span className="text-sm font-bold text-ink group-hover:text-maroon transition-colors leading-tight">
                  {batches.find(b => b.id === selectedBatch)?.name || 'Select Batch'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-body ml-1 transition-transform duration-200 ${isBatchDropdownOpen ? 'rotate-180 text-maroon' : ''}`} />
            </button>

            {/* Dropdown Menu Popover */}
            {isBatchDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-border-soft rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-body border-b border-border-soft/60 mb-1 flex items-center justify-between">
                  <span>Available Batches</span>
                  <span className="bg-cream text-maroon text-[10px] font-bold px-2 py-0.5 rounded-full border border-border-soft/60">
                    {batches.length}
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {batches.map(batch => {
                    const isCurrent = batch.id === selectedBatch;
                    return (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => handleSelectBatch(batch.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                          isCurrent 
                            ? 'bg-maroon text-white font-bold shadow-xs' 
                            : 'hover:bg-cream/80 text-ink font-medium'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <GraduationCap className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-maroon'}`} />
                          <span>{batch.name}</span>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Breadcrumbs */}
          {selectedDept && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-body/50 shrink-0" />
              <button
                type="button"
                onClick={() => { setSelectedSection(null); setSelectedQuiz(null); }}
                className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !selectedSection 
                    ? 'bg-maroon/10 text-maroon border border-maroon/20' 
                    : 'text-gray-body hover:text-maroon hover:bg-cream/70 border border-transparent hover:border-border-soft'
                }`}
                title="Return to Department"
              >
                {departments.find(d => d.id === selectedDept)?.name || 'Department'}
              </button>
            </>
          )}

          {selectedSection && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-body/50 shrink-0" />
              <button
                type="button"
                onClick={() => { setSelectedQuiz(null); }}
                className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !selectedQuiz 
                    ? 'bg-maroon/10 text-maroon border border-maroon/20' 
                    : 'text-gray-body hover:text-maroon hover:bg-cream/70 border border-transparent hover:border-border-soft'
                }`}
                title="Return to Section"
              >
                Section {departments.find(d => d.id === selectedDept)?.sections?.find((s: any) => s.id === selectedSection)?.name || selectedSection}
              </button>
            </>
          )}

          {selectedQuiz && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-body/50 shrink-0" />
              <span className="bg-maroon/10 text-maroon border border-maroon/20 px-3 py-1.5 rounded-xl text-xs font-bold truncate max-w-xs shadow-2xs">
                {quizzes.find(q => q.id === selectedQuiz)?.title || 'Quiz'}
              </span>
            </>
          )}
        </div>

        <div className="w-full md:w-80">
          <form onSubmit={handleSearch} className="relative w-full">
            <input
              type="text"
              placeholder="Search Roll No (e.g. CB.EN...)"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); if (searchError) setSearchError(null); }}
              className="w-full bg-white border border-border-soft rounded-lg pl-10 pr-10 py-2 focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm text-ink placeholder:text-gray-body/50"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-body/50" />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-maroon animate-spin" />
            )}
          </form>
          {searchError && (
            <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between animate-in fade-in shadow-sm">
              <div className="flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>{searchError}</span>
              </div>
              <button 
                onClick={() => setSearchError(null)} 
                className="text-gray-body hover:text-ink font-bold text-xs ml-2 cursor-pointer"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {!selectedDept && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <section className="overflow-hidden rounded-2xl border border-maroon/20 bg-[linear-gradient(120deg,#fffaf2_0%,#ffffff_55%,#f8eee7_100%)] shadow-sm">
            <div className="border-b border-maroon/10 px-6 py-5 md:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maroon">
                    <TrendingUp className="h-4 w-4" />
                    Faculty briefing
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-ink md:text-3xl">What is happening in {selectedBatchName}?</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-body">
                    This view summarises completed quiz attempts. Start with the reading below, then use departments and sections to locate the learners who need attention.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-body shadow-xs">
                  <Info className="h-4 w-4 text-maroon" />
                  {reportHasData ? 'Based on live evaluated attempts' : 'Waiting for evaluated attempts'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-maroon/10 md:grid-cols-4">
              {[
                { label: 'Average score', value: reportHasData ? `${reportSummary.averageScore}%` : '--', icon: Target, tone: 'text-maroon' },
                { label: 'Learners evaluated', value: reportHasData ? reportSummary.evaluatedStudents : '--', icon: Users, tone: 'text-emerald-700' },
                { label: 'Completed attempts', value: reportHasData ? reportSummary.totalAttempts : '--', icon: BookOpen, tone: 'text-amber-700' },
                { label: 'Need support', value: reportHasData ? `${summaryPercentages.poor}%` : '--', icon: AlertTriangle, tone: 'text-red-700' }
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="bg-white/75 px-4 py-4 md:px-6">
                  <Icon className={`mb-3 h-5 w-5 ${tone}`} />
                  <p className="text-2xl font-bold text-ink">{value}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-body">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 px-6 py-5 md:grid-cols-[1.2fr_1fr] md:px-8">
              <div className="rounded-xl border border-border-soft bg-white/75 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Lightbulb className="h-4 w-4 text-amber-600" />Plain-language reading</div>
                <p className="text-sm leading-6 text-gray-body">{primaryInsight}</p>
              </div>
              <div className="rounded-xl border border-border-soft bg-white/75 p-4">
                <p className="mb-3 text-sm font-bold text-ink">How to read the bands</p>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
                  <div className="rounded-lg bg-red-50 px-2 py-2 text-red-700"><strong className="block text-base">{summaryPercentages.poor}%</strong>Needs support<br />below 60</div>
                  <div className="rounded-lg bg-amber-50 px-2 py-2 text-amber-700"><strong className="block text-base">{summaryPercentages.average}%</strong>Developing<br />60 to 79</div>
                  <div className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-700"><strong className="block text-base">{summaryPercentages.excellent}%</strong>Ready<br />80 and above</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-maroon/10 px-6 py-4 text-xs text-gray-body md:flex-row md:items-center md:justify-between md:px-8">
              <span className="flex items-center gap-2"><Target className="h-4 w-4 text-maroon" />Recommended next step: {reportHasData ? 'open a department, then compare its sections' : 'publish and evaluate a quiz to begin the analysis'}.</span>
              <span className="font-semibold text-maroon">Counts are attempts, not unique questions</span>
            </div>
          </section>

          <h2 className="text-xl font-serif font-bold text-ink">Department Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeDepartments.map(dept => (
              <div 
                key={dept.id} 
                onClick={() => setSelectedDept(dept.id)}
                className="bg-white border border-border-soft rounded-xl p-6 hover:border-maroon/40 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-sm"
              >
                <h3 className="text-lg font-bold text-ink mb-1">{dept.name}</h3>
                <p className="text-xs text-gray-body mb-4">Click to view section details</p>
                <div className="flex items-center justify-between border-t border-border-soft pt-3 text-xs">
                  <span className="text-gray-body">Completed attempts</span>
                  <span className="font-bold text-maroon">{reportHasData ? reportSummary.totalAttempts : '--'}</span>
                </div>
              </div>
            ))}
            {activeDepartments.length === 0 && (
              <div className="col-span-3">
                <EmptyState icon={<GraduationCap className="w-8 h-8 text-maroon" />} title="No Departments" description="No departments found for this batch." />
              </div>
            )}
          </div>

          <div className="bg-white border border-border-soft rounded-xl p-6 mt-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-serif font-bold text-ink">Subject Performance by Band</h3>
              <div className="flex items-center space-x-3">
                <select 
                  value={subjectFilter}
                  onChange={e => setSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 border border-border-soft rounded-lg text-sm bg-white font-medium text-ink focus:border-maroon outline-none"
                >
                  <option value="All Subjects">All Subjects</option>
                  {reportSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <button
                  onClick={() => exportToCSV(yearData, `subject_performance_${selectedBatch}`)}
                  disabled={reportsLoading || yearData.length === 0}
                  className="p-1.5 text-gray-body hover:text-maroon border border-border-soft rounded-lg hover:bg-cream transition-colors disabled:opacity-50"
                  title="Export to CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="h-80">
              {reportsLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-maroon" />
                  <p className="text-xs text-gray-body font-medium animate-pulse">Loading performance analytics...</p>
                </div>
              ) : reportsError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                  <p className="text-sm font-semibold text-ink mb-1">{reportsError}</p>
                  <button
                    onClick={fetchPerformanceBands}
                    className="mt-3 px-3 py-1.5 bg-maroon text-white text-xs font-semibold rounded-lg hover:bg-maroon-dark transition-colors flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : reportSubjects.length === 0 || (subjectFilter !== 'All Subjects' && !reportSubjects.includes(subjectFilter)) ? (
                <EmptyState icon={<AlertTriangle className="w-8 h-8 text-maroon" />} title="No evaluated data" description="Complete and evaluate a quiz in this scope to populate subject performance." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={30}>
                    <defs>
                      <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9B2242" stopOpacity={1}/><stop offset="100%" stopColor="#8A1E3A" stopOpacity={0.85}/></linearGradient>
                      <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E8D6B8" stopOpacity={1}/><stop offset="100%" stopColor="#C8B698" stopOpacity={0.85}/></linearGradient>
                      <linearGradient id="grad3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5E3D2" stopOpacity={1}/><stop offset="100%" stopColor="#E3D1C0" stopOpacity={0.85}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} opacity={0.6} />
                    <XAxis dataKey="band" stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--gray-body)' }} />
                    <YAxis stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                    <RechartsTooltip cursor={{ fill: 'var(--cream)', opacity: 0.3 }} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ fontWeight: 'bold', color: 'var(--ink)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: 12, fill: 'var(--ink)' }} />
                    
                    {subjectsToShow.slice(0, 3).map((sub, i) => (
                      <Bar key={sub} dataKey={sub} fill={`url(#grad${(i % 3) + 1})`} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDept && !selectedSection && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
             <div>
               <h2 className="text-xl font-serif font-bold text-ink">Section Overview</h2>
               <p className="text-xs text-gray-body mt-0.5">
                 {departments.find(d => d.id === selectedDept)?.name} &bull; Batch {batches.find(b => b.id === selectedBatch)?.name}
               </p>
             </div>
             <button
               type="button"
               onClick={handleResetToBatch}
               className="inline-flex items-center space-x-1.5 text-xs font-bold text-gray-body hover:text-maroon bg-white hover:bg-cream/70 border border-border-soft hover:border-maroon/30 px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer self-start sm:self-auto"
               title="Return to Batch Overview"
             >
               <ArrowLeft className="w-3.5 h-3.5" />
               <span>Back to Batch Overview</span>
             </button>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             {departments.find(d => d.id === selectedDept)?.sections?.map((sec: any) => (
                <div 
                  key={sec.id} 
                  onClick={() => setSelectedSection(sec.id)}
                  className="bg-white border border-border-soft rounded-xl p-5 hover:border-maroon/40 cursor-pointer transition-all flex items-center justify-between shadow-sm"
                >
                  <span className="text-base font-semibold text-ink">Section {sec.name}</span>
                  <ChevronRight className="w-5 h-5 text-gray-body" />
                </div>
             ))}
           </div>
           
           <div className="bg-white border border-border-soft rounded-xl p-6 mt-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-serif font-bold text-ink">Performance by Section</h3>
              <button
                onClick={() => exportToCSV(deptData, `section_performance_${selectedDept}`)}
                disabled={reportsLoading || deptData.length === 0}
                className="p-1.5 text-gray-body hover:text-maroon border border-border-soft rounded-lg hover:bg-cream transition-colors disabled:opacity-50"
                title="Export to CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div className="h-72 mt-4">
              {reportsLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-maroon" />
                  <p className="text-xs text-gray-body font-medium animate-pulse">Loading section analytics...</p>
                </div>
              ) : reportsError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                  <p className="text-sm font-semibold text-ink mb-1">{reportsError}</p>
                  <button
                    onClick={fetchPerformanceBands}
                    className="mt-3 px-3 py-1.5 bg-maroon text-white text-xs font-semibold rounded-lg hover:bg-maroon-dark transition-colors flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : deptData.length === 0 ? (
                <EmptyState icon={<AlertTriangle className="w-8 h-8 text-maroon" />} title="No Sections" description="No sections found for this department." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={40}>
                    <defs>
                      <linearGradient id="secExcellent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="secAverage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#D97706" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="secPoor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#DC2626" stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} opacity={0.6} />
                    <XAxis dataKey="name" stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--gray-body)' }} />
                    <YAxis stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                    <RechartsTooltip cursor={{ fill: 'var(--cream)', opacity: 0.3 }} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ fontWeight: 'bold', color: 'var(--ink)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: 12 }} />
                    <Bar dataKey="Excellent" stackId="a" fill="url(#secExcellent)" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Average" stackId="a" fill="url(#secAverage)" />
                    <Bar dataKey="Poor" stackId="a" fill="url(#secPoor)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedSection && !selectedQuiz && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
             <div>
               <h2 className="text-xl font-serif font-bold text-ink">Recent Assessments</h2>
               <p className="text-xs text-gray-body mt-0.5">
                 {departments.find(d => d.id === selectedDept)?.name} &bull; Section {departments.find(d => d.id === selectedDept)?.sections?.find((s: any) => s.id === selectedSection)?.name || selectedSection}
               </p>
             </div>
             <div className="flex items-center space-x-2 self-start sm:self-auto">
               <button
                 type="button"
                 onClick={() => setSelectedSection(null)}
                 className="inline-flex items-center space-x-1.5 text-xs font-bold text-gray-body hover:text-maroon bg-white hover:bg-cream/70 border border-border-soft hover:border-maroon/30 px-3 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
               >
                 <ArrowLeft className="w-3.5 h-3.5" />
                 <span>Back to Sections</span>
               </button>
               <button
                 type="button"
                 onClick={handleResetToBatch}
                 className="inline-flex items-center space-x-1.5 text-xs font-bold text-gray-body hover:text-maroon bg-white hover:bg-cream/70 border border-border-soft hover:border-maroon/30 px-3 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
               >
                 <span>Batch Overview</span>
               </button>
             </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {quizzes.map(quiz => (
                <div 
                  key={quiz.id} 
                  onClick={() => setSelectedQuiz(quiz.id)}
                  className="bg-white border border-border-soft rounded-xl p-6 hover:border-maroon/40 cursor-pointer transition-all shadow-sm group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/5 rounded-full blur-3xl group-hover:bg-maroon/10 transition-all"></div>
                  <h3 className="text-lg font-bold text-ink mb-1 relative z-10">{quiz.title}</h3>
                  <p className="text-xs text-gray-body mb-4 relative z-10">Conducted on {new Date(quiz.createdAt).toLocaleDateString()}</p>
                  <div className="flex items-center text-maroon text-xs font-bold relative z-10">
                    View detailed analytics <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
             ))}
             {quizzes.length === 0 && (
               <div className="col-span-full">
                 <EmptyState
                   icon={<BookOpen className="w-8 h-8 text-maroon" />}
                   title="No assessments posted here"
                   description="This department or section has no posted quizzes. Drafts and assessments assigned to other departments are excluded."
                 />
               </div>
             )}
           </div>
        </div>
      )}

      {selectedQuiz && quizDetails && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="text-xl font-serif font-bold text-ink">{quizDetails.title}</h2>
              <p className="text-xs text-gray-body mt-0.5">
                Detailed assessment analytics, topic strengths & leaderboard
              </p>
              {quizDetails.summary && (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-gray-body">
                  <span className="rounded-lg border border-border-soft bg-white px-3 py-1.5">Attended: {quizDetails.summary.attended}</span>
                  <span className="rounded-lg border border-border-soft bg-white px-3 py-1.5">Evaluated: {quizDetails.summary.evaluated}</span>
                  <span className="rounded-lg border border-border-soft bg-white px-3 py-1.5">Average: {quizDetails.summary.averageScore}%</span>
                </div>
              )}
              {quizAnalyticsError && <p className="mt-3 text-xs font-semibold text-red-700">{quizAnalyticsError}</p>}
            </div>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSelectedQuiz(null)}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-gray-body hover:text-maroon bg-white hover:bg-cream/70 border border-border-soft hover:border-maroon/30 px-3 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Assessments</span>
              </button>
              <button
                type="button"
                onClick={handleResetToBatch}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-gray-body hover:text-maroon bg-white hover:bg-cream/70 border border-border-soft hover:border-maroon/30 px-3 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <span>Batch Overview</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-border-soft rounded-xl p-6 lg:col-span-1 shadow-sm">
              <h3 className="text-base font-bold text-ink mb-4 text-center font-serif">Score Distribution</h3>
              <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="pieGrad0" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="pieGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#D97706" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="pieGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#DC2626" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <Pie
                      data={quizDetails.pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                    >
                      {quizDetails.pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#pieGrad${index % 3})`} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ color: 'var(--ink)', fontWeight: 'bold' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-border-soft rounded-xl p-6 lg:col-span-2 shadow-sm">
               <h3 className="text-base font-bold text-ink mb-6 font-serif">Topic-wise Class Average</h3>
               <div className="h-64 mt-2">
                {quizAnalyticsLoading ? (
                  <div className="flex h-full items-center justify-center text-xs font-semibold text-gray-body"><Loader2 className="mr-2 h-4 w-4 animate-spin text-maroon" />Loading topic analysis...</div>
                ) : quizDetails.topicAverages.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-8 text-center text-xs text-gray-body">Topic averages will appear after responses have been marked and the questions include topic labels.</div>
                ) : <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quizDetails.topicAverages} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }} barSize={24}>
                    <defs>
                      <linearGradient id="barGood" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.85}/>
                        <stop offset="100%" stopColor="#10B981" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="barAvg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#D97706" stopOpacity={0.85}/>
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="barPoor" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#DC2626" stopOpacity={0.85}/>
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" horizontal={false} opacity={0.6} />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--gray-body)' }} />
                    <YAxis dataKey="topic" type="category" stroke="var(--gray-body)" axisLine={false} tickLine={false} tick={{ fill: 'var(--ink)', fontSize: 11 }} />
                    <RechartsTooltip cursor={{fill: 'var(--cream)', opacity: 0.3}} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-soft)', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} itemStyle={{ fontWeight: 'bold', color: 'var(--ink)' }} />
                    <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                      {quizDetails.topicAverages.map((entry: { avg: number }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.avg < 60 ? 'url(#barPoor)' : entry.avg < 75 ? 'url(#barAvg)' : 'url(#barGood)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-border-soft rounded-xl p-6 lg:col-span-2 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-ink font-serif">Class Leaderboard</h3>
                <button
                  onClick={() => exportToCSV(quizDetails.leaderboard, `class_leaderboard_${selectedQuiz}`)}
                  disabled={!quizDetails.leaderboard || quizDetails.leaderboard.length === 0}
                  className="p-1.5 text-gray-body hover:text-maroon border border-border-soft rounded-lg hover:bg-cream transition-colors disabled:opacity-50"
                  title="Export Leaderboard to CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className="text-xs text-gray-body uppercase bg-cream-edge/40 border-b border-border-soft">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Roll Number</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 rounded-tr-lg font-semibold">Band</th>
                      <th className="px-4 py-3 font-semibold">Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizAnalyticsLoading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-body"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-maroon" />Loading attended students...</td></tr>
                    ) : quizDetails.leaderboard.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-body">No submitted or evaluated student attempts were found for this assessment.</td></tr>
                    ) : quizDetails.leaderboard.map((student: any, idx: number) => (
                      <tr 
                        key={student.roll} 
                        onClick={() => { setSearchTerm(student.roll); handleSearch({preventDefault: () => {}} as React.FormEvent, student.roll); }}
                        className="border-b border-border-soft hover:bg-cream/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-maroon text-xs font-semibold">{student.roll}</td>
                        <td className="px-4 py-3 text-gray-body">{student.name}</td>
                        <td className="px-4 py-3 text-ink font-semibold">{student.score}%</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            student.band === 'Excellent' ? 'bg-green-50/10 text-green-700 border-green-200' :
                            student.band === 'Average' ? 'bg-yellow-50/10 text-yellow-700 border-yellow-200' :
                            'bg-red-50/10 text-red-700 border-red-200'
                          }`}>
                            {student.band}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-body">{student.status === 'EVALUATED' ? 'Evaluated' : 'Submitted'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-ink mb-4 flex items-center font-serif"><AlertTriangle className="w-5 h-5 text-yellow-600 mr-2"/> Actionable Insights</h3>
              <div className="space-y-4">
                {quizAnalyticsLoading ? (
                  <div className="rounded-xl border border-border-soft bg-cream/30 p-4 text-xs text-gray-body">Preparing insights from attended student responses...</div>
                ) : quizDetails.topicAverages.filter((t: { avg: number }) => t.avg < 65).length > 0 ? (
                  quizDetails.topicAverages.filter((t: { avg: number }) => t.avg < 65).map((weakTopic: { topic: string; avg: number }) => (
                    <div key={weakTopic.topic} className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <h4 className="text-red-700 font-bold text-sm mb-1">Low Performance in {weakTopic.topic}</h4>
                      <p className="text-gray-body text-xs leading-relaxed">Class average is {weakTopic.avg}%. Consider scheduling a remedial session for this topic.</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-cream/40 border border-border-soft rounded-xl p-4">
                    <h4 className="text-ink font-bold text-sm mb-1">No weak topics detected</h4>
                    <p className="text-gray-body text-xs leading-relaxed">This is based only on marked responses with topic labels.</p>
                  </div>
                )}
                <button className="w-full mt-4 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full transition-all font-bold text-xs shadow-sm hover:scale-105 active:scale-95">
                  Generate Remedial Assignments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
