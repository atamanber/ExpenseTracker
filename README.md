# ExpenseTracker

A local personal finance tracker for importing and categorizing bank transactions from ABN AMRO and bunq.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Zustand (state + localStorage persistence)
- PapaParse (CSV parsing)
- SheetJS / xlsx (XLS parsing)

## Supported Banks

| Bank | Format |
|------|--------|
| ABN AMRO | `.xls` export |
| bunq | `.csv` export |

## Data Storage

All data is stored locally in your browser's `localStorage` — nothing is sent to any server.
