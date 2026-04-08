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

export async function parseBunq(file: File, person: string, sessionId: string): Promise<Transaction[]> {
  const text = await file.text()

  return new Promise((resolve, reject) => {
    Papa.parse<BunqRow>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = results.data.map((row) => {
          // bunq uses comma as decimal separator: "3,58" → 3.58
          const amount = parseFloat(row.Amount.replace(',', '.'))
          const description = row.Description?.trim() || row.Name?.trim() || ''
          const counterparty = row.Name?.trim() || ''

          return {
            id: bunqTransactionId(
              row.Account ?? '',
              row.Date ?? '',
              row.Amount ?? '',
              row.Counterparty ?? '',
              row.Description ?? ''
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
          }
        })
        resolve(transactions)
      },
      error: reject,
    })
  })
}
