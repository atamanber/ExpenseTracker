import { useState, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore'
import NewRuleForm from './NewRuleForm'
import { formatAmount } from '../utils/format'

type SortKey = 'date' | 'amount' | 'category' | 'person' | 'bank'

type ColKey = 'date' | 'amount' | 'type' | 'category' | 'description' | 'person' | 'bank' | 'tag' | 'actions'

const COL_KEYS: ColKey[] = ['date', 'amount', 'type', 'category', 'description', 'person', 'bank', 'tag', 'actions']

const INIT_WIDTHS: Record<ColKey, number> = {
  date: 110,
  amount: 100,
  type: 90,
  category: 130,
  description: 300,
  person: 100,
  bank: 80,
  tag: 110,
  actions: 40,
}

export default function TransactionsPage() {
  const { transactions, categories, tags, uploadSessions, updateTransaction, removeTransaction, clearAllTransactions } = useStore()
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterPerson, setFilterPerson] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [filterAmountOp, setFilterAmountOp] = useState<'gte' | 'lte' | ''>('')
  const [filterAmountVal, setFilterAmountVal] = useState('')
  const [search, setSearch] = useState('')
  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [showIgnored, setShowIgnored] = useState(true)
  const [showNewRule, setShowNewRule] = useState(false)
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(INIT_WIDTHS)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    if (window.getSelection()?.toString()) return
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const resizing = useRef<{ col: ColKey; nextCol: ColKey; startX: number; startWidth: number; nextStartWidth: number } | null>(null)

  const startResize = (col: ColKey, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const idx = COL_KEYS.indexOf(col)
    const nextCol = COL_KEYS[idx + 1]
    if (!nextCol) return
    resizing.current = {
      col,
      nextCol,
      startX: e.clientX,
      startWidth: colWidths[col],
      nextStartWidth: colWidths[nextCol],
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const delta = e.clientX - resizing.current.startX
      const newWidth = Math.max(50, resizing.current.startWidth + delta)
      const actualDelta = newWidth - resizing.current.startWidth
      const newNextWidth = Math.max(50, resizing.current.nextStartWidth - actualDelta)
      setColWidths((prev) => ({
        ...prev,
        [resizing.current!.col]: newWidth,
        [resizing.current!.nextCol]: newNextWidth,
      }))
    }

    const onMouseUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const persons = [...new Set(transactions.map((t) => t.person))]
  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse()

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const filtered = useMemo(() => {
    let txs = [...transactions]
    if (!showIgnored) txs = txs.filter((t) => !t.ignored)
    if (filterSession) txs = txs.filter((t) => t.sessionId === filterSession)
    if (filterPerson) txs = txs.filter((t) => t.person === filterPerson)
    if (filterCategory) txs = txs.filter((t) => t.category === filterCategory)
    if (filterType) txs = txs.filter((t) => t.type === filterType)
    if (filterMonth) txs = txs.filter((t) => t.date.startsWith(filterMonth))
    if (filterAmountOp && filterAmountVal !== '') {
      const val = parseFloat(filterAmountVal)
      if (!isNaN(val)) {
        if (filterAmountOp === 'gte') txs = txs.filter((t) => t.amount >= val)
        else txs = txs.filter((t) => t.amount <= val)
      }
    }
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
  }, [transactions, sortKey, sortDir, filterSession, filterPerson, filterCategory, filterType, filterMonth, filterAmountOp, filterAmountVal, search, showIgnored])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const resizeHandle = (col: ColKey) => {
    const idx = COL_KEYS.indexOf(col)
    if (idx === COL_KEYS.length - 1) return null
    return (
      <div
        onMouseDown={(e) => startResize(col, e)}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-500/50"
      />
    )
  }

  const colHeader = (col: ColKey, sortable: SortKey | null, label: string) => (
    <th
      key={col}
      className="relative group px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider select-none overflow-hidden"
      style={{ width: colWidths[col] }}
      onClick={sortable ? () => handleSort(sortable) : undefined}
    >
      <span className={sortable ? 'cursor-pointer hover:text-white' : ''}>
        {label} {sortable && sortKey === sortable ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </span>
      {resizeHandle(col)}
    </th>
  )

  const handleCopyTable = () => {
    const header = 'Date\tAmount\tType\tCategory\tDescription\tPerson\tBank'
    const rows = filtered.map((t) =>
      [t.date, formatAmount(t.amount), t.type, categoryMap[t.category] ?? t.category, t.description, t.person, t.bank].join('\t')
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
        <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm max-w-48">
          <option value="">All sessions</option>
          {[...uploadSessions].reverse().map((s) => (
            <option key={s.id} value={s.id}>{s.filename} ({s.person})</option>
          ))}
        </select>
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
        <div className="flex gap-1">
          <select
            value={filterAmountOp}
            onChange={(e) => setFilterAmountOp(e.target.value as 'gte' | 'lte' | '')}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
          >
            <option value="">Amount</option>
            <option value="gte">≥</option>
            <option value="lte">≤</option>
          </select>
          {filterAmountOp && (
            <input
              type="number"
              placeholder="0.00"
              value={filterAmountVal}
              onChange={(e) => setFilterAmountVal(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-28"
            />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} className="rounded" />
          Show ignored
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            {COL_KEYS.map((col) => (
              <col key={col} style={{ width: colWidths[col] }} />
            ))}
          </colgroup>
          <thead className="bg-gray-900">
            <tr>
              {colHeader('date', 'date', 'Date')}
              {colHeader('amount', 'amount', 'Amount')}
              {colHeader('type', null, 'Type')}
              {colHeader('category', 'category', 'Category')}
              {colHeader('description', null, 'Description')}
              {colHeader('person', 'person', 'Person')}
              {colHeader('bank', 'bank', 'Bank')}
              {colHeader('tag', null, 'Tag')}
              <th className="relative py-3" style={{ width: colWidths.actions }} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No transactions found</td></tr>
            )}
            {filtered.map((tx) => (
              <tr key={tx.id} className={`transition-colors ${tx.ignored ? 'opacity-40 hover:opacity-60' : 'hover:bg-gray-800/50'}`}>
                <td className="px-4 py-2.5 font-mono text-gray-300 overflow-hidden">
                  {editingDateId === tx.id ? (
                    <input
                      type="date"
                      defaultValue={tx.date}
                      autoFocus
                      onBlur={(e) => { updateTransaction(tx.id, { date: e.target.value }); setEditingDateId(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingDateId(null) }}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm w-full"
                    />
                  ) : (
                    <span onClick={() => setEditingDateId(tx.id)} className="cursor-pointer hover:text-white">{tx.date}</span>
                  )}
                </td>
                <td className={`px-4 py-2.5 font-mono font-semibold overflow-hidden ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatAmount(tx.amount)}
                </td>
                <td className="px-4 py-2.5 overflow-hidden">
                  {tx.ignored
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-500">ignored</span>
                    : <span className={`text-xs px-2 py-0.5 rounded-full ${tx.type === 'income' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>{tx.type}</span>
                  }
                </td>
                <td className="py-1.5 overflow-hidden">
                  <div className="flex items-center gap-1 px-3">
                    <select
                      value={tx.category}
                      onChange={(e) => updateTransaction(tx.id, { category: e.target.value, categoryPinned: true })}
                      className="bg-transparent text-gray-300 text-sm cursor-pointer hover:text-white focus:outline-none"
                    >
                      {categories.map((c) => <option key={c.id} value={c.id} className="bg-gray-800">{c.name}</option>)}
                      {!categories.find((c) => c.id === tx.category) && (
                        <option value={tx.category} className="bg-gray-800">{tx.category}</option>
                      )}
                    </select>
                    {tx.categoryPinned && (
                      <button
                        onClick={() => updateTransaction(tx.id, { categoryPinned: false })}
                        title="Pinned — click to unpin"
                        className="text-orange-400 hover:text-gray-500 text-xs leading-none"
                      >
                        📌
                      </button>
                    )}
                  </div>
                </td>
                <td
                  className="px-4 py-2.5 text-gray-300 cursor-pointer hover:text-white overflow-hidden"
                  onClick={() => toggleExpanded(tx.id)}
                >
                  <span className={expandedRows.has(tx.id) ? 'whitespace-pre-wrap break-words' : 'block truncate'}>
                    {tx.description}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-400 overflow-hidden">{tx.person}</td>
                <td className="px-4 py-2.5 overflow-hidden">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{tx.bank}</span>
                </td>
                <td className="px-2 py-1.5 overflow-hidden">
                  <select
                    value={tx.tagId ?? ''}
                    onChange={(e) => updateTransaction(tx.id, { tagId: e.target.value || undefined })}
                    className={`text-xs rounded px-1.5 py-0.5 w-full cursor-pointer focus:outline-none ${
                      tx.tagId ? 'bg-violet-900/60 text-violet-300 border border-violet-700' : 'bg-transparent text-gray-600 border border-transparent hover:border-gray-600'
                    }`}
                  >
                    <option value="">—</option>
                    {tags.map((t) => <option key={t.id} value={t.id} className="bg-gray-800 text-gray-200">{t.name}</option>)}
                  </select>
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
