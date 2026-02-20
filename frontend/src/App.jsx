import { useState, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const API = 'http://localhost:8000'

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ── Sub-components ───────────────────────────────────────────

function MetricCard({ label, value, sub, accent = '#63D3AA', delay = 0 }) {
  return (
    <div className="glass card-glow p-6 fade-up" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-3xl font-display" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
    </div>
  )
}

function RiskBadge({ risk }) {
  if (!risk) return null
  const cls = risk.badge === 'Low' ? 'badge-low' : risk.badge === 'Medium' ? 'badge-medium' : 'badge-high'
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-medium ${cls}`}>
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      Risk: {risk.badge} ({risk.score}/100)
    </div>
  )
}

function ExpenseChart({ summary, forecast }) {
  if (!summary) return null

  const histLabels = Object.keys(summary.monthly_expenses)
  const histValues = Object.values(summary.monthly_expenses)
  const foreLabels = forecast?.forecast_labels || []
  const foreValues = forecast?.predicted_expenses || []

  const labels = [...histLabels, ...foreLabels]

  const data = {
    labels,
    datasets: [
      {
        label: 'Historical Expenses',
        data: [...histValues, ...Array(foreLabels.length).fill(null)],
        borderColor: '#63D3AA',
        backgroundColor: 'rgba(99,211,170,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#63D3AA',
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'AI Forecast',
        data: [...Array(histLabels.length).fill(null), ...(histValues.length ? [histValues[histValues.length - 1]] : []), ...foreValues].slice(histLabels.length > 0 ? histLabels.length - 1 : 0),
        borderColor: '#6382D3',
        backgroundColor: 'rgba(99,130,211,0.06)',
        borderWidth: 2,
        borderDash: [6, 4],
        pointBackgroundColor: '#6382D3',
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      },
    ],
  }

  // Fix: proper joining for dashed forecast line
  const joinedForeData = new Array(labels.length).fill(null)
  if (histLabels.length > 0) joinedForeData[histLabels.length - 1] = histValues[histValues.length - 1]
  foreLabels.forEach((_, i) => { joinedForeData[histLabels.length + i] = foreValues[i] })

  data.datasets[1].data = joinedForeData

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(255,255,255,0.6)', font: { family: 'DM Mono', size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(10,13,20,0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#e8eaf0',
        bodyColor: 'rgba(255,255,255,0.6)',
        callbacks: { label: ctx => ` ${fmt(ctx.raw)}` }
      },
    },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'DM Mono', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'DM Mono', size: 10 }, callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
    },
  }

  return <Line data={data} options={options} />
}

function IncomeChart({ summary }) {
  if (!summary) return null
  const labels = Object.keys(summary.monthly_income)
  const values = Object.values(summary.monthly_income)

  const data = {
    labels,
    datasets: [{
      label: 'Monthly Income',
      data: values,
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderWidth: 2,
      pointBackgroundColor: '#F59E0B',
      pointRadius: 4,
      tension: 0.4,
      fill: true,
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(255,255,255,0.6)', font: { family: 'DM Mono', size: 11 } } },
      tooltip: { backgroundColor: 'rgba(10,13,20,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, titleColor: '#e8eaf0', bodyColor: 'rgba(255,255,255,0.6)', callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } },
    },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'DM Mono', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'DM Mono', size: 10 }, callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
    },
  }

  return <Line data={data} options={options} />
}

// ── Transaction Form ─────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Other']
const INCOME_CATEGORIES  = ['Salary', 'Freelance', 'Investment', 'Business', 'Other']

function TransactionForm({ onAdd }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ amount: '', type: 'expense', category: 'Food', date: today, description: '' })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({
    ...f,
    [k]: v,
    ...(k === 'type' ? { category: v === 'expense' ? 'Food' : 'Salary' } : {})
  }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.amount || isNaN(+form.amount)) return
    setLoading(true)
    try {
      await fetch(`${API}/add-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: +form.amount }),
      })
      setForm({ amount: '', type: form.type, category: form.category, date: today, description: '' })
      onAdd()
    } finally { setLoading(false) }
  }

  const cats = form.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  return (
    <form onSubmit={submit} className="glass p-6 fade-up" style={{ animationDelay: '200ms' }}>
      <h2 className="font-display text-xl mb-5" style={{ color: '#63D3AA' }}>Add Transaction</h2>

      {/* Type toggle */}
      <div className="flex gap-2 mb-4">
        {['expense', 'income'].map(t => (
          <button key={t} type="button" onClick={() => set('type', t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium font-mono transition-all duration-200"
            style={{
              background: form.type === t ? (t === 'expense' ? 'rgba(239,68,68,0.2)' : 'rgba(99,211,170,0.2)') : 'rgba(255,255,255,0.04)',
              color:      form.type === t ? (t === 'expense' ? '#EF4444'            : '#63D3AA')             : 'rgba(255,255,255,0.4)',
              border:     form.type === t ? `1px solid ${t === 'expense' ? '#EF4444' : '#63D3AA'}` : '1px solid rgba(255,255,255,0.08)',
            }}>
            {t === 'expense' ? '↑ Expense' : '↓ Income'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-mono text-white/40 block mb-1">AMOUNT ($)</label>
          <input type="number" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} required min="0.01" step="0.01"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50 text-white placeholder-white/20" />
        </div>
        <div>
          <label className="text-xs font-mono text-white/40 block mb-1">CATEGORY</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50 text-white">
            {cats.map(c => <option key={c} value={c} style={{ background: '#0a0d14' }}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-mono text-white/40 block mb-1">DATE</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50 text-white" />
        </div>
        <div>
          <label className="text-xs font-mono text-white/40 block mb-1">DESCRIPTION</label>
          <input type="text" placeholder="Optional note" value={form.description} onChange={e => set('description', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50 text-white placeholder-white/20" />
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="mt-4 w-full py-3 rounded-lg font-mono font-medium text-sm transition-all duration-200"
        style={{ background: 'linear-gradient(135deg, #63D3AA, #6382D3)', color: '#0a0d14' }}>
        {loading ? 'Adding...' : '+ Add Transaction'}
      </button>
    </form>
  )
}

// ── Transaction List ──────────────────────────────────────────
function TransactionList({ transactions, onReset }) {
  return (
    <div className="glass p-6 fade-up" style={{ animationDelay: '300ms' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-xl" style={{ color: '#e8eaf0' }}>Recent Transactions</h2>
        <button onClick={onReset} className="text-xs font-mono text-white/30 hover:text-red-400 transition-colors">Reset All</button>
      </div>
      {transactions.length === 0 ? (
        <p className="text-sm font-mono text-white/30 text-center py-8">No transactions yet. Add some above!</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {[...transactions].reverse().map(tx => (
            <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{tx.type === 'income' ? '💚' : '🔴'}</span>
                <div>
                  <p className="text-sm font-medium">{tx.category}</p>
                  <p className="text-xs font-mono text-white/30">{tx.date} {tx.description ? `· ${tx.description}` : ''}</p>
                </div>
              </div>
              <span className="font-mono text-sm font-medium" style={{ color: tx.type === 'income' ? '#63D3AA' : '#EF4444' }}>
                {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Forecast Panel ────────────────────────────────────────────
function ForecastPanel({ forecast }) {
  if (!forecast || !forecast.forecast_labels?.length) return (
    <div className="glass p-6 fade-up" style={{ animationDelay: '400ms' }}>
      <h2 className="font-display text-xl mb-2" style={{ color: '#6382D3' }}>AI Forecast</h2>
      <p className="text-sm font-mono text-white/30">Add transactions across multiple months to see predictions.</p>
    </div>
  )

  return (
    <div className="glass p-6 fade-up" style={{ animationDelay: '400ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl" style={{ color: '#6382D3' }}>AI Forecast</h2>
        <span className="text-xs font-mono text-white/30">Linear Regression · 3 months</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {forecast.forecast_labels.map((label, i) => (
          <div key={label} className="text-center p-3 rounded-lg" style={{ background: 'rgba(99,130,211,0.08)', border: '1px solid rgba(99,130,211,0.2)' }}>
            <p className="text-xs font-mono text-white/40 mb-1">{label}</p>
            <p className="font-display text-lg" style={{ color: '#6382D3' }}>{fmt(forecast.predicted_expenses[i])}</p>
            <p className="text-xs font-mono text-white/30">expenses</p>
          </div>
        ))}
      </div>
      {forecast.risk?.reasons?.length > 0 && (
        <div className="mt-2">
          {forecast.risk.reasons.map((r, i) => (
            <p key={i} className="text-xs font-mono text-white/40 flex items-center gap-2">
              <span style={{ color: '#FBbf24' }}>⚠</span> {r}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [summary,      setSummary]      = useState(null)
  const [forecast,     setForecast]     = useState(null)
  const [transactions, setTransactions] = useState([])

  const refresh = async () => {
    try {
      const [s, f, t] = await Promise.all([
        fetch(`${API}/get-summary`).then(r => r.json()),
        fetch(`${API}/forecast`).then(r => r.json()),
        fetch(`${API}/transactions`).then(r => r.json()),
      ])
      setSummary(s)
      setForecast(f)
      setTransactions(t.transactions || [])
    } catch (e) {
      console.warn('Backend not connected:', e.message)
    }
  }

  const reset = async () => {
    await fetch(`${API}/reset`, { method: 'DELETE' })
    refresh()
  }

  useEffect(() => { refresh() }, [])

  const savingsColor = summary?.savings >= 0 ? '#63D3AA' : '#EF4444'

  return (
    <div className="mesh-bg min-h-screen">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #63D3AA, #6382D3)' }}>◈</div>
          <span className="font-display text-xl tracking-tight">FinSight <span style={{ color: '#63D3AA' }}>AI</span></span>
        </div>
        <div className="flex items-center gap-4">
          {forecast?.risk && <RiskBadge risk={forecast.risk} />}
          <span className="text-xs font-mono text-white/25">{transactions.length} transactions</span>
        </div>
      </header>

      <main className="px-8 py-8 max-w-7xl mx-auto">
        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Income"   value={fmt(summary?.total_income   || 0)} accent="#63D3AA" delay={0}   />
          <MetricCard label="Total Expenses" value={fmt(summary?.total_expenses || 0)} accent="#EF4444" delay={80}  />
          <MetricCard label="Net Savings"    value={fmt(summary?.savings        || 0)} accent={savingsColor} delay={160} sub={summary?.savings < 0 ? '⚠ Spending exceeds income' : 'Keep it up!'} />
          <MetricCard label="Risk Score"     value={forecast?.risk ? `${forecast.risk.score}/100` : '—'} accent={forecast?.risk?.color === 'green' ? '#63D3AA' : forecast?.risk?.color === 'red' ? '#EF4444' : '#FBbf24'} delay={240} sub={forecast?.risk?.badge ? `${forecast.risk.badge} Risk` : 'No data yet'} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="glass p-6 fade-up" style={{ animationDelay: '320ms' }}>
            <h3 className="font-display text-lg mb-4">Expenses & AI Forecast</h3>
            <div style={{ height: '240px' }}>
              <ExpenseChart summary={summary} forecast={forecast} />
            </div>
          </div>
          <div className="glass p-6 fade-up" style={{ animationDelay: '360ms' }}>
            <h3 className="font-display text-lg mb-4">Income Trend</h3>
            <div style={{ height: '240px' }}>
              <IncomeChart summary={summary} />
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <TransactionForm onAdd={refresh} />
            <ForecastPanel forecast={forecast} />
          </div>
          <div className="lg:col-span-2">
            <TransactionList transactions={transactions} onReset={reset} />

            {/* Demo data loader */}
            <DemoLoader onLoad={refresh} />
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Demo Data Loader ──────────────────────────────────────────
const DEMO_DATA = [
  // 4 months of realistic data
  { amount: 5000, type: 'income',  category: 'Salary',       date: '2024-09-01' },
  { amount: 1200, type: 'expense', category: 'Housing',      date: '2024-09-02' },
  { amount: 320,  type: 'expense', category: 'Food',         date: '2024-09-10' },
  { amount: 150,  type: 'expense', category: 'Transport',    date: '2024-09-15' },
  { amount: 200,  type: 'expense', category: 'Entertainment',date: '2024-09-22' },

  { amount: 5000, type: 'income',  category: 'Salary',       date: '2024-10-01' },
  { amount: 1200, type: 'expense', category: 'Housing',      date: '2024-10-02' },
  { amount: 380,  type: 'expense', category: 'Food',         date: '2024-10-12' },
  { amount: 180,  type: 'expense', category: 'Transport',    date: '2024-10-16' },
  { amount: 350,  type: 'expense', category: 'Shopping',     date: '2024-10-25' },

  { amount: 5500, type: 'income',  category: 'Salary',       date: '2024-11-01' },
  { amount: 800,  type: 'income',  category: 'Freelance',    date: '2024-11-05' },
  { amount: 1200, type: 'expense', category: 'Housing',      date: '2024-11-02' },
  { amount: 420,  type: 'expense', category: 'Food',         date: '2024-11-14' },
  { amount: 210,  type: 'expense', category: 'Transport',    date: '2024-11-18' },
  { amount: 490,  type: 'expense', category: 'Entertainment',date: '2024-11-28' },

  { amount: 5500, type: 'income',  category: 'Salary',       date: '2024-12-01' },
  { amount: 1200, type: 'expense', category: 'Housing',      date: '2024-12-02' },
  { amount: 510,  type: 'expense', category: 'Food',         date: '2024-12-16' },
  { amount: 620,  type: 'expense', category: 'Shopping',     date: '2024-12-20' },
  { amount: 300,  type: 'expense', category: 'Entertainment',date: '2024-12-24' },
]

function DemoLoader({ onLoad }) {
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  const loadDemo = async () => {
    setLoading(true)
    for (const tx of DEMO_DATA) {
      await fetch(`${API}/add-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      })
    }
    await onLoad()
    setLoading(false)
    setDone(true)
  }

  return (
    <div className="glass p-4 mt-4 fade-up flex items-center justify-between" style={{ animationDelay: '500ms' }}>
      <div>
        <p className="text-sm font-medium">Load Demo Dataset</p>
        <p className="text-xs font-mono text-white/30">4 months of sample transactions to test forecasting</p>
      </div>
      <button onClick={loadDemo} disabled={loading || done}
        className="px-4 py-2 rounded-lg text-sm font-mono transition-all duration-200"
        style={{
          background: done ? 'rgba(99,211,170,0.15)' : 'rgba(255,255,255,0.06)',
          color:      done ? '#63D3AA'                : 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
        {done ? '✓ Loaded' : loading ? 'Loading...' : 'Load Demo'}
      </button>
    </div>
  )
}
