# Add a New Bank Parser

Use this prompt in [Claude Code](https://claude.ai/code) to add support for a bank that isn't yet supported.

## Prompt

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

## What to fill in

- **Sample rows** — paste the header row + 2–3 real rows from your export file, replacing actual amounts with fake numbers
- **File format** — write CSV, XLS, or XLSX depending on what your bank exports

## Tips

- The more columns you include in the sample, the better the mapping will be
- If your bank's export uses a non-English decimal separator (e.g. comma instead of dot), mention it
- If the date format is unusual (e.g. `31-12-2024` instead of `2024-12-31`), mention that too
