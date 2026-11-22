import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import FacultyHome from '../components/dashboard/FacultyHome';
import UserProfile from '../components/dashboard/UserProfile';
import QuizManagement from '../components/dashboard/QuizManagement';
import { StudentReports } from '../components/dashboard/StudentReports';
import AssignmentManagement from '../components/dashboard/AssignmentManagement';
import FacultyStudentsDirectory from '../components/dashboard/FacultyStudentsDirectory';
import { Bell, BookOpen, FileText, Home, ListChecks, ScrollText, ShieldCheck, User, Users, UserRound } from 'lucide-react';
import type { DashboardNavGroup } from '../components/DashboardLayout';
import FacultyCommandPalette from '../components/dashboard/FacultyCommandPalette';
import { FacultyDemoProvider } from '../context/FacultyDemoContext';
import QuestionBank from '../components/dashboard/QuestionBank';
import QuestionPaperManagement from '../components/dashboard/QuestionPaperManagement';
import { FacultyNotificationsPage, FacultyNotificationsProvider } from '../components/dashboard/FacultyNotifications';
import FacultyManagement from '../components/dashboard/FacultyManagement';

const facultyNavigation: DashboardNavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'home', label: 'Overview', icon: Home },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Students',
    items: [
      { id: 'students', label: 'Student Directory', icon: UserRound },
      { id: 'reports', label: 'Student Reports', icon: Users, badge: 'Analytics' },
    ],
  },
  {
    label: 'Assessments',
    items: [
      { id: 'quizzes', label: 'Quizzes', icon: ListChecks },
      { id: 'assignments', label: 'Assignments', icon: FileText },
      { id: 'question-bank', label: 'Question Bank', icon: BookOpen },
      { id: 'question-papers', label: 'Question Papers', icon: ScrollText },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'management', label: 'Faculty Management', icon: ShieldCheck },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'My Profile', icon: User },
    ],
  },
];

export default function FacultyDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const isAdmin = user.role === 'ADMIN';

  // For Admin role: remove the entire Assessments dock (Quizzes, Assignments, Question Bank, Question Papers)
  const currentNavigation = useMemo(() => {
    if (isAdmin) {
      return facultyNavigation.filter((group) => group.label !== 'Assessments');
    }
    return facultyNavigation;
  }, [isAdmin]);

  const currentAllowedTabs = useMemo(() => {
    return new Set([
      ...currentNavigation.flatMap((group) => group.items.map((item) => item.id)),
      'admin'
    ]);
  }, [currentNavigation]);

  const defaultTab = isAdmin ? 'management' : 'home';
  const rawTab = searchParams.get('tab') || defaultTab;
  const activeTab = currentAllowedTabs.has(rawTab) ? rawTab : defaultTab;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [paperSubmissionsId, setPaperSubmissionsId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && ['quizzes', 'assignments', 'question-bank', 'question-papers'].includes(rawTab)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'management');
      setSearchParams(nextParams, { replace: true });
      return;
    }
    if (rawTab !== defaultTab && !currentAllowedTabs.has(rawTab)) {
      const nextParams = new URLSearchParams(searchParams);
      if (defaultTab === 'home') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', defaultTab);
      }
      setSearchParams(nextParams, { replace: true });
    }
  }, [rawTab, isAdmin, defaultTab, currentAllowedTabs, searchParams, setSearchParams]);

  const navigateFaculty = (tab: string) => {
    const nextTab = currentAllowedTabs.has(tab) ? tab : defaultTab;
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'home' && !isAdmin) {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }
    if (nextTab !== activeTab) {
      nextParams.delete('view');
      nextParams.delete('quizId');
      nextParams.delete('attemptId');
      nextParams.delete('assignmentId');
      setPaperSubmissionsId(null);
    }
    setSearchParams(nextParams);
  };

  return (
    <FacultyDemoProvider value={isDemo}>
    <>
    <FacultyNotificationsProvider isDemo={isDemo} onNavigate={navigateFaculty}>
    <DashboardLayout title={activeTab === 'notifications' ? 'Notifications' : (activeTab === 'management' || activeTab === 'admin') ? 'Faculty Management' : 'Faculty Workspace'} activeTab={activeTab === 'admin' ? 'management' : activeTab} onTabChange={navigateFaculty} facultyNavigation={currentNavigation} onCommandPalette={() => setCommandPaletteOpen(true)} isDemo={isDemo} onToggleDemo={setIsDemo} facultySidebarCollapsible>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'home' && <FacultyHome onNavigate={navigateFaculty} />}
      {activeTab === 'notifications' && <FacultyNotificationsPage />}
      {activeTab === 'reports' && <StudentReports />}
      {activeTab === 'students' && <FacultyStudentsDirectory />}
      {activeTab === 'quizzes' && <QuizManagement initialSubmissionsQuizId={paperSubmissionsId} />}
      {activeTab === 'assignments' && <AssignmentManagement />}
      {activeTab === 'question-bank' && <QuestionBank />}
      {(activeTab === 'management' || activeTab === 'admin') && <FacultyManagement />}
      {activeTab === 'question-papers' && <QuestionPaperManagement onSubmissions={(id) => {
        setPaperSubmissionsId(id);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', 'quizzes');
        nextParams.set('view', 'submissions');
        nextParams.set('quizId', id);
        nextParams.delete('attemptId');
        setSearchParams(nextParams);
      }} />}
    </DashboardLayout>
    </FacultyNotificationsProvider>
    <FacultyCommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onNavigate={navigateFaculty} />
    </>
    </FacultyDemoProvider>
  );
}
