import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Transaction, Category, Rule, AppData, UploadSession } from '../types'
import { classifyTransaction } from '../utils/ruleEngine'

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'market',        name: 'Market',        keywords: ['albert heijn', 'jumbo', 'lidl', 'aldi', 'plus supermarkt', 'hoogvliet', 'dirk', 'ah '],  color: '#22c55e' },
  { id: 'rent',          name: 'Rent',           keywords: ['huur', 'rent', 'hypotheek'],                                                             color: '#3b82f6' },
  { id: 'transport',     name: 'Transport',      keywords: ['ns ', 'ov-chipkaart', 'parkeer', 'shell', 'bp ', 'esso', 'tankstation', 'uber'],         color: '#f59e0b' },
  { id: 'dining',        name: 'Dining Out',     keywords: ['restaurant', 'cafe ', 'mcdonalds', 'burger king', 'kfc', 'thuisbezorgd', 'deliveroo'],   color: '#ef4444' },
  { id: 'subscriptions', name: 'Subscriptions',  keywords: ['netflix', 'spotify', 'apple', 'google', 'amazon', 'disney'],                            color: '#8b5cf6' },
  { id: 'health',        name: 'Health',         keywords: ['apotheek', 'huisarts', 'tandarts', 'zorgverzekering', 'hospital'],                      color: '#06b6d4' },
  { id: 'salary',        name: 'Salary',         keywords: ['salaris', 'loon', 'salary'],                                                            color: '#10b981' },
  { id: 'transfer',      name: 'Transfer',       keywords: [],                                                                                       color: '#6b7280' },
  { id: 'other',         name: 'Other',          keywords: [],                                                                                       color: '#94a3b8' },
]

const DEFAULT_RULES: Rule[] = [
  {
    id: 'r2',
    name: 'Positive amount = income',
    priority: 90,
    conditions: [{ field: 'amount', operator: 'gt', value: '0' }],
    action: { setType: 'income' },
  },
  {
    id: 'r3',
    name: 'Negative amount = expense',
    priority: 91,
    conditions: [{ field: 'amount', operator: 'lt', value: '0' }],
    action: { setType: 'expense' },
  },
]

interface StoreState extends AppData {
  addTransactions: (txs: Transaction[]) => { added: number; skipped: number }
  removeTransaction: (id: string) => void
  clearAllTransactions: () => void
  addUploadSession: (session: UploadSession) => void
  deleteSession: (sessionId: string) => void
  reapplyRules: () => void
  setCategories: (cats: Category[]) => void
  addCategory: (cat: Category) => void
  updateCategory: (cat: Category) => void
  deleteCategory: (id: string) => void
  setRules: (rules: Rule[]) => void
  addRule: (rule: Rule) => void
  updateRule: (rule: Rule) => void
  deleteRule: (id: string) => void
  addPerson: (name: string) => void
  removePerson: (name: string) => void
  importData: (data: AppData) => void
  exportData: () => AppData
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      transactions: [],
      uploadSessions: [],
      categories: DEFAULT_CATEGORIES,
      rules: DEFAULT_RULES,
      persons: ['Me', 'Wife'],

      addTransactions: (txs) => {
        let added = 0
        let skipped = 0
        set((s) => {
          const existingIds = new Set(s.transactions.map((t) => t.id))
          const newTxs = txs.filter((t) => {
            if (existingIds.has(t.id)) { skipped++; return false }
            added++
            return true
          })
          return { transactions: [...s.transactions, ...newTxs] }
        })
        return { added, skipped }
      },

      removeTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      clearAllTransactions: () => set({ transactions: [], uploadSessions: [] }),

      addUploadSession: (session) =>
        set((s) => ({ uploadSessions: [...s.uploadSessions, session] })),

      deleteSession: (sessionId) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.sessionId !== sessionId),
          uploadSessions: s.uploadSessions.filter((sess) => sess.id !== sessionId),
        })),

      reapplyRules: () => {
        const { transactions, categories, rules } = get()
        const updated = transactions.map((tx) => {
          // Reset ignored and category before re-applying, keep manual overrides flagged
          const reset = { ...tx, ignored: false, category: 'other' }
          return classifyTransaction(reset, categories, rules)
        })
        set({ transactions: updated })
      },

      setCategories: (cats) => set({ categories: cats }),
      addCategory: (cat) => set((s) => ({ categories: [...s.categories, cat] })),
      updateCategory: (cat) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === cat.id ? cat : c)) })),
      deleteCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      setRules: (rules) => set({ rules }),
      addRule: (rule) => {
        set((s) => ({ rules: [...s.rules, rule] }))
        get().reapplyRules()
      },
      updateRule: (rule) => {
        set((s) => ({ rules: s.rules.map((r) => (r.id === rule.id ? rule : r)) }))
        get().reapplyRules()
      },
      deleteRule: (id) =>
        set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

      addPerson: (name) =>
        set((s) => ({ persons: s.persons.includes(name) ? s.persons : [...s.persons, name] })),
      removePerson: (name) =>
        set((s) => ({ persons: s.persons.filter((p) => p !== name) })),

      importData: (data) => set({ ...data, uploadSessions: data.uploadSessions ?? [] }),
      exportData: () => {
        const { transactions, uploadSessions, categories, rules, persons } = get()
        return { transactions, uploadSessions, categories, rules, persons }
      },
    }),
    { name: 'expense-tracker-data' }
  )
)
