<<<<<<< HEAD
import { LayoutDashboard, Users, BookOpen, LogOut, FileText, CheckSquare, Settings, User, Home, BookMarked, Target, Database, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import ThemeToggle from './ui/ThemeToggle';
=======
import { LayoutDashboard, Users, BookOpen, LogOut, FileText, CheckSquare, Settings, User, Home, BookMarked, Target, Database, Bell, Menu, X, Search, PanelLeftClose, PanelLeftOpen, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FacultyNotificationBell } from './dashboard/FacultyNotifications';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface DashboardNavGroup {
  label: string;
  items: DashboardNavItem[];
}
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDemo?: boolean;
  onToggleDemo?: (val: boolean) => void;
  facultyNavigation?: DashboardNavGroup[];
  onCommandPalette?: () => void;
  facultySidebarCollapsible?: boolean;
}

export default function DashboardLayout({ children, title, activeTab, onTabChange, isDemo, onToggleDemo, facultyNavigation, onCommandPalette, facultySidebarCollapsible = false }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [facultySidebarCollapsed, setFacultySidebarCollapsed] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';
  const useFacultyNavigation = role === 'FACULTY' && Boolean(facultyNavigation);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('cira_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    if (localStorage.getItem('cira_theme') === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('cira_sidebar_collapsed', String(next));
  };

  const handleLogout = () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    navigate('/');
  };

  const getNavClass = (tab: string) => {
<<<<<<< HEAD
    return `flex items-center w-full ${isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'} rounded-lg transition-all font-medium text-sm cursor-pointer ${activeTab === tab
      ? 'bg-maroon/10 dark:bg-rose-500/15 text-maroon dark:text-rose-300 font-semibold border border-maroon/40 dark:border-rose-500/40 shadow-xs'
      : 'text-gray-body dark:text-neutral-300 hover:text-ink dark:hover:text-white hover:bg-cream-edge/40 dark:hover:bg-neutral-800/80 border border-transparent'
=======
    return `flex items-center w-full px-3 py-2 rounded-lg transition-colors font-medium text-sm ${activeTab === tab
      ? 'bg-maroon/5 dark:bg-maroon/20 text-maroon dark:text-red-400 font-semibold border border-maroon dark:border-maroon/50 shadow-sm'
      : 'text-gray-body dark:text-gray-400 hover:text-ink dark:hover:text-white hover:bg-cream-edge/30 dark:hover:bg-gray-800 border border-transparent'
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
      }`;
  };

  const SectionHeader = ({ title }: { title: string }) => (
<<<<<<< HEAD
    isCollapsed ? (
      <div className="my-2 border-t border-border-soft/60 dark:border-neutral-800" title={title} />
    ) : (
      <div className="px-3 pt-4 pb-1">
        <h4 className="text-[10px] font-bold text-gray-body dark:text-neutral-500 uppercase tracking-wider">{title}</h4>
      </div>
    )
=======
    <div className={`px-3 pt-4 pb-1 ${useFacultyNavigation && facultySidebarCollapsible && facultySidebarCollapsed ? 'hidden' : ''}`}>
      <h4 className="text-[10px] font-bold text-gray-body dark:text-gray-500 uppercase tracking-wider">{title}</h4>
    </div>
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
  );

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!useFacultyNavigation || !onCommandPalette) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onCommandPalette();
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [onCommandPalette, useFacultyNavigation]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const firstFocusable = mobileNavRef.current?.querySelector<HTMLElement>('button');
    firstFocusable?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = mobileNavRef.current
        ? Array.from(mobileNavRef.current.querySelectorAll<HTMLButtonElement>('button')).filter((button) => !button.disabled)
        : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileNavOpen]);

  const renderFacultyNavigation = (closeOnSelect = false) => (
    <>
      {facultyNavigation?.map((group) => (
        <React.Fragment key={group.label}>
          <SectionHeader title={group.label} />
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => {
                  onTabChange(item.id);
                  if (closeOnSelect) setMobileNavOpen(false);
                }}
                className={`${getNavClass(item.id)} ${useFacultyNavigation && facultySidebarCollapsible && facultySidebarCollapsed && !closeOnSelect ? 'justify-center px-2' : ''}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${!closeOnSelect && !(useFacultyNavigation && facultySidebarCollapsible && facultySidebarCollapsed) ? 'mr-3' : ''}`} />
                {(!useFacultyNavigation || !facultySidebarCollapsible || !facultySidebarCollapsed || closeOnSelect) && <span className="flex-1 text-left">{item.label}</span>}
                {item.badge && (!useFacultyNavigation || !facultySidebarCollapsible || !facultySidebarCollapsed || closeOnSelect) && <span className="rounded-full border border-maroon/20 bg-maroon/10 px-2 py-0.5 text-[10px] font-bold text-maroon">{item.badge}</span>}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </>
  );

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-cream dark:bg-[#111113] flex text-ink dark:text-neutral-100 font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} border-r border-border-soft dark:border-neutral-800 bg-white dark:bg-[#18181B] flex flex-col hidden md:flex transition-all duration-200 ease-in-out shrink-0`}>
        <div className={`h-16 flex items-center ${isCollapsed ? 'justify-between px-2.5 gap-1' : 'justify-between px-4 sm:px-5'} border-b border-border-soft dark:border-neutral-800 shrink-0`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center min-w-0 mr-2">
                <img src="/img/favicon.ico" alt="CIRA Logo" className="w-8 h-8 rounded-md mr-2.5 object-contain shrink-0" />
                <span className="font-bold tracking-tight text-ink dark:text-white truncate">CIRA Workspace</span>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Collapse sidebar to icons"
                aria-label="Collapse sidebar"
                className="p-1.5 rounded-lg text-gray-body dark:text-neutral-400 hover:text-ink dark:hover:text-white hover:bg-cream-edge/50 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <img
                src="/img/favicon.ico"
                alt="CIRA Logo"
                onClick={toggleSidebar}
                title="CIRA — Click to expand sidebar"
                className="w-7 h-7 rounded-md object-contain shrink-0 cursor-pointer"
              />
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="p-1 rounded-md text-maroon dark:text-rose-300 bg-cream-edge/40 dark:bg-neutral-800 border border-border-soft dark:border-neutral-700 hover:bg-cream-edge dark:hover:bg-neutral-700 transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
=======
    <div className="min-h-screen bg-cream dark:bg-[#111] flex text-ink dark:text-ink font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className={`${useFacultyNavigation && facultySidebarCollapsible && facultySidebarCollapsed ? 'w-20' : 'w-64'} border-r border-border-soft dark:border-gray-800 bg-white dark:bg-[#1A1A1A] flex flex-col hidden md:flex transition-[width,colors] duration-200`}>
        <div className={`h-16 flex items-center border-b border-border-soft dark:border-gray-800 ${useFacultyNavigation && facultySidebarCollapsible && facultySidebarCollapsed ? 'justify-center px-3' : 'px-6'}`}>
          <img src="/img/favicon.ico" alt="CIRA Logo" className="w-8 h-8 mr-3 object-contain" />
          {(!useFacultyNavigation || !facultySidebarCollapsible || !facultySidebarCollapsed) && <span className="font-bold tracking-tight text-ink dark:text-white">CIRA Workspace</span>}
        </div>

        <nav aria-label="Primary navigation" className={`flex-1 py-4 space-y-1 overflow-y-auto ${useFacultyNavigation && facultySidebarCollapsible && facultySidebarCollapsed ? 'px-2' : 'px-4'}`}>
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
          {role === 'ADMIN' && (
            <>
              <button title={isCollapsed ? "Admin Hub" : undefined} aria-current={activeTab === 'hub' ? 'page' : undefined} onClick={() => onTabChange('hub')} className={getNavClass('hub')}>
                <LayoutDashboard className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Admin Hub</span>}
              </button>
              <button title={isCollapsed ? "Faculty Approvals" : undefined} aria-current={activeTab === 'faculty' ? 'page' : undefined} onClick={() => onTabChange('faculty')} className={getNavClass('faculty')}>
                <CheckSquare className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Faculty Approvals</span>}
              </button>
              <button title={isCollapsed ? "User Management" : undefined} aria-current={activeTab === 'users' ? 'page' : undefined} onClick={() => onTabChange('users')} className={getNavClass('users')}>
                <Users className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">User Management</span>}
              </button>
              <button title={isCollapsed ? "Departments" : undefined} aria-current={activeTab === 'departments' ? 'page' : undefined} onClick={() => onTabChange('departments')} className={getNavClass('departments')}>
                <Settings className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Departments</span>}
              </button>
              <button title={isCollapsed ? "My Profile" : undefined} aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">My Profile</span>}
              </button>
            </>
          )}

          {role === 'FACULTY' && useFacultyNavigation && renderFacultyNavigation()}
          {role === 'FACULTY' && !useFacultyNavigation && (
            <>
              <button title={isCollapsed ? "Home" : undefined} aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => onTabChange('home')} className={getNavClass('home')}>
                <Home className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Home</span>}
              </button>
              <button title={isCollapsed ? "Student Reports" : undefined} aria-current={activeTab === 'reports' ? 'page' : undefined} onClick={() => onTabChange('reports')} className={getNavClass('reports')}>
                <Users className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} /> 
                {!isCollapsed && <span className="flex-1 text-left truncate">Student Reports</span>}
                {!isCollapsed && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-maroon/10 text-maroon dark:bg-maroon/30 dark:text-red-300 border border-maroon/20">Analytics</span>}
              </button>
              <button title={isCollapsed ? "Quizzes" : undefined} aria-current={activeTab === 'quizzes' ? 'page' : undefined} onClick={() => onTabChange('quizzes')} className={getNavClass('quizzes')}>
                <BookOpen className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Quizzes</span>}
              </button>
              <button title={isCollapsed ? "Assignments" : undefined} aria-current={activeTab === 'assignments' ? 'page' : undefined} onClick={() => onTabChange('assignments')} className={getNavClass('assignments')}>
                <FileText className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Assignments</span>}
              </button>
              <button title={isCollapsed ? "My Profile" : undefined} aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">My Profile</span>}
              </button>
            </>
          )}

          {role === 'STUDENT' && (
            <>
              <SectionHeader title="Dashboard" />
              <button title={isCollapsed ? "Overview" : undefined} aria-current={activeTab === 'overview' ? 'page' : undefined} onClick={() => onTabChange('overview')} className={getNavClass('overview')}>
                <LayoutDashboard className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Overview</span>}
              </button>
              <button title={isCollapsed ? "Announcements" : undefined} aria-current={activeTab === 'announcements' ? 'page' : undefined} onClick={() => onTabChange('announcements')} className={getNavClass('announcements')}>
                <Bell className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Announcements</span>}
              </button>

              <SectionHeader title="All Analysis" />
              <button title={isCollapsed ? "Topic Skills" : undefined} aria-current={activeTab === 'topics' ? 'page' : undefined} onClick={() => onTabChange('topics')} className={getNavClass('topics')}>
                <BookMarked className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Topic Skills</span>}
              </button>
              <button title={isCollapsed ? "Analytics" : undefined} aria-current={activeTab === 'analytics' ? 'page' : undefined} onClick={() => onTabChange('analytics')} className={getNavClass('analytics')}>
                <Target className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Analytics</span>}
              </button>

              <SectionHeader title="Resources" />
              <button title={isCollapsed ? "Resource Hub" : undefined} aria-current={activeTab === 'resources' ? 'page' : undefined} onClick={() => onTabChange('resources')} className={getNavClass('resources')}>
                <FileText className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Resource Hub</span>}
              </button>

              <SectionHeader title="Student essentials" />
              <button title={isCollapsed ? "My Goals" : undefined} aria-current={activeTab === 'goals' ? 'page' : undefined} onClick={() => onTabChange('goals')} className={getNavClass('goals')}>
                <Target className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">My Goals</span>}
              </button>
              <button title={isCollapsed ? "Assignments" : undefined} aria-current={activeTab === 'assignments' ? 'page' : undefined} onClick={() => onTabChange('assignments')} className={getNavClass('assignments')}>
                <FileText className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Assignments</span>}
              </button>

              <SectionHeader title="Quiz" />
              <button title={isCollapsed ? "Quizzes" : undefined} aria-current={activeTab === 'quizzes' ? 'page' : undefined} onClick={() => onTabChange('quizzes')} className={getNavClass('quizzes')}>
                <BookOpen className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">Quizzes</span>}
              </button>

              <SectionHeader title="Profile" />
              <button title={isCollapsed ? "My Profile" : undefined} aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => onTabChange('profile')} className={getNavClass('profile')}>
                <User className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="truncate">My Profile</span>}
              </button>
            </>
          )}
        </nav>
        {useFacultyNavigation && facultySidebarCollapsible && (
          <div className="border-t border-border-soft p-3">
            <button
              type="button"
              onClick={() => setFacultySidebarCollapsed(value => !value)}
              aria-label={facultySidebarCollapsed ? 'Expand faculty navigation' : 'Collapse faculty navigation'}
              className="flex w-full items-center justify-center rounded-lg p-2 text-gray-body hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30"
            >
              {facultySidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <><PanelLeftClose className="mr-3 h-5 w-5" /><span className="text-sm font-medium">Collapse</span></>}
            </button>
          </div>
        )}

        <div className="p-3 border-t border-border-soft dark:border-neutral-800 shrink-0">
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            className={`flex items-center w-full ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2'} text-gray-body dark:text-neutral-300 hover:text-ink dark:hover:text-white hover:bg-cream-edge/30 dark:hover:bg-neutral-800 rounded-lg transition-colors font-medium text-sm cursor-pointer`}
          >
            <LogOut className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {useFacultyNavigation && (
        <>
          <button type="button" aria-label="Open faculty navigation" onClick={() => setMobileNavOpen(true)} className="fixed left-4 top-4 z-30 rounded-lg border border-border-soft bg-white p-2 text-ink shadow-sm md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          {mobileNavOpen && (
            <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileNavOpen(false); }}>
              <aside ref={mobileNavRef} role="dialog" aria-modal="true" aria-label="Faculty navigation" className="flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-lg">
                <div className="flex h-16 items-center justify-between border-b border-border-soft px-5">
                  <span className="font-bold text-ink">CIRA Workspace</span>
                  <button type="button" aria-label="Close faculty navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-gray-body hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30">
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <nav aria-label="Faculty mobile navigation" className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
                  {renderFacultyNavigation(true)}
                </nav>
                <div className="border-t border-border-soft p-4">
                  <button onClick={handleLogout} className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-body hover:bg-cream-edge/30 hover:text-ink">
                    <LogOut className="mr-3 h-5 w-5" /> Sign Out
                  </button>
                </div>
              </aside>
            </div>
          )}
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
<<<<<<< HEAD
        <div className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-border-soft dark:border-neutral-800 bg-white/85 dark:bg-[#18181B]/90 backdrop-blur-md transition-colors duration-200">
          <h2 className="text-xl font-serif font-bold text-ink dark:text-white">{title}</h2>

          <div className="flex items-center gap-4 sm:gap-6">
            <ThemeToggle />

            {role === 'STUDENT' && onToggleDemo && (
              <div className="flex items-center gap-2 bg-cream-edge/40 dark:bg-neutral-800/80 px-3 py-1.5 rounded-full border border-border-soft dark:border-neutral-700">
                <Database className="w-4 h-4 text-maroon dark:text-rose-400" />
                <span className="text-xs font-bold text-ink dark:text-neutral-100">Demo Data</span>
=======
        <div className="h-16 shrink-0 flex items-center justify-between pl-14 pr-3 sm:px-8 border-b border-border-soft dark:border-gray-800 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-md transition-colors duration-200">
          <h2 className="min-w-0 flex-1 truncate text-base font-serif font-bold text-ink dark:text-white sm:text-xl">{title}</h2>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-6">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="rounded-lg border border-border-soft bg-white px-2.5 py-2 text-gray-body transition-colors hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 dark:bg-[#242124] dark:hover:bg-[#302b2f] dark:hover:text-cream"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            {useFacultyNavigation && onCommandPalette && (
              <button type="button" onClick={onCommandPalette} aria-label="Open command palette" className="flex items-center gap-2 rounded-lg border border-border-soft bg-white px-3 py-2 text-sm font-semibold text-gray-body hover:bg-cream">
                <Search className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Search</span> <kbd className="hidden rounded border border-border-soft px-1.5 py-0.5 text-[10px] sm:inline">Ctrl K</kbd>
              </button>
            )}
            {useFacultyNavigation && <FacultyNotificationBell onNavigate={onTabChange} />}
            {onToggleDemo && (role === 'STUDENT' || role === 'FACULTY') && (
              <div className="flex items-center gap-2 bg-cream-edge/30 dark:bg-gray-800/50 px-2 sm:px-3 py-1.5 rounded-full border border-border-soft dark:border-gray-700">
                <Database className="w-4 h-4 text-maroon dark:text-red-400" />
                <span className="hidden text-xs font-bold text-ink dark:text-ink lg:inline">Demo Data</span>
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
                <button
                  onClick={() => onToggleDemo(!isDemo)}
                  aria-label="Toggle demo data"
                  className={`w-8 h-4 rounded-full flex items-center transition-colors cursor-pointer ${isDemo ? 'bg-maroon dark:bg-rose-500' : 'bg-gray-300 dark:bg-neutral-600'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isDemo ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
            )}

<<<<<<< HEAD
            <div className="flex items-center gap-3 border-l border-border-soft dark:border-neutral-700 pl-6">
              <div className="w-8 h-8 rounded-full bg-cream dark:bg-neutral-800 border border-border-soft dark:border-neutral-700 flex items-center justify-center">
                <span className="text-xs font-bold text-maroon dark:text-rose-400">
=======
            <div className="hidden sm:flex items-center gap-3 border-l border-border-soft dark:border-gray-700 pl-6">
              <div className="w-8 h-8 rounded-full bg-cream dark:bg-gray-800 border border-border-soft dark:border-gray-700 flex items-center justify-center">
                <span className="text-xs font-bold text-maroon dark:text-red-400">
>>>>>>> 1337b9372f667fbde4b97e71d0076bd2c2a291b9
                  {role === 'ADMIN' ? 'AD' : role === 'FACULTY' ? 'FA' : 'ST'}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-ink dark:text-white leading-none">{user.name || 'User'}</p>
                <p className="text-gray-body dark:text-neutral-400 text-xs mt-1 leading-none">{role}</p>
              </div>
            </div>
          </div>
        </div>

        <div id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
