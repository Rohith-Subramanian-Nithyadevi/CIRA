import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, CheckCircle, Star, ExternalLink, Activity } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface SheetViewProps {
  sheetId: string;
  onBack: () => void;
}

export default function SheetView({ sheetId, onBack }: SheetViewProps) {
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<string[]>([]);

  useEffect(() => {
    fetchSheet();
  }, [sheetId]);

  const fetchSheet = async () => {
    setLoading(true);
    try {
      const res = await apiClient.fetch(`/api/v1/student/resources/sheet/${sheetId}`);
      const data = await res.json();
      if (data.success) {
        setSheet(data.data);
        if (data.data.sheetTopics.length > 0) {
          setExpandedTopics([data.data.sheetTopics[0].id]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sheet', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => 
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const updateProgress = async (questionId: string, status?: string, markedForRevision?: boolean) => {
    try {
      const payload: any = {};
      if (status !== undefined) payload.status = status;
      if (markedForRevision !== undefined) payload.markedForRevision = markedForRevision;

      await apiClient.fetch(`/api/v1/student/resources/sheet/question/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchSheet(); // refresh state
    } catch (error) {
      console.error('Error updating progress', error);
    }
  };

  if (loading) return <div className="p-8 text-center"><Activity className="w-8 h-8 animate-spin mx-auto text-maroon" /></div>;
  if (!sheet) return <div className="p-8 text-center text-red-500">Failed to load sheet</div>;

  let totalSolved = 0;
  sheet.sheetTopics.forEach((t: any) => {
    t.questions.forEach((q: any) => {
      if (q.studentProgress.length > 0 && q.studentProgress[0].status === 'SOLVED') totalSolved++;
    });
  });
  const progressPercent = sheet.totalQuestions > 0 ? Math.round((totalSolved / sheet.totalQuestions) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-border-soft bg-cream/20 shrink-0">
        <button onClick={onBack} className="flex items-center text-gray-body hover:text-maroon text-sm font-bold mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Resources
        </button>
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-serif font-bold text-ink">{sheet.title}</h2>
            <p className="text-gray-body text-sm mt-1">{sheet.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-maroon">{progressPercent}%</div>
            <div className="text-xs text-gray-body uppercase tracking-wider font-semibold">{totalSolved} / {sheet.totalQuestions} Solved</div>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
          <div className="bg-maroon h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 max-w-4xl mx-auto">
          {sheet.sheetTopics.map((topic: any) => {
            const isExpanded = expandedTopics.includes(topic.id);
            const topicSolved = topic.questions.filter((q: any) => q.studentProgress[0]?.status === 'SOLVED').length;
            
            return (
              <div key={topic.id} className="border border-border-soft rounded-xl overflow-hidden bg-white shadow-sm">
                <button 
                  onClick={() => toggleTopic(topic.id)}
                  className="w-full flex items-center justify-between p-4 bg-cream/10 hover:bg-cream/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-ink">{topic.name}</span>
                    <span className="text-xs bg-white px-2 py-1 rounded-full border border-border-soft text-gray-body font-semibold">
                      {topicSolved} / {topic.questions.length}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-body" /> : <ChevronDown className="w-5 h-5 text-gray-body" />}
                </button>
                
                {isExpanded && (
                  <div className="divide-y divide-border-soft">
                    {topic.questions.map((q: any, i: number) => {
                      const isSolved = q.studentProgress[0]?.status === 'SOLVED';
                      const isMarked = q.studentProgress[0]?.markedForRevision;
                      
                      return (
                        <div key={q.id} className={`flex items-center p-3 sm:p-4 hover:bg-gray-50 transition-colors ${isSolved ? 'bg-green-50/30' : ''}`}>
                          <button 
                            onClick={() => updateProgress(q.id, isSolved ? 'UNSOLVED' : 'SOLVED')}
                            className="mr-4 text-gray-300 hover:text-green-500 transition-colors"
                          >
                            <CheckCircle className={`w-6 h-6 ${isSolved ? 'text-green-500 fill-green-50' : ''}`} />
                          </button>
                          
                          <div className="flex-1">
                            <a href={q.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-maroon text-sm flex items-center group">
                              {i + 1}. {q.title}
                              <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                              q.difficulty === 'EASY' ? 'text-green-700 bg-green-50 border-green-200' : 
                              q.difficulty === 'MEDIUM' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 
                              'text-red-700 bg-red-50 border-red-200'
                            }`}>
                              {q.difficulty}
                            </span>
                            
                            <button 
                              onClick={() => updateProgress(q.id, undefined, !isMarked)}
                              title="Mark for revision"
                              className={`transition-colors ${isMarked ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}
                            >
                              <Star className={`w-5 h-5 ${isMarked ? 'fill-yellow-500' : ''}`} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
