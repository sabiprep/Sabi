-- Read-only checks for the Sabi question bank after import.
-- Run against source and destination and compare the results.

SELECT COUNT(*) AS total_rows FROM public.question_bank;

SELECT status, COUNT(*) AS rows
FROM public.question_bank
GROUP BY status
ORDER BY status;

SELECT subject, COUNT(*) AS rows
FROM public.question_bank
GROUP BY subject
ORDER BY subject;

SELECT
  COUNT(*) FILTER (WHERE question IS NULL OR BTRIM(question) = '') AS missing_question,
  COUNT(*) FILTER (WHERE answer IS NULL OR BTRIM(answer) = '') AS missing_answer,
  COUNT(*) FILTER (WHERE explanation IS NULL OR BTRIM(explanation) = '') AS missing_explanation,
  COUNT(*) FILTER (
    WHERE option_a IS NULL OR BTRIM(option_a) = ''
       OR option_b IS NULL OR BTRIM(option_b) = ''
       OR option_c IS NULL OR BTRIM(option_c) = ''
       OR option_d IS NULL OR BTRIM(option_d) = ''
  ) AS incomplete_options
FROM public.question_bank;

SELECT
  COUNT(*) AS duplicate_text_groups,
  COALESCE(SUM(row_count - 1), 0) AS excess_rows
FROM (
  SELECT LOWER(REGEXP_REPLACE(BTRIM(question), '\\s+', ' ', 'g')) AS normalized_question,
         COUNT(*) AS row_count
  FROM public.question_bank
  WHERE question IS NOT NULL AND BTRIM(question) <> ''
  GROUP BY LOWER(REGEXP_REPLACE(BTRIM(question), '\\s+', ' ', 'g'))
  HAVING COUNT(*) > 1
) duplicates;

SELECT
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'question_bank';
