import { useState } from 'react';

export default function UserProfile() {
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [password, setPassword] = useState('');
  const [enrollDepartmentId, setEnrollDepartmentId] = useState('');
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);

  // Fetch departments if faculty
  useState(() => {
    if (role === 'FACULTY') {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/v1/departments`)
        .then(res => res.json())
        .then(data => {
          if (data?.data?.departments) setDepartments(data.data.departments);
        })
        .catch(console.error);
    }
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    setLoading(true);
    // In a real implementation, we would call an API here.
    // For now, we simulate saving to local storage.
    setTimeout(() => {
      const updatedUser = { ...user, name, phone };
      localStorage.setItem('cira_user', JSON.stringify(updatedUser));
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }, 1000);
  };

  return (
    <div className="max-w-2xl bg-slate-900 rounded-xl border border-slate-800 p-8 shadow-xl">
      <h2 className="text-2xl font-bold mb-6">User Profile</h2>
      
      {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded mb-6 text-sm">{success}</div>}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
          <input 
            type="text" 
            disabled={!isEditing} 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
          <input 
            type="email" 
            disabled 
            value={user.email} 
            className="w-full px-4 py-2 bg-slate-800/30 border border-slate-800 rounded text-slate-500 cursor-not-allowed" 
          />
          <p className="text-xs text-slate-500 mt-1">Email address cannot be changed.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Phone Number</label>
          <input 
            type="text" 
            disabled={!isEditing} 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed" 
          />
        </div>

        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">New Password (Optional)</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Leave blank to keep current password"
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors" 
            />
          </div>
        )}

        {role === 'STUDENT' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Roll Number</label>
              <input type="text" disabled value={user.rollNumber || 'N/A'} className="w-full px-4 py-2 bg-slate-800/30 border border-slate-800 rounded text-slate-500 cursor-not-allowed" />
            </div>
          </div>
        )}

        {role === 'FACULTY' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Employee ID</label>
              <input type="text" disabled value={user.employeeId || 'N/A'} className="w-full px-4 py-2 bg-slate-800/30 border border-slate-800 rounded text-slate-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Subject</label>
              <input type="text" disabled value={user.subject || 'N/A'} className="w-full px-4 py-2 bg-slate-800/30 border border-slate-800 rounded text-slate-500 cursor-not-allowed uppercase" />
            </div>
          </div>
        )}

        {role === 'FACULTY' && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-lg font-bold text-white">Course Enrollment Mapping</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Select Department/Class to Enroll</label>
                <div className="flex gap-2">
                  <select 
                    value={enrollDepartmentId} 
                    onChange={(e) => setEnrollDepartmentId(e.target.value)} 
                    className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded focus:border-blue-500 transition-colors text-white appearance-none"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button onClick={() => setSuccess('Successfully enrolled in class!')} disabled={!enrollDepartmentId} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium disabled:opacity-50">
                    Enroll
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex gap-4">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setIsEditing(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium transition-colors">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors">
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
