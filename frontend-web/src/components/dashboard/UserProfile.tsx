import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useBatches, useDepartments } from '@/hooks/useReferenceData';
import { apiClient, getApiErrorMessage } from '@/lib/apiClient';

export default function UserProfile() {
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  if (user.role === 'FACULTY') return <FacultyReadOnlyProfile initialUser={user} />;
  return <LegacyUserProfile />;
}

function FacultyReadOnlyProfile({ initialUser }: { initialUser: Record<string, any> }) {
  const [user, setUser] = useState(initialUser);
  const [changing, setChanging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient.fetch('/api/v1/auth/me').then((response) => response.json()).then((body) => {
      if (!active || !body?.data?.user) return;
      setUser(body.data.user);
      localStorage.setItem('cira_user', JSON.stringify(body.data.user));
    }).catch((cause) => {
      if (active) setError(getApiErrorMessage(cause, 'Profile details could not be loaded.'));
    });
    return () => { active = false; };
  }, []);

  const validateNewPassword = () => {
    if (newPassword.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(newPassword)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(newPassword)) return 'Password must contain a number.';
    if (newPassword !== confirmPassword) return 'New password and confirmation do not match.';
    return '';
  };

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setSuccess('');
    if (!currentPassword) { setError('Enter your current password.'); return; }
    const validationError = validateNewPassword();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    try {
      await apiClient.fetch('/api/v1/faculty/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setChanging(false);
      setSuccess('Password changed successfully.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Password could not be changed.'));
    } finally { setLoading(false); }
  };

  const fields = [
    ['Full Name', user.name], ['Email Address', user.email], ['Personal Email', user.personalEmail], ['Phone Number', user.phone],
    ['Department', user.department?.name || user.departmentName], ['Designation', user.designation || user.subject],
    ['Employee ID', user.employeeId], ['Role', user.role], ['Approval Status', user.approvalStatus],
  ].filter(([, value]) => value);

  return <section className="w-full max-w-2xl rounded-xl border border-border-soft bg-white p-4 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-[#1A1A1A]">
    <h2 className="mb-6 font-serif text-2xl font-bold text-ink dark:text-cream">My Profile</h2>
    {success && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</p>}
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <dl className="space-y-4">{fields.map(([label, value]) => <div key={label}>
      <dt className="text-sm font-semibold text-gray-body dark:text-gray-400">{label}</dt>
      <dd className="mt-1 rounded-lg border border-border-soft bg-cream/40 px-4 py-2.5 text-ink dark:border-gray-700 dark:bg-gray-800 dark:text-cream">{String(value)}</dd>
    </div>)}</dl>
    {user.authProvider === 'GOOGLE' ? <p className="mt-6 text-sm text-gray-body">Your password is managed by Google.</p> : !changing ? <button type="button" onClick={() => { setError(''); setSuccess(''); setChanging(true); }} className="mt-6 rounded-full bg-maroon px-6 py-2.5 text-sm font-bold text-white hover:bg-maroon-deep">Change Password</button> :
      <form onSubmit={submitPasswordChange} className="mt-6 space-y-4" noValidate>
        <h3 className="font-serif text-lg font-bold text-ink dark:text-cream">Change Password</h3>
        {([['Current Password', currentPassword, setCurrentPassword], ['New Password', newPassword, setNewPassword], ['Confirm New Password', confirmPassword, setConfirmPassword]] as const).map(([label, value, setter]) => <label key={label} className="block text-sm font-semibold text-gray-body dark:text-gray-400">{label}
          <input type="password" autoComplete={label === 'Current Password' ? 'current-password' : 'new-password'} value={value} onChange={(event) => setter(event.target.value)} className="mt-1 w-full rounded-lg border border-border-soft bg-white px-4 py-2 text-ink focus:border-maroon focus:outline-none dark:border-gray-700 dark:bg-[#222] dark:text-cream" />
        </label>)}
        <p className="text-xs text-gray-body">Use at least 8 characters, including an uppercase letter and a number.</p>
        <div className="flex gap-3"><button type="submit" disabled={loading} className="rounded-full bg-maroon px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Changing…' : 'Update Password'}</button>
          <button type="button" disabled={loading} onClick={() => { setChanging(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setError(''); }} className="rounded-full border border-border-soft px-6 py-2.5 text-sm font-bold text-ink dark:border-gray-700 dark:text-cream">Cancel</button></div>
      </form>}
  </section>;
}

