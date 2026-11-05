/**
 * SABI — Canonical Learning Event Contracts
 *
 * Contract version: 1
 *
 * Learning events are immutable facts. Trusted learning state (correctness,
 * mastery, confidence, coverage, readiness, XP and balances) is calculated by
 * backend services and must never be accepted from a client event payload.
 */

export const LEARNING_EVENT_SCHEMA_VERSION = 1 as const;

export const LEARNING_EVENT_TYPES = [
  "question_viewed",
  "answer_selected",
  "answer_submitted",
  "answer_changed",
  "explanation_opened",
  "explanation_completed",
  "question_skipped",
  "recovery_answer_submitted",
  "cbt_answer_submitted",
  "recommendation_created",
  "recommendation_presented",
  "recommendation_accepted",
  "recommendation_dismissed",
  "recommendation_completed",
  "session_completed",
] as const;

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

export type PracticeMode =
  | "diagnostic"
  | "smart"
  | "blitz"
  | "custom"
  | "cbt";

export type EventSource = "web" | "android" | "ios" | "system";

/**
 * Event-specific data only. Do not add derived learning state here.
 * The backend resolves correctness from the authoritative question version.
 */
export interface EventPayloadMap {
  question_viewed: {
    position?: number;
  };
  answer_selected: {
    optionId: string;
  };
  answer_submitted: {
    optionId: string;
  };
  answer_changed: {
    previousOptionId?: string;
    newOptionId: string;
  };
  explanation_opened: {
    explanationType?: "text" | "video" | "ai";
  };
  explanation_completed: {
    completionMethod?: "manual" | "reader" | "video";
  };
  question_skipped: {
    reason?: string;
  };
  recovery_answer_submitted: {
    optionId: string;
    recoverySequence?: number;
  };
  cbt_answer_submitted: {
    optionId: string;
    examSessionId: string;
    questionOrder: number;
  };
  recommendation_created: {
    recommendationId: string;
    actionType: string;
  };
  recommendation_presented: {
    recommendationId: string;
  };
  recommendation_accepted: {
    recommendationId: string;
  };
  recommendation_dismissed: {
    recommendationId: string;
    reason?: string;
  };
  recommendation_completed: {
    recommendationId: string;
  };
  session_completed: {
    completionReason:
      | "completed"
      | "student_submitted"
      | "time_expired"
      | "system_terminated";
  };
}

/**
 * Client-submitted event envelope.
 *
 * studentId, receivedAt and createdAt are deliberately absent:
 * authentication and persistence layers supply those values.
 */
export interface LearningEventInput<
  T extends LearningEventType = LearningEventType,
> {
  readonly eventId: string;
  readonly eventType: T;
  readonly schemaVersion: typeof LEARNING_EVENT_SCHEMA_VERSION;
  readonly occurredAt?: string;
  readonly sessionId?: string;
  readonly questionId?: string;
  readonly questionVersionId?: string;
  readonly subjectId?: string;
  readonly topicId?: string;
  readonly subtopicId?: string;
  readonly learningObjectiveId?: string;
  readonly mode?: PracticeMode;
  readonly source: EventSource;
  readonly payload: EventPayloadMap[T];
}

/** Event after the server has authenticated and enriched the input. */
export interface PersistedLearningEvent<
  T extends LearningEventType = LearningEventType,
> extends LearningEventInput<T> {
  readonly studentId: string;
  readonly receivedAt: string;
  readonly createdAt: string;
}

/**
 * Explicitly forbidden client-controlled fields.
 * These belong to trusted backend calculations or payment services.
 */
export const FORBIDDEN_CLIENT_EVENT_FIELDS = [
  "isCorrect",
  "correctAnswer",
  "masteryScore",
  "confidenceScore",
  "coverageScore",
  "readinessScore",
  "xpAwarded",
  "diamondBalance",
  "paymentVerified",
] as const;

export type ForbiddenClientEventField =
  (typeof FORBIDDEN_CLIENT_EVENT_FIELDS)[number];

/** Runtime guard for event-type checks at API boundaries. */
export function isLearningEventType(
  value: unknown,
): value is LearningEventType {
  return (
    typeof value === "string" &&
    (LEARNING_EVENT_TYPES as readonly string[]).includes(value)
  );
}
