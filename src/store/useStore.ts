import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Transaction, Category, Rule, AppData, UploadSession, Tag } from '../types'
import { classifyTransaction } from '../utils/ruleEngine'
import baseConfig from '../data/baseConfig.json'

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'market',    name: 'Market',    keywords: ['albert heijn', 'jumbo', 'lidl', 'aldi', 'plus supermarkt', 'hoogvliet', 'dirk', 'ozde foodcenter'], color: '#22c55e' },
  { id: 'rent',      name: 'Rent',      keywords: ['huur', 'rent', 'hypotheek'],                                                            color: '#3b82f6' },
  { id: 'transport', name: 'Transport', keywords: ['ns ', 'ov-chipkaart', 'parkeer', 'shell', 'bp ', 'esso', 'tankstation', 'uber'],        color: '#f59e0b' },
  { id: 'health',    name: 'Health',    keywords: ['apotheek', 'huisarts', 'tandarts', 'zorgverzekering', 'hospital'],                     color: '#06b6d4' },
  { id: 'salary',    name: 'Salary',    keywords: ['salaris', 'loon', 'salary'],                                                           color: '#10b981' },
  { id: 'transfer',  name: 'Transfer',  keywords: [],                                                                                      color: '#6b7280' },
  {
    id: 'bills', name: 'Bills', color: '#f97316',
    keywords: ['youfone nederland', 'vitens nv', 'eneco services', 'basic fit nederland', 'greenchoice', 'centraal beheer', 'simpel', 'vereniging van eigenaars hofstad iv', 'allianz direct'],
  },
  { id: 'other',     name: 'Other',     keywords: [],                                                                                      color: '#94a3b8' },
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
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  removeTransaction: (id: string) => void
  clearAllTransactions: () => void
  addUploadSession: (session: UploadSession) => void
  deleteSession: (sessionId: string) => void
  updateSessionPerson: (sessionId: string, person: string) => void
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
  addTag: (tag: Tag) => void
  deleteTag: (id: string) => void
  applyTag: (id: string) => void
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
      deletedBaseIds: [],
      tags: [],

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

      updateSessionPerson: (sessionId, person) =>
        set((s) => ({
          uploadSessions: s.uploadSessions.map((sess) => sess.id === sessionId ? { ...sess, person } : sess),
          transactions: s.transactions.map((t) => t.sessionId === sessionId ? { ...t, person } : t),
        })),

      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: s.transactions.map((t) => t.id === id ? { ...t, ...patch } : t) })),

      reapplyRules: () => {
        const { transactions, categories, rules } = get()
        const updated = transactions.map((tx) => {
          if (tx.categoryPinned) return tx  // preserve manual category overrides
          const reset = { ...tx, ignored: false, category: 'other' }
          return classifyTransaction(reset, categories, rules)
        })
        set({ transactions: updated })
      },

      setCategories: (cats) => set({ categories: cats }),
      addCategory: (cat) => set((s) => ({ categories: [...s.categories, cat] })),
      updateCategory: (cat) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === cat.id ? cat : c)) })),
      deleteCategory: (id) => {
        const isBase = (baseConfig.categories as Category[]).some((c) => c.id === id)
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          deletedBaseIds: isBase ? [...s.deletedBaseIds, id] : s.deletedBaseIds,
        }))
      },

      setRules: (rules) => set({ rules }),
      addRule: (rule) => {
        set((s) => ({ rules: [...s.rules, rule] }))
        get().reapplyRules()
      },
      updateRule: (rule) => {
        set((s) => ({ rules: s.rules.map((r) => (r.id === rule.id ? rule : r)) }))
        get().reapplyRules()
      },
      deleteRule: (id) => {
        const isBase = (baseConfig.rules as Rule[]).some((r) => r.id === id)
        set((s) => ({
          rules: s.rules.filter((r) => r.id !== id),
          deletedBaseIds: isBase ? [...s.deletedBaseIds, id] : s.deletedBaseIds,
        }))
      },

      addPerson: (name) =>
        set((s) => ({ persons: s.persons.includes(name) ? s.persons : [...s.persons, name] })),
      removePerson: (name) => {
        const isBase = (baseConfig.persons as string[]).includes(name)
        set((s) => ({
          persons: s.persons.filter((p) => p !== name),
          deletedBaseIds: isBase ? [...s.deletedBaseIds, name] : s.deletedBaseIds,
        }))
      },

      addTag: (tag) => {
        set((s) => ({ tags: [...s.tags, tag] }))
        get().applyTag(tag.id)
      },

      deleteTag: (id) =>
        set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          transactions: s.transactions.map((tx) => tx.tagId === id ? { ...tx, tagId: undefined } : tx),
        })),

      applyTag: (id) => {
        const { tags, transactions } = get()
        const tag = tags.find((t) => t.id === id)
        if (!tag) return
        set({
          transactions: transactions.map((tx) => {
            const inRange = tx.date >= tag.dateFrom && tx.date <= tag.dateTo
            if (!inRange) return tx
            // Auto-tag only 'other' category expenses; manual tags on other categories are preserved
            if (tx.category === 'other' && tx.type === 'expense') {
              return { ...tx, tagId: id }
            }
            return tx
          }),
        })
      },

      importData: (data) => set({ ...data, uploadSessions: data.uploadSessions ?? [], deletedBaseIds: data.deletedBaseIds ?? [], tags: data.tags ?? [] }),
      exportData: () => {
        const { transactions, uploadSessions, categories, rules, persons, deletedBaseIds, tags } = get()
        return { transactions, uploadSessions, categories, rules, persons, deletedBaseIds, tags }
      },
    }),
    {
      name: 'expense-tracker-data',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.tags) state.tags = []
        const BILLS_KEYWORDS = ['youfone nederland', 'vitens nv', 'eneco services', 'basic fit nederland', 'greenchoice', 'centraal beheer', 'simpel', 'vereniging van eigenaars hofstad iv', 'allianz direct']
        // Remove retired categories
        state.categories = state.categories.filter((c) => c.id !== 'dining' && c.id !== 'subscriptions')
        // Update market keywords
        const market = state.categories.find((c) => c.id === 'market')
        if (market) market.keywords = ['albert heijn', 'jumbo', 'lidl', 'aldi', 'plus supermarkt', 'hoogvliet', 'dirk', 'ozde foodcenter']
        // Add bills if missing, or update its keywords
        const bills = state.categories.find((c) => c.id === 'bills')
        if (!bills) {
          state.categories = [...state.categories, { id: 'bills', name: 'Bills', keywords: BILLS_KEYWORDS, color: '#f97316' }]
        } else {
          bills.keywords = BILLS_KEYWORDS
        }

        // Merge base config — add any base item not already present and not explicitly deleted
        const deleted = new Set(state.deletedBaseIds ?? [])
        for (const bp of baseConfig.persons as string[]) {
          if (!deleted.has(bp) && !state.persons.includes(bp)) {
            state.persons = [...state.persons, bp]
          }
        }
        for (const bc of baseConfig.categories as Category[]) {
          if (!deleted.has(bc.id) && !state.categories.find((c) => c.id === bc.id)) {
            state.categories = [...state.categories, bc]
          }
        }
        for (const br of baseConfig.rules as Rule[]) {
          if (!deleted.has(br.id) && !state.rules.find((r) => r.id === br.id)) {
            state.rules = [...state.rules, br]
          }
        }
      },
    }
  )
)
