import Papa from 'papaparse'
import type { Transaction } from '../types'
import { bunqTransactionId } from '../utils/hash'

// bunq CSV columns: Date, Interest Date, Amount, Account, Counterparty, Name, Description

interface BunqRow {
  Date: string
  Amount: string
  Account: string
  Counterparty: string
  Name: string
  Description: string
}

// bunq wraps the last field (Description) in extra quotes: ""value"" instead of "value"
// This causes PapaParse to stay in quoted mode and swallow subsequent rows.
// Fix: strip the extra outer quote from the last field on each line.
function fixBunqCsv(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const idx = line.lastIndexOf(',"')
      if (idx === -1) return line
      const last = line.slice(idx + 1)
      if (last.startsWith('""') && last.endsWith('""') && last.length >= 4) {
        return line.slice(0, idx + 1) + last.slice(1, -1)
      }
      return line
    })
    .join('\n')
}

export async function parseBunq(file: File, person: string, sessionId: string): Promise<{ transactions: Transaction[]; skippedRows: number }> {
  const raw = await file.text()
  const text = fixBunqCsv(raw)

  return new Promise((resolve, reject) => {
    Papa.parse<BunqRow>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const occurrences: Record<string, number> = {}
        let skippedRows = results.errors.filter((e) => e.type === 'FieldMismatch' || e.type === 'Quotes').length
        const transactions: Transaction[] = []

        for (const row of results.data) {
          const amount = parseFloat((row.Amount ?? '').replace(/\./g, '').replace(',', '.'))
          if (isNaN(amount) || !row.Date) { skippedRows++; continue }

          const name = row.Name?.trim() || ''
          const desc = row.Description?.trim() || ''
          const description = name && desc ? `${name} - ${desc}` : name || desc
          const counterparty = row.Name?.trim() || ''

          const dedupeKey = `${row.Account}|${row.Date}|${row.Amount}|${row.Counterparty}|${row.Description}`
          const occurrence = occurrences[dedupeKey] ?? 0
          occurrences[dedupeKey] = occurrence + 1

          transactions.push({
            id: bunqTransactionId(
              row.Account ?? '',
              row.Date ?? '',
              row.Amount ?? '',
              row.Counterparty ?? '',
              row.Description ?? '',
              occurrence
            ),
            date: row.Date,
            amount,
            description,
            rawDescription: row.Description ?? '',
            counterparty,
            category: 'other',
            type: amount >= 0 ? 'income' : 'expense',
            bank: 'bunq',
            person,
            isManual: false,
            sessionId,
            ignored: false,
          })
        }

        resolve({ transactions, skippedRows })
      },
      error: reject,
    })
  })
}
