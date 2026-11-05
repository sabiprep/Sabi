# Sabi question-bank migration

Source: personal Supabase project. Destination: team Supabase project.

The source audit found 10,369 records. Preserve every ID, column value, status, timestamp, answer, explanation, and provenance field. Do not deduplicate, normalize, repair, or promote records during import.

The destination migration creates an empty public.question_bank table matching the audited source schema and its six existing indexes. Enable RLS and do not add browser-facing policies. The server-side API must control access and answer-key exposure.

Import must be paginated and resumable. Insert by source ID without overwriting an existing destination row. Verify exact source/destination parity across every column using deterministic row hashes. Report missing IDs, mismatched rows, extra destination IDs, total counts, and status counts.

The baseline source count is 10,369. Abort if it changes until a fresh audit approves a new baseline. Do not treat legacy published status or AI verification labels as independently human-verified. Existing evaluation logic requires verified status, so a separate reviewed promotion process is required.

Execution is not part of this preparation. Apply the schema and import only after explicit approval. Never delete or alter the source data.