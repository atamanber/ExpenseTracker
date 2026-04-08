export interface Transaction {
  id: string
  date: string          // ISO: YYYY-MM-DD
  amount: number        // negative = expense, positive = income
  description: string   // normalized/cleaned
  rawDescription: string
  counterparty: string
  category: string
  type: 'income' | 'expense'
  bank: 'abn' | 'bunq' | 'manual'
  person: string        // e.g. "Me", "Wife"
  isManual: boolean
  sessionId: string
  ignored: boolean      // if true, excluded from Summary
}

export interface UploadSession {
  id: string
  filename: string
  bank: 'abn' | 'bunq' | 'manual'
  person: string
  count: number
  dateFrom: string      // ISO date of earliest transaction
  dateTo: string        // ISO date of latest transaction
  uploadedAt: string    // ISO datetime
}

export interface Category {
  id: string
  name: string
  keywords: string[]    // matched against description + counterparty (case-insensitive)
  color: string         // hex color for charts
}

export interface RuleCondition {
  field: 'description' | 'counterparty' | 'amount'
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte'
  value: string
}

export interface Rule {
  id: string
  name: string
  priority: number           // lower = evaluated first
  conditions: RuleCondition[] // ALL must match (AND logic)
  action: {
    setCategory?: string
    setType?: 'income' | 'expense'
    ignore?: boolean          // if true, mark transaction as ignored
  }
}

export interface AppData {
  transactions: Transaction[]
  uploadSessions: UploadSession[]
  categories: Category[]
  rules: Rule[]
  persons: string[]
}
