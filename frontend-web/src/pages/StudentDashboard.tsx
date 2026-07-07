import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import StudentSpace from '../components/dashboard/StudentSpace';
import UserProfile from '../components/dashboard/UserProfile';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('progress');

  return (
    <DashboardLayout title="Academic Profile" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'profile' && <UserProfile />}
      {activeTab === 'progress' && <StudentSpace />}
      {activeTab === 'assignments' && (
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">My Assignments</h2>
          <p className="text-slate-500">You currently have no assigned tasks.</p>
        </div>
      )}
      {activeTab === 'quizzes' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Exam Results</h2>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white">Midterm Examination: Data Structures</h3>
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">EXCELLENT</span>
              </div>
              <div className="text-sm text-slate-400 mb-4">Submitted: 2026-06-25</div>
              <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                  <div className="text-2xl font-bold text-blue-400">92</div>
                  <div className="text-xs text-slate-500 uppercase">Total Score</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                  <div className="text-2xl font-bold text-white">40</div>
                  <div className="text-xs text-slate-500 uppercase">Objective</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                  <div className="text-2xl font-bold text-white">52</div>
                  <div className="text-xs text-slate-500 uppercase">Written</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                  <div className="text-2xl font-bold text-green-400">A+</div>
                  <div className="text-xs text-slate-500 uppercase">Grade</div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300">Faculty Feedback:</p>
                <p className="text-sm text-slate-400 mt-1 italic">"Excellent understanding of algorithmic complexities. Keep up the good work on your written explanations."</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold mb-2">Active Examinations</h2>
              <p className="text-slate-500 mb-4">Access your active exams via the Secure Desktop Client.</p>
              <div className="flex gap-4">
                <a href="https://github.com/Rohith-Subramanian-Nithyadevi/CIRA/raw/vishnu_branch/releases/CIRA-Secure-Client.exe" target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download .exe
                </a>
                <a href="https://github.com/Rohith-Subramanian-Nithyadevi/CIRA/raw/vishnu_branch/releases/CIRA-Secure-Client.dmg" target="_blank" rel="noreferrer" className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download .dmg
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
