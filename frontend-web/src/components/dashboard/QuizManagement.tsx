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
      const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
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
      <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-xl"><CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Create New Quiz</h2>
          <button onClick={() => setActiveView('list')} className="text-blue-500 hover:text-blue-400">Cancel</button>
        </div>
        
        <form onSubmit={handleCreateQuiz} className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Quiz Title</Label><Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} type="text" /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} type="text" /></div>
          </div>
          <div className="space-y-2"><Label>Instructions</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Total Marks</Label><Input value={formData.totalMarks} onChange={e => setFormData({...formData, totalMarks: e.target.value})} type="number" /></div>
            <div className="space-y-2"><Label>Passing Marks</Label><Input value={formData.passingMarks} onChange={e => setFormData({...formData, passingMarks: e.target.value})} type="number" /></div>
            <div className="space-y-2"><Label>Duration (mins)</Label><Input value={formData.durationMinutes} onChange={e => setFormData({...formData, durationMinutes: e.target.value})} type="number" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Start Time</Label><Input value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} type="datetime-local" /></div>
            <div className="space-y-2"><Label>End Time</Label><Input value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} type="datetime-local" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <Label className="block mb-2">Target Departments (Hold Ctrl)</Label>
              <select multiple value={formData.targetDepartments} onChange={e => setFormData({...formData, targetDepartments: [...e.target.selectedOptions].map(o => o.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white h-32">
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <Label className="block mb-2">Target Sections</Label>
              <select multiple value={formData.targetSections} onChange={e => setFormData({...formData, targetSections: [...e.target.selectedOptions].map(o => o.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white h-32 disabled:opacity-50" disabled={availableSections.length === 0}>
                {availableSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Save & Add Questions'}</Button>
        </form>
      </CardContent></Card>
  );
}

  if (activeView === 'add_questions') {
    return (
      <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-xl"><CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Add Questions to Quiz</h2>
          <button onClick={() => setActiveView('list')} className="text-blue-500 hover:text-blue-400">Cancel</button>
        </div>
        
        <div className="space-y-6">
          {questions.map((q, qIndex) => {
            if (q.type === 'MATCHING' && (!q.options || typeof q.options[0] !== 'object')) {
              q.options = [{ left: '', right: '' }, { left: '', right: '' }];
            }
            return (
              <div key={qIndex} className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
                <div className="flex justify-between">
                  <h3 className="font-bold text-slate-300">Question {qIndex + 1}</h3>
                  <select value={q.type} onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white">
                    <option value="MCQ">MCQ (Single)</option>
                    <option value="MULTI_SELECT">MCQ (Multiple)</option>
                    <option value="NUMERICAL">Numerical</option>
                    <option value="SHORT_WRITTEN">Short Written</option>
                    <option value="LONG_WRITTEN">Long Written</option>
                    <option value="MATCHING">Match the Following</option>
                  </select>
                </div>
                
                <div>
                  <Label className="text-xs text-slate-400 block mb-1">Question Text</Label>
                  <Textarea value={q.text} onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} rows={2} />
                </div>

                <div className="flex gap-4">
                  <div className="w-32">
                    <Label className="text-xs text-slate-400 block mb-1">Marks</Label>
                    <Input type="number" value={q.marks} onChange={(e) => updateQuestion(qIndex, 'marks', e.target.value)} />
                  </div>
                </div>

                {/* Answer Key UI based on Type */}
                {(q.type === 'MCQ' || q.type === 'MULTI_SELECT') && (
                  <div className="grid grid-cols-2 gap-4 mt-2 bg-slate-900/50 p-4 rounded-lg">
                    <div className="col-span-2 text-sm text-slate-400 mb-2">Define Options and Mark the Correct Answer(s):</div>
                    {q.options.map((opt: string, optIndex: number) => (
                      <div key={optIndex} className="flex gap-2 items-center">
                        <Input type="text" value={opt} onChange={(e) => updateOption(qIndex, optIndex, e.target.value)} placeholder={`Option ${optIndex + 1}`} className="flex-1" />
                        {q.type === 'MCQ' ? (
                          <input type="radio" name={`correct-${qIndex}`} checked={q.answerKey === opt} onChange={() => updateQuestion(qIndex, 'answerKey', opt)} className="w-5 h-5" />
                        ) : (
                          <input type="checkbox" checked={Array.isArray(q.answerKey) && q.answerKey.includes(opt)} onChange={(e) => {
                            let curr = Array.isArray(q.answerKey) ? [...q.answerKey] : [];
                            if (e.target.checked) curr.push(opt);
                            else curr = curr.filter(x => x !== opt);
                            updateQuestion(qIndex, 'answerKey', curr);
                          }} className="w-5 h-5" />
                        )}
                      </div>
                    ))}
                    <button onClick={() => { const n = [...questions]; n[qIndex].options.push(''); setQuestions(n); }} className="col-span-2 text-left text-sm text-blue-400 hover:text-blue-300 mt-2">+ Add Option</button>
                  </div>
                )}

                {(q.type === 'SHORT_WRITTEN' || q.type === 'LONG_WRITTEN') && (
                  <div className="mt-2">
                    <Label className="text-xs text-green-400 block mb-1">Expected Answer / Answer Key (For Faculty Reference)</Label>
                    <Textarea value={q.answerKey || ''} onChange={(e) => updateQuestion(qIndex, 'answerKey', e.target.value)} rows={q.type === 'LONG_WRITTEN' ? 4 : 2} placeholder="Provide the expected answer points..." className="border-green-800 focus-visible:ring-green-500" />
                  </div>
                )}

                {q.type === 'NUMERICAL' && (
                  <div className="mt-2">
                    <Label className="text-xs text-green-400 block mb-1">Exact Numerical Answer</Label>
                    <Input type="number" value={q.answerKey || ''} onChange={(e) => updateQuestion(qIndex, 'answerKey', Number(e.target.value))} placeholder="e.g. 42" className="border-green-800 focus-visible:ring-green-500" />
                  </div>
                )}

                {q.type === 'MATCHING' && (
                  <div className="mt-2 bg-slate-900/50 p-4 rounded-lg">
                    <div className="text-sm text-slate-400 mb-2">Define Correct Pairs (Left maps to Right):</div>
                    {q.options.map((pair: any, optIndex: number) => (
                      <div key={optIndex} className="flex gap-4 items-center mb-2">
                        <Input type="text" value={pair.left || ''} onChange={(e) => updateMatchingOption(qIndex, optIndex, 'left', e.target.value)} placeholder={`Left ${optIndex + 1}`} className="flex-1" />
                        <span className="text-slate-500">→</span>
                        <Input type="text" value={pair.right || ''} onChange={(e) => updateMatchingOption(qIndex, optIndex, 'right', e.target.value)} placeholder={`Right ${optIndex + 1}`} className="flex-1" />
                      </div>
                    ))}
                    <button onClick={() => { const n = [...questions]; n[qIndex].options.push({left:'', right:''}); setQuestions(n); }} className="text-sm text-blue-400 hover:text-blue-300 mt-2">+ Add Pair</button>
                  </div>
                )}
              </div>
            );
          })}
          
          <div className="flex justify-between items-center border-t border-slate-800 pt-6">
            <Button variant="outline" onClick={handleAddQuestionRow}>+ Add Another Question</Button>
            <Button onClick={handleSaveQuestions} disabled={loading} className="bg-green-600 hover:bg-green-700">{loading ? 'Saving...' : 'Save All Questions'}</Button>
          </div>
        </div>
      </CardContent></Card>
  );
}

  if (activeView === 'grade_submissions') {
    return (
      <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-xl"><CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Grade Submissions</h2>
          <button onClick={() => setActiveView('list')} className="text-blue-500 hover:text-blue-400">Back to Quizzes</button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Roll Number</TableHead>
                <TableHead>Auto-Score</TableHead>
                <TableHead>Written Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No submissions found.</TableCell></TableRow>
              ) : (
                submissions.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="py-4 font-medium">{sub.user?.name}</TableCell>
                    <TableCell>{sub.user?.rollNumber || 'N/A'}</TableCell>
                    <TableCell>{sub.objectiveScore}</TableCell>
                    <TableCell>{sub.writtenScore}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${sub.status === 'EVALUATED' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'}`}>{sub.status}</span>
                    </TableCell>
                    <TableCell><Button variant="outline" size="sm" onClick={() => handleOpenAttempt(sub)}>Review Attempt</Button></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
  );
}

  if (activeView === 'evaluate_attempt') {
    return (
      <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-xl"><CardContent className="p-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Review Attempt: {activeAttempt.user?.name}</h2>
            <div className="text-sm text-slate-400 mt-1 flex space-x-4">
              <span>Auto-Graded Objective Score: <strong className="text-blue-400">{activeAttempt.objectiveScore}</strong></span>
              <span>Current Written Score: <strong className="text-purple-400">{activeAttempt.writtenScore}</strong></span>
              <span>Total Score: <strong className="text-green-400">{activeAttempt.totalScore}</strong></span>
            </div>
          </div>
          <button onClick={() => setActiveView('grade_submissions')} className="text-blue-500 hover:text-blue-400">Back</button>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
          {activeAttempt.responses?.map((r: any, idx: number) => {
            const isObjective = ['MCQ', 'MULTI_SELECT', 'NUMERICAL', 'MATCHING'].includes(r.question.type);
            return (
              <div key={r.id} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-slate-400 font-bold">Q{idx + 1}. ({r.question.type}) - Marks: {r.question.marks}</span>
                  {isObjective && (
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">Auto-Graded</span>
                  )}
                </div>
                <div className="text-white mb-4">{r.question.text}</div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-3 rounded border border-slate-700">
                    <div className="text-xs text-slate-500 mb-1">Student's Answer:</div>
                    <div className="text-blue-100 font-mono text-sm whitespace-pre-wrap">{JSON.stringify(r.answerData, null, 2)}</div>
                  </div>
                  <div className="bg-green-900/20 p-3 rounded border border-green-900/50">
                    <div className="text-xs text-green-500 mb-1">Expected Answer / Key:</div>
                    <div className="text-green-100 font-mono text-sm whitespace-pre-wrap">{JSON.stringify(r.question.answerKey, null, 2)}</div>
                  </div>
                </div>

                {!isObjective && (
                  <div className="mt-4 flex items-center justify-end space-x-4 border-t border-slate-700 pt-4">
                    <span className="text-sm text-slate-400">Assign Marks:</span>
                    <Input type="number" value={evaluations[r.id] || 0} onChange={(e) => setEvaluations({...evaluations, [r.id]: Number(e.target.value)})} className="w-24 border-purple-500 focus-visible:ring-purple-500" max={r.question.marks} min={0} step={0.5} />
                    <span className="text-sm text-slate-500">/ {r.question.marks}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 border-t border-slate-800 pt-6">
          <Label className="block mb-2">Overall Faculty Feedback (Optional)</Label>
          <Textarea value={facultyFeedback} onChange={(e) => setFacultyFeedback(e.target.value)} rows={3} placeholder="Provide general feedback on this attempt..." className="mb-4" />
          
          <div className="flex justify-end">
            <Button onClick={handleSaveEvaluation} disabled={loading} className="bg-purple-600 hover:bg-purple-700 font-bold px-8 py-6">{loading ? 'Saving...' : 'Save Evaluation'}</Button>
          </div>
        </div>
      </CardContent></Card>
  );
}

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-200 shadow-xl"><CardContent className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Quiz Management</h2>
        <button onClick={() => setActiveView('create')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          + Create New Quiz
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Starts At</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quizzes.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No quizzes found.</TableCell></TableRow>
            ) : (
              quizzes.map((quiz) => (
                <TableRow key={quiz.id}>
                  <TableCell className="font-medium">{quiz.title}</TableCell>
                  <TableCell>{quiz.subject}</TableCell>
                  <TableCell>{quiz.startDate ? new Date(quiz.startDate).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>{quiz._count?.questions || 0}</TableCell>
                  <TableCell className="space-x-2 flex">
                    <Button variant="outline" size="sm" onClick={() => { setActiveQuizId(quiz.id); setActiveView('add_questions'); }}>Edit Questions</Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenGradeView(quiz.id)}>Grade Submissions</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteQuiz(quiz.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </CardContent></Card>
  );
}
