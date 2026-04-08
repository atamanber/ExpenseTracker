import type { Transaction, Category, Rule, RuleCondition } from '../types'

export function applyCategories(tx: Transaction, categories: Category[]): string {
  const haystack = `${tx.description} ${tx.counterparty}`.toLowerCase()
  for (const cat of categories) {
    if (cat.keywords.some((kw) => kw && haystack.includes(kw.toLowerCase()))) {
      return cat.id
    }
  }
  return 'other'
}

export function applyRules(tx: Transaction, rules: Rule[]): Transaction {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  let result = { ...tx }

  for (const rule of sorted) {
    // Migrate old single-condition rules that may come from persisted data
    const conditions = rule.conditions ?? [(rule as unknown as { condition: RuleCondition }).condition]
    if (conditions.every((c) => matchesCondition(result, c))) {
      if (rule.action.setCategory) result.category = rule.action.setCategory
      if (rule.action.setType) result.type = rule.action.setType
      if (rule.action.ignore) result.ignored = true
    }
  }

  return result
}

function matchesCondition(tx: Transaction, condition: RuleCondition): boolean {
  const { field, operator, value } = condition

  if (field === 'amount') {
    const num = parseFloat(value)
    if (operator === 'gt') return tx.amount > num
    if (operator === 'lt') return tx.amount < num
    if (operator === 'gte') return tx.amount >= num
    if (operator === 'lte') return tx.amount <= num
    if (operator === 'equals') return tx.amount === num
    return false
  }

  const fieldValue = (field === 'description' ? tx.description : tx.counterparty).toLowerCase()
  const v = value.toLowerCase()

  if (operator === 'contains') return fieldValue.includes(v)
  if (operator === 'equals') return fieldValue === v
  return false
}

export function classifyTransaction(
  tx: Transaction,
  categories: Category[],
  rules: Rule[]
): Transaction {
  const withCategory = { ...tx, category: applyCategories(tx, categories) }
  return applyRules(withCategory, rules)
}
