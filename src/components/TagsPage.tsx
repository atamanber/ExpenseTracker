import { useState } from 'react'
import { useStore } from '../store/useStore'
import { formatAmount } from '../utils/format'
import type { Tag } from '../types'

export default function TagsPage() {
  const { tags, transactions, addTag, deleteTag, applyTag } = useStore()
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [dayQuery, setDayQuery] = useState<Record<string, string>>({}) // tagId -> date string

  const handleCreate = () => {
    if (!name.trim()) return setError('Name is required')
    if (!dateFrom || !dateTo) return setError('Date range is required')
    if (dateFrom > dateTo) return setError('Start date must be before end date')
    const tag: Tag = { id: crypto.randomUUID(), name: name.trim(), dateFrom, dateTo }
    addTag(tag)
    setName('')
    setDateFrom('')
    setDateTo('')
    setError('')
  }

  const tagStats = [...tags]
    .sort((a, b) => b.dateTo.localeCompare(a.dateTo))
    .map((tag) => {
      const tagged = transactions.filter((tx) => tx.tagId === tag.id)
      const total = tagged.reduce((s, tx) => s + tx.amount, 0)
      return { tag, tagged, count: tagged.length, total }
    })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tags</h1>

      {/* Create form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">New Tag</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Croatia 2025"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-48"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium"
          >
            Create & Auto-tag
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Automatically tags all <span className="text-gray-300">Other</span> expenses in the date range. You can also manually tag any transaction from the Transactions page.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Tag list */}
      {tagStats.length === 0 ? (
        <p className="text-gray-500 text-sm">No tags yet.</p>
      ) : (
        <div className="space-y-4">
          {tagStats.map(({ tag, tagged, count, total }) => {
            const selectedDay = dayQuery[tag.id] ?? ''
            const dayTxs = selectedDay ? tagged.filter((tx) => tx.date === selectedDay) : []
            const dayTotal = dayTxs.reduce((s, tx) => s + tx.amount, 0)

            return (
              <div key={tag.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white">{tag.name}</span>
                      <span className="text-xs text-gray-500 font-mono">{tag.dateFrom} → {tag.dateTo}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{count} transaction{count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className={`text-xl font-bold font-mono ${total <= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {total > 0 ? '+' : ''}€{formatAmount(total)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyTag(tag.id)}
                      title="Re-run auto-tagging for this tag"
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                    >
                      Re-apply
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete tag "${tag.name}"? This will untag all ${count} transactions.`)) deleteTag(tag.id) }}
                      className="px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800 text-red-400 hover:text-red-200 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Day lookup */}
                {count > 0 && (
                  <div className="border-t border-gray-800 px-5 py-3 flex items-center gap-3">
                    <label className="text-xs text-gray-500 flex-shrink-0">Check a day</label>
                    <input
                      type="date"
                      value={selectedDay}
                      min={tag.dateFrom}
                      max={tag.dateTo}
                      onChange={(e) => setDayQuery((prev) => ({ ...prev, [tag.id]: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                    />
                    {selectedDay && (
                      <>
                        <span className={`text-sm font-bold font-mono ${dayTotal <= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {dayTotal > 0 ? '+' : ''}€{formatAmount(dayTotal)}
                        </span>
                        <span className="text-xs text-gray-500">{dayTxs.length} transaction{dayTxs.length !== 1 ? 's' : ''}</span>
                        <button
                          onClick={() => setDayQuery((prev) => ({ ...prev, [tag.id]: '' }))}
                          className="text-gray-600 hover:text-gray-400 text-xs ml-auto"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Transaction list — filtered to day if selected, otherwise all */}
                {count > 0 && (
                  <div className="border-t border-gray-800 divide-y divide-gray-800/60 max-h-60 overflow-y-auto">
                    {(selectedDay ? dayTxs : tagged)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 px-5 py-2 text-xs">
                          <span className="text-gray-500 w-20 flex-shrink-0 font-mono">{tx.date}</span>
                          <span className="text-gray-300 flex-1 truncate">{tx.description}</span>
                          <span className="text-gray-400 w-20 flex-shrink-0">{tx.category}</span>
                          <span className={`font-mono flex-shrink-0 ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.amount >= 0 ? '+' : ''}€{formatAmount(tx.amount)}
                          </span>
                        </div>
                      ))}
                    {selectedDay && dayTxs.length === 0 && (
                      <div className="px-5 py-3 text-xs text-gray-600">No transactions on this day.</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
