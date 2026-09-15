# ExpenseTracker

A local personal finance tracker for importing and categorizing bank transactions from ABN AMRO and bunq.

## Running Locally (Windows)

### Step 1 — Install Node.js

Download and install Node.js from [nodejs.org](https://nodejs.org/) (choose the LTS version). This also installs `npm` automatically.

### Step 2 — Download the project

Download this repository as a ZIP (click the green **Code** button → **Download ZIP**) and extract it somewhere on your computer, for example `C:\Users\YourName\ExpenseTracker`.

### Step 3 — Open PowerShell in the project folder

1. Open the extracted folder in File Explorer
2. Click the address bar at the top, type `powershell`, and press Enter

This opens PowerShell already inside the project folder. You can verify by checking that the prompt shows the correct path.

### Step 4 — Install dependencies (once only)

```powershell
npm install
```

This downloads all required packages into a `node_modules` folder. Only needed the first time.

### Step 5 — Start the app

```powershell
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

To stop the server, press `Ctrl+C` in the PowerShell window.

---

## Build for Production

```powershell
npm run build
```

Output will be in the `dist/` folder. You can drag and drop this folder onto [Netlify Drop](https://app.netlify.com/drop) to get a shareable link with no server needed.

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

---

## Adding Support for a New Bank

The app currently supports ABN AMRO and bunq. If your bank is not listed, you can use Claude Code to add a new parser. Open [Claude Code](https://claude.ai/code) in the project folder and paste the following prompt — filling in the two placeholders at the bottom:

```
I have a personal expense tracker app built with React + TypeScript + Vite. The codebase is at the root of this project. I want to add support for uploading bank exports from my bank.

The app already supports two banks (ABN AMRO .xls and bunq .csv). Each bank has its own parser in src/parsers/. Look at src/parsers/bunqParser.ts and src/parsers/abnParser.ts to understand the pattern — each parser takes a File, a person string, and a sessionId string, and returns a Promise<Transaction[]> using the Transaction type from src/types/index.ts.

I want to add a new parser for my bank. Here is a sample of what my bank's export file looks like:

[paste a few rows of your export file here — column headers + 2-3 example rows, with real amounts replaced by fake ones]

Please:
1. Create a new parser at src/parsers/[bankname]Parser.ts that maps my bank's columns to the Transaction model
2. Register it in src/components/UploadPage.tsx so I can select it from the Bank dropdown when uploading
3. Make sure the transaction ID hash uses raw source columns (not derived fields) so re-uploading the same file skips duplicates

The file format is: [CSV / XLS / XLSX — pick one]
```

The two things you need to fill in:
- **Sample rows** — paste the header row + 2-3 real rows from your export (replace actual amounts with fake numbers)
- **File format** — write CSV, XLS, or XLSX depending on what your bank exports
