import { useState, useRef } from 'react'
import { formatAmount } from '../utils/format'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { parseABN } from '../parsers/abnParser'
import { parseBunq } from '../parsers/bunqParser'
import { classifyTransaction } from '../utils/ruleEngine'
import type { Transaction, UploadSession } from '../types'

interface FileEntry {
  file: File
  bank: 'abn' | 'bunq'
  person: string
}

export default function UploadPage() {
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; parseWarnings: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { addTransactions, addUploadSession, deleteSession, updateSessionPerson, uploadSessions, transactions, categories, rules, persons, importData, exportData, removeTransaction } = useStore()
  const [manualExpanded, setManualExpanded] = useState(false)
  const [editingPersonSession, setEditingPersonSession] = useState<string | null>(null)

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    const newEntries: FileEntry[] = []
    Array.from(files).forEach((file) => {
      if (file.name.toLowerCase().endsWith('.json')) {
        // Treat JSON files as data imports directly
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string)
            importData(data)
          } catch {
            setError('Invalid JSON file: ' + file.name)
          }
        }
        reader.readAsText(file)
      } else {
        newEntries.push({
          file,
          bank: file.name.toLowerCase().endsWith('.csv') ? 'bunq' : 'abn',
          person: persons[0] ?? 'Me',
        })
      }
    })
    if (newEntries.length > 0) setFileEntries((prev) => [...prev, ...newEntries])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }

  const updateEntry = (index: number, patch: Partial<FileEntry>) => {
    setFileEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  const removeEntry = (index: number) => {
    setFileEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const handleImport = async () => {
    if (fileEntries.length === 0) return
    setLoading(true)
    setError(null)

    try {
      let totalAdded = 0
      let totalSkipped = 0
      let totalParseWarnings = 0
      for (const entry of fileEntries) {
        const sessionId = crypto.randomUUID()
        const { transactions: parsed, skippedRows } =
          entry.bank === 'abn'
            ? await parseABN(entry.file, entry.person, sessionId)
            : await parseBunq(entry.file, entry.person, sessionId)

        totalParseWarnings += skippedRows
        const classified = parsed.map((tx) => classifyTransaction(tx, categories, rules))

        if (classified.length > 0) {
          const { added, skipped } = addTransactions(classified)
          totalAdded += added
          totalSkipped += skipped

          if (added > 0) {
            const addedTxs = classified.filter((tx, i) => {
              // only count non-skipped ones for session date range
              void i
              return true
            })
            const dates = addedTxs.map((t) => t.date).sort()
            const session: UploadSession = {
              id: sessionId,
              filename: entry.file.name,
              bank: entry.bank,
              person: entry.person,
              count: added,
              dateFrom: dates[0],
              dateTo: dates[dates.length - 1],
              uploadedAt: new Date().toISOString(),
            }
            addUploadSession(session)
          }
        }
      }

      setImportResult({ added: totalAdded, skipped: totalSkipped, parseWarnings: totalParseWarnings })
      setFileEntries([])
      setTimeout(() => navigate('/transactions'), 1500)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expense-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        importData(data)
      } catch {
        setError('Invalid JSON file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upload Bank Exports</h1>
        <div className="flex gap-3">
          <button onClick={handleExport} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
            Export Data
          </button>
          <label className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer">
            Import Data
            <input type="file" accept=".json" className="hidden" onChange={handleJsonImport} />
          </label>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-12 text-center cursor-pointer transition-colors"
      >
        <div className="text-gray-400 space-y-2">
          <div className="text-4xl">+</div>
          <div className="text-lg font-medium">Drop files here or click to browse</div>
          <div className="text-sm">Supports ABN AMRO (.xls), bunq (.csv), or a previous export (.json)</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xls,.xlsx,.csv,.json"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Pending files */}
      {fileEntries.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-300">Files to import</h2>
          {fileEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-4 bg-gray-800 rounded-lg p-4">
              <span className="flex-1 text-sm font-mono truncate">{entry.file.name}</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Bank</label>
                <select
                  value={entry.bank}
                  onChange={(e) => updateEntry(i, { bank: e.target.value as 'abn' | 'bunq' })}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="abn">ABN AMRO</option>
                  <option value="bunq">bunq</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Person</label>
                <select
                  value={entry.person}
                  onChange={(e) => updateEntry(i, { person: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  {persons.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <button onClick={() => removeEntry(i)} className="text-gray-500 hover:text-red-400 text-lg leading-none">×</button>
            </div>
          ))}

          <button
            onClick={handleImport}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded-lg font-semibold transition-colors"
          >
            {loading ? 'Importing...' : `Import ${fileEntries.length} file(s)`}
          </button>
        </div>
      )}

      {importResult !== null && (
        <div className={`border rounded-lg p-4 space-y-1 ${importResult.parseWarnings > 0 ? 'bg-yellow-900/30 border-yellow-700' : 'bg-green-900/40 border-green-700'}`}>
          <div className="text-green-300">
            Imported {importResult.added} transactions.
            {importResult.skipped > 0 && (
              <span className="text-yellow-300"> {importResult.skipped} duplicate(s) skipped.</span>
            )}
            {' '}Redirecting...
          </div>
          {importResult.parseWarnings > 0 && (
            <div className="text-yellow-300 text-sm">
              ⚠ {importResult.parseWarnings} row{importResult.parseWarnings !== 1 ? 's' : ''} could not be parsed and were skipped. Check that your file is a valid export from the selected bank.
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>
      )}

      {/* Upload sessions history */}
      {(uploadSessions.length > 0 || transactions.some((t) => t.isManual)) && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-300 border-b border-gray-800 pb-2">Upload History</h2>
          <div className="space-y-2">
            {[...uploadSessions].reverse().map((session) => (
              <div key={session.id} className="flex items-center gap-4 bg-gray-800 rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate">{session.filename}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                    {session.dateFrom} → {session.dateTo} · {session.count} transactions ·
                    {editingPersonSession === session.id ? (
                      <select
                        autoFocus
                        value={session.person}
                        onChange={(e) => { updateSessionPerson(session.id, e.target.value); setEditingPersonSession(null) }}
                        onBlur={() => setEditingPersonSession(null)}
                        className="bg-gray-700 border border-gray-600 rounded px-1 py-0 text-xs"
                      >
                        {persons.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingPersonSession(session.id)}
                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        {session.person}
                      </button>
                    )}
                    · {session.bank.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">Uploaded {new Date(session.uploadedAt).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => { if (confirm(`Delete all ${session.count} transactions from "${session.filename}"?`)) deleteSession(session.id) }}
                  className="text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-800 text-red-400 hover:text-red-200 rounded transition-colors flex-shrink-0"
                >
                  Delete Session
                </button>
              </div>
            ))}

            {/* Manual entries */}
            {(() => {
              const manualTxs = transactions.filter((t) => t.isManual)
              if (manualTxs.length === 0) return null
              return (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setManualExpanded((v) => !v)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Manual Entries</div>
                      <div className="text-xs text-gray-400 mt-0.5">{manualTxs.length} transaction{manualTxs.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="text-gray-500 text-xs">{manualExpanded ? '▲' : '▼'}</span>
                  </button>
                  {manualExpanded && (
                    <div className="border-t border-gray-700 divide-y divide-gray-700">
                      {[...manualTxs].sort((a, b) => b.date.localeCompare(a.date)).map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-xs text-gray-500 w-24 flex-shrink-0">{tx.date}</span>
                          <span className="text-xs text-gray-300 flex-1 truncate">{tx.description}</span>
                          <span className={`text-xs font-mono flex-shrink-0 ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.amount >= 0 ? '+' : ''}{formatAmount(tx.amount)}
                          </span>
                          <span className="text-xs text-gray-500 w-16 flex-shrink-0">{tx.person}</span>
                          <button
                            onClick={() => { if (confirm('Delete this manual entry?')) removeTransaction(tx.id) }}
                            className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
