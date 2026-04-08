import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'

export default function SummaryPage() {
  const { transactions, categories } = useStore()
  const [filterMonth, setFilterMonth] = useState('')
  const [filterPerson, setFilterPerson] = useState('')

  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse()
  const persons = [...new Set(transactions.map((t) => t.person))]
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]))

  const filtered = useMemo(() => {
    let txs = transactions.filter((t) => !t.ignored)  // always exclude ignored
    if (filterMonth) txs = txs.filter((t) => t.date.startsWith(filterMonth))
    if (filterPerson) txs = txs.filter((t) => t.person === filterPerson)
    return txs
  }, [transactions, filterMonth, filterPerson])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, { total: number; count: number; transactions: typeof filtered }>()
    for (const tx of filtered) {
      const existing = map.get(tx.category) ?? { total: 0, count: 0, transactions: [] }
      existing.total += tx.amount
      existing.count++
      existing.transactions.push(tx)
      map.set(tx.category, existing)
    }
    return [...map.entries()]
      .map(([catId, data]) => ({ catId, ...data }))
      .sort((a, b) => a.total - b.total) // most negative (expense) first
  }, [filtered])

  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = totalIncome + totalExpense

  const handleCopy = () => {
    const header = 'Category\tTotal\tCount'
    const rows = grouped.map((g) => [categoryMap[g.catId]?.name ?? g.catId, g.total.toFixed(2), g.count].join('\t'))
    const summary = [`Total Income\t${totalIncome.toFixed(2)}\t`, `Total Expenses\t${totalExpense.toFixed(2)}\t`, `Net\t${net.toFixed(2)}\t`]
    navigator.clipboard.writeText([header, ...rows, '', ...summary].join('\n'))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Summary</h1>
        <button onClick={handleCopy} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
          Copy for Sheets
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
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
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-900/30 border border-green-800 rounded-xl p-4">
          <div className="text-xs text-green-400 font-semibold uppercase tracking-wider">Total Income</div>
          <div className="text-2xl font-bold text-green-300 mt-1">+€{totalIncome.toFixed(2)}</div>
        </div>
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
          <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">Total Expenses</div>
          <div className="text-2xl font-bold text-red-300 mt-1">€{totalExpense.toFixed(2)}</div>
        </div>
        <div className={`${net >= 0 ? 'bg-blue-900/30 border-blue-800' : 'bg-orange-900/30 border-orange-800'} border rounded-xl p-4`}>
          <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Net</div>
          <div className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>
            {net >= 0 ? '+' : ''}€{net.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Transactions</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {grouped.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No data</td></tr>
            )}
            {grouped.map(({ catId, total, count }) => {
              const cat = categoryMap[catId]
              return (
                <tr key={catId} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 flex items-center gap-2">
                    {cat && (
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: cat.color }} />
                    )}
                    {cat?.name ?? catId}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{count}</td>
                  <td className={`px-4 py-3 text-right font-semibold font-mono ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {total >= 0 ? '+' : ''}€{total.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
