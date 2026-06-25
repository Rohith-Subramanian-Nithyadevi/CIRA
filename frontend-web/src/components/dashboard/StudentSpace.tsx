import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Download, FileText } from 'lucide-react';

const performanceData = [
  { week: 'Week 1', score: 65 },
  { week: 'Week 2', score: 72 },
  { week: 'Week 3', score: 68 },
  { week: 'Week 4', score: 85 },
  { week: 'Week 5', score: 82 },
  { week: 'Week 6', score: 91 },
];

const deficitData = [
  { subject: 'OSI Model', A: 45, fullMark: 100 },
  { subject: 'Binary Trees', A: 85, fullMark: 100 },
  { subject: 'Normalization', A: 50, fullMark: 100 },
  { subject: 'Sorting Algos', A: 90, fullMark: 100 },
  { subject: 'SQL Joins', A: 60, fullMark: 100 },
  { subject: 'Hashing', A: 75, fullMark: 100 },
];

const assignments = [
  { id: 1, title: 'Adaptive DB Normalization', date: 'Oct 24', status: 'Generated' },
  { id: 2, title: 'OSI Layers deep dive', date: 'Oct 18', status: 'Completed' },
  { id: 3, title: 'SQL Joins Practice', date: 'Oct 12', status: 'Completed' },
];

export default function StudentSpace() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Historical Performance Trendline */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6 flex items-center">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
            Performance Trajectory
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="week" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Deficit Mapping Radar */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6 flex items-center">
            <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
            Knowledge Deficits
          </h3>
          <div className="h-[300px] w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={deficitData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                <Radar name="Student" dataKey="A" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.3} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Remediation Tracking */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-4">NLP-Generated Remediation Assignments</h3>
        <p className="text-sm text-slate-400 mb-6">These adaptive assignments are algorithmically targeted towards your mapped vulnerabilities.</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-sm text-slate-400">
                <th className="pb-3 font-medium">Assignment Title</th>
                <th className="pb-3 font-medium">Date Issued</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-3 text-slate-500" />
                      <span className="font-medium text-slate-200">{item.title}</span>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-slate-400">{item.date}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                      item.status === 'Generated' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors">
                      <Download className="w-3 h-3 mr-1.5" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
