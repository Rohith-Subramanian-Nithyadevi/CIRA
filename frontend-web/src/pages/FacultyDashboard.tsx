import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import FacultyHome from '../components/dashboard/FacultyHome';
import UserProfile from '../components/dashboard/UserProfile';
import QuizManagement from '../components/dashboard/QuizManagement';
import { StudentReports } from '../components/dashboard/StudentReports';
import AssignmentManagement from '../components/dashboard/AssignmentManagement';
import FacultyStudentsDirectory from '../components/dashboard/FacultyStudentsDirectory';
import { Bell, BookOpen, FileText, Home, ListChecks, ScrollText, User, Users, UserRound, CheckSquare, Building2 } from 'lucide-react';
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
      { id: 'reports', label: 'Student Reports', icon: Users },
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
      { id: 'approvals', label: 'Faculty Approvals', icon: CheckSquare },
      { id: 'users', label: 'User Management', icon: Users },
      { id: 'departments', label: 'Departments', icon: Building2 },
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

  // For Admin role: show Administration, remove Assessments dock.
  // For Faculty role: show Assessments, remove Administration dock completely.
  const currentNavigation = useMemo(() => {
    if (isAdmin) {
      return facultyNavigation.filter((group) => group.label !== 'Assessments');
    }
    return facultyNavigation.filter((group) => group.label !== 'Administration');
  }, [isAdmin]);

  const currentAllowedTabs = useMemo(() => {
    const allowed = new Set(currentNavigation.flatMap((group) => group.items.map((item) => item.id)));
    if (isAdmin) {
      allowed.add('management');
      allowed.add('admin');
      allowed.add('faculty-approvals');
      allowed.add('user-directory');
      allowed.add('academic-structure');
    }
    return allowed;
  }, [currentNavigation, isAdmin]);

  const defaultTab = isAdmin ? 'approvals' : 'home';
  const rawTab = searchParams.get('tab') || defaultTab;
  const activeTab = currentAllowedTabs.has(rawTab) ? rawTab : defaultTab;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [paperSubmissionsId, setPaperSubmissionsId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && ['quizzes', 'assignments', 'question-bank', 'question-papers'].includes(rawTab)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'approvals');
      setSearchParams(nextParams, { replace: true });
      return;
    }
    if (!isAdmin && ['approvals', 'users', 'departments', 'management', 'admin', 'faculty-approvals', 'user-directory', 'academic-structure'].includes(rawTab)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('tab');
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
    <DashboardLayout
      title={
        activeTab === 'notifications'
          ? 'Notifications'
          : (activeTab === 'approvals' || activeTab === 'management' || activeTab === 'admin' || activeTab === 'faculty-approvals')
          ? 'Faculty Approvals'
          : (activeTab === 'users' || activeTab === 'user-directory')
          ? 'User Management'
          : (activeTab === 'departments' || activeTab === 'academic-structure')
          ? 'Departments'
          : 'Faculty Workspace'
      }
      activeTab={activeTab === 'admin' ? 'approvals' : activeTab === 'management' ? 'approvals' : activeTab}
      onTabChange={navigateFaculty}
      facultyNavigation={currentNavigation}
      onCommandPalette={() => setCommandPaletteOpen(true)}
      isDemo={isDemo}
      onToggleDemo={setIsDemo}
      facultySidebarCollapsible
    >
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'home' && <FacultyHome onNavigate={navigateFaculty} />}
      {activeTab === 'notifications' && <FacultyNotificationsPage />}
      {activeTab === 'reports' && <StudentReports />}
      {activeTab === 'students' && <FacultyStudentsDirectory />}
      {activeTab === 'quizzes' && <QuizManagement initialSubmissionsQuizId={paperSubmissionsId} />}
      {activeTab === 'assignments' && <AssignmentManagement />}
      {activeTab === 'question-bank' && <QuestionBank />}
      {(activeTab === 'approvals' || activeTab === 'management' || activeTab === 'admin' || activeTab === 'faculty-approvals') && (
        <FacultyManagement initialTab="approvals" onNavigateTab={navigateFaculty} />
      )}
      {(activeTab === 'users' || activeTab === 'user-directory') && (
        <FacultyManagement initialTab="users" onNavigateTab={navigateFaculty} />
      )}
      {(activeTab === 'departments' || activeTab === 'academic-structure') && (
        <FacultyManagement initialTab="departments" onNavigateTab={navigateFaculty} />
      )}
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
