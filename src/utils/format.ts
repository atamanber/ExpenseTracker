export function formatAmount(amount: number): string {
  return amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
