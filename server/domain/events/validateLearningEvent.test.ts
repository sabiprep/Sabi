import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLearningEventInput } from "./validateLearningEvent";

function validAnswerEvent() {
  return {
    eventId: "evt_01HXYZ",
    eventType: "answer_submitted",
    schemaVersion: 1,
    occurredAt: "2026-11-05T12:00:00.000Z",
    sessionId: "session_123",
    questionId: "question_456",
    mode: "smart",
    source: "web",
    payload: {
      optionId: "B",
    },
  };
}

test("accepts a valid authenticated-client answer event", () => {
  const result = validateLearningEventInput(validAnswerEvent());
  assert.equal(result.success, true);
});

test("rejects derived correctness and mastery fields", () => {
  const event = validAnswerEvent() as Record<string, unknown>;
  event.isCorrect = true;
  const result = validateLearningEventInput(event);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((error) => error.includes("isCorrect")));
  }
});

test("rejects unknown fields in an event payload", () => {
  const event: Record<string, unknown> = validAnswerEvent();
  event.payload = { optionId: "B", masteryScore: 99 };
  const result = validateLearningEventInput(event);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((error) => error.includes("masteryScore")));
  }
});

test("rejects system as a client event source", () => {
  const event = { ...validAnswerEvent(), source: "system" };
  const result = validateLearningEventInput(event);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((error) => error.includes("source")));
  }
});

test("rejects backend-generated event types from clients", () => {
  const event = {
    eventId: "evt_backend_1",
    eventType: "recommendation_created",
    schemaVersion: 1,
    source: "web",
    payload: {
      recommendationId: "rec_123",
      actionType: "review_topic",
    },
  };
  const result = validateLearningEventInput(event);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((error) => error.includes("trusted backend")));
  }
});

test("rejects unknown event types and unsupported schema versions", () => {
  const event = {
    ...validAnswerEvent(),
    eventType: "client_awarded_xp",
    schemaVersion: 2,
  };
  const result = validateLearningEventInput(event);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((error) => error.includes("eventType")));
    assert.ok(result.errors.some((error) => error.includes("schemaVersion")));
  }
});

test("requires a session and question reference for question-scoped events", () => {
  const event: Record<string, unknown> = validAnswerEvent();
  delete event.sessionId;
  delete event.questionId;
  const result = validateLearningEventInput(event);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((error) => error.includes("sessionId is required")));
    assert.ok(result.errors.some((error) => error.includes("questionId is required")));
  }
});
