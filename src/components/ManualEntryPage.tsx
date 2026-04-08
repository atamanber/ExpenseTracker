import { useState } from 'react'
import { useStore } from '../store/useStore'
import { classifyTransaction } from '../utils/ruleEngine'

export default function ManualEntryPage() {
  const { addTransactions, categories, rules, persons } = useStore()

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    description: '',
    counterparty: '',
    category: 'other',
    type: 'expense' as 'income' | 'expense',
    person: persons[0] ?? 'Me',
  })
  const [saved, setSaved] = useState(false)

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (isNaN(amount)) return

    const tx = classifyTransaction(
      {
        id: crypto.randomUUID(),
        date: form.date,
        amount: form.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        description: form.description,
        rawDescription: form.description,
        counterparty: form.counterparty,
        category: form.category,
        type: form.type,
        bank: 'manual',
        person: form.person,
        isManual: true,
        sessionId: 'manual',
        ignored: false,
      },
      categories,
      rules
    )

    addTransactions([tx])
    setSaved(true)
    setForm((f) => ({ ...f, amount: '', description: '', counterparty: '' }))
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Manual Entry</h1>
      <p className="text-gray-400 text-sm">Add cash payments or other transactions without a digital record.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount (€)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <input
            placeholder="What was this for?"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Counterparty (optional)</label>
          <input
            placeholder="Shop or person name"
            value={form.counterparty}
            onChange={(e) => set('counterparty', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Type</label>
            <div className="flex rounded overflow-hidden border border-gray-700">
              <button
                type="button"
                onClick={() => set('type', 'expense')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-red-800 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => set('type', 'income')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-green-800 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                Income
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Person</label>
            <select
              value={form.person}
              onChange={(e) => set('person', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            >
              {persons.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
        >
          Add Transaction
        </button>
      </form>

      {saved && (
        <div className="bg-green-900/40 border border-green-700 rounded-lg p-3 text-green-300 text-sm">
          Transaction added successfully.
        </div>
      )}
    </div>
  )
}
