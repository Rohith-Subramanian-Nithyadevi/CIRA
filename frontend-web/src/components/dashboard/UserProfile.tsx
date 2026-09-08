import { useState, useEffect } from 'react';
import { CheckCircle2, Trash2, Loader2, Moon, Sun } from 'lucide-react';
import { useBatches, useDepartments } from '@/hooks/useReferenceData';
import { apiClient, getApiErrorMessage } from '@/lib/apiClient';

export default function UserProfile() {
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [rollNumber, setRollNumber] = useState(user.rollNumber || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('cira_theme') || 'light');

  // Enrollment state
  const [enrolledDepartments, setEnrolledDepartments] = useState<{ id: string; name: string; batchName?: string; type?: string; departmentName?: string }[]>([]);
  const [enrolledSections, setEnrolledSections] = useState<{ id: string; name: string; batchName?: string; departmentName?: string; type?: string }[]>([]);
  const [enrollBatchId, setEnrollBatchId] = useState(user.department?.batchId || '');
  const [enrollDeptId, setEnrollDeptId] = useState(user.departmentId || '');
  const [enrollSectionId, setEnrollSectionId] = useState(user.sectionId || '');
  const [enrolling, setEnrolling] = useState(false);

  // Cascading reference data
  const { batches } = useBatches();
  const { departments: deptsByBatch } = useDepartments(enrollBatchId, { enabled: !!enrollBatchId });

  // Fetch already-enrolled departments on mount
  useEffect(() => {
    if (role === 'FACULTY') {
      apiClient.fetch('/api/v1/faculty/departments')
        .then(res => res.json())
        .then(data => {
          if (data?.data?.departments) setEnrolledDepartments(data.data.departments);
          if (data?.data?.sections) setEnrolledSections(data.data.sections);
        })
        .catch(console.error);
    }
  }, [role]);

  const toggleTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('cira_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    
    try {
      const payload: any = { name, phone };
      if (role === 'STUDENT') {
        payload.rollNumber = rollNumber;
        payload.departmentId = enrollDeptId || undefined;
        payload.sectionId = enrollSectionId === 'all' ? undefined : (enrollSectionId || undefined);
      }
      
      if (password) {
        payload.password = password;
      }
      
      if (role === 'STUDENT') {
        const res = await apiClient.fetch('/api/v1/student/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          const resData = await res.json();
          // update local user
          const updatedUser = { ...user, ...resData.data };
          localStorage.setItem('cira_user', JSON.stringify(updatedUser));
          setSuccess('Profile updated successfully!');
          setIsEditing(false);
        } else {
          const errData = await res.json();
          setError(errData.details ? `${errData.error}: ${errData.details}` : (errData.error || 'Failed to update profile'));
        }
      } else {
        // Just local storage for non-students for now
        const updatedUser = { ...user, name, phone };
        localStorage.setItem('cira_user', JSON.stringify(updatedUser));
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'An error occurred while saving.'));
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleFacultyEnroll = async () => {
    if (!enrollDeptId) return;
    setEnrolling(true);
    setError('');
    try {
      const payload: any = { departmentId: enrollDeptId };
      if (enrollSectionId && enrollSectionId !== 'all') {
        payload.sectionId = enrollSectionId;
      }

      const res = await apiClient.fetch('/api/v1/faculty/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await res.json();
      if (res.ok) {
        const dept = deptsByBatch.find(d => d.id === enrollDeptId);
        const batch = batches.find(b => b.id === enrollBatchId);
        
        if (payload.sectionId) {
          const sec = dept?.sections?.find(s => s.id === payload.sectionId);
          if (sec && dept) {
            setEnrolledSections(prev => [...prev, { id: sec.id, name: sec.name, departmentName: dept.name, batchName: batch?.name, type: 'section' }]);
          }
        } else if (dept) {
          setEnrolledDepartments(prev => [...prev, { id: dept.id, name: dept.name, batchName: batch?.name, type: 'department' }]);
        }

        setSuccess('Successfully enrolled!');
        setEnrollSectionId('');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Enrollment failed. You may already be enrolled.'));
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (id: string, type: 'department' | 'section') => {
    try {
      const endpoint = type === 'department' ? `/api/v1/faculty/enroll/${id}` : `/api/v1/faculty/enroll/section/${id}`;
      await apiClient.fetch(endpoint, { method: 'DELETE' });
      if (type === 'department') {
        setEnrolledDepartments(prev => prev.filter(d => d.id !== id));
      } else {
        setEnrolledSections(prev => prev.filter(s => s.id !== id));
      }
      setSuccess('Unenrolled successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to unenroll. Please try again.'));
    }
  };

  // Departments in the selected batch
  const availableDepts = deptsByBatch;
  const selectedDept = deptsByBatch.find(d => d.id === enrollDeptId);
  const availableSections = selectedDept?.sections || [];

  return (
    <div className="max-w-2xl bg-white dark:bg-[#1A1A1A] rounded-xl border border-border-soft dark:border-gray-800 p-8 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif font-bold text-ink dark:text-cream">User Profile</h2>
        
        {/* Theme Toggle */}
        <div className="flex bg-cream dark:bg-gray-800 rounded-full p-1 border border-border-soft dark:border-gray-700">
          <button 
            onClick={() => toggleTheme('light')} 
            className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-white shadow-sm text-maroon' : 'text-gray-body hover:text-ink dark:hover:text-cream'}`}
            title="Light Mode"
          >
            <Sun className="w-4 h-4" />
          </button>
          <button 
            onClick={() => toggleTheme('dark')} 
            className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-gray-700 shadow-sm text-cream' : 'text-gray-body hover:text-ink dark:hover:text-cream'}`}
            title="Dark Mode"
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 p-3 rounded-lg mb-4 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg mb-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="space-y-6 text-ink dark:text-cream">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-body dark:text-gray-400 mb-1.5">Full Name</label>
          <input
            type="text"
            disabled={!isEditing}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-semibold text-gray-body dark:text-gray-400 mb-1.5">Email Address</label>
          <input
            type="email"
            disabled
            value={user.email || ''}
            className="w-full px-4 py-2 bg-cream/40 dark:bg-gray-800/40 border border-border-soft dark:border-gray-700 rounded-lg text-gray-body dark:text-gray-500 cursor-not-allowed font-medium"
          />
          <p className="text-xs text-gray-body/60 dark:text-gray-500 mt-1">Email address cannot be changed.</p>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-body dark:text-gray-400 mb-1.5">Phone Number</label>
          <input
            type="text"
            disabled={!isEditing}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
          />
        </div>
        
        {/* Roll Number (Student Only) */}
        {role === 'STUDENT' && (
          <div>
            <label className="block text-sm font-semibold text-gray-body dark:text-gray-400 mb-1.5">Roll Number</label>
            <input
              type="text"
              disabled={!isEditing}
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Password (only visible in edit mode) */}
        {isEditing && (
          <div>
            <label className="block text-sm font-semibold text-gray-body dark:text-gray-400 mb-1.5">New Password (Optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full px-4 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors placeholder:text-gray-body/40 dark:placeholder:text-gray-600"
            />
          </div>
        )}

        {/* ── DEPARTMENT / SECTION (STUDENT & FACULTY) ── */}
        <div className="space-y-5 pt-5 border-t border-border-soft dark:border-gray-800">
          <div>
            <h3 className="text-lg font-serif font-bold">
              {role === 'STUDENT' ? 'Your Class Details' : 'Department Enrollment'}
            </h3>
            <p className="text-xs text-gray-body dark:text-gray-400 mt-0.5">
              {role === 'STUDENT' 
                ? 'Update your class details to receive targeted announcements and quizzes.' 
                : 'Select a batch then a department to enroll. Only enrolled departments appear in Student Reports.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-body dark:text-gray-400 mb-1.5 uppercase tracking-wide">Batch</label>
              <select
                disabled={role === 'STUDENT' && !isEditing}
                value={enrollBatchId}
                onChange={(e) => { setEnrollBatchId(e.target.value); setEnrollDeptId(''); setEnrollSectionId(''); }}
                className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <option value="">Select Batch…</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-body dark:text-gray-400 mb-1.5 uppercase tracking-wide">Department</label>
              <select
                disabled={(role === 'STUDENT' && !isEditing) || !enrollBatchId || availableDepts.length === 0}
                value={enrollDeptId}
                onChange={(e) => { setEnrollDeptId(e.target.value); setEnrollSectionId(''); }}
                className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!enrollBatchId ? 'Select a batch first' : availableDepts.length === 0 ? 'No departments' : 'Select Department…'}
                </option>
                {availableDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-body dark:text-gray-400 mb-1.5 uppercase tracking-wide">Section</label>
              <select
                disabled={(role === 'STUDENT' && !isEditing) || !enrollDeptId || availableSections.length === 0}
                value={enrollSectionId}
                onChange={(e) => setEnrollSectionId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value={role === 'STUDENT' ? "" : "all"}>
                  {!enrollDeptId ? 'Select a department first' : (role === 'STUDENT' ? 'Select Section...' : 'All Sections')}
                </option>
                {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {role === 'FACULTY' && (
            <>
              <button
                onClick={handleFacultyEnroll}
                disabled={!enrollDeptId || enrolling}
                className="flex items-center gap-2 px-6 py-2 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm disabled:opacity-50 shadow-sm"
              >
                {enrolling && <Loader2 className="w-4 h-4 animate-spin" />}
                {enrolling ? 'Enrolling…' : '+ Enroll'}
              </button>

              {/* Currently enrolled departments & sections */}
              {(enrolledDepartments.length > 0 || enrolledSections.length > 0) ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-body dark:text-gray-400 mb-2 uppercase tracking-wide">Currently Enrolled</label>
                  <div className="space-y-2">
                    {enrolledDepartments.map(ed => (
                      <div key={ed.id} className="flex items-center justify-between bg-cream/30 dark:bg-gray-800/30 border border-border-soft dark:border-gray-800 rounded-lg px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold">{ed.name}</p>
                            <span className="text-[10px] bg-maroon text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Dept</span>
                          </div>
                          {ed.batchName && <p className="text-xs text-gray-body dark:text-gray-500 mt-0.5">{ed.batchName}</p>}
                        </div>
                        <button onClick={() => handleUnenroll(ed.id, 'department')} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {enrolledSections.map(es => (
                      <div key={es.id} className="flex items-center justify-between bg-cream/30 dark:bg-gray-800/30 border border-border-soft dark:border-gray-800 rounded-lg px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold">Section {es.name}</p>
                            <span className="text-[10px] bg-gray-500 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Section</span>
                          </div>
                          <p className="text-xs text-gray-body dark:text-gray-500 mt-0.5">{es.departmentName} {es.batchName ? `(${es.batchName})` : ''}</p>
                        </div>
                        <button onClick={() => handleUnenroll(es.id, 'section')} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-border-soft dark:border-gray-800 rounded-xl bg-cream/10 dark:bg-gray-900/30">
                  <p className="text-sm text-gray-body dark:text-gray-500 italic">Not enrolled in any departments yet.</p>
                  <p className="text-xs text-gray-body/60 dark:text-gray-600 mt-1">Select a batch and department above to get started.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save / Edit buttons */}
        <div className="pt-4 border-t border-border-soft dark:border-gray-800 flex gap-4">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm disabled:opacity-50 shadow-sm">
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-cream dark:bg-gray-800 hover:bg-cream-edge/60 dark:hover:bg-gray-700 border border-border-soft dark:border-gray-700 font-bold rounded-full transition-all text-sm">
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