function LegacyUserProfile() {
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
  const { theme, setTheme } = useTheme();

  // Student class details
  const [enrollBatchId, setEnrollBatchId] = useState(user.department?.batchId || user.department?.batch?.id || '');
  const [enrollDeptId, setEnrollDeptId] = useState(user.departmentId || user.department?.id || '');
  const [enrollSectionId, setEnrollSectionId] = useState(user.sectionId || user.section?.id || '');

  // Cascading reference data
  const { batches } = useBatches();
  const { departments: deptsByBatch } = useDepartments(enrollBatchId, { enabled: !!enrollBatchId });

  // Always fetch fresh profile details on mount from database
  useEffect(() => {
    let isMounted = true;
    apiClient.fetch('/api/v1/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!isMounted || !data?.data?.user) return;
        const u = data.data.user;
        localStorage.setItem('cira_user', JSON.stringify(u));
        setName(u.name || '');
        setPhone(u.phone || '');
        if (u.rollNumber) setRollNumber(u.rollNumber);
        const batchId = u.department?.batchId || u.department?.batch?.id || '';
        if (batchId) setEnrollBatchId(batchId);
        if (u.departmentId || u.department?.id) setEnrollDeptId(u.departmentId || u.department?.id);
        if (u.sectionId || u.section?.id) setEnrollSectionId(u.sectionId || u.section?.id);
      })
      .catch(console.error);

    return () => { isMounted = false; };
  }, []);

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
          setName(updatedUser.name || '');
          setPhone(updatedUser.phone || '');
          setRollNumber(updatedUser.rollNumber || '');
          setEnrollBatchId(updatedUser.department?.batchId || updatedUser.department?.batch?.id || enrollBatchId);
          setEnrollDeptId(updatedUser.departmentId || enrollDeptId);
          setEnrollSectionId(updatedUser.sectionId || enrollSectionId);
          window.dispatchEvent(new Event('cira_user_updated'));
          setSuccess('Profile updated successfully!');
          setIsEditing(false);
        } else {
          const errData = await res.json();
          setError(errData.details ? `${errData.error}: ${errData.details}` : (errData.error || 'Failed to update profile'));
        }
      } else {
        const updatedUser = { ...user, name, phone };
        localStorage.setItem('cira_user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('cira_user_updated'));
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

  // Departments in the selected batch
  const availableDepts = deptsByBatch;
  const selectedDept = deptsByBatch.find(d => d.id === enrollDeptId);
  const availableSections = selectedDept?.sections || [];

  return (
    <div className="w-full max-w-2xl bg-white dark:bg-[#1A1A1A] rounded-xl border border-border-soft dark:border-gray-800 p-4 sm:p-8 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif font-bold text-ink dark:text-ink">User Profile</h2>
        
        {/* Theme Toggle */}
        <div className="flex bg-cream dark:bg-gray-800 rounded-full p-1 border border-border-soft dark:border-gray-700">
          <button 
            onClick={() => setTheme('light')} 
            className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-white shadow-sm text-maroon' : 'text-gray-body hover:text-ink dark:hover:text-cream'}`}
            title="Light Mode"
          >
            Light
          </button>
          <button 
            onClick={() => setTheme('dark')} 
            className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-gray-700 shadow-sm text-cream' : 'text-gray-body hover:text-ink dark:hover:text-cream'}`}
            title="Dark Mode"
          >
            Dark
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

      <div className="space-y-6 text-ink dark:text-ink">
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

        {/* ── DEPARTMENT / SECTION (STUDENT) ── */}
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
                {enrollBatchId && !batches.some(b => b.id === enrollBatchId) && (
                  <option value={enrollBatchId}>{user.department?.batch?.name || 'Current Batch'}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-body dark:text-gray-400 mb-1.5 uppercase tracking-wide">Department</label>
              <select
                disabled={(role === 'STUDENT' && !isEditing) || !enrollBatchId || (availableDepts.length === 0 && !enrollDeptId)}
                value={enrollDeptId}
                onChange={(e) => { setEnrollDeptId(e.target.value); setEnrollSectionId(''); }}
                className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!enrollBatchId ? 'Select a batch first' : availableDepts.length === 0 ? 'No departments' : 'Select Department…'}
                </option>
                {availableDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                {enrollDeptId && !availableDepts.some(d => d.id === enrollDeptId) && (
                  <option value={enrollDeptId}>{user.department?.name || 'Current Department'}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-body dark:text-gray-400 mb-1.5 uppercase tracking-wide">Section</label>
              <select
                disabled={(role === 'STUDENT' && !isEditing) || !enrollDeptId || (availableSections.length === 0 && !enrollSectionId)}
                value={enrollSectionId}
                onChange={(e) => setEnrollSectionId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-border-soft dark:border-gray-700 rounded-lg focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value={role === 'STUDENT' ? "" : "all"}>
                  {!enrollDeptId ? 'Select a department first' : (role === 'STUDENT' ? 'Select Section...' : 'All Sections')}
                </option>
                {availableSections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                {enrollSectionId && enrollSectionId !== 'all' && !availableSections.some(s => s.id === enrollSectionId) && (
                  <option value={enrollSectionId}>Section {user.section?.name || enrollSectionId}</option>
                )}
              </select>
            </div>
          </div>


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
