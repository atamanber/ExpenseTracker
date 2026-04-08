import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import NewRuleForm from './NewRuleForm'

type SortKey = 'date' | 'amount' | 'category' | 'person' | 'bank'

export default function TransactionsPage() {
  const { transactions, categories, removeTransaction, clearAllTransactions } = useStore()
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterPerson, setFilterPerson] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [search, setSearch] = useState('')
  const [showIgnored, setShowIgnored] = useState(true)
  const [showNewRule, setShowNewRule] = useState(false)

  const persons = [...new Set(transactions.map((t) => t.person))]
  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse()

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const filtered = useMemo(() => {
    let txs = [...transactions]
    if (!showIgnored) txs = txs.filter((t) => !t.ignored)
    if (filterPerson) txs = txs.filter((t) => t.person === filterPerson)
    if (filterCategory) txs = txs.filter((t) => t.category === filterCategory)
    if (filterType) txs = txs.filter((t) => t.type === filterType)
    if (filterMonth) txs = txs.filter((t) => t.date.startsWith(filterMonth))
    if (search) {
      const s = search.toLowerCase()
      txs = txs.filter(
        (t) =>
          t.description.toLowerCase().includes(s) ||
          t.counterparty.toLowerCase().includes(s)
      )
    }
    txs.sort((a, b) => {
      let av: string | number = a[sortKey]
      let bv: string | number = b[sortKey]
      if (sortKey === 'amount') { av = a.amount; bv = b.amount }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return txs
  }, [transactions, sortKey, sortDir, filterPerson, filterCategory, filterType, filterMonth, search, showIgnored])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const colHeader = (key: SortKey, label: string) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
      onClick={() => handleSort(key)}
    >
      {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  const handleCopyTable = () => {
    const header = 'Date\tAmount\tType\tCategory\tDescription\tCounterparty\tPerson\tBank'
    const rows = filtered.map((t) =>
      [t.date, t.amount.toFixed(2), t.type, categoryMap[t.category] ?? t.category, t.description, t.counterparty, t.person, t.bank].join('\t')
    )
    navigator.clipboard.writeText([header, ...rows].join('\n'))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Transactions ({filtered.length})</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewRule((v) => !v)}
            className={`px-3 py-1.5 rounded text-sm ${showNewRule ? 'bg-blue-800 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            + New Rule
          </button>
          <button onClick={handleCopyTable} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
            Copy for Sheets
          </button>
          <button
            onClick={() => { if (confirm('Clear all transactions?')) clearAllTransactions() }}
            className="px-3 py-1.5 bg-red-900 hover:bg-red-700 rounded text-sm"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* New Rule panel */}
      {showNewRule && (
        <NewRuleForm onSaved={() => setShowNewRule(false)} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm flex-1 min-w-40"
        />
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
          <option value="">All months</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
          <option value="">All persons</option>
          {persons.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} className="rounded" />
          Show ignored
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900">
            <tr>
              {colHeader('date', 'Date')}
              {colHeader('amount', 'Amount')}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
              {colHeader('category', 'Category')}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Counterparty</th>
              {colHeader('person', 'Person')}
              {colHeader('bank', 'Bank')}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No transactions found</td></tr>
            )}
            {filtered.map((tx) => (
              <tr key={tx.id} className={`transition-colors ${tx.ignored ? 'opacity-40 hover:opacity-60' : 'hover:bg-gray-800/50'}`}>
                <td className="px-4 py-2.5 font-mono text-gray-300">{tx.date}</td>
                <td className={`px-4 py-2.5 font-mono font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                </td>
                <td className="px-4 py-2.5">
                  {tx.ignored
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-500">ignored</span>
                    : <span className={`text-xs px-2 py-0.5 rounded-full ${tx.type === 'income' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>{tx.type}</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-gray-300">{categoryMap[tx.category] ?? tx.category}</td>
                <td className="px-4 py-2.5 max-w-xs truncate text-gray-300" title={tx.description}>{tx.description}</td>
                <td className="px-4 py-2.5 text-gray-400 max-w-xs truncate" title={tx.counterparty}>{tx.counterparty}</td>
                <td className="px-4 py-2.5 text-gray-400">{tx.person}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{tx.bank}</span>
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => removeTransaction(tx.id)} className="text-gray-600 hover:text-red-400 text-xs">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
