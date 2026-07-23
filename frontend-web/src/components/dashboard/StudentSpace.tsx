import { useState, useEffect } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

export default function StudentSpace() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/student/dashboard');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const { performanceTrajectory, knowledgeDeficits, assignments } = data || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Historical Performance Trendline */}
        <div className="bg-white border border-border-soft p-6 lg:col-span-2 rounded-xl shadow-sm">
          <h3 className="text-lg font-serif font-bold mb-6 flex items-center text-ink">
            <span className="w-2 h-2 rounded-full bg-maroon mr-2"></span>
            Performance Trajectory
          </h3>
          <div className="h-[300px] w-full flex items-center justify-center border border-dashed border-border-soft rounded-xl bg-cream/20 overflow-hidden">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-gray-body" />
            ) : performanceTrajectory && performanceTrajectory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceTrajectory} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }}
                    itemStyle={{ color: '#0f172a' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#800000" strokeWidth={3} dot={{ r: 4, fill: '#800000' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-body text-sm italic">No performance data available yet.</p>
            )}
          </div>
        </div>

        {/* Deficit Mapping Radar */}
        <div className="bg-white border border-border-soft p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-serif font-bold mb-6 flex items-center text-ink">
            <span className="w-2 h-2 rounded-full bg-maroon mr-2"></span>
            Knowledge Deficits
          </h3>
          <div className="h-[300px] w-full flex items-center justify-center border border-dashed border-border-soft rounded-xl bg-cream/20 overflow-hidden">
            {loading ? (
               <Loader2 className="w-6 h-6 animate-spin text-gray-body" />
            ) : knowledgeDeficits && knowledgeDeficits.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={knowledgeDeficits}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#800000" fill="#800000" fillOpacity={0.4} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-body text-sm italic">No analysis available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Remediation Tracking */}
      <div className="bg-white border border-border-soft p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-serif font-bold mb-1 text-ink">NLP-Generated Remediation Assignments</h3>
        <p className="text-sm text-gray-body mb-6">These adaptive assignments are algorithmically targeted towards your mapped vulnerabilities.</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-ink">
            <thead>
              <tr className="border-b border-border-soft text-xs uppercase text-gray-body">
                <th className="pb-3 font-semibold">Assignment Title</th>
                <th className="pb-3 font-semibold">Date Issued</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-body mx-auto" />
                  </td>
                </tr>
              ) : assignments && assignments.length > 0 ? assignments.map((item: any) => (
                <tr key={item.id} className="border-b border-border-soft hover:bg-cream/20 transition-colors">
                  <td className="py-4 font-semibold text-ink">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-3 text-maroon" />
                      <span>{item.title}</span>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-gray-body">{item.date}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      item.status === 'Generated' ? 'bg-maroon/10 text-maroon border-maroon/20' : 'bg-green-50/10 text-green-700 border-green-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-cream hover:bg-cream-edge/60 border border-border-soft text-ink rounded-lg transition-colors">
                      <Download className="w-3 h-3 mr-1.5 text-maroon" /> PDF
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-body italic text-sm">No assignments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
