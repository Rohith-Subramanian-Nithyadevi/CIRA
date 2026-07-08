import { useState, useEffect } from 'react';

export default function UserProfile() {
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [password, setPassword] = useState('');
  const [enrollDepartmentId, setEnrollDepartmentId] = useState('');
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [enrolledDepartments, setEnrolledDepartments] = useState<{id: string, name: string}[]>([]);

  // Fetch departments if faculty
  useEffect(() => {
    if (role === 'FACULTY') {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/v1/departments`)
        .then(res => res.json())
        .then(data => {
          if (data?.data?.departments) setDepartments(data.data.departments);
        })
        .catch(console.error);

      // Fetch enrolled departments
      const token = localStorage.getItem('cira_token');
      if (token) {
        fetch(`${baseUrl}/api/v1/faculty/departments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data?.data?.departments) setEnrolledDepartments(data.data.departments);
          })
          .catch(console.error);
      }
    }
  }, [role]);

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
    <div className="max-w-2xl bg-white rounded-xl border border-border-soft p-8 shadow-sm text-ink">
      <h2 className="text-2xl font-serif font-bold text-ink mb-6">User Profile</h2>
      
      {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-6 text-sm font-semibold">{success}</div>}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-body mb-1.5">Full Name</label>
          <input 
            type="text" 
            disabled={!isEditing} 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="w-full px-4 py-2 bg-white border border-border-soft rounded-lg text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors disabled:opacity-75 disabled:cursor-not-allowed" 
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-body mb-1.5">Email Address</label>
          <input 
            type="email" 
            disabled 
            value={user.email || ''} 
            className="w-full px-4 py-2 bg-cream/40 border border-border-soft rounded-lg text-gray-body cursor-not-allowed font-medium" 
          />
          <p className="text-xs text-gray-body/60 mt-1">Email address cannot be changed.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-body mb-1.5">Phone Number</label>
          <input 
            type="text" 
            disabled={!isEditing} 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            className="w-full px-4 py-2 bg-white border border-border-soft rounded-lg text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors disabled:opacity-75 disabled:cursor-not-allowed" 
          />
        </div>

        {isEditing && (
          <div>
            <label className="block text-sm font-semibold text-gray-body mb-1.5">New Password (Optional)</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Leave blank to keep current password"
              className="w-full px-4 py-2 bg-white border border-border-soft rounded-lg text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors placeholder:text-gray-body/40" 
            />
          </div>
        )}

        {role === 'FACULTY' && (
          <div className="space-y-4 pt-4 border-t border-border-soft">
            <h3 className="text-lg font-serif font-bold text-ink">Course Enrollment Mapping</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-body mb-1.5">Select Department/Class to Enroll</label>
                <div className="flex gap-2">
                  <select 
                    value={enrollDepartmentId} 
                    onChange={(e) => setEnrollDepartmentId(e.target.value)} 
                    className="flex-1 px-4 py-2 bg-white border border-border-soft rounded-lg text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors appearance-none text-sm font-semibold shadow-sm"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.filter(d => !enrolledDepartments.find(ed => ed.id === d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button 
                    onClick={async () => {
                      try {
                        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
                        const token = localStorage.getItem('cira_token');
                        const res = await fetch(`${baseUrl}/api/v1/faculty/enroll`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ departmentId: enrollDepartmentId })
                        });
                        if (res.ok) {
                          const dept = departments.find(d => d.id === enrollDepartmentId);
                          if (dept) setEnrolledDepartments(prev => [...prev, dept]);
                          setSuccess('Successfully enrolled in class!');
                          setEnrollDepartmentId('');
                        }
                      } catch (err) { console.error(err); }
                    }} 
                    disabled={!enrollDepartmentId} 
                    className="px-6 py-2 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm disabled:opacity-50 shadow-sm"
                  >
                    Enroll
                  </button>
                </div>
              </div>
              
              {enrolledDepartments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-semibold text-gray-body mb-1.5">Enrolled Departments</label>
                  {enrolledDepartments.map(ed => (
                    <div key={ed.id} className="p-3 bg-cream/20 border border-border-soft rounded-lg flex justify-between items-center text-sm font-semibold text-ink">
                      <span>{ed.name}</span>
                      <button 
                        onClick={async () => {
                          try {
                            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
                            const token = localStorage.getItem('cira_token');
                            const res = await fetch(`${baseUrl}/api/v1/faculty/enroll/${ed.id}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                              setEnrolledDepartments(prev => prev.filter(d => d.id !== ed.id));
                              setSuccess('Unenrolled successfully');
                            }
                          } catch (err) { console.error(err); }
                        }}
                        className="text-red-600 hover:text-red-700 transition-colors font-bold"
                      >
                        Unenroll
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border-soft flex gap-4">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm disabled:opacity-50 shadow-sm">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-cream hover:bg-cream-edge/60 border border-border-soft text-ink font-bold rounded-full transition-all text-sm">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm shadow-sm">
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
