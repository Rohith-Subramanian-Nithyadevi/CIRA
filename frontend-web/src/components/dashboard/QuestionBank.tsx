import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, ImagePlus, Loader2, Plus, RotateCw, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, getApiErrorMessage } from '@/lib/apiClient';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';
import { useFacultyDemo } from '@/context/FacultyDemoContext';
import { facultyDemoQuestionBank } from '@/lib/facultyDemoData';

type Category = 'ASSIGNMENT' | 'TEST_QUIZ';
type QuestionType = 'MCQ' | 'MULTI_SELECT' | 'NUMERICAL' | 'SHORT_WRITTEN' | 'LONG_WRITTEN' | 'MATCHING' | 'TRUE_FALSE' | 'FILL_BLANK' | 'CODING';
type Question = {
  id: string; ownerId: string | null; ownership: 'owned' | 'shared' | 'inaccessible'; category: Category; subject: string | null;
  type: QuestionType; text: string; topic: string | null; subtopic: string | null; difficulty: string | null; tags: string[];
  marks: number; negativeMarks: number; options: any; answerKey: any; explanation: string | null; image: string | null;
  usages: Array<{ category: Category; assessmentTitle: string }>; reuse: { eligible: boolean; usedInOppositeCategory: boolean; warning: string | null };
};

const types: Array<{ value: QuestionType; label: string }> = [
  { value: 'MCQ', label: 'Single choice (MCQ)' }, { value: 'MULTI_SELECT', label: 'Multiple select' },
  { value: 'TRUE_FALSE', label: 'True / False' }, { value: 'FILL_BLANK', label: 'Fill in the blank' },
  { value: 'NUMERICAL', label: 'Numerical' }, { value: 'SHORT_WRITTEN', label: 'Short written' },
  { value: 'LONG_WRITTEN', label: 'Long written' }, { value: 'MATCHING', label: 'Matching' }, { value: 'CODING', label: 'Coding' },
];

type FormQuestion = {
  category: Category; type: QuestionType; text: string; subject: string; topic: string; subtopic: string; difficulty: string;
  tags: string; marks: string; negativeMarks: string; options: any; answerKey: any; explanation: string; image: string;
};

const freshForm = (category: Category): FormQuestion => ({ category, type: 'MCQ', text: '', subject: '', topic: '', subtopic: '', difficulty: 'Medium', tags: '', marks: '1', negativeMarks: '0', options: ['', '', '', ''], answerKey: '', explanation: '', image: '' });
const toForm = (question: Question): FormQuestion => ({
  category: question.category, type: question.type, text: question.text, subject: question.subject || '', topic: question.topic || '',
  subtopic: question.subtopic || '', difficulty: question.difficulty || 'Medium', tags: question.tags.join(', '), marks: String(question.marks),
  negativeMarks: String(question.negativeMarks), options: question.options || [], answerKey: question.answerKey ?? '', explanation: question.explanation || '', image: question.image || '',
});

const createFormQuestion = (category: Category, type: QuestionType): FormQuestion => ({
  ...freshForm(category), type,
  options: type === 'MATCHING' ? [{ left: '', right: '' }] : ['MCQ', 'MULTI_SELECT'].includes(type) ? ['', '', '', ''] : undefined,
  answerKey: type === 'TRUE_FALSE' ? true : type === 'MATCHING' ? [{ left: '', right: '' }] : '',
});

const paramsFromFilters = (filters: Record<string, string>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params;
};

