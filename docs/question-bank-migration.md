# Sabi question-bank migration

## Current state

The audited personal/source project contains 10,369 records. The team/destination project already contains 3,325 records from the interrupted connector-based transfer. The source remains unchanged.

- Source project ref: `tzjbmllzsrkygkvutgxs`
- Destination project ref: `dnrzixaasphxiswjyglj`
- Destination table: `public.question_bank`
- Baseline source count: `10,369`

## Safe completion procedure

The Supabase chat connector truncated/blocked large row-payload transfers. Complete the remaining transfer through the repository's local Node.js migration utility. This keeps the data transfer between Supabase endpoints and avoids placing question content or credentials in chat or GitHub.

1. On a trusted computer, clone the repository and check out `backend/learning-event-contracts`.
2. Install dependencies with `npm install`.
3. In the local terminal, set these environment variables using the source and destination project URLs and their respective **service-role** keys from Supabase Project Settings → API. Do not commit these values, paste them into chat, or put them in a tracked file:
   - `SOURCE_SUPABASE_URL`
   - `SOURCE_SUPABASE_SERVICE_ROLE_KEY`
   - `DESTINATION_SUPABASE_URL`
   - `DESTINATION_SUPABASE_SERVICE_ROLE_KEY`
4. Run a dry run first:
   ```bash
   node scripts/migrate-question-bank.mjs
   ```
5. If the dry run confirms the source still contains exactly 10,369 records and the destination is reachable, run:
   ```bash
   SABI_MIGRATION_CONFIRM=IMPORT_QUESTION_BANK_10369 node scripts/migrate-question-bank.mjs --execute
   ```
   On PowerShell:
   ```powershell
   $env:SABI_MIGRATION_CONFIRM="IMPORT_QUESTION_BANK_10369"
   node scripts/migrate-question-bank.mjs --execute
   ```
6. Save the final JSON report. Completion requires `missing = 0`, `mismatched = 0`, `extra = 0`, and `parity = true`.

The script imports in small batches and uses insert-only conflict handling. It will not overwrite the 3,325 existing destination rows. If interrupted, re-run the same command; already-present IDs are skipped and the full parity check runs again. If a row with an existing ID differs, it is reported as a mismatch and is not overwritten.

## Data integrity and product rules

Preserve every ID, column value, status, timestamp, answer, explanation, and provenance field. Do not deduplicate, normalize, repair, or promote records during import. The quality issues from the audit remain for a separate review workflow.

Do not treat legacy `published` status or AI verification labels as independently human-verified. Existing evaluation logic requires `verified`; a separate reviewed promotion process is required before questions enter scored practice.

## Safety

- The utility defaults to dry-run. Writes require both `--execute` and the exact confirmation environment variable.
- It aborts if source count differs from the audited baseline.
- The source is read-only throughout.
- Never expose service-role keys or commit them.
- Do not drop or truncate either table as a rollback.
