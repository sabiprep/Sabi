import express, { type Request, type Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLearningEventInput } from "../domain/events/validateLearningEvent";

interface LearningEventsRouterOptions {
  supabase: SupabaseClient;
  persistenceEnabled: boolean;
}

const COMPARISON_FIELDS = [
  "event_type",
  "schema_version",
  "occurred_at",
  "session_id",
  "question_id",
  "question_version_id",
  "subject_id",
  "topic_id",
  "subtopic_id",
  "learning_objective_id",
  "mode",
  "source",
  "payload",
] as const;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function normalizedTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function sameEvent(existing: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  return COMPARISON_FIELDS.every((field) => {
    const left = field === "occurred_at"
      ? normalizedTimestamp(existing[field])
      : (existing[field] ?? null);
    const right = field === "occurred_at"
      ? normalizedTimestamp(incoming[field])
      : (incoming[field] ?? null);
    return stableJson(left) === stableJson(right);
  });
}

export function createLearningEventsRouter({
  supabase,
  persistenceEnabled,
}: LearningEventsRouterOptions): express.Router {
  const router = express.Router();

  router.post("/", async (req: Request, res: Response) => {
    const authorization = req.header("authorization") ?? "";
    const tokenMatch = authorization.match(/^Bearer\s+([^\s]+)$/i);

    if (!tokenMatch) {
      return res.status(401).json({ error: "A valid Bearer access token is required." });
    }

    let authenticatedUserId: string;
    try {
      const { data, error } = await supabase.auth.getUser(tokenMatch[1]);
      if (error || !data.user?.id) {
        return res.status(401).json({ error: "The access token is invalid or expired." });
      }
      authenticatedUserId = data.user.id;
    } catch {
      return res.status(503).json({ error: "Authentication service is temporarily unavailable." });
    }

    if (!persistenceEnabled) {
      return res.status(503).json({
        error: "Learning-event storage is not configured. Server-side Supabase service credentials are required.",
      });
    }

    const validation = validateLearningEventInput(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Learning event validation failed.",
        details: validation.errors,
      });
    }

    const input = validation.data;
    const row = {
      event_id: input.eventId,
      student_id: authenticatedUserId,
      event_type: input.eventType,
      schema_version: input.schemaVersion,
      occurred_at: input.occurredAt ?? null,
      session_id: input.sessionId ?? null,
      question_id: input.questionId ?? null,
      question_version_id: input.questionVersionId ?? null,
      subject_id: input.subjectId ?? null,
      topic_id: input.topicId ?? null,
      subtopic_id: input.subtopicId ?? null,
      learning_objective_id: input.learningObjectiveId ?? null,
      mode: input.mode ?? null,
      source: input.source,
      payload: input.payload,
    };

    try {
      const { data, error } = await supabase
        .from("learning_events")
        .insert(row)
        .select("id, event_id, received_at")
        .single();

      if (!error && data) {
        return res.status(201).json({
          status: "stored",
          eventId: data.event_id,
          receivedAt: data.received_at,
        });
      }

      // A repeated eventId is idempotent only when its original content matches.
      if (error?.code === "23505") {
        const { data: existing, error: lookupError } = await supabase
          .from("learning_events")
          .select("*")
          .eq("student_id", authenticatedUserId)
          .eq("event_id", input.eventId)
          .maybeSingle();

        if (lookupError || !existing) {
          return res.status(500).json({ error: "Could not verify the existing learning event." });
        }
        if (!sameEvent(existing as Record<string, unknown>, row)) {
          return res.status(409).json({
            error: "eventId has already been used with different event content.",
          });
        }
        return res.status(200).json({
          status: "duplicate",
          eventId: input.eventId,
          receivedAt: existing.received_at,
        });
      }

      // Do not expose database internals or claim success if persistence failed.
      return res.status(500).json({ error: "Learning event could not be stored." });
    } catch {
      return res.status(500).json({ error: "Learning event could not be stored." });
    }
  });

  return router;
}
