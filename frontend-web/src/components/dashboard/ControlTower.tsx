import { useState, useEffect } from 'react';
import { Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  department: { name: string } | null;
  section: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function ControlTower() {
  const [filterDept, setFilterDept] = useState('All');
  const [filterSection, setFilterSection] = useState('All');
  const [students, setStudents] = useState<Student[]>([]);
  const [enrolledDepartments, setEnrolledDepartments] = useState<Department[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const token = localStorage.getItem('cira_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const [deptRes, stdRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/faculty/departments`, { headers }),
          fetch(`${baseUrl}/api/v1/faculty/students`, { headers })
        ]);

        const deptData = await deptRes.json();
        const stdData = await stdRes.json();

        if (deptData.data?.departments) setEnrolledDepartments(deptData.data.departments);
        if (stdData.data?.students) setStudents(stdData.data.students);
      } catch (err) {
        console.error("Failed to fetch ControlTower data", err);
      }
    };
    fetchData();
  }, []);

  // Simulated filtering logic
  const filteredStudents = students.filter(s => {
    return (filterDept === 'All' || s.department?.name === filterDept) &&
           (filterSection === 'All' || s.section?.name === filterSection);
  });

  return (
    <div className="space-y-6">
      
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 lg:col-span-1">
          <h3 className="text-lg font-bold mb-6">Campus Population by Band</h3>
          <div className="h-[250px] w-full flex items-center justify-center border border-dashed border-slate-700 rounded-lg">
            <p className="text-slate-500">No population data available yet.</p>
          </div>
        </div>

        {/* Global KPIs (Placeholders) */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col justify-center gap-6">
           <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-800">
               <p className="text-sm text-slate-400 font-medium mb-1">Total Enrolled Students</p>
               <p className="text-3xl font-bold text-white">{students.length}</p>
             </div>
             <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-800">
               <p className="text-sm text-slate-400 font-medium mb-1">Active Remediation</p>
               <p className="text-3xl font-bold text-purple-400">0</p>
             </div>
             <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-800">
               <p className="text-sm text-slate-400 font-medium mb-1">Avg Placement Prob.</p>
               <p className="text-3xl font-bold text-blue-400">0.0%</p>
             </div>
             <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-800">
               <p className="text-sm text-slate-400 font-medium mb-1">Critical Deficits</p>
               <p className="text-3xl font-bold text-red-400">0</p>
             </div>
           </div>
        </div>
      </div>

      {/* Multi-Column Data Table */}
      <div className="glass-card flex flex-col">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold">Aggregated Placement Matrix</h3>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search students..." 
                className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-full md:w-64"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                className="bg-slate-950 border border-slate-800 rounded-lg text-sm px-3 py-2 text-slate-300 focus:outline-none"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="All">All Departments</option>
                {enrolledDepartments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              
              <select 
                className="bg-slate-950 border border-slate-800 rounded-lg text-sm px-3 py-2 text-slate-300 focus:outline-none"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="All">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800">
                <th className="px-6 py-4">Student ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Section</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-800/50">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-400">{student.rollNumber || 'N/A'}</td>
                  <td className="px-6 py-4 font-medium text-slate-200">{student.name}</td>
                  <td className="px-6 py-4 text-slate-400">{student.department?.name || 'N/A'}</td>
                  <td className="px-6 py-4 text-slate-400">{student.section?.name || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium">Enrolled</span>
                  </td>
                </tr>

              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No students match the current filtration parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400">
          <div>Showing 1 to {filteredStudents.length} of {students.length} results</div>
          <div className="flex gap-1">
            <button className="p-2 rounded hover:bg-slate-800 transition-colors disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded font-medium">1</button>
            <button className="px-3 py-1 hover:bg-slate-800 rounded transition-colors">2</button>
            <button className="px-3 py-1 hover:bg-slate-800 rounded transition-colors">3</button>
            <button className="p-2 rounded hover:bg-slate-800 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
