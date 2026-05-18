import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Category, Rule, RuleCondition } from '../types'
import NewRuleForm from './NewRuleForm'


function randomId() {
  return Math.random().toString(36).slice(2)
}

const COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#10b981','#f97316','#ec4899','#6b7280']

export default function RulesPage() {
  const { categories, rules, persons, addCategory, updateCategory, deleteCategory, addRule, updateRule, deleteRule, addPerson, removePerson, reapplyRules } = useStore()
  const [reapplied, setReapplied] = useState(false)

  const handleReapply = () => {
    reapplyRules()
    setReapplied(true)
    setTimeout(() => setReapplied(false), 2000)
  }

  // Category editing
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(COLORS[0])
  const [newCatKeywords, setNewCatKeywords] = useState('')

  // Rule editing
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [showNewRuleForm, setShowNewRuleForm] = useState(false)
  const [newPerson, setNewPerson] = useState('')

  const saveCategory = () => {
    const keywords = newCatKeywords.split(',').map((k) => k.trim()).filter(Boolean)
    if (editingCat) {
      updateCategory({ ...editingCat, name: newCatName, color: newCatColor, keywords })
    } else {
      addCategory({ id: randomId(), name: newCatName, color: newCatColor, keywords })
    }
    setEditingCat(null)
    setNewCatName('')
    setNewCatColor(COLORS[0])
    setNewCatKeywords('')
  }

  const startEditCat = (cat: Category) => {
    setEditingCat(cat)
    setNewCatName(cat.name)
    setNewCatColor(cat.color)
    setNewCatKeywords(cat.keywords.join(', '))
  }

  const saveRule = () => {
    if (!editingRule) return
    if (editingRule.id === '__new__') {
      addRule({ ...editingRule, id: randomId() })
    } else {
      updateRule(editingRule)
    }
    setEditingRule(null)
  }

  const newRule = (): Rule => ({
    id: '__new__',
    name: '',
    priority: 50,
    conditions: [{ field: 'description', operator: 'contains', value: '' }],
    action: {},
  })

  const updateCondition = (idx: number, patch: Partial<Rule['conditions'][number]>) => {
    if (!editingRule) return
    const conditions = editingRule.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c)
    setEditingRule({ ...editingRule, conditions })
  }

  const addCondition = () => {
    if (!editingRule) return
    setEditingRule({ ...editingRule, conditions: [...editingRule.conditions, { field: 'description', operator: 'contains', value: '' }] })
  }

  const removeCondition = (idx: number) => {
    if (!editingRule || editingRule.conditions.length <= 1) return
    setEditingRule({ ...editingRule, conditions: editingRule.conditions.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Rules & Categories</h1>

      {/* Persons */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b border-gray-800 pb-2">Persons</h2>
        <div className="flex flex-wrap gap-2">
          {persons.map((p) => (
            <span key={p} className="flex items-center gap-1 bg-gray-800 rounded-full px-3 py-1 text-sm">
              {p}
              <button onClick={() => removePerson(p)} className="text-gray-500 hover:text-red-400 ml-1">×</button>
            </span>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); if (newPerson.trim()) { addPerson(newPerson.trim()); setNewPerson('') } }}
            className="flex gap-2"
          >
            <input
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              placeholder="Add person..."
              className="bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-sm"
            />
            <button type="submit" className="bg-blue-700 hover:bg-blue-600 rounded-full px-3 py-1 text-sm">Add</button>
          </form>
        </div>
      </section>

      {/* Categories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <h2 className="text-lg font-semibold">Categories</h2>
          <div className="flex gap-2">
            <button
              onClick={handleReapply}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              {reapplied ? 'Done!' : 'Re-apply to All Transactions'}
            </button>
            <button
              onClick={() => { setEditingCat(null); setNewCatName(''); setNewCatColor(COLORS[0]); setNewCatKeywords('') }}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-sm"
            >
              + New Category
            </button>
          </div>
        </div>

        {/* Category form */}
        {(editingCat !== null || newCatName !== '' || newCatKeywords !== '') && (
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">{editingCat ? 'Edit Category' : 'New Category'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Color</label>
                <div className="flex gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewCatColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${newCatColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <input
                placeholder="Keywords (comma-separated): albert heijn, jumbo, ah "
                value={newCatKeywords}
                onChange={(e) => setNewCatKeywords(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Matched against description + counterparty (case-insensitive, any match = this category)</p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveCategory} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm">Save</button>
              <button onClick={() => { setEditingCat(null); setNewCatName(''); setNewCatKeywords('') }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
              <span className="font-medium w-36 flex-shrink-0">{cat.name}</span>
              <span className="text-xs text-gray-400 flex-1 truncate">{cat.keywords.join(', ') || <em>no keywords</em>}</span>
              <button onClick={() => startEditCat(cat)} className="text-xs text-gray-500 hover:text-blue-400">Edit</button>
              <button onClick={() => deleteCategory(cat.id)} className="text-xs text-gray-500 hover:text-red-400">Delete</button>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div>
            <h2 className="text-lg font-semibold">Override Rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">Applied after category matching. Lower priority number = runs first.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowNewRuleForm(true); setEditingRule(null) }} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-sm">
              + New Rule
            </button>
          </div>
        </div>

        {showNewRuleForm && (
          <>
            <h3 className="font-semibold text-sm">New Rule</h3>
            <NewRuleForm onSaved={() => setShowNewRuleForm(false)} />
          </>
        )}

        {editingRule && (
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Edit Rule</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Rule name"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 whitespace-nowrap">Priority</label>
                <input
                  type="number"
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) })}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-24"
                />
              </div>
            </div>
            <div className="space-y-2">
              {editingRule.conditions.map((cond, idx) => (
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
                  {editingRule.conditions.length > 1 && (
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
                  value={editingRule.action.setCategory ?? ''}
                  onChange={(e) => setEditingRule({ ...editingRule, action: { ...editingRule.action, setCategory: e.target.value || undefined } })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                >
                  <option value="">— no change —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Set Type (optional)</label>
                <select
                  value={editingRule.action.setType ?? ''}
                  onChange={(e) => setEditingRule({ ...editingRule, action: { ...editingRule.action, setType: (e.target.value as 'income' | 'expense') || undefined } })}
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
                checked={editingRule.action.ignore ?? false}
                onChange={(e) => setEditingRule({ ...editingRule, action: { ...editingRule.action, ignore: e.target.checked || undefined } })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">Ignore this transaction (hide from Summary, excluded from totals)</span>
            </label>
            <div className="flex gap-2">
              <button onClick={saveRule} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm">Save</button>
              <button onClick={() => setEditingRule(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {[...rules].sort((a, b) => a.priority - b.priority).map((rule) => {
            const catName = rule.action.setCategory ? (categories.find((c) => c.id === rule.action.setCategory)?.name ?? rule.action.setCategory) : null
            return (
              <div key={rule.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
                <span className="text-xs text-gray-500 w-6 text-right">{rule.priority}</span>
                <span className="font-medium w-40 flex-shrink-0 truncate">{rule.name}</span>
                <span className="text-xs text-gray-400 flex-1">
                  {(rule.conditions ?? [(rule as unknown as { condition: RuleCondition }).condition]).map((c, i) => (
                    <span key={i}>{i > 0 && <strong className="text-blue-400"> AND </strong>}{c.field} {c.operator} "{c.value}"</span>
                  ))}
                  {' → '}
                  {rule.action.ignore && <span className="text-orange-400 font-semibold">IGNORE</span>}
                  {rule.action.ignore && (catName || rule.action.setType) && ' | '}
                  {catName && <span>category: <strong>{catName}</strong></span>}
                  {catName && rule.action.setType && ' | '}
                  {rule.action.setType && <span>type: <strong>{rule.action.setType}</strong></span>}
                </span>
                <button onClick={() => {
                  // Migrate old persisted rules that have `condition` instead of `conditions`
                  const migrated = rule.conditions
                    ? rule
                    : { ...rule, conditions: [(rule as unknown as { condition: RuleCondition }).condition] }
                  setEditingRule(migrated)
                }} className="text-xs text-gray-500 hover:text-blue-400">Edit</button>
                <button onClick={() => deleteRule(rule.id)} className="text-xs text-gray-500 hover:text-red-400">Delete</button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
