import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FacultyHome from '../components/dashboard/FacultyHome';
import UserProfile from '../components/dashboard/UserProfile';
import QuizManagement from '../components/dashboard/QuizManagement';
import { StudentReports } from '../components/dashboard/StudentReports';
import AssignmentManagement from '../components/dashboard/AssignmentManagement';
import FacultyStudentsDirectory from '../components/dashboard/FacultyStudentsDirectory';
import { Bell, BookOpen, FileText, Home, ListChecks, ScrollText, User, Users, UserRound } from 'lucide-react';
import type { DashboardNavGroup } from '../components/DashboardLayout';
import FacultyCommandPalette from '../components/dashboard/FacultyCommandPalette';
import { FacultyDemoProvider } from '../context/FacultyDemoContext';
import QuestionBank from '../components/dashboard/QuestionBank';
import QuestionPaperManagement from '../components/dashboard/QuestionPaperManagement';
import { FacultyNotificationsPage, FacultyNotificationsProvider } from '../components/dashboard/FacultyNotifications';

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
    label: 'Account',
    items: [
      { id: 'profile', label: 'My Profile', icon: User },
    ],
  },
];

const allowedFacultyTabs = new Set(facultyNavigation.flatMap((group) => group.items.map((item) => item.id)));

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [paperSubmissionsId, setPaperSubmissionsId] = useState<string | null>(null);
  const navigateFaculty = (tab: string) => setActiveTab(allowedFacultyTabs.has(tab) ? tab : 'home');

  return (
    <FacultyDemoProvider value={isDemo}>
    <>
    <FacultyNotificationsProvider isDemo={isDemo} onNavigate={navigateFaculty}>
    <DashboardLayout title={activeTab === 'notifications' ? 'Notifications' : 'Faculty Workspace'} activeTab={activeTab} onTabChange={navigateFaculty} facultyNavigation={facultyNavigation} onCommandPalette={() => setCommandPaletteOpen(true)} isDemo={isDemo} onToggleDemo={setIsDemo} facultySidebarCollapsible>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'home' && <FacultyHome onNavigate={navigateFaculty} />}
      {activeTab === 'notifications' && <FacultyNotificationsPage />}
      {activeTab === 'reports' && <StudentReports />}
      {activeTab === 'students' && <FacultyStudentsDirectory />}
      {activeTab === 'quizzes' && <QuizManagement initialSubmissionsQuizId={paperSubmissionsId} />}
      {activeTab === 'assignments' && <AssignmentManagement />}
      {activeTab === 'question-bank' && <QuestionBank />}
      {activeTab === 'question-papers' && <QuestionPaperManagement onSubmissions={(id) => { setPaperSubmissionsId(id); setActiveTab('quizzes'); }} />}
    </DashboardLayout>
    </FacultyNotificationsProvider>
    <FacultyCommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onNavigate={navigateFaculty} />
    </>
    </FacultyDemoProvider>
  );
}
