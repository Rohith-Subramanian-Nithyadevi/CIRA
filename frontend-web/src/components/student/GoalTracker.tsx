import { useState, useEffect } from 'react';
import { Loader2, Target, Plus, X, CheckCircle } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

const C = { maroon: '#9B2242', good: '#2A6B4A', danger: '#C13535', warn: '#C07820', gray: '#6B6560', ink: '#1A1A1A', border: '#E7DDD0', cream: '#FAF5EE', creamEdge: '#EFE5D8' };

interface Goal {
  id: string;
  goalType: string;
  description: string | null;
  currentValue: number;
  targetValue: number;
  startDate: string;
  targetDate: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'PAUSED';
  topic: { name: string } | null;
}

function GoalCard({ goal, onStatusChange }: { goal: Goal; onStatusChange: () => void }) {
  const progress = goal.targetValue > 0 ? Math.min(100, (goal.currentValue / goal.targetValue) * 100) : 0;
  const daysLeft = goal.targetDate
    ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000)
    : null;
  const isExpired = daysLeft !== null && daysLeft < 0;

  const statusColor = goal.status === 'COMPLETED' ? C.good : goal.status === 'EXPIRED' || isExpired ? C.danger : goal.status === 'PAUSED' ? C.gray : C.maroon;
  const statusLabel = goal.status === 'COMPLETED' ? '✓ Completed' : goal.status === 'PAUSED' ? '⏸ Paused' : isExpired ? 'Expired' : 'Active';

  const handlePause = async () => {
    await apiClient.fetch(`/api/v1/student/improvement/goals/${goal.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: goal.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }),
    });
    onStatusChange();
  };

  const handleComplete = async () => {
    await apiClient.fetch(`/api/v1/student/improvement/goals/${goal.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    onStatusChange();
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${statusColor}, ${statusColor}88)` }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: C.gray }}>
              {goal.goalType.replace('_', ' ')} {goal.topic ? `· ${goal.topic.name}` : ''}
            </span>
            <p className="text-sm font-semibold text-ink mt-0.5">{goal.description || `Reach ${goal.targetValue}%`}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-3 shrink-0" style={{ background: `${statusColor}18`, color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: C.gray }}>Progress</span>
            <span className="font-bold tabular-nums text-ink">{Math.round(goal.currentValue)}% → {goal.targetValue}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: C.creamEdge }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: statusColor }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1" style={{ color: C.gray }}>
            <span>{Math.round(progress)}% of goal</span>
            {daysLeft !== null && !isExpired && <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>}
            {isExpired && <span style={{ color: C.danger }}>Deadline passed</span>}
          </div>
        </div>

        {goal.status === 'ACTIVE' && (
          <div className="flex gap-2 pt-3 border-t" style={{ borderColor: C.border }}>
            <button onClick={handlePause} className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors" style={{ borderColor: C.border, color: C.gray }}>
              Pause
            </button>
            <button onClick={handleComplete} className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5" style={{ background: C.good, color: '#fff' }}>
              <CheckCircle className="w-3 h-3" /> Mark Complete
            </button>
          </div>
        )}
        {goal.status === 'PAUSED' && (
          <div className="pt-3 border-t" style={{ borderColor: C.border }}>
            <button onClick={handlePause} className="text-xs px-3 py-1.5 rounded-lg border font-semibold" style={{ borderColor: C.maroon, color: C.maroon }}>
              Resume
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoalTracker() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ goalType: 'TOPIC_SCORE', description: '', targetValue: '75', targetDate: '' });
  const [saving, setSaving] = useState(false);

  const fetchGoals = () => {
    apiClient.fetch('/api/v1/student/improvement/goals')
      .then(r => r.json())
      .then(d => { if (d?.success) setGoals(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchGoals(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.fetch('/api/v1/student/improvement/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalType: form.goalType,
          description: form.description || null,
          targetValue: parseFloat(form.targetValue),
          targetDate: form.targetDate || null,
        }),
      });
      setShowForm(false);
      setForm({ goalType: 'TOPIC_SCORE', description: '', targetValue: '75', targetDate: '' });
      fetchGoals();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin" style={{ color: C.gray }} /></div>;

  const active = goals.filter(g => g.status === 'ACTIVE' || g.status === 'PAUSED');
  const done = goals.filter(g => g.status === 'COMPLETED' || g.status === 'EXPIRED');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">My Goals</h2>
          <p className="text-xs mt-0.5" style={{ color: C.gray }}>Set improvement targets and track your progress.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: C.maroon, color: '#fff' }}
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancel' : 'New Goal'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border shadow-sm p-5 space-y-4" style={{ borderColor: C.border }}>
          <p className="text-sm font-semibold text-ink">Set a new goal</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: C.gray }}>Goal Type</label>
              <select
                value={form.goalType} onChange={e => setForm(f => ({ ...f, goalType: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm text-ink focus:outline-none" style={{ borderColor: C.border }}
              >
                <option value="TOPIC_SCORE">Topic Score</option>
                <option value="SUBJECT_SCORE">Subject Score</option>
                <option value="SIS_SCORE">SIS Score</option>
                <option value="PERFORMANCE_BAND">Performance Band</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: C.gray }}>Target Value (%)</label>
              <input
                type="number" min="0" max="100" value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ borderColor: C.border }}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: C.gray }}>Description (optional)</label>
              <input
                type="text" placeholder="e.g. Improve Critical Thinking" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ borderColor: C.border }}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: C.gray }}>Target Date (optional)</label>
              <input
                type="date" value={form.targetDate}
                onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ borderColor: C.border }}
              />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: C.maroon, color: '#fff' }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
            Create Goal
          </button>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="bg-cream rounded-xl border border-dashed py-10 text-center" style={{ borderColor: C.border }}>
          <Target className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: C.maroon }} />
          <p className="text-sm font-medium text-ink">No goals yet</p>
          <p className="text-xs mt-1" style={{ color: C.gray }}>Create a goal to track your improvement targets.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-3" style={{ color: C.gray }}>Active Goals</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map(g => <GoalCard key={g.id} goal={g} onStatusChange={fetchGoals} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-3 mt-4" style={{ color: C.gray }}>Past Goals</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                {done.map(g => <GoalCard key={g.id} goal={g} onStatusChange={fetchGoals} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
