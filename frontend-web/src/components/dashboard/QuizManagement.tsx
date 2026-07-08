import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

export default function QuizManagement() {
  const [activeView, setActiveView] = useState<'list' | 'create' | 'add_questions' | 'grade_submissions' | 'evaluate_attempt'>('list');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create Form State
  const [formData, setFormData] = useState({
    title: '', subject: '', description: '', totalMarks: '', passingMarks: '',
    durationMinutes: '60', startDate: '', endDate: '',
    targetDepartments: [] as string[], targetSections: [] as string[],
  });

  // Questions State
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([{ type: 'MCQ', text: '', marks: 1, options: ['', '', '', ''], answerKey: '' }]);

  // Grading State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<Record<string, number>>({});
  const [facultyFeedback, setFacultyFeedback] = useState('');

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const token = localStorage.getItem('cira_token');

  useEffect(() => {
    fetchQuizzes();
    fetchDepartments();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.data) setQuizzes(data.data);
    } catch (err) { console.error(err); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/departments`);
      const data = await res.json();
      if (data?.data?.departments) setDepartments(data.data.departments);
    } catch (err) { console.error(err); }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/${quizId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data?.status === 'success') fetchQuizzes();
      else toast.error('Failed to delete quiz: ' + data.message);
    } catch (err) { console.error(err); }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      if (payload.startDate) payload.startDate = new Date(payload.startDate).toISOString();
      if (payload.endDate) payload.endDate = new Date(payload.endDate).toISOString();

      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.status === 'success') {
        toast.success('Quiz created successfully! Now add questions.');
        setActiveQuizId(data.data.id);
        setActiveView('add_questions');
        fetchQuizzes();
      } else toast.error('Failed to create quiz: ' + data.message);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSaveQuestions = async () => {
    if (!activeQuizId) return;
    setLoading(true);
    // Sanitize matching options
    const sanitizedQuestions = questions.map(q => {
      if (q.type === 'MATCHING') {
        return { ...q, answerKey: q.options }; // option array acts as the correct pair key
      }
      return q;
    });

    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/${activeQuizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ questions: sanitizedQuestions })
      });
      const data = await res.json();
      if (data?.status === 'success') {
        toast.success('Questions saved successfully!');
        setActiveView('list');
        fetchQuizzes();
      } else toast.error('Failed to save questions: ' + data.message);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleUploadDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    toast.info('Parsing DOCX... this might take a moment.');
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/upload-docx`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data?.status === 'success' && data.data) {
        toast.success('DOCX parsed successfully! Please review the questions.');
        setQuestions(data.data);
      } else {
        toast.error('Failed to parse DOCX: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error uploading DOCX');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleImageUpload = async (qIndex: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    toast.info('Uploading image...');
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data?.status === 'success' && data.data?.url) {
        toast.success('Image uploaded!');
        updateQuestion(qIndex, 'image', data.data.url);
      } else {
        toast.error('Failed to upload image');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error uploading image');
    }
  };

  const handleAddQuestionRow = () => {
    setQuestions([...questions, { type: 'MCQ', text: '', marks: 1, options: ['', '', '', ''], answerKey: '' }]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const newQs = [...questions];
    newQs[index][field] = value;
    setQuestions(newQs);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const newQs = [...questions];
    newQs[qIndex].options[optIndex] = value;
    setQuestions(newQs);
  };

  const updateMatchingOption = (qIndex: number, optIndex: number, field: 'left' | 'right', value: string) => {
    const newQs = [...questions];
    if (!Array.isArray(newQs[qIndex].options)) {
      newQs[qIndex].options = [{ left: '', right: '' }];
    }
    newQs[qIndex].options[optIndex][field] = value;
    setQuestions(newQs);
  };

  const handleOpenGradeView = async (quizId: string) => {
    setActiveQuizId(quizId);
    setActiveView('grade_submissions');
    try {
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/${quizId}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.status === 'success') setSubmissions(data.data);
    } catch (err) { console.error(err); }
  };

  const handleOpenAttempt = (attempt: any) => {
    setActiveAttempt(attempt);
    setFacultyFeedback(attempt.facultyFeedback || '');
    const initialEvals: Record<string, number> = {};
    attempt.responses?.forEach((r: any) => {
      initialEvals[r.id] = r.marksAwarded || 0;
    });
    setEvaluations(initialEvals);
    setActiveView('evaluate_attempt');
  };

  const handleSaveEvaluation = async () => {
    try {
      setLoading(true);
      const evalsArray = Object.keys(evaluations).map(respId => ({ responseId: respId, marks: evaluations[respId] }));
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/attempt/${activeAttempt.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ evaluations: evalsArray, facultyFeedback })
      });
      const data = await res.json();
      if (data?.status === 'success') {
        toast.success('Evaluation saved!');
        handleOpenGradeView(activeQuizId!);
      } else toast.error('Error: ' + data.message);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const availableSections = departments.filter(d => formData.targetDepartments.includes(d.id)).flatMap(d => d.sections || []);

  if (activeView === 'create') {
    return (
      <Card className="bg-white border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-serif font-bold text-ink">Create New Quiz</h2>
            <button onClick={() => setActiveView('list')} className="text-maroon hover:text-maroon-deep font-semibold text-sm">Cancel</button>
          </div>
          
          <form onSubmit={handleCreateQuiz} className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-ink font-semibold">Quiz Title</Label>
                <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} type="text" className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
              </div>
              <div className="space-y-2">
                <Label className="text-ink font-semibold">Subject</Label>
                <Input value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} type="text" className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-ink font-semibold">Instructions</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-ink font-semibold">Total Marks</Label>
                <Input value={formData.totalMarks} onChange={e => setFormData({...formData, totalMarks: e.target.value})} type="number" className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
              </div>
              <div className="space-y-2">
                <Label className="text-ink font-semibold">Passing Marks</Label>
                <Input value={formData.passingMarks} onChange={e => setFormData({...formData, passingMarks: e.target.value})} type="number" className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
              </div>
              <div className="space-y-2">
                <Label className="text-ink font-semibold">Duration (mins)</Label>
                <Input value={formData.durationMinutes} onChange={e => setFormData({...formData, durationMinutes: e.target.value})} type="number" className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-ink font-semibold">Start Time</Label>
                <Input value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} type="datetime-local" className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
              </div>
              <div className="space-y-2">
                <Label className="text-ink font-semibold">End Time</Label>
                <Input value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} type="datetime-local" className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-4 bg-cream/40 rounded-xl border border-border-soft">
                <Label className="block mb-2 text-ink font-semibold">Target Departments (Hold Ctrl)</Label>
                <select multiple value={formData.targetDepartments} onChange={e => setFormData({...formData, targetDepartments: Array.from(e.target.selectedOptions).map(o => o.value)})} className="w-full bg-white border border-border-soft rounded-lg px-4 py-2 text-ink h-32 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none text-sm">
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-2 p-4 bg-cream/40 rounded-xl border border-border-soft">
                <Label className="block mb-2 text-ink font-semibold">Target Sections</Label>
                <select multiple value={formData.targetSections} onChange={e => setFormData({...formData, targetSections: Array.from(e.target.selectedOptions).map(o => o.value)})} className="w-full bg-white border border-border-soft rounded-lg px-4 py-2 text-ink h-32 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none text-sm disabled:opacity-50" disabled={availableSections.length === 0}>
                  {availableSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="bg-maroon hover:bg-maroon-deep text-white font-bold h-10 px-6 rounded-full transition-all">{loading ? 'Creating...' : 'Save & Add Questions'}</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (activeView === 'add_questions') {
    return (
      <Card className="bg-white border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-serif font-bold text-ink">Add Questions to Quiz</h2>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer px-4 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full text-xs font-bold transition-all shadow-sm">
                Upload .docx
                <input type="file" accept=".docx" className="hidden" onChange={handleUploadDocx} />
              </label>
              <button onClick={() => setActiveView('list')} className="text-maroon hover:text-maroon-deep font-semibold text-sm">Cancel</button>
            </div>
          </div>
          
          <div className="space-y-6">
            {questions.map((q, qIndex) => {
              if (q.type === 'MATCHING' && (!q.options || typeof q.options[0] !== 'object')) {
                q.options = [{ left: '', right: '' }, { left: '', right: '' }];
              }
              return (
                <div key={qIndex} className="p-5 bg-cream/30 rounded-xl border border-border-soft space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-ink">Question {qIndex + 1}</h3>
                    <select value={q.type} onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)} className="bg-white border border-border-soft rounded-lg px-3 py-1 text-xs text-ink focus:border-maroon outline-none font-semibold shadow-sm">
                      <option value="MCQ">MCQ (Single)</option>
                      <option value="MULTI_SELECT">MCQ (Multiple)</option>
                      <option value="NUMERICAL">Numerical</option>
                      <option value="SHORT_WRITTEN">Short Written</option>
                      <option value="LONG_WRITTEN">Long Written</option>
                      <option value="MATCHING">Match the Following</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-body block mb-1">Question Text</Label>
                    <Textarea value={q.text} onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} rows={2} className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                  </div>

                  {q.validationError && (
                    <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm mt-2 font-medium">
                      ⚠️ Validation Error: {q.validationError}
                    </div>
                  )}

                  {q.image && (
                    <div className="mt-2">
                      <img src={q.image} alt={`Question ${qIndex + 1}`} className="max-w-md max-h-64 object-contain rounded-xl border border-border-soft" />
                    </div>
                  )}

                  <div className="mt-2">
                    <label className="text-xs text-maroon cursor-pointer hover:text-maroon-deep font-semibold">
                      + {q.image ? 'Change Image' : 'Upload Image'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) handleImageUpload(qIndex, e.target.files[0]);
                      }} />
                    </label>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-32">
                      <Label className="text-xs text-gray-body block mb-1">Marks</Label>
                      <Input type="number" value={q.marks} onChange={(e) => updateQuestion(qIndex, 'marks', e.target.value)} className="bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                    </div>
                  </div>

                  {/* Answer Key UI based on Type */}
                  {(q.type === 'MCQ' || q.type === 'MULTI_SELECT') && (
                    <div className="grid grid-cols-2 gap-4 mt-2 bg-white/60 p-4 border border-border-soft rounded-xl">
                      <div className="col-span-2 text-sm font-semibold text-gray-body mb-2">Define Options and Mark the Correct Answer(s):</div>
                      {q.options.map((opt: string, optIndex: number) => (
                        <div key={optIndex} className="flex gap-2 items-center">
                          <Input type="text" value={opt} onChange={(e) => updateOption(qIndex, optIndex, e.target.value)} placeholder={`Option ${optIndex + 1}`} className="flex-1 bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                          {q.type === 'MCQ' ? (
                            <input type="radio" name={`correct-${qIndex}`} checked={q.answerKey === opt} onChange={() => updateQuestion(qIndex, 'answerKey', opt)} className="w-5 h-5 accent-maroon" />
                          ) : (
                            <input type="checkbox" checked={Array.isArray(q.answerKey) && q.answerKey.includes(opt)} onChange={(e) => {
                              let curr = Array.isArray(q.answerKey) ? [...q.answerKey] : [];
                              if (e.target.checked) curr.push(opt);
                              else curr = curr.filter(x => x !== opt);
                              updateQuestion(qIndex, 'answerKey', curr);
                            }} className="w-5 h-5 accent-maroon" />
                          )}
                        </div>
                      ))}
                      <button onClick={() => { const n = [...questions]; n[qIndex].options.push(''); setQuestions(n); }} className="col-span-2 text-left text-sm text-maroon hover:text-maroon-deep font-semibold mt-2">+ Add Option</button>
                    </div>
                  )}

                  {(q.type === 'SHORT_WRITTEN' || q.type === 'LONG_WRITTEN') && (
                    <div className="mt-2">
                      <Label className="text-xs text-green-700 block mb-1 font-semibold">Expected Answer / Answer Key (For Faculty Reference)</Label>
                      <Textarea value={q.answerKey || ''} onChange={(e) => updateQuestion(qIndex, 'answerKey', e.target.value)} rows={q.type === 'LONG_WRITTEN' ? 4 : 2} placeholder="Provide the expected answer points..." className="bg-white border-green-200 focus-visible:ring-green-600 text-ink" />
                    </div>
                  )}

                  {q.type === 'NUMERICAL' && (
                    <div className="mt-2">
                      <Label className="text-xs text-green-700 block mb-1 font-semibold">Exact Numerical Answer</Label>
                      <Input type="number" value={q.answerKey || ''} onChange={(e) => updateQuestion(qIndex, 'answerKey', Number(e.target.value))} placeholder="e.g. 42" className="bg-white border-green-200 focus-visible:ring-green-600 text-ink" />
                    </div>
                  )}

                  {q.type === 'MATCHING' && (
                    <div className="mt-2 bg-white/60 p-4 border border-border-soft rounded-xl">
                      <div className="text-sm font-semibold text-gray-body mb-2">Define Correct Pairs (Left maps to Right):</div>
                      {q.options.map((pair: any, optIndex: number) => (
                        <div key={optIndex} className="flex gap-4 items-center mb-2">
                          <Input type="text" value={pair.left || ''} onChange={(e) => updateMatchingOption(qIndex, optIndex, 'left', e.target.value)} placeholder={`Left ${optIndex + 1}`} className="flex-1 bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                          <span className="text-gray-body">→</span>
                          <Input type="text" value={pair.right || ''} onChange={(e) => updateMatchingOption(qIndex, optIndex, 'right', e.target.value)} placeholder={`Right ${optIndex + 1}`} className="flex-1 bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                        </div>
                      ))}
                      <button onClick={() => { const n = [...questions]; n[qIndex].options.push({left:'', right:''}); setQuestions(n); }} className="text-sm text-maroon hover:text-maroon-deep font-semibold mt-2">+ Add Pair</button>
                    </div>
                  )}
                </div>
              );
            })}
            
            <div className="flex justify-between items-center border-t border-border-soft pt-6">
              <Button variant="outline" className="border-border-soft hover:bg-cream/40" onClick={handleAddQuestionRow}>+ Add Another Question</Button>
              <Button onClick={handleSaveQuestions} disabled={loading} className="bg-maroon hover:bg-maroon-deep text-white font-bold h-10 px-6 rounded-full transition-all">{loading ? 'Saving...' : 'Save All Questions'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeView === 'grade_submissions') {
    return (
      <Card className="bg-white border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-serif font-bold text-ink">Grade Submissions</h2>
            <button onClick={() => setActiveView('list')} className="text-maroon hover:text-maroon-deep font-semibold text-sm">Back to Quizzes</button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border-soft">
                  <TableHead className="text-gray-body font-semibold">Student</TableHead>
                  <TableHead className="text-gray-body font-semibold">Roll Number</TableHead>
                  <TableHead className="text-gray-body font-semibold">Auto-Score</TableHead>
                  <TableHead className="text-gray-body font-semibold">Written Score</TableHead>
                  <TableHead className="text-gray-body font-semibold">Status</TableHead>
                  <TableHead className="text-gray-body font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-gray-body italic py-8">No submissions found.</TableCell></TableRow>
                ) : (
                  submissions.map((sub: any) => (
                    <TableRow key={sub.id} className="border-b border-border-soft hover:bg-cream/20 transition-colors">
                      <TableCell className="py-4 font-semibold text-ink">{sub.user?.name}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-body">{sub.user?.rollNumber || 'N/A'}</TableCell>
                      <TableCell className="text-ink">{sub.objectiveScore}</TableCell>
                      <TableCell className="text-ink">{sub.writtenScore}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                          sub.status === 'EVALUATED' ? 'bg-green-50/10 text-green-700 border-green-200' : 'bg-yellow-50/10 text-yellow-700 border-yellow-200'
                        }`}>{sub.status}</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="border-border-soft hover:bg-cream/40" onClick={() => handleOpenAttempt(sub)}>Review Attempt</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeView === 'evaluate_attempt') {
    return (
      <Card className="bg-white border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6 border-b border-border-soft pb-4">
            <div>
              <h2 className="text-2xl font-serif font-bold text-ink">Review Attempt: {activeAttempt.user?.name}</h2>
              <div className="text-xs text-gray-body mt-2 flex space-x-6">
                <span>Auto-Graded Objective Score: <strong className="text-maroon text-sm font-semibold">{activeAttempt.objectiveScore}</strong></span>
                <span>Current Written Score: <strong className="text-maroon text-sm font-semibold">{activeAttempt.writtenScore}</strong></span>
                <span>Total Score: <strong className="text-green-700 text-sm font-bold">{activeAttempt.totalScore}</strong></span>
              </div>
            </div>
            <button onClick={() => setActiveView('grade_submissions')} className="text-maroon hover:text-maroon-deep font-semibold text-sm">Back</button>
          </div>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
            {activeAttempt.responses?.map((r: any, idx: number) => {
              const isObjective = ['MCQ', 'MULTI_SELECT', 'NUMERICAL', 'MATCHING'].includes(r.question.type);
              return (
                <div key={r.id} className="p-5 bg-cream/30 rounded-xl border border-border-soft">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-body font-bold uppercase tracking-wider">Q{idx + 1}. ({r.question.type}) - Marks: {r.question.marks}</span>
                    {isObjective && (
                      <span className="text-xs bg-cream border border-border-soft px-2 py-0.5 rounded text-gray-body font-medium">Auto-Graded</span>
                    )}
                  </div>
                  <div className="text-ink font-semibold text-base mb-4">{r.question.text}</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-border-soft">
                      <div className="text-xs text-gray-body mb-1 font-semibold">Student's Answer:</div>
                      <div className="text-maroon font-mono text-xs whitespace-pre-wrap">{JSON.stringify(r.answerData, null, 2)}</div>
                    </div>
                    <div className="bg-green-50/10 p-3 rounded-lg border border-green-200">
                      <div className="text-xs text-green-700 mb-1 font-semibold">Expected Answer / Key:</div>
                      <div className="text-green-700 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(r.question.answerKey, null, 2)}</div>
                    </div>
                  </div>

                  {!isObjective && (
                    <div className="mt-4 flex items-center justify-end space-x-4 border-t border-border-soft pt-4">
                      <span className="text-sm text-gray-body font-medium">Assign Marks:</span>
                      <Input type="number" value={evaluations[r.id] || 0} onChange={(e) => setEvaluations({...evaluations, [r.id]: Number(e.target.value)})} className="w-24 bg-white border-border-soft text-ink focus-visible:ring-maroon" max={r.question.marks} min={0} step={0.5} />
                      <span className="text-sm text-gray-body">/ {r.question.marks}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t border-border-soft pt-6">
            <Label className="block mb-2 text-ink font-semibold">Overall Faculty Feedback (Optional)</Label>
            <Textarea value={facultyFeedback} onChange={(e) => setFacultyFeedback(e.target.value)} rows={3} placeholder="Provide general feedback on this attempt..." className="mb-4 bg-white border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
            
            <div className="flex justify-end">
              <Button onClick={handleSaveEvaluation} disabled={loading} className="bg-maroon hover:bg-maroon-deep text-white font-bold h-11 px-8 rounded-full transition-all">{loading ? 'Saving...' : 'Save Evaluation'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-border-soft text-ink shadow-sm rounded-xl">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-bold text-ink">Quiz Management</h2>
          <button onClick={() => setActiveView('create')} className="px-5 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full text-sm font-bold transition-all shadow-sm hover:scale-105 active:scale-95">
            + Create New Quiz
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border-soft">
                <TableHead className="text-gray-body font-semibold">Title</TableHead>
                <TableHead className="text-gray-body font-semibold">Subject</TableHead>
                <TableHead className="text-gray-body font-semibold">Starts At</TableHead>
                <TableHead className="text-gray-body font-semibold">Questions</TableHead>
                <TableHead className="text-gray-body font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-body italic py-8">No quizzes found.</TableCell></TableRow>
              ) : (
                quizzes.map((quiz) => (
                  <TableRow key={quiz.id} className="border-b border-border-soft hover:bg-cream/20 transition-colors">
                    <TableCell className="font-semibold text-ink">{quiz.title}</TableCell>
                    <TableCell className="text-gray-body">{quiz.subject}</TableCell>
                    <TableCell className="text-gray-body">{quiz.startDate ? new Date(quiz.startDate).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell className="text-ink font-mono text-sm">{quiz._count?.questions || 0}</TableCell>
                    <TableCell className="space-x-2 flex items-center">
                      <Button variant="outline" size="sm" className="border-border-soft hover:bg-cream/40" onClick={() => { setActiveQuizId(quiz.id); setActiveView('add_questions'); }}>Edit Questions</Button>
                      <Button variant="outline" size="sm" className="border-border-soft hover:bg-cream/40" onClick={() => handleOpenGradeView(quiz.id)}>Grade Submissions</Button>
                      <Button variant="destructive" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" onClick={() => handleDeleteQuiz(quiz.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
