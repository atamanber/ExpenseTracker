/**
 * Deterministic ID generator for deduplication.
 * Uses a simple djb2-style hash — no crypto needed, fast, good enough for this use case.
 */
function hashString(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

export function abnTransactionId(
  accountNumber: number,
  date: number,
  amount: number,
  startSaldo: number,
  endSaldo: number
): string {
  // ABN: balance fields change per transaction, making this rock-solid unique
  return 'abn-' + hashString(`${accountNumber}|${date}|${amount}|${startSaldo}|${endSaldo}`)
}

export function bunqTransactionId(
  account: string,
  date: string,
  amount: string,
  counterparty: string,
  description: string
): string {
  // bunq: no balance fields, but this combo is unique in practice
  return 'bunq-' + hashString(`${account}|${date}|${amount}|${counterparty}|${description}`)
}
