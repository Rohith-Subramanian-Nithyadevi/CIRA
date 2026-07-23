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
        <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
          <h2 className="text-xl font-serif font-bold mb-4 text-ink">My Assignments</h2>
          <p className="text-gray-body text-sm">You currently have no assigned tasks.</p>
        </div>
      )}
      {activeTab === 'quizzes' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm">
            <h2 className="text-xl font-serif font-bold mb-4 text-ink">Exam Results</h2>
            <div className="bg-cream/40 p-5 rounded-xl border border-border-soft">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-ink text-base">Midterm Examination: Data Structures</h3>
                <span className="bg-green-500/10 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">EXCELLENT</span>
              </div>
              <div className="text-xs text-gray-body mb-4">Submitted: 2026-06-25</div>
              <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm">
                  <div className="text-2xl font-bold text-maroon">92</div>
                  <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Total Score</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm">
                  <div className="text-2xl font-bold text-ink">40</div>
                  <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Objective</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm">
                  <div className="text-2xl font-bold text-ink">52</div>
                  <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Written</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-border-soft shadow-sm">
                  <div className="text-2xl font-bold text-green-600">A+</div>
                  <div className="text-[10px] font-semibold text-gray-body uppercase tracking-wider">Grade</div>
                </div>
              </div>
              <div className="border-t border-border-soft/60 pt-3 mt-3">
                <p className="text-xs font-bold text-ink">Faculty Feedback:</p>
                <p className="text-xs text-gray-body mt-1 italic leading-relaxed">"Excellent understanding of algorithmic complexities. Keep up the good work on your written explanations."</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-white rounded-xl border border-border-soft shadow-sm flex justify-between items-center">
            <div>
              <h2 className="text-xl font-serif font-bold text-ink mb-1">Active Examinations</h2>
              <p className="text-gray-body text-sm mb-4">Access your active exams via the Secure Desktop Client.</p>
              <div className="flex gap-3">
                <a href="https://github.com/Rohith-Subramanian-Nithyadevi/CIRA/releases/latest" target="_blank" rel="noreferrer" className="bg-maroon hover:bg-maroon-dark text-white px-4 py-2 rounded-lg font-sans font-semibold text-xs transition-colors flex items-center shadow-sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download .exe
                </a>
                <a href="https://github.com/Rohith-Subramanian-Nithyadevi/CIRA/releases/latest" target="_blank" rel="noreferrer" className="bg-ink hover:bg-black text-white px-4 py-2 rounded-lg font-sans font-semibold text-xs transition-colors flex items-center shadow-sm">
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
