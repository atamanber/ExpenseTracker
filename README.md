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