export default function QuestionBank() {
  const isDemo = useFacultyDemo();
  const [category, setCategory] = useState<Category>('ASSIGNMENT');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [type, setType] = useState('');
  const [tag, setTag] = useState('');
  const [includeReused, setIncludeReused] = useState(false);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Question | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormQuestion>(() => freshForm(category));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);

  const filterQuery = useMemo(() => paramsFromFilters({ category, search, subject, topic, difficulty, type, tag, includeReused: String(includeReused), page: String(page), limit: '12' }).toString(), [category, search, subject, topic, difficulty, type, tag, includeReused, page]);

  const loadQuestions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setListError(null); setQuestions([]);
    try {
      if (isDemo) {
        const query = new URLSearchParams(filterQuery);
        const categoryQuestions = facultyDemoQuestionBank.filter((question) => question.category === category);
        const filtered = categoryQuestions.filter((question) => {
          const searchText = `${question.text} ${question.subject} ${question.topic} ${question.tags.join(' ')}`.toLowerCase();
          return (includeReused || !question.reuse.usedInOppositeCategory)
            && (!search || searchText.includes(search.toLowerCase()))
            && (!subject || question.subject.toLowerCase().includes(subject.toLowerCase()))
            && (!topic || `${question.topic} ${question.subtopic}`.toLowerCase().includes(topic.toLowerCase()))
            && (!difficulty || question.difficulty === difficulty)
            && (!type || question.type === type)
            && (!tag || question.tags.some((value) => value.toLowerCase() === tag.toLowerCase()));
        });
        const pageSize = Number(query.get('limit')) || 12;
        const currentPage = Number(query.get('page')) || 1;
        setQuestions(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) as Question[]);
        setPages(Math.max(1, Math.ceil(filtered.length / pageSize)));
        setTotal(filtered.length);
        return;
      }
      const response = await apiClient.fetch(`/api/v1/faculty/quiz/question-bank?${filterQuery}`, { signal });
      const json = await response.json();
      if (signal?.aborted) return;
      setQuestions(json.data?.items || []); setPages(Math.max(1, json.data?.pagination?.pages || 1)); setTotal(json.data?.pagination?.total || 0);
    } catch (error) {
      if (!signal?.aborted) setListError(getApiErrorMessage(error, 'We could not load the Question Bank. Please try again, or contact your administrator if the problem continues.'));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [category, difficulty, filterQuery, includeReused, isDemo, search, subject, tag, topic, type]);

  useEffect(() => {
    const controller = new AbortController();
    void loadQuestions(controller.signal);
    return () => controller.abort();
  }, [loadQuestions, retry]);

  const resetEditor = (nextCategory = category) => { setEditing(null); setEditorOpen(false); setForm(freshForm(nextCategory)); setMutationError(null); setPreview(false); };
  const startCreate = () => { setEditing(null); setEditorOpen(true); setForm(freshForm(category)); setMutationError(null); setPreview(false); };
  const startEdit = (question: Question) => { setEditing(question); setEditorOpen(true); setForm(toForm(question)); setMutationError(null); setPreview(false); };
  const changeCategory = (nextCategory: Category) => {
    setCategory(nextCategory); setPage(1);
    if (editorOpen) { setEditing(null); setForm(freshForm(nextCategory)); setMutationError(null); setPreview(false); }
  };
  const setField = (field: keyof FormQuestion, value: any) => setForm((current) => ({ ...current, [field]: value }));

  const handleTypeChange = (nextType: QuestionType) => setForm((current) => ({ ...createFormQuestion(category, nextType), category: current.category, subject: current.subject, topic: current.topic, subtopic: current.subtopic, difficulty: current.difficulty, tags: current.tags, marks: current.marks, negativeMarks: current.negativeMarks, text: current.text, explanation: current.explanation, image: current.image }));

  const saveQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setMutationError(null);
    const payload = { ...form, tags: form.tags.split(',').map((value) => value.trim()).filter(Boolean), options: form.options, answerKey: form.answerKey };
    try {
      await apiClient.fetch(editing ? `/api/v1/faculty/quiz/question-bank/${editing.id}` : '/api/v1/faculty/quiz/question-bank', {
        method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      resetEditor(); setRetry((value) => value + 1);
    } catch (error) { setMutationError(getApiErrorMessage(error, 'We could not save this question. Please try again, or contact your administrator if the problem continues.')); }
    finally { setSaving(false); }
  };

  const handleImage = async (file?: File) => {
    if (!file || uploading) return;
    if (file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMutationError('Choose a PNG, JPEG or WebP image no larger than 5 MB.'); return;
    }
    setUploading(true); setMutationError(null);
    try {
      const body = new FormData(); body.append('file', file);
      const response = await apiClient.fetch('/api/v1/faculty/quiz/question-bank/upload-image', { method: 'POST', body });
      const json = await response.json(); setField('image', json.data.url);
    } catch (error) { setMutationError(getApiErrorMessage(error, 'We could not upload this image. Please try again, or contact your administrator if the problem continues.')); }
    finally { setUploading(false); }
  };

  const confirmRemoveQuestion = async () => {
    if (!questionToDelete) return;
    const question = questionToDelete;
    setMutationError(null);
    try {
      const response = await apiClient.fetch(`/api/v1/faculty/quiz/question-bank/${question.id}`, { method: 'DELETE' });
      const json = await response.json?.().catch(() => null);
      if (response?.ok === false || json?.status === 'error') {
        const message = json?.error?.message || json?.message || 'We could not remove this question. Please try again.';
        toast.error(message);
        throw new Error(message);
      }
      toast.success('Question removed from your bank.');
      if (editing?.id === question.id) resetEditor();
      setQuestionToDelete(null);
      setRetry((value) => value + 1);
    } catch (error) {
      const msg = getApiErrorMessage(error, 'We could not remove this question. Please try again, or contact your administrator if the problem continues.');
      setMutationError(msg);
      throw new Error(msg);
    }
  };

  const updateOption = (index: number, value: string) => setField('options', (form.options || []).map((option: string, currentIndex: number) => currentIndex === index ? value : option));
  const updatePair = (index: number, key: 'left' | 'right', value: string) => {
    const options = [...(form.options || [])]; options[index] = { ...options[index], [key]: value }; setField('options', options); setField('answerKey', options);
  };

  const renderTypeEditor = () => {
    if (['MCQ', 'MULTI_SELECT'].includes(form.type)) {
      const answers = form.type === 'MCQ' ? [String(form.answerKey)] : Array.isArray(form.answerKey) ? form.answerKey.map(String) : String(form.answerKey || '').split(',').map((part) => part.trim()).filter(Boolean);
      return <div className="space-y-3"><p className="text-xs font-semibold text-gray-body">Options and correct answer</p>{(form.options || []).map((option: string, index: number) => <div key={index} className="flex items-center gap-3"><input aria-label={`Option ${index + 1}`} value={option} onChange={(event) => updateOption(index, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-border-soft px-3 py-2 text-sm" placeholder={`Option ${index + 1}`} />{form.type === 'MCQ' ? <input aria-label={`Correct option ${index + 1}`} type="radio" name="question-answer" checked={String(form.answerKey) === option && !!option} onChange={() => setField('answerKey', option)} /> : <input aria-label={`Correct option ${index + 1}`} type="checkbox" checked={answers.includes(option) && !!option} onChange={(event) => setField('answerKey', event.target.checked ? [...new Set([...answers, option])] : answers.filter((answer: string) => answer !== option))} />}</div>)}<button type="button" className="text-xs font-semibold text-maroon underline" onClick={() => setField('options', [...(form.options || []), ''])}>Add option</button></div>;
    }
    if (form.type === 'TRUE_FALSE') return <label className="block space-y-1 text-xs font-semibold text-gray-body">Correct answer<select aria-label="Correct answer" value={String(form.answerKey)} onChange={(event) => setField('answerKey', event.target.value === 'true')} className="mt-1 h-10 w-full rounded-lg border border-border-soft bg-white px-3 text-sm"><option value="true">True</option><option value="false">False</option></select></label>;
    if (form.type === 'NUMERICAL') return <Field label="Expected numerical answer"><input aria-label="Expected numerical answer" type="number" value={form.answerKey} onChange={(event) => setField('answerKey', event.target.value)} className={inputClass} /></Field>;
    if (form.type === 'FILL_BLANK') return <Field label="Expected answer"><input aria-label="Expected answer" value={form.answerKey} onChange={(event) => setField('answerKey', event.target.value)} className={inputClass} /></Field>;
    if (form.type === 'MATCHING') return <div className="space-y-3"><p className="text-xs font-semibold text-gray-body">Matching pairs</p>{(form.options || []).map((pair: any, index: number) => <div key={index} className="grid gap-2 sm:grid-cols-2"><input aria-label={`Left item ${index + 1}`} value={pair.left} onChange={(event) => updatePair(index, 'left', event.target.value)} className={inputClass} placeholder="Left item" /><input aria-label={`Right match ${index + 1}`} value={pair.right} onChange={(event) => updatePair(index, 'right', event.target.value)} className={inputClass} placeholder="Matching right item" /></div>)}<button type="button" className="text-xs font-semibold text-maroon underline" onClick={() => { const options = [...(form.options || []), { left: '', right: '' }]; setField('options', options); setField('answerKey', options); }}>Add pair</button></div>;
    if (form.type === 'CODING') return <Field label="Reference solution"><textarea aria-label="Reference solution" value={form.answerKey} onChange={(event) => setField('answerKey', event.target.value)} rows={5} className={`${inputClass} font-mono`} placeholder="Reference solution or expected output" /></Field>;
    return <p className="rounded-lg bg-cream p-3 text-xs text-gray-body">This written question is manually graded. Add an optional explanation or marking guidance below.</p>;
  };

  return <div className="space-y-6 text-ink">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-body">Assessments</p><h2 className="font-serif text-2xl font-bold">Question Bank</h2><p className="mt-1 text-sm text-gray-body">Create and manage reusable questions with saved usage history.</p></div><button disabled={isDemo} title={isDemo ? 'Turn off Demo Data to create saved questions.' : undefined} onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-deep disabled:cursor-not-allowed disabled:opacity-60"><Plus className="h-4 w-4" />New question</button></header>
    {isDemo && <p role="status" className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">Showing sample questions. They are read-only; turn off Demo Data to use the saved Question Bank.</p>}

    <div className="flex flex-wrap gap-2 border-b border-border-soft" role="tablist" aria-label="Question divisions">
      <button role="tab" aria-selected={category === 'ASSIGNMENT'} onClick={() => changeCategory('ASSIGNMENT')} className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${category === 'ASSIGNMENT' ? 'border-b-2 border-maroon text-maroon' : 'text-gray-body'}`}>Assignments</button>
      <button role="tab" aria-selected={category === 'TEST_QUIZ'} onClick={() => changeCategory('TEST_QUIZ')} className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${category === 'TEST_QUIZ' ? 'border-b-2 border-maroon text-maroon' : 'text-gray-body'}`}>Tests / Quizzes</button>
    </div>

    <section aria-label="Question filters" className="grid gap-3 rounded-2xl border border-border-soft bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-body" /><input aria-label="Search questions" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search questions, subjects, tags" className="h-10 w-full rounded-lg border border-border-soft pl-9 pr-3 text-sm" /></label>
      <input aria-label="Filter subject" value={subject} onChange={(event) => { setSubject(event.target.value); setPage(1); }} placeholder="Subject" className={inputClass} />
      <input aria-label="Filter topic" value={topic} onChange={(event) => { setTopic(event.target.value); setPage(1); }} placeholder="Topic or subtopic" className={inputClass} />
      <select aria-label="Filter difficulty" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }} className={inputClass}><option value="">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
      <select aria-label="Filter type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className={inputClass}><option value="">All question types</option>{types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <input aria-label="Filter tag" value={tag} onChange={(event) => { setTag(event.target.value); setPage(1); }} placeholder="Exact tag" className={inputClass} />
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={includeReused} onChange={(event) => { setIncludeReused(event.target.checked); setPage(1); }} />Include questions used in the opposite category</label>
      <span className="self-center text-xs text-gray-body">{total} question{total === 1 ? '' : 's'}</span>
    </section>

    {includeReused && <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Included questions used in the opposite assessment category are marked with a reuse warning. Confirm reuse when selecting them for an assessment.</p>}
    {mutationError && !editorOpen && <p role="alert" className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-300">{mutationError}</p>}

    {editorOpen ? <section className="rounded-2xl border border-border-soft bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="font-serif text-xl font-bold">{editing ? 'Edit question' : 'Create question'}</h3><button onClick={() => resetEditor()} aria-label="Close editor" className="rounded-lg p-2 text-gray-body hover:bg-cream"><X className="h-4 w-4" /></button></div>
      <form onSubmit={saveQuestion} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Question type"><select aria-label="Question type" value={form.type} onChange={(event) => handleTypeChange(event.target.value as QuestionType)} className={inputClass}>{types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="Subject"><input aria-label="Subject" value={form.subject} onChange={(event) => setField('subject', event.target.value)} className={inputClass} /></Field><Field label="Topic"><input aria-label="Topic" value={form.topic} onChange={(event) => setField('topic', event.target.value)} className={inputClass} /></Field><Field label="Subtopic"><input aria-label="Subtopic" value={form.subtopic} onChange={(event) => setField('subtopic', event.target.value)} className={inputClass} /></Field><Field label="Difficulty"><select aria-label="Difficulty" value={form.difficulty} onChange={(event) => setField('difficulty', event.target.value)} className={inputClass}><option>Easy</option><option>Medium</option><option>Hard</option></select></Field><Field label="Marks"><input aria-label="Marks" type="number" min="0.5" step="0.5" value={form.marks} onChange={(event) => setField('marks', event.target.value)} className={inputClass} /></Field><Field label="Negative marks"><input aria-label="Negative marks" type="number" min="0" step="0.25" value={form.negativeMarks} onChange={(event) => setField('negativeMarks', event.target.value)} className={inputClass} /></Field><Field label="Tags (comma separated)"><input aria-label="Tags" value={form.tags} onChange={(event) => setField('tags', event.target.value)} className={inputClass} /></Field></div>
        <Field label="Question content"><textarea aria-label="Question content" required rows={4} value={form.text} onChange={(event) => setField('text', event.target.value)} className={inputClass} /></Field>
        {renderTypeEditor()}
        <Field label="Explanation or marking guidance"><textarea aria-label="Explanation" rows={3} value={form.explanation} onChange={(event) => setField('explanation', event.target.value)} className={inputClass} /></Field>
        <div className="space-y-2"><label className="block text-xs font-semibold text-gray-body">Question image</label><div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold hover:bg-cream"><Upload className="h-4 w-4" />{uploading ? 'Uploading…' : form.image ? 'Replace image' : 'Upload image'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { void handleImage(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>{uploading && <Loader2 className="h-4 w-4 animate-spin text-maroon" />}{form.image && <button type="button" onClick={() => setField('image', '')} className="inline-flex items-center gap-1 text-sm font-semibold text-red-700"><Trash2 className="h-4 w-4" />Remove image</button>}</div>{form.image && <img src={form.image} alt="Question attachment preview" className="max-h-56 max-w-full rounded-lg object-contain border border-border-soft object-contain" />}</div>
        {mutationError && <p role="alert" className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-300">{mutationError}</p>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setPreview((value) => !value)} className="rounded-lg border border-border-soft px-4 py-2 text-sm font-semibold hover:bg-cream">{preview ? 'Hide preview' : 'Preview'}</button><button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save question'}</button></div>
        {preview && <div className="rounded-xl border border-maroon/20 bg-cream/50 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-maroon">Preview · {types.find((item) => item.value === form.type)?.label}</p><p className="whitespace-pre-wrap font-medium">{form.text || 'Question content appears here.'}</p>{form.image && <img src={form.image} alt="Question preview" className="mt-3 max-h-56 max-w-full rounded-lg object-contain" />}{Array.isArray(form.options) && <ul className="mt-3 space-y-1 text-sm">{form.options.map((option: any, index: number) => <li key={index}>{form.type === 'MATCHING' ? `${option.left || 'Left'} → ${option.right || 'Right'}` : option || `Option ${index + 1}`}</li>)}</ul>}<p className="mt-3 text-xs text-gray-body">{form.marks || 0} marks · {form.difficulty} · {form.tags || 'No tags'}</p></div>}
      </form></section> : null}

    <section aria-label="Question bank results" className="overflow-hidden rounded-2xl border border-border-soft bg-white shadow-sm">
      {loading ? <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-body"><Loader2 className="h-5 w-5 animate-spin text-maroon" />Loading question bank…</div> : listError ? <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"><p role="alert" className="text-sm text-red-800 dark:text-red-300">{listError}</p><button onClick={() => setRetry((value) => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold"><RotateCw className="h-4 w-4" />Retry</button></div> : !questions.length ? <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center"><ImagePlus className="h-8 w-8 text-maroon" /><p className="font-semibold">No questions found</p><p className="text-sm text-gray-body">Create a question or adjust your filters.</p>{!isDemo && <button onClick={startCreate} className="mt-2 rounded-lg bg-maroon px-3 py-2 text-sm font-semibold text-white">Create question</button>}</div> : <div className="divide-y divide-border-soft">{questions.map((question) => <article key={question.id} className="p-4 sm:p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-maroon">{types.find((item) => item.value === question.type)?.label || question.type}</span><span className="text-xs text-gray-body">{question.subject || 'No subject'} · {question.topic || 'No topic'} · {question.difficulty || 'Unrated'} · {question.marks} marks</span>{question.ownership === 'shared' && <span className="rounded-full bg-slate-100 dark:bg-neutral-800 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-neutral-300">Shared · read only</span>}</div><p className="whitespace-pre-wrap font-semibold">{question.text}</p>{question.image && <img src={question.image} alt="Question attachment" className="mt-3 max-h-36 rounded-lg object-contain" />}{question.tags.length > 0 && <p className="mt-2 text-xs text-gray-body">Tags: {question.tags.join(', ')}</p>}{question.reuse.usedInOppositeCategory && <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" />{question.reuse.warning} Usage: {question.usages.filter((usage) => usage.category !== category).map((usage) => usage.assessmentTitle).join(', ')}</p>}<p className="mt-2 text-[11px] text-gray-body">Used in {question.usages.length} assessment{question.usages.length === 1 ? '' : 's'} · {question.usages.map((usage) => usage.assessmentTitle).join(', ') || 'Not used yet'}</p></div>{!isDemo && question.ownership === 'owned' && <div className="flex shrink-0 gap-2"><button onClick={() => startEdit(question)} className="h-fit rounded-lg border border-border-soft px-3 py-2 text-xs font-semibold hover:bg-cream">Edit</button><button aria-label={`Remove question ${question.id}`} onClick={() => setQuestionToDelete(question)} className="h-fit rounded-lg border border-red-200 dark:border-red-900/50 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button></div>}</div></article>)}</div>}
      {!loading && !listError && questions.length > 0 && <footer className="flex items-center justify-between border-t border-border-soft p-3"><span className="text-xs text-gray-body">Page {page} of {pages}</span><div className="flex gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-border-soft px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Previous</button><button onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} className="rounded-lg border border-border-soft px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Next</button></div></footer>}
    </section>
    <DeleteConfirmationDialog
      open={Boolean(questionToDelete)}
      itemName={questionToDelete?.text ? (questionToDelete.text.length > 60 ? `${questionToDelete.text.slice(0, 60)}...` : questionToDelete.text) : 'this question'}
      title="Confirm Deletion"
      description="This will remove the question from your Question Bank. Existing published assessments will retain their copy, but it cannot be undone in the bank."
      confirmLabel="Delete"
      onCancel={() => setQuestionToDelete(null)}
      onConfirm={confirmRemoveQuestion}
    />
  </div>;
}

const inputClass = 'h-10 w-full rounded-lg border border-border-soft bg-white px-3 text-sm text-ink';
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1 text-xs font-semibold text-gray-body">{label}{children}</label>; }
