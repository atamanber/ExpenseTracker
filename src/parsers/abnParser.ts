import * as XLSX from 'xlsx'
import type { Transaction } from '../types'
import { abnTransactionId } from '../utils/hash'

// ABN AMRO XLS columns (0-indexed):
// 0: accountNumber, 1: mutationcode, 2: transactiondate (YYYYMMDD float),
// 3: valuedate, 4: startsaldo, 5: endsaldo, 6: amount, 7: description

function parseDate(raw: number): string {
  const s = String(Math.round(raw))
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function cleanDescription(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function extractCounterparty(description: string): string {
  const beaMatch = description.match(/BEA,\s*Betaalpas\s+(.+?),PAS/i)
  if (beaMatch) return beaMatch[1].trim()

  const sepaMatch = description.match(/([A-Z][A-Z0-9\s&.'-]{2,30})\s{2,}/i)
  if (sepaMatch) return sepaMatch[1].trim()

  return ''
}

export async function parseABN(file: File, person: string, sessionId: string): Promise<Transaction[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

  const transactions: Transaction[] = []

  for (const row of rows as unknown[][]) {
    if (!row || row.length < 8) continue

    const accountRaw = row[0]
    const dateRaw = row[2]
    const startSaldoRaw = row[4]
    const endSaldoRaw = row[5]
    const amountRaw = row[6]
    const descRaw = String(row[7] ?? '')

    if (typeof dateRaw !== 'number' || typeof amountRaw !== 'number') continue

    const description = cleanDescription(descRaw)
    const counterparty = extractCounterparty(description)
    const amount = amountRaw

    transactions.push({
      id: abnTransactionId(
        typeof accountRaw === 'number' ? accountRaw : 0,
        dateRaw,
        amountRaw,
        typeof startSaldoRaw === 'number' ? startSaldoRaw : 0,
        typeof endSaldoRaw === 'number' ? endSaldoRaw : 0
      ),
      date: parseDate(dateRaw),
      amount,
      description,
      rawDescription: descRaw,
      counterparty,
      category: 'other',
      type: amount >= 0 ? 'income' : 'expense',
      bank: 'abn',
      person,
      isManual: false,
      sessionId,
      ignored: false,
    })
  }

  return transactions
}
