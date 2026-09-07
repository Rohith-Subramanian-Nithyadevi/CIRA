import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell, ReferenceLine
} from 'recharts';
import { TrendingUp, AlertTriangle, Target, Activity } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

export default function StudentAnalytics() {
  const [timelineData, setTimelineData] = useState([]);
  const [strengthsWeaknesses, setStrengthsWeaknesses] = useState({ strengths: [], weaknesses: [] });
  const [radarData, setRadarData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real scenario we would Promise.all these.
    // For now we fetch them sequentially or mock them safely if the backend fails.
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // Timeline
      const tRes = await apiClient.fetch('/api/v1/student-features/analytics/timeline');
      const tData = await tRes.json();
      setTimelineData(tData);

      // Strengths/Weaknesses
      const swRes = await apiClient.fetch('/api/v1/student-features/analytics/strengths-weaknesses');
      const swData = await swRes.json();
      setStrengthsWeaknesses(swData);

      // Heatmap
      const hRes = await apiClient.fetch('/api/v1/student-features/analytics/heatmap');
      const hData = await hRes.json();
      setHeatmapData(hData);

      // Radar
      const rRes = await apiClient.fetch('/api/v1/student-features/analytics/radar');
      const rData = await rRes.json();
      setRadarData(rData);

    } catch (error) {
      console.error('Failed to fetch analytics', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-white rounded-xl h-[600px] border border-border-soft"></div>;
  }

  // Helper for Heatmap colors
  const getHeatmapColor = (score: number) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-400';
    if (score >= 50) return 'bg-orange-400';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      
      {/* 1. What should I focus on? (Priority Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-maroon/20 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-lg text-red-600"><AlertTriangle className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-bold text-gray-body uppercase tracking-wider mb-1">Critical Focus</p>
            <h3 className="font-serif font-bold text-lg text-ink">Public Speaking</h3>
            <p className="text-xs text-gray-body mt-1">Trending below 50%. See Resource Hub.</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-border-soft shadow-sm flex items-start gap-4">
          <div className="p-3 bg-green-100 rounded-lg text-green-600"><Target className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-bold text-gray-body uppercase tracking-wider mb-1">Strongest Skill</p>
            <h3 className="font-serif font-bold text-lg text-ink">Critical Thinking</h3>
            <p className="text-xs text-gray-body mt-1">Consistent 85%+ across all semesters.</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-border-soft shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><Activity className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-bold text-gray-body uppercase tracking-wider mb-1">Momentum</p>
            <h3 className="font-serif font-bold text-lg text-ink">+12% Overall</h3>
            <p className="text-xs text-gray-body mt-1">You are improving faster than last month.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. Am I improving? (Line Chart) */}
        <div className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-maroon" />
            <h3 className="font-bold text-ink">Am I improving?</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dx={-10} domain={[0, 100]} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="score" stroke="#800000" strokeWidth={3} dot={{r: 4, fill: '#800000', strokeWidth: 0}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. What is my skill profile? (Radar Chart) */}
        <div className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
          <h3 className="font-bold text-ink mb-2">What is my skill profile?</h3>
          <p className="text-xs text-gray-body mb-4">Overall balance across core Life Skills.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis dataKey="subject" tick={{fill: '#4B5563', fontSize: 11, fontWeight: 600}} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Student" dataKey="A" stroke="#800000" fill="#800000" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. What am I good/weak at? (Horizontal Bars) */}
        <div className="bg-white p-6 rounded-xl border border-border-soft shadow-sm flex flex-col justify-between">
          <h3 className="font-bold text-ink mb-6">Strengths vs Weaknesses</h3>
          
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3">Top Strengths</p>
              <div className="space-y-3">
                {strengthsWeaknesses.strengths.map((item: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-ink">{item.topic}</span>
                      <span className="font-bold text-gray-body">{item.score}%</span>
                    </div>
                    <div className="w-full bg-cream-edge rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${item.score}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3">Needs Improvement</p>
              <div className="space-y-3">
                {strengthsWeaknesses.weaknesses.map((item: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-ink">{item.topic}</span>
                      <span className="font-bold text-gray-body">{item.score}%</span>
                    </div>
                    <div className="w-full bg-cream-edge rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full" style={{ width: `${item.score}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. How have skills changed? (Heatmap visualization) */}
        <div className="bg-white p-6 rounded-xl border border-border-soft shadow-sm">
          <h3 className="font-bold text-ink mb-2">How have skills changed over time?</h3>
          <p className="text-xs text-gray-body mb-6">Topic mastery progression by semester.</p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-gray-body pb-3 w-1/3">Topic</th>
                  <th className="text-center font-medium text-gray-body pb-3">Sem 3</th>
                  <th className="text-center font-medium text-gray-body pb-3">Sem 4</th>
                  <th className="text-center font-medium text-gray-body pb-3">Sem 5</th>
                  <th className="text-center font-medium text-gray-body pb-3">Sem 6</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {heatmapData.map((row: any, i: number) => (
                  <tr key={i} className="border-t border-border-soft">
                    <td className="py-3 font-semibold text-ink truncate pr-2">{row.topic}</td>
                    <td className="py-2 px-1"><div className={`h-8 rounded flex items-center justify-center text-white text-xs font-bold ${getHeatmapColor(row.s1)}`}>{row.s1}</div></td>
                    <td className="py-2 px-1"><div className={`h-8 rounded flex items-center justify-center text-white text-xs font-bold ${getHeatmapColor(row.s2)}`}>{row.s2}</div></td>
                    <td className="py-2 px-1"><div className={`h-8 rounded flex items-center justify-center text-white text-xs font-bold ${getHeatmapColor(row.s3)}`}>{row.s3}</div></td>
                    <td className="py-2 px-1"><div className={`h-8 rounded flex items-center justify-center text-white text-xs font-bold ${getHeatmapColor(row.s4)}`}>{row.s4}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-body">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> &lt;50</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-sm"></div> 50-69</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> 70-84</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> 85+</div>
          </div>
        </div>

      </div>
    </div>
  );
}
