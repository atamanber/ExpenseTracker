import { useState, useRef } from 'react'
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
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { addTransactions, addUploadSession, deleteSession, uploadSessions, categories, rules, persons, importData, exportData } = useStore()

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
      for (const entry of fileEntries) {
        const sessionId = crypto.randomUUID()
        const parsed: Transaction[] =
          entry.bank === 'abn'
            ? await parseABN(entry.file, entry.person, sessionId)
            : await parseBunq(entry.file, entry.person, sessionId)

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

      setImportResult({ added: totalAdded, skipped: totalSkipped })
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
        <div className="bg-green-900/40 border border-green-700 rounded-lg p-4 text-green-300">
          Imported {importResult.added} transactions.
          {importResult.skipped > 0 && (
            <span className="text-yellow-300"> {importResult.skipped} duplicate(s) skipped.</span>
          )}
          {' '}Redirecting...
        </div>
      )}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>
      )}

      {/* Upload sessions history */}
      {uploadSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-300 border-b border-gray-800 pb-2">Upload History</h2>
          <div className="space-y-2">
            {[...uploadSessions].reverse().map((session) => (
              <div key={session.id} className="flex items-center gap-4 bg-gray-800 rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate">{session.filename}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {session.dateFrom} → {session.dateTo} · {session.count} transactions · {session.person} · {session.bank.toUpperCase()}
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
          </div>
        </div>
      )}
    </div>
  )
}
