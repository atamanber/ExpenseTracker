import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatAmount } from '../utils/format'
import { useLocalStorage } from '../utils/useLocalStorage'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function SummaryPage() {
  const { transactions, categories } = useStore()
  const [filterMonth, setFilterMonth] = useState('')
  const [filterPerson, setFilterPerson] = useState('')

  const [excludedCatsArr, setExcludedCatsArr] = useLocalStorage<string[]>('summary-excluded-cats', [])
  const excludedCats = new Set(excludedCatsArr)

  const [showOtherBar, setShowOtherBar] = useLocalStorage('summary-show-other-bar', true)
  const [anomalyThreshold, setAnomalyThreshold] = useLocalStorage('summary-anomaly-threshold', 10)

  const [excludedAnalysisCatsArr, setExcludedAnalysisCatsArr] = useLocalStorage<string[]>('summary-excluded-analysis-cats', [])
  const excludedAnalysisCats = new Set(excludedAnalysisCatsArr)

  const toggleAnalysisCat = (catId: string) => {
    setExcludedAnalysisCatsArr((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  const toggleCat = (catId: string) => {
    setExcludedCatsArr((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse()
  const persons = [...new Set(transactions.map((t) => t.person))]
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]))

  const filtered = useMemo(() => {
    let txs = transactions.filter((t) => !t.ignored)
    if (filterMonth) txs = txs.filter((t) => t.date.startsWith(filterMonth))
    if (filterPerson) txs = txs.filter((t) => t.person === filterPerson)
    return txs
  }, [transactions, filterMonth, filterPerson])

  const grouped = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const tx of filtered) {
      const existing = map.get(tx.category) ?? { total: 0, count: 0 }
      existing.total += tx.amount
      existing.count++
      map.set(tx.category, existing)
    }
    return [...map.entries()]
      .map(([catId, data]) => ({ catId, ...data }))
      .sort((a, b) => a.total - b.total)
  }, [filtered])

  const monthCount = filterMonth ? 1 : new Set(filtered.map((t) => t.date.slice(0, 7))).size || 1
  const filteredExcluded = filtered.filter((t) => !excludedCats.has(t.category))
  const totalIncome = filteredExcluded.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filteredExcluded.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = totalIncome + totalExpense

  // Monthly average — exclude toggled categories, only when not filtered to a single month
  const monthlyAvg = useMemo(() => {
    if (filterMonth) return null
    const baseTxs = transactions.filter((t) => !t.ignored && !excludedCats.has(t.category))
    const filtered2 = filterPerson ? baseTxs.filter((t) => t.person === filterPerson) : baseTxs
    const monthSet = [...new Set(filtered2.map((t) => t.date.slice(0, 7)))].sort()
    if (monthSet.length === 0) return null
    const n = monthSet.length
    const income = filtered2.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = filtered2.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income: income / n, expense: expense / n, net: (income + expense) / n, months: n }
  }, [transactions, filterMonth, filterPerson, excludedCats])


  const chartData = useMemo(() => {
    const baseTxs = transactions.filter((t) => !t.ignored && !excludedCats.has(t.category))
    const filtered2 = filterPerson ? baseTxs.filter((t) => t.person === filterPerson) : baseTxs
    const monthSet = [...new Set(filtered2.map((t) => t.date.slice(0, 7)))].sort()
    return monthSet.map((month) => {
      const txs = filtered2.filter((t) => t.date.startsWith(month))
      const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0)
      const allTxs = transactions.filter((t) => !t.ignored && t.date.startsWith(month) && (!filterPerson || t.person === filterPerson))
      const other = allTxs.filter((t) => t.category === 'other').reduce((s, t) => s + Math.abs(t.amount), 0)
      return { month, income, expense, other }
    })
  }, [transactions, filterPerson, excludedCats])

  // Per-category, per-month analysis (always uses all months, ignores filterMonth)
  const categoryAnalysis = useMemo(() => {
    const baseTxs = transactions.filter((t) => !t.ignored)
    const txs = filterPerson ? baseTxs.filter((t) => t.person === filterPerson) : baseTxs
    const allMonths = [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort()
    const allCatIds = [...new Set(txs.map((t) => t.category))]

    // Build catId -> month -> total (absolute value for expenses)
    const data: Record<string, Record<string, number>> = {}
    for (const catId of allCatIds) {
      data[catId] = {}
      for (const month of allMonths) {
        const amt = txs.filter((t) => t.category === catId && t.date.startsWith(month)).reduce((s, t) => s + Math.abs(t.amount), 0)
        data[catId][month] = amt
      }
    }

    // Compute average per category: total signed amount / total months (same as breakdown table)
    const avg: Record<string, number> = {}
    for (const catId of allCatIds) {
      const total = txs.filter((t) => t.category === catId).reduce((s, t) => s + t.amount, 0)
      avg[catId] = Math.abs(total / (allMonths.length || 1))
    }

    // Compute deviation % per cell
    const deviation: Record<string, Record<string, number>> = {}
    for (const catId of allCatIds) {
      deviation[catId] = {}
      for (const month of allMonths) {
        const a = avg[catId]
        deviation[catId][month] = a === 0 ? 0 : ((data[catId][month] - a) / a) * 100
      }
    }

    return { allMonths, allCatIds, data, avg, deviation }
  }, [transactions, filterPerson])

  const anomalies = useMemo(() => {
    const { allMonths, allCatIds, data, avg, deviation } = categoryAnalysis
    const results: { catId: string; month: string; amount: number; avg: number; pct: number }[] = []
    for (const catId of allCatIds) {
      if (excludedAnalysisCats.has(catId)) continue
      for (const month of allMonths) {
        const pct = deviation[catId][month]
        if (Math.abs(pct) >= anomalyThreshold && avg[catId] > 0) {
          results.push({ catId, month, amount: data[catId][month], avg: avg[catId], pct })
        }
      }
    }
    return results.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
  }, [categoryAnalysis, anomalyThreshold, excludedAnalysisCats])

  const handleCopy = () => {
    const header = 'Category\tTotal\tCount'
    const rows = grouped.map((g) => [categoryMap[g.catId]?.name ?? g.catId, formatAmount(g.total), g.count].join('\t'))
    const summary = [`Total Income\t${formatAmount(totalIncome)}\t`, `Total Expenses\t${formatAmount(totalExpense)}\t`, `Net\t${formatAmount(net)}\t`]
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
          <div className="text-2xl font-bold text-green-300 mt-1">+€{formatAmount(totalIncome)}</div>
        </div>
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
          <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">Total Expenses</div>
          <div className="text-2xl font-bold text-red-300 mt-1">€{formatAmount(totalExpense)}</div>
        </div>
        <div className={`${net >= 0 ? 'bg-blue-900/30 border-blue-800' : 'bg-orange-900/30 border-orange-800'} border rounded-xl p-4`}>
          <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Net</div>
          <div className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>
            {net >= 0 ? '+' : ''}€{formatAmount(net)}
          </div>
        </div>
      </div>

      {/* Monthly average */}
      {monthlyAvg && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Monthly Average</h2>
            <span className="text-xs text-gray-600">over {monthlyAvg.months} month{monthlyAvg.months !== 1 ? 's' : ''}</span>
            {excludedCats.size > 0 && (
              <span className="text-xs text-orange-400">{excludedCats.size} categor{excludedCats.size === 1 ? 'y' : 'ies'} excluded</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-900/20 border border-green-900 rounded-xl p-4">
              <div className="text-xs text-green-500 font-semibold uppercase tracking-wider">Avg Income</div>
              <div className="text-xl font-bold text-green-400 mt-1">+€{formatAmount(monthlyAvg.income)}</div>
            </div>
            <div className="bg-red-900/20 border border-red-900 rounded-xl p-4">
              <div className="text-xs text-red-500 font-semibold uppercase tracking-wider">Avg Expenses</div>
              <div className="text-xl font-bold text-red-400 mt-1">€{formatAmount(monthlyAvg.expense)}</div>
            </div>
            <div className={`${monthlyAvg.net >= 0 ? 'bg-blue-900/20 border-blue-900' : 'bg-orange-900/20 border-orange-900'} border rounded-xl p-4`}>
              <div className="text-xs text-blue-500 font-semibold uppercase tracking-wider">Avg Net</div>
              <div className={`text-xl font-bold mt-1 ${monthlyAvg.net >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                {monthlyAvg.net >= 0 ? '+' : ''}€{formatAmount(monthlyAvg.net)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Transactions</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Avg</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider" title="Include in calculations">Calculate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {grouped.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No data</td></tr>
            )}
            {grouped.map(({ catId, total, count }) => {
              const cat = categoryMap[catId]
              const excluded = excludedCats.has(catId)
              return (
                <tr key={catId} className={`hover:bg-gray-800/50 ${excluded ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 flex items-center gap-2">
                    {cat && <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: cat.color }} />}
                    {cat?.name ?? catId}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{count}</td>
                  <td className={`px-4 py-3 text-right font-semibold font-mono ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {total >= 0 ? '+' : ''}€{formatAmount(total)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${(total / monthCount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(total / monthCount) >= 0 ? '+' : ''}€{formatAmount(total / monthCount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleCat(catId)}
                      title={excluded ? 'Excluded from average — click to include' : 'Included in average — click to exclude'}
                      className={`w-5 h-5 rounded border-2 transition-colors ${excluded ? 'border-gray-600 bg-transparent' : 'border-blue-500 bg-blue-500'}`}
                    >
                      {!excluded && <span className="text-white text-xs leading-none">✓</span>}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Monthly bar chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Month by Month</h2>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showOtherBar} onChange={(e) => setShowOtherBar(e.target.checked)} className="rounded" />
              Show Other
            </label>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="25%" barGap={2}>
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${formatAmount(v)}`} width={90} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const income = (payload.find((p) => p.dataKey === 'income')?.value as number) ?? 0
                  const expense = (payload.find((p) => p.dataKey === 'expense')?.value as number) ?? 0
                  const other = (chartData.find((d) => d.month === label)?.other) ?? 0
                  const net = income - expense
                  return (
                    <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ color: '#e5e7eb', marginBottom: 6, fontWeight: 600 }}>{label}</div>
                      <div style={{ color: '#4ade80', fontSize: 13 }}>Income: €{formatAmount(income)}</div>
                      <div style={{ color: '#f87171', fontSize: 13 }}>Expenses: €{formatAmount(expense)}</div>
                      <div style={{ color: '#94a3b8', fontSize: 13 }}>Other: €{formatAmount(other)}</div>
                      <div style={{ color: net >= 0 ? '#60a5fa' : '#fb923c', fontSize: 13, marginTop: 4, fontWeight: 600, borderTop: '1px solid #374151', paddingTop: 4 }}>
                        Net: {net >= 0 ? '+' : '-'}€{formatAmount(Math.abs(net))}
                      </div>
                    </div>
                  )
                }}
              />
              <Legend formatter={(v) => v === 'income' ? 'Income' : v === 'expense' ? 'Expenses' : 'Other'} wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Bar dataKey="income" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" fill="#f87171" radius={[3, 3, 0, 0]} />
              {showOtherBar && <Bar dataKey="other" fill="#94a3b8" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category analysis: threshold control */}
      {categoryAnalysis.allMonths.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Category Analysis</h2>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-400">Threshold</label>
              <input
                type="number"
                value={anomalyThreshold}
                onChange={(e) => setAnomalyThreshold(Math.max(1, parseInt(e.target.value) || 10))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm w-16 text-center"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2">
            {categoryAnalysis.allCatIds.map((catId) => {
              const cat = categoryMap[catId]
              const excluded = excludedAnalysisCats.has(catId)
              return (
                <button
                  key={catId}
                  onClick={() => toggleAnalysisCat(catId)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    excluded
                      ? 'border-gray-700 bg-transparent text-gray-600'
                      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {cat && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: excluded ? '#4b5563' : cat.color }} />}
                  {cat?.name ?? catId}
                </button>
              )
            })}
          </div>

          {/* Heat map */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
            <table className="text-xs min-w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-2 text-left text-gray-400 font-semibold sticky left-0 bg-gray-900 min-w-28">Category</th>
                  {categoryAnalysis.allMonths.map((m) => (
                    <th key={m} className="px-2 py-2 text-gray-400 font-semibold text-center min-w-20">{m}</th>
                  ))}
                  <th className="px-3 py-2 text-gray-400 font-semibold text-right min-w-20">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {categoryAnalysis.allCatIds.map((catId) => {
                  const cat = categoryMap[catId]
                  const catAvg = categoryAnalysis.avg[catId]
                  if (catAvg === 0 || excludedAnalysisCats.has(catId)) return null
                  return (
                    <tr key={catId} className="hover:bg-gray-800/30">
                      <td className="px-4 py-2 sticky left-0 bg-gray-900 flex items-center gap-1.5">
                        {cat && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />}
                        <span className="truncate max-w-24">{cat?.name ?? catId}</span>
                      </td>
                      {categoryAnalysis.allMonths.map((month) => {
                        const amount = categoryAnalysis.data[catId][month] ?? 0
                        const pct = categoryAnalysis.deviation[catId][month]
                        const absPct = Math.abs(pct)
                        const isAnomaly = absPct >= anomalyThreshold
                        const intensity = Math.min(absPct / 100, 1)
                        const bg = !isAnomaly
                          ? 'transparent'
                          : pct > 0
                          ? `rgba(248,113,113,${0.15 + intensity * 0.45})`
                          : `rgba(74,222,128,${0.15 + intensity * 0.45})`
                        return (
                          <td key={month} className="px-2 py-2 text-center font-mono" style={{ background: bg }}>
                            <div>{amount > 0 ? `€${formatAmount(amount)}` : '—'}</div>
                            {isAnomaly && <div className={`text-xs ${pct > 0 ? 'text-red-400' : 'text-green-400'}`}>{pct > 0 ? '+' : ''}{Math.round(pct)}%</div>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right font-mono text-gray-400">€{formatAmount(catAvg)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Anomaly list */}
          {anomalies.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Anomalies — deviations ≥ {anomalyThreshold}%
              </div>
              <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto">
                {anomalies.map(({ catId, month, amount, avg, pct }) => {
                  const cat = categoryMap[catId]
                  return (
                    <div key={`${catId}-${month}`} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-gray-500 w-16 flex-shrink-0 font-mono text-xs">{month}</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {cat && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />}
                        <span className="text-gray-300 text-xs truncate">{cat?.name ?? catId}</span>
                      </div>
                      <span className="font-mono text-xs text-gray-300">€{formatAmount(amount)}</span>
                      <span className="text-xs text-gray-500">avg €{formatAmount(avg)}</span>
                      <span className={`text-xs font-semibold w-16 text-right flex-shrink-0 ${pct > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {pct > 0 ? '+' : ''}{Math.round(pct)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
