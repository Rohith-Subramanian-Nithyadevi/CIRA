import { useState, useEffect } from 'react';
import { CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { useBatches, useDepartments } from '@/hooks/useReferenceData';

export default function UserProfile() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token');
  const user = JSON.parse(localStorage.getItem('cira_user') || '{}');
  const role = user.role || 'STUDENT';

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Enrollment state
  const [enrolledDepartments, setEnrolledDepartments] = useState<{ id: string; name: string; batchName?: string; type?: string; departmentName?: string }[]>([]);
  const [enrolledSections, setEnrolledSections] = useState<{ id: string; name: string; batchName?: string; departmentName?: string; type?: string }[]>([]);
  const [enrollBatchId, setEnrollBatchId] = useState('');
  const [enrollDeptId, setEnrollDeptId] = useState('');
  const [enrollSectionId, setEnrollSectionId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Cascading reference data
  const { batches } = useBatches();
  const { departments: deptsByBatch } = useDepartments(enrollBatchId, { enabled: !!enrollBatchId });

  // Fetch already-enrolled departments on mount
  useEffect(() => {
    if (role === 'FACULTY' && token) {
      fetch(`${baseUrl}/api/v1/faculty/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data?.data?.departments) setEnrolledDepartments(data.data.departments);
          if (data?.data?.sections) setEnrolledSections(data.data.sections);
        })
        .catch(console.error);
    }
  }, [role]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    // Profile updates saved to local storage (placeholder — extend with real API if needed)
    setTimeout(() => {
      const updatedUser = { ...user, name, phone };
      localStorage.setItem('cira_user', JSON.stringify(updatedUser));
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }, 500);
  };

  const handleEnroll = async () => {
    if (!enrollDeptId) return;
    setEnrolling(true);
    setError('');
    try {
      const payload: any = { departmentId: enrollDeptId };
      if (enrollSectionId && enrollSectionId !== 'all') {
        payload.sectionId = enrollSectionId;
      }

      const res = await fetch(`${baseUrl}/api/v1/faculty/enroll`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
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
      } else {
        setError(data?.message || data?.status || 'Enrollment failed. You may already be enrolled.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (id: string, type: 'department' | 'section') => {
    try {
      const endpoint = type === 'department' ? `/api/v1/faculty/enroll/${id}` : `/api/v1/faculty/enroll/section/${id}`;
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (type === 'department') {
          setEnrolledDepartments(prev => prev.filter(d => d.id !== id));
        } else {
          setEnrolledSections(prev => prev.filter(s => s.id !== id));
        }
        setSuccess('Unenrolled successfully.');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to unenroll. Please try again.');
    }
  };

  // Departments in the selected batch
  const availableDepts = deptsByBatch;
  const selectedDept = deptsByBatch.find(d => d.id === enrollDeptId);
  const availableSections = selectedDept?.sections || [];

  return (
    <div className="max-w-2xl bg-white rounded-xl border border-border-soft p-8 shadow-sm text-ink">
      <h2 className="text-2xl font-serif font-bold text-ink mb-6">User Profile</h2>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-4 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Full Name */}
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

        {/* Email (read-only) */}
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

        {/* Phone */}
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

        {/* Password (only visible in edit mode) */}
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

        {/* ── FACULTY ENROLLMENT SECTION ── */}
        {role === 'FACULTY' && (
          <div className="space-y-5 pt-5 border-t border-border-soft">
            <div>
              <h3 className="text-lg font-serif font-bold text-ink">Department Enrollment</h3>
              <p className="text-xs text-gray-body mt-0.5">Select a batch then a department to enroll. Only enrolled departments appear in Student Reports.</p>
            </div>

            {/* Batch → Department → Section cascading selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-body mb-1.5 uppercase tracking-wide">Batch</label>
                <select
                  value={enrollBatchId}
                  onChange={(e) => { setEnrollBatchId(e.target.value); setEnrollDeptId(''); setEnrollSectionId(''); }}
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none"
                >
                  <option value="">Select Batch…</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-body mb-1.5 uppercase tracking-wide">Department</label>
                <select
                  value={enrollDeptId}
                  onChange={(e) => { setEnrollDeptId(e.target.value); setEnrollSectionId(''); }}
                  disabled={!enrollBatchId || availableDepts.length === 0}
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!enrollBatchId ? 'Select a batch first' : availableDepts.length === 0 ? 'No departments' : 'Select Department…'}
                  </option>
                  {availableDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-body mb-1.5 uppercase tracking-wide">Section (Optional)</label>
                <select
                  value={enrollSectionId}
                  onChange={(e) => setEnrollSectionId(e.target.value)}
                  disabled={!enrollDeptId || availableSections.length === 0}
                  className="w-full px-3 py-2 bg-white border border-border-soft rounded-lg text-ink focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon transition-colors text-sm font-semibold appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="all">
                    {!enrollDeptId ? 'Select a department first' : 'All Sections (Whole Dept)'}
                  </option>
                  {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={handleEnroll}
              disabled={!enrollDeptId || enrolling}
              className="flex items-center gap-2 px-6 py-2 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm disabled:opacity-50 shadow-sm"
            >
              {enrolling && <Loader2 className="w-4 h-4 animate-spin" />}
              {enrolling ? 'Enrolling…' : '+ Enroll'}
            </button>

            {/* Currently enrolled departments & sections */}
            {(enrolledDepartments.length > 0 || enrolledSections.length > 0) ? (
              <div>
                <label className="block text-xs font-semibold text-gray-body mb-2 uppercase tracking-wide">Currently Enrolled</label>
                <div className="space-y-2">
                  {enrolledDepartments.map(ed => (
                    <div key={ed.id} className="flex items-center justify-between bg-cream/30 border border-border-soft rounded-lg px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-ink">{ed.name}</p>
                          <span className="text-[10px] bg-maroon text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Dept</span>
                        </div>
                        {ed.batchName && <p className="text-xs text-gray-body mt-0.5">{ed.batchName}</p>}
                      </div>
                      <button
                        onClick={() => handleUnenroll(ed.id, 'department')}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Unenroll"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {enrolledSections.map(es => (
                    <div key={es.id} className="flex items-center justify-between bg-cream/30 border border-border-soft rounded-lg px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-ink">Section {es.name}</p>
                          <span className="text-[10px] bg-gray-500 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Section</span>
                        </div>
                        <p className="text-xs text-gray-body mt-0.5">{es.departmentName} {es.batchName ? `(${es.batchName})` : ''}</p>
                      </div>
                      <button
                        onClick={() => handleUnenroll(es.id, 'section')}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Unenroll"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-border-soft rounded-xl bg-cream/10">
                <p className="text-sm text-gray-body italic">Not enrolled in any departments yet.</p>
                <p className="text-xs text-gray-body/60 mt-1">Select a batch and department above to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Save / Edit buttons */}
        <div className="pt-4 border-t border-border-soft flex gap-4">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full transition-all text-sm disabled:opacity-50 shadow-sm">
                {loading ? 'Saving…' : 'Save Changes'}
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
