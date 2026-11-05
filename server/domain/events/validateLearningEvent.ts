import {
  FORBIDDEN_CLIENT_EVENT_FIELDS,
  LEARNING_EVENT_SCHEMA_VERSION,
  isLearningEventType,
  type EventPayloadMap,
  type LearningEventInput,
} from "./eventTypes";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

const ROOT_KEYS = new Set([
  "eventId",
  "eventType",
  "schemaVersion",
  "occurredAt",
  "sessionId",
  "questionId",
  "questionVersionId",
  "subjectId",
  "topicId",
  "subtopicId",
  "learningObjectiveId",
  "mode",
  "source",
  "payload",
]);

const MODES = new Set(["diagnostic", "smart", "blitz", "custom", "cbt"]);
const CLIENT_SOURCES = new Set(["web", "android", "ios"]);
const SERVER_GENERATED_EVENT_TYPES = new Set([
  "recommendation_created",
  "recommendation_completed",
  "session_completed",
]);
const FORBIDDEN = new Set<string>(FORBIDDEN_CLIENT_EVENT_FIELDS);

const PAYLOAD_KEYS: Record<keyof EventPayloadMap, readonly string[]> = {
  question_viewed: ["position"],
  answer_selected: ["optionId"],
  answer_submitted: ["optionId"],
  answer_changed: ["previousOptionId", "newOptionId"],
  explanation_opened: ["explanationType"],
  explanation_completed: ["completionMethod"],
  question_skipped: ["reason"],
  recovery_answer_submitted: ["optionId", "recoverySequence"],
  cbt_answer_submitted: ["optionId", "examSessionId", "questionOrder"],
  recommendation_created: ["recommendationId", "actionType"],
  recommendation_presented: ["recommendationId"],
  recommendation_accepted: ["recommendationId"],
  recommendation_dismissed: ["recommendationId", "reason"],
  recommendation_completed: ["recommendationId"],
  session_completed: ["completionReason"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.has(key)) {
      errors.push(`${path}.${key} is server-controlled and is not accepted.`);
    } else if (!allowed.includes(key)) {
      errors.push(`${path}.${key} is not an allowed field.`);
    }
  }
}

function validatePayload(
  eventType: keyof EventPayloadMap,
  value: unknown,
  errors: string[],
): boolean {
  if (!isRecord(value)) {
    errors.push("payload must be an object.");
    return false;
  }

  hasOnlyKeys(value, PAYLOAD_KEYS[eventType], "payload", errors);

  const requiredString = (key: string, max = 200) => {
    if (!isNonEmptyString(value[key], max)) {
      errors.push(`payload.${key} must be a non-empty string (max ${max} characters).`);
    }
  };
  const optionalString = (key: string, max = 200) => {
    if (value[key] !== undefined && !isNonEmptyString(value[key], max)) {
      errors.push(`payload.${key} must be a non-empty string (max ${max} characters).`);
    }
  };

  switch (eventType) {
    case "question_viewed":
      if (value.position !== undefined &&
          (!Number.isInteger(value.position) || (value.position as number) < 0)) {
        errors.push("payload.position must be a non-negative integer.");
      }
      break;
    case "answer_selected":
    case "answer_submitted":
      requiredString("optionId", 80);
      break;
    case "answer_changed":
      optionalString("previousOptionId", 80);
      requiredString("newOptionId", 80);
      break;
    case "explanation_opened":
      if (value.explanationType !== undefined &&
          !(["text", "video", "ai"] as readonly string[]).includes(String(value.explanationType))) {
        errors.push("payload.explanationType must be text, video, or ai.");
      }
      break;
    case "explanation_completed":
      if (value.completionMethod !== undefined &&
          !(["manual", "reader", "video"] as readonly string[]).includes(String(value.completionMethod))) {
        errors.push("payload.completionMethod must be manual, reader, or video.");
      }
      break;
    case "question_skipped":
      optionalString("reason", 500);
      break;
    case "recovery_answer_submitted":
      requiredString("optionId", 80);
      if (value.recoverySequence !== undefined &&
          (!Number.isInteger(value.recoverySequence) || (value.recoverySequence as number) < 0)) {
        errors.push("payload.recoverySequence must be a non-negative integer.");
      }
      break;
    case "cbt_answer_submitted":
      requiredString("optionId", 80);
      requiredString("examSessionId", 128);
      if (!Number.isInteger(value.questionOrder) || (value.questionOrder as number) < 1) {
        errors.push("payload.questionOrder must be a positive integer.");
      }
      break;
    case "recommendation_created":
      requiredString("recommendationId", 128);
      requiredString("actionType", 100);
      break;
    case "recommendation_presented":
    case "recommendation_accepted":
    case "recommendation_completed":
      requiredString("recommendationId", 128);
      break;
    case "recommendation_dismissed":
      requiredString("recommendationId", 128);
      optionalString("reason", 500);
      break;
    case "session_completed":
      if (!(["completed", "student_submitted", "time_expired", "system_terminated"] as readonly string[])
        .includes(String(value.completionReason))) {
        errors.push("payload.completionReason is invalid.");
      }
      break;
  }

  return errors.length === 0;
}

/**
 * Strictly validates untrusted JSON from an authenticated client.
 * Unknown keys are rejected to prevent accidental acceptance of derived state.
 */
export function validateLearningEventInput(
  value: unknown,
): ValidationResult<LearningEventInput> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { success: false, errors: ["Event body must be a JSON object."] };
  }

  hasOnlyKeys(value, [...ROOT_KEYS], "event", errors);

  if (!isNonEmptyString(value.eventId, 128)) {
    errors.push("eventId must be a non-empty string (max 128 characters).");
  }
  if (!isLearningEventType(value.eventType)) {
    errors.push("eventType is not a supported learning event.");
  }
  if (value.schemaVersion !== LEARNING_EVENT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${LEARNING_EVENT_SCHEMA_VERSION}.`);
  }
  if (value.occurredAt !== undefined &&
      (typeof value.occurredAt !== "string" ||
       !Number.isFinite(Date.parse(value.occurredAt)))) {
    errors.push("occurredAt must be a valid ISO-compatible date string.");
  }

  for (const key of [
    "sessionId",
    "questionId",
    "questionVersionId",
    "subjectId",
    "topicId",
    "subtopicId",
    "learningObjectiveId",
  ]) {
    if (value[key] !== undefined && !isNonEmptyString(value[key], 128)) {
      errors.push(`${key} must be a non-empty string (max 128 characters).`);
    }
  }

  if (value.mode !== undefined &&
      (typeof value.mode !== "string" || !MODES.has(value.mode))) {
    errors.push("mode is not a supported practice mode.");
  }
  if (typeof value.source !== "string" || !CLIENT_SOURCES.has(value.source)) {
    errors.push("source must be web, android, or ios; system events are server-only.");
  }

  if (isLearningEventType(value.eventType)) {
    if (SERVER_GENERATED_EVENT_TYPES.has(value.eventType)) {
      errors.push("This event type must be generated by a trusted backend service.");
    }
    validatePayload(value.eventType, value.payload, errors);
  } else if (value.payload !== undefined && !isRecord(value.payload)) {
    errors.push("payload must be an object.");
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: value as unknown as LearningEventInput,
  };
}
