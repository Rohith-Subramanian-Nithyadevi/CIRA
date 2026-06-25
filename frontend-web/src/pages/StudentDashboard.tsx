import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900/50 p-4 flex justify-between items-center">
        <h1 className="font-bold text-xl">Student Portal</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{user.name} ({user.rollNumber || 'Student'})</span>
          <button onClick={handleLogout} className="text-sm bg-red-600/20 text-red-400 px-3 py-1 rounded hover:bg-red-600/40">Logout</button>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">My Profile</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500 w-24 inline-block">Name:</span> {user.name}</p>
              <p><span className="text-slate-500 w-24 inline-block">Email:</span> {user.email}</p>
              <p><span className="text-slate-500 w-24 inline-block">Roll No:</span> {user.rollNumber || 'N/A'}</p>
            </div>
            <button className="mt-4 text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">Edit Profile</button>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Readiness Score</h2>
            <div className="flex items-center justify-center h-32">
              <p className="text-5xl font-bold text-blue-500">TBD</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Pending Quizzes</h2>
            <div className="text-slate-400 text-sm italic">No pending quizzes at this time.</div>
          </div>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Adaptive Assignments</h2>
            <div className="text-slate-400 text-sm italic">Assignments will be generated based on your quiz performance.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
