import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Rule, RuleCondition } from '../types'

function randomId() {
  return Math.random().toString(36).slice(2)
}

function blankRule(): Rule {
  return {
    id: '__new__',
    name: '',
    priority: 50,
    conditions: [{ field: 'description', operator: 'contains', value: '' }],
    action: {},
  }
}

interface Props {
  onSaved?: () => void
}

export default function NewRuleForm({ onSaved }: Props) {
  const { categories, addRule } = useStore()
  const [rule, setRule] = useState<Rule>(blankRule)

  const updateCondition = (idx: number, patch: Partial<RuleCondition>) => {
    setRule((r) => ({ ...r, conditions: r.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c) }))
  }

  const addCondition = () => {
    setRule((r) => ({ ...r, conditions: [...r.conditions, { field: 'description', operator: 'contains', value: '' }] }))
  }

  const removeCondition = (idx: number) => {
    setRule((r) => ({ ...r, conditions: r.conditions.filter((_, i) => i !== idx) }))
  }

  const save = () => {
    addRule({ ...rule, id: randomId() })
    setRule(blankRule())
    onSaved?.()
  }

  const cancel = () => {
    setRule(blankRule())
    onSaved?.()
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Rule name"
          value={rule.name}
          onChange={(e) => setRule((r) => ({ ...r, name: e.target.value }))}
          className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 whitespace-nowrap">Priority</label>
          <input
            type="number"
            value={rule.priority}
            onChange={(e) => setRule((r) => ({ ...r, priority: parseInt(e.target.value) }))}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-24"
          />
        </div>
      </div>

      <div className="space-y-2">
        {rule.conditions.map((cond, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {idx > 0 && <span className="text-xs font-bold text-blue-400 w-8 flex-shrink-0">AND</span>}
            {idx === 0 && <span className="text-xs text-gray-500 w-8 flex-shrink-0">IF</span>}
            <select
              value={cond.field}
              onChange={(e) => updateCondition(idx, { field: e.target.value as RuleCondition['field'] })}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="description">Description</option>
              <option value="counterparty">Counterparty</option>
              <option value="amount">Amount</option>
            </select>
            <select
              value={cond.operator}
              onChange={(e) => updateCondition(idx, { operator: e.target.value as RuleCondition['operator'] })}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="contains">contains</option>
              <option value="equals">equals</option>
              <option value="gt">greater than</option>
              <option value="lt">less than</option>
              <option value="gte">≥</option>
              <option value="lte">≤</option>
            </select>
            <input
              placeholder="Value"
              value={cond.value}
              onChange={(e) => updateCondition(idx, { value: e.target.value })}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            />
            {rule.conditions.length > 1 && (
              <button onClick={() => removeCondition(idx)} className="text-gray-500 hover:text-red-400 px-2">×</button>
            )}
          </div>
        ))}
        <button onClick={addCondition} className="text-xs text-blue-400 hover:text-blue-300 mt-1">
          + Add AND condition
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Set Category (optional)</label>
          <select
            value={rule.action.setCategory ?? ''}
            onChange={(e) => setRule((r) => ({ ...r, action: { ...r.action, setCategory: e.target.value || undefined } }))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          >
            <option value="">— no change —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Set Type (optional)</label>
          <select
            value={rule.action.setType ?? ''}
            onChange={(e) => setRule((r) => ({ ...r, action: { ...r.action, setType: (e.target.value as 'income' | 'expense') || undefined } }))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          >
            <option value="">— no change —</option>
            <option value="income">income</option>
            <option value="expense">expense</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={rule.action.ignore ?? false}
          onChange={(e) => setRule((r) => ({ ...r, action: { ...r.action, ignore: e.target.checked || undefined } }))}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm">Ignore this transaction (hide from Summary, excluded from totals)</span>
      </label>

      <div className="flex gap-2">
        <button onClick={save} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm">Save</button>
        <button onClick={cancel} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
      </div>
    </div>
  )
}
