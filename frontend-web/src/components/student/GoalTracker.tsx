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
    <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm overflow-hidden">
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${statusColor}, ${statusColor}88)` }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-[9px] uppercase tracking-widest font-bold text-gray-body dark:text-neutral-400">
              {goal.goalType.replace('_', ' ')} {goal.topic ? `· ${goal.topic.name}` : ''}
            </span>
            <p className="text-sm font-semibold text-ink dark:text-neutral-100 mt-0.5">{goal.description || `Reach ${goal.targetValue}%`}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-3 shrink-0" style={{ background: `${statusColor}22`, color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-body dark:text-neutral-400">Progress</span>
            <span className="font-bold tabular-nums text-ink dark:text-neutral-100">{Math.round(goal.currentValue)}% → {goal.targetValue}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-cream-edge dark:bg-neutral-800">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: statusColor }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1 text-gray-body dark:text-neutral-400">
            <span>{Math.round(progress)}% of goal</span>
            {daysLeft !== null && !isExpired && <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>}
            {isExpired && <span className="text-red-600 dark:text-red-400">Deadline passed</span>}
          </div>
        </div>

        {goal.status === 'ACTIVE' && (
          <div className="flex gap-2 pt-3 border-t border-border-soft dark:border-neutral-800">
            <button onClick={handlePause} className="text-xs px-3 py-1.5 rounded-lg border border-border-soft dark:border-neutral-700 text-gray-body dark:text-neutral-300 hover:bg-cream-edge/40 dark:hover:bg-neutral-800 font-semibold transition-colors cursor-pointer">
              Pause
            </button>
            <button onClick={handleComplete} className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 bg-[#2A6B4A] hover:bg-[#23573C] text-white cursor-pointer">
              <CheckCircle className="w-3 h-3" /> Mark Complete
            </button>
          </div>
        )}
        {goal.status === 'PAUSED' && (
          <div className="pt-3 border-t border-border-soft dark:border-neutral-800">
            <button onClick={handlePause} className="text-xs px-3 py-1.5 rounded-lg border border-maroon dark:border-rose-400 text-maroon dark:text-rose-400 font-semibold cursor-pointer">
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

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-gray-body dark:text-neutral-400" /></div>;

  const active = goals.filter(g => g.status === 'ACTIVE' || g.status === 'PAUSED');
  const done = goals.filter(g => g.status === 'COMPLETED' || g.status === 'EXPIRED');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink dark:text-neutral-100">My Goals</h2>
          <p className="text-xs mt-0.5 text-gray-body dark:text-neutral-400">Set improvement targets and track your progress.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors bg-maroon hover:bg-maroon-deep text-white cursor-pointer"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancel' : 'New Goal'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-[#1E1E22] rounded-xl border border-border-soft dark:border-neutral-800 shadow-sm p-5 space-y-4">
          <p className="text-sm font-semibold text-ink dark:text-neutral-100">Set a new goal</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-gray-body dark:text-neutral-400">Goal Type</label>
              <select
                value={form.goalType} onChange={e => setForm(f => ({ ...f, goalType: e.target.value }))}
                className="w-full border border-border-soft dark:border-neutral-700 bg-white dark:bg-[#25252A] rounded-lg px-3 py-2 text-sm text-ink dark:text-neutral-100 focus:outline-none focus:border-maroon"
              >
                <option value="TOPIC_SCORE">Topic Score</option>
                <option value="SUBJECT_SCORE">Subject Score</option>
                <option value="SIS_SCORE">SIS Score</option>
                <option value="PERFORMANCE_BAND">Performance Band</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-gray-body dark:text-neutral-400">Target Value (%)</label>
              <input
                type="number" min="0" max="100" value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                className="w-full border border-border-soft dark:border-neutral-700 bg-white dark:bg-[#25252A] text-ink dark:text-neutral-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-maroon"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-gray-body dark:text-neutral-400">Description (optional)</label>
              <input
                type="text" placeholder="e.g. Improve Critical Thinking" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-border-soft dark:border-neutral-700 bg-white dark:bg-[#25252A] text-ink dark:text-neutral-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-maroon"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-gray-body dark:text-neutral-400">Target Date (optional)</label>
              <input
                type="date" value={form.targetDate}
                onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                className="w-full border border-border-soft dark:border-neutral-700 bg-white dark:bg-[#25252A] text-ink dark:text-neutral-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-maroon"
              />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-maroon hover:bg-maroon-deep text-white cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
            Create Goal
          </button>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="bg-white dark:bg-[#1E1E22] rounded-xl border border-dashed border-border-soft dark:border-neutral-800 py-10 text-center">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-40 text-maroon dark:text-rose-400" />
          <p className="text-sm font-medium text-ink dark:text-neutral-100">No goals yet</p>
          <p className="text-xs mt-1 text-gray-body dark:text-neutral-400">Create a goal to track your improvement targets.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-3 text-gray-body dark:text-neutral-400">Active Goals</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map(g => <GoalCard key={g.id} goal={g} onStatusChange={fetchGoals} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-3 mt-4 text-gray-body dark:text-neutral-400">Past Goals</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                {done.map(g => <GoalCard key={g.id} goal={g} onStatusChange={fetchGoals} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
