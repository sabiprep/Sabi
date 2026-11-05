-- SABI learning event ledger
-- Apply after confirming this is the intended Sabi Supabase project.
-- Client roles intentionally receive no direct table access; the API writes
-- through a server-only Supabase service credential.

CREATE TABLE IF NOT EXISTS public.learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(128) NOT NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'question_viewed',
    'answer_selected',
    'answer_submitted',
    'answer_changed',
    'explanation_opened',
    'explanation_completed',
    'question_skipped',
    'recovery_answer_submitted',
    'cbt_answer_submitted',
    'recommendation_created',
    'recommendation_presented',
    'recommendation_accepted',
    'recommendation_dismissed',
    'recommendation_completed',
    'session_completed'
  )),
  schema_version SMALLINT NOT NULL CHECK (schema_version = 1),
  occurred_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id TEXT NULL,
  question_id TEXT NULL,
  question_version_id TEXT NULL,
  subject_id TEXT NULL,
  topic_id TEXT NULL,
  subtopic_id TEXT NULL,
  learning_objective_id TEXT NULL,
  mode TEXT NULL CHECK (
    mode IS NULL OR mode IN ('diagnostic', 'smart', 'blitz', 'custom', 'cbt')
  ),
  source TEXT NOT NULL CHECK (source IN ('web', 'android', 'ios', 'system')),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT learning_events_student_event_unique UNIQUE (student_id, event_id)
);

CREATE INDEX IF NOT EXISTS learning_events_student_received_idx
  ON public.learning_events (student_id, received_at DESC);

CREATE INDEX IF NOT EXISTS learning_events_student_type_received_idx
  ON public.learning_events (student_id, event_type, received_at DESC);

CREATE INDEX IF NOT EXISTS learning_events_session_idx
  ON public.learning_events (student_id, session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

-- No browser/mobile role can read or write the event ledger directly.
REVOKE ALL ON TABLE public.learning_events FROM anon, authenticated;
GRANT ALL ON TABLE public.learning_events TO service_role;
