import { LayoutDashboard, Users, BookOpen, LogOut, FileText, CheckSquare, Settings, User, Home, BookMarked, Target, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDemo?: boolean;
  onToggleDemo?: (val: boolean) => void;
}

export default function DashboardLayout({ children, title, activeTab, onTabChange, isDemo, onToggleDemo }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const getNavClass = (tab: string) => {
    return `flex items-center w-full px-3 py-2 rounded-lg transition-all font-medium text-sm ${activeTab === tab
      ? 'bg-maroon/5 dark:bg-maroon/20 text-maroon dark:text-red-400 font-semibold border border-maroon dark:border-maroon/50 shadow-sm'
      : 'text-gray-body dark:text-gray-400 hover:text-ink dark:hover:text-white hover:bg-cream-edge/30 dark:hover:bg-gray-800 border border-transparent'
      }`;
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="px-3 pt-4 pb-1">
      <h4 className="text-[10px] font-bold text-gray-body dark:text-gray-500 uppercase tracking-wider">{title}</h4>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream dark:bg-[#111] flex text-ink dark:text-cream font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border-soft dark:border-gray-800 bg-white dark:bg-[#1A1A1A] flex flex-col hidden md:flex transition-colors duration-200">
        <div className="h-16 flex items-center px-6 border-b border-border-soft dark:border-gray-800">
          <img src="/img/favicon.ico" alt="CIRA Logo" className="w-8 h-8 mr-3 object-contain" />
          <span className="font-bold tracking-tight text-ink dark:text-white">CIRA Workspace</span>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {role === 'ADMIN' && (
            <>
              <button aria-current={activeTab === 'hub' ? 'page' : undefined} onClick={() => onTabChange('hub')} className={getNavClass('hub')}>
                <LayoutDashboard className="w-5 h-5 mr-3" /> Admin Hub
              </button>
              <button aria-current={activeTab === 'faculty' ? 'page' : undefined} onClick={() => onTabChange('faculty')} className={getNavClass('faculty')}>
                <CheckSquare className="w-5 h-5 mr-3" /> Faculty Approvals
              </button>
              <button aria-current={activeTab === 'users' ? 'page' : undefined} onClick={() => onTabChange('users')} className={getNavClass('users')}>
                <Users className="w-5 h-5 mr-3" /> User Management
              </button>
              <button aria-current={activeTab === 'departments' ? 'page' : undefined} onClick={() => onTabChange('departments')} className={getNavClass('departments')}>
                <Settings className="w-5 h-5 mr-3" /> Departments
              </button>
              <button aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className="w-5 h-5 mr-3" /> My Profile
              </button>
            </>
          )}

          {role === 'FACULTY' && (
            <>
              <button aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => onTabChange('home')} className={getNavClass('home')}>
                <Home className="w-5 h-5 mr-3" /> Home
              </button>
              <button aria-current={activeTab === 'reports' ? 'page' : undefined} onClick={() => onTabChange('reports')} className={getNavClass('reports')}>
                <Users className="w-5 h-5 mr-3 text-maroon dark:text-red-400" /> 
                <span className="flex-1 text-left">Student Reports</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-maroon/10 text-maroon dark:bg-maroon/30 dark:text-red-300 border border-maroon/20">Analytics</span>
              </button>
              <button aria-current={activeTab === 'quizzes' ? 'page' : undefined} onClick={() => onTabChange('quizzes')} className={getNavClass('quizzes')}>
                <BookOpen className="w-5 h-5 mr-3" /> Quizzes
              </button>
              <button aria-current={activeTab === 'assignments' ? 'page' : undefined} onClick={() => onTabChange('assignments')} className={getNavClass('assignments')}>
                <FileText className="w-5 h-5 mr-3" /> Assignments
              </button>
              <button onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className="w-5 h-5 mr-3" /> My Profile
              </button>
            </>
          )}

          {role === 'STUDENT' && (
            <>
              <SectionHeader title="Dashboard" />
              <button aria-current={activeTab === 'overview' ? 'page' : undefined} onClick={() => onTabChange('overview')} className={getNavClass('overview')}>
                <LayoutDashboard className="w-5 h-5 mr-3" /> Overview
              </button>

              <SectionHeader title="All Analysis" />
              <button aria-current={activeTab === 'topics' ? 'page' : undefined} onClick={() => onTabChange('topics')} className={getNavClass('topics')}>
                <BookMarked className="w-5 h-5 mr-3" /> Topic Skills
              </button>
              <button aria-current={activeTab === 'analytics' ? 'page' : undefined} onClick={() => onTabChange('analytics')} className={getNavClass('analytics')}>
                <Target className="w-5 h-5 mr-3" /> Analytics
              </button>

              <SectionHeader title="Resources" />
              <button aria-current={activeTab === 'resources' ? 'page' : undefined} onClick={() => onTabChange('resources')} className={getNavClass('resources')}>
                <FileText className="w-5 h-5 mr-3" /> Resource Hub
              </button>

              <SectionHeader title="Student essentials" />
              <button aria-current={activeTab === 'goals' ? 'page' : undefined} onClick={() => onTabChange('goals')} className={getNavClass('goals')}>
                <Target className="w-5 h-5 mr-3" /> My Goals
              </button>
              <button aria-current={activeTab === 'todo' ? 'page' : undefined} onClick={() => onTabChange('todo')} className={getNavClass('todo')}>
                <CheckSquare className="w-5 h-5 mr-3" /> Action Plan
              </button>
              <button aria-current={activeTab === 'assignments' ? 'page' : undefined} onClick={() => onTabChange('assignments')} className={getNavClass('assignments')}>
                <FileText className="w-5 h-5 mr-3" /> Assignments
              </button>

              <SectionHeader title="Quiz" />
              <button aria-current={activeTab === 'quizzes' ? 'page' : undefined} onClick={() => onTabChange('quizzes')} className={getNavClass('quizzes')}>
                <BookOpen className="w-5 h-5 mr-3" /> Quizzes
              </button>

              <SectionHeader title="Profile" />
              <button aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className="w-5 h-5 mr-3" /> My Profile
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-border-soft dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-gray-body dark:text-gray-400 hover:text-ink dark:hover:text-white hover:bg-cream-edge/30 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium text-sm"
          >
            <LogOut className="w-5 h-5 mr-3" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-border-soft dark:border-gray-800 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-md transition-colors duration-200">
          <h2 className="text-xl font-serif font-bold text-ink dark:text-white">{title}</h2>

          <div className="flex items-center gap-6">
            {role === 'STUDENT' && onToggleDemo && (
              <div className="flex items-center gap-2 bg-cream-edge/30 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-border-soft dark:border-gray-700">
                <Database className="w-4 h-4 text-maroon dark:text-red-400" />
                <span className="text-xs font-bold text-ink dark:text-cream">Demo Data</span>
                <button
                  onClick={() => onToggleDemo(!isDemo)}
                  className={`w-8 h-4 rounded-full flex items-center transition-colors ${isDemo ? 'bg-maroon dark:bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isDemo ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 border-l border-border-soft dark:border-gray-700 pl-6">
              <div className="w-8 h-8 rounded-full bg-cream dark:bg-gray-800 border border-border-soft dark:border-gray-700 flex items-center justify-center">
                <span className="text-xs font-bold text-maroon dark:text-red-400">
                  {role === 'ADMIN' ? 'AD' : role === 'FACULTY' ? 'FA' : 'ST'}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-ink dark:text-white leading-none">{user.name || 'User'}</p>
                <p className="text-gray-body dark:text-gray-400 text-xs mt-1 leading-none">{role}</p>
              </div>
            </div>
          </div>
        </div>

        <div id="main-content" className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
